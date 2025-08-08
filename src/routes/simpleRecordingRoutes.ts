import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../utils/prisma';
import { validate } from '../utils/validators';
import Joi from 'joi';
import { MappingStatus } from '@prisma/client';

const router = Router();

interface SubtaskTiming {
  subtaskId: string;
  startedAt?: string | null;
  completedAt?: string | null;
  duration?: number | null;
  orderStarted?: number | null;
  orderCompleted?: number | null;
}

// Validation schema for task recording
const taskRecordingSchema = Joi.object({
  taskAssignmentId: Joi.string().required(),
  mappingSessionId: Joi.string().required(),
  iterationNumber: Joi.number().integer().min(1).required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  completedSubtasks: Joi.array().items(Joi.string()).required(),
  cameraCount: Joi.number().integer().min(1).required(),
  // Optional metadata fields
  subtaskTimings: Joi.array().items(Joi.object({
    subtaskId: Joi.string().required(),
    startedAt: Joi.date().iso().allow(null).optional(),
    completedAt: Joi.date().iso().allow(null).optional(),
    duration: Joi.number().integer().min(0).allow(null).optional(),
    orderStarted: Joi.number().integer().min(1).allow(null).optional(),
    orderCompleted: Joi.number().integer().min(1).allow(null).optional()
  })).optional(),
  events: Joi.array().items(Joi.object({
    timestamp: Joi.date().iso().required(),
    eventType: Joi.string().required(),
    subtaskId: Joi.string().allow(null).optional(),
    cameraSerial: Joi.string().allow(null).optional(),
    data: Joi.object().required(),
    elapsed: Joi.number().integer().min(0).required()
  })).optional()
});

/**
 * Simple endpoint to save task recording data
 * Receives all data at once after recording is complete
 */
router.post('/task-recordings', requireAuth, validate(taskRecordingSchema), async (req: AuthRequest, res: Response, next): Promise<any> => {
  try {
    const {
      taskAssignmentId,
      mappingSessionId,
      iterationNumber,
      startTime,
      endTime,
      completedSubtasks,
      cameraCount
    } = req.body;

    const userId = req.user!.id;

    // Validate mapping session
    const mappingSession = await prisma.mappingSession.findFirst({
      where: {
        id: mappingSessionId,
        createdBy: userId,
        status: MappingStatus.completed,
        expiresAt: { gt: new Date() }
      }
    });

    if (!mappingSession) {
      return res.status(400).json({ 
        error: 'Valid mapping session required. Please complete environment mapping first.',
        details: 'Mapping must be completed and not expired'
      });
    }

    // Verify assignment belongs to user
    const assignment = await prisma.taskAssignment.findFirst({
      where: {
        id: taskAssignmentId,
        assignedTo: userId,
      },
      include: {
        task: {
          include: {
            subtasks: true,
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Validate that the iteration number is within range
    if (iterationNumber > assignment.task.requiredIterations) {
      return res.status(400).json({ 
        error: `Invalid iteration number. Task requires ${assignment.task.requiredIterations} iterations.` 
      });
    }

    // Validate that completed subtasks belong to this task
    const validSubtaskIds = assignment.task.subtasks.map(s => s.id);
    const invalidSubtasks = completedSubtasks.filter((id: string) => !validSubtaskIds.includes(id));
    
    if (invalidSubtasks.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid subtask IDs provided',
        invalidIds: invalidSubtasks 
      });
    }

    // Check if iteration already exists
    const existingSessions = await prisma.recordingSession.findMany({
      where: {
        taskAssignmentId,
        iterationNumber,
        sessionType: 'task',
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    // If there's a completed session for this iteration, reject
    const hasCompletedSession = existingSessions.some(s => s.status === 'completed');
    if (hasCompletedSession) {
      return res.status(409).json({ 
        error: `Iteration ${iterationNumber} has already been completed successfully` 
      });
    }

    // If there are failed attempts, log this as a retry
    const failedAttempts = existingSessions.filter(s => s.status === 'failed').length;
    if (failedAttempts > 0) {
      console.log(`Recording retry for iteration ${iterationNumber} (${failedAttempts} previous failed attempts)`);
    }

    // Determine session status based on completed subtasks
    const isComplete = completedSubtasks.length === assignment.task.subtasks.length;
    const status = isComplete ? 'completed' : 'failed';
    
    // Warn if marking as complete with no subtasks
    if (completedSubtasks.length === 0) {
      console.warn(`Recording session for iteration ${iterationNumber} has 0 completed subtasks`);
    }
    
    // Create recording session
    const session = await prisma.recordingSession.create({
      data: {
        taskAssignmentId,
        mappingSessionId,
        sessionType: 'task',
        status,
        cameraCount,
        iterationNumber,
        startedAt: new Date(startTime),
        completedAt: new Date(endTime),
        metadata: {
          completedSubtasks,
          duration: new Date(endTime).getTime() - new Date(startTime).getTime(),
          attemptNumber: failedAttempts + 1,
          totalSubtasks: assignment.task.subtasks.length,
        },
      },
    });

    // Create subtask records with timing data
    const subtaskTimingsMap = new Map<string, SubtaskTiming>(
      req.body.subtaskTimings?.map((t: SubtaskTiming) => [t.subtaskId, t]) || []
    );
    
    for (const subtaskId of completedSubtasks) {
      const timing = subtaskTimingsMap.get(subtaskId);
      
      await prisma.subtaskRecord.create({
        data: {
          sessionId: session.id,
          subtaskId,
          iterationNumber,
          startedAt: timing?.startedAt ? new Date(timing.startedAt) : null,
          completedAt: timing?.completedAt ? new Date(timing.completedAt) : new Date(endTime),
          duration: timing?.duration || null,
          orderStarted: timing?.orderStarted || null,
          orderCompleted: timing?.orderCompleted || null,
        },
      });
    }
    
    // Create session events if provided
    if (req.body.events && req.body.events.length > 0) {
      const eventData = req.body.events.map((event: any) => ({
        sessionId: session.id,
        timestamp: new Date(event.timestamp),
        eventType: event.eventType,
        subtaskId: event.subtaskId || null,
        cameraSerial: event.cameraSerial || null,
        data: event.data,
        elapsed: event.elapsed,
      }));
      
      await prisma.sessionEvent.createMany({
        data: eventData,
      });
    }

    // Check if all iterations are complete
    // Count successful sessions (where all subtasks were completed)
    const successfulIterations = await prisma.recordingSession.count({
      where: {
        taskAssignmentId: assignment.id,
        sessionType: 'task',
        status: 'completed',
      },
    });

    // Update assignment if all required iterations are complete
    if (successfulIterations >= assignment.task.requiredIterations) {
      await prisma.taskAssignment.update({
        where: { id: assignment.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
    }

    res.json({
      success: true,
      sessionId: session.id,
      status,
      message: isComplete ? 'Recording saved successfully' : 'Incomplete recording saved',
      completedSubtasks: completedSubtasks.length,
      totalSubtasks: assignment.task.subtasks.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;