import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../utils/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * Get subtask analytics for a recording session
 */
router.get('/sessions/:sessionId/analytics', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;
  
  // Verify session exists and user has access
  const session = await prisma.recordingSession.findUnique({
    where: { id: sessionId },
    include: {
      assignment: {
        select: {
          assignedTo: true,
          task: {
            select: {
              title: true,
              subtasks: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  // Check authorization
  if (req.user!.role !== 'admin' && session.assignment.assignedTo !== req.user!.id) {
    throw new AppError('Not authorized to view this session', 403);
  }

  // Get subtask records with timing data
  const subtaskRecords = await prisma.subtaskRecord.findMany({
    where: { sessionId },
    include: {
      subtask: {
        select: {
          id: true,
          title: true,
          orderIndex: true,
        },
      },
    },
    orderBy: {
      orderStarted: 'asc',
    },
  });

  // Calculate analytics
  const completedSubtasks = subtaskRecords.filter(r => r.completedAt !== null);
  const durations = completedSubtasks
    .filter(r => r.duration !== null)
    .map(r => r.duration!);

  const analytics = {
    session: {
      id: session.id,
      taskTitle: session.assignment.task.title,
      iterationNumber: session.iterationNumber,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      duration: session.completedAt 
        ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
        : null,
    },
    subtasks: {
      total: session.assignment.task.subtasks.length,
      completed: completedSubtasks.length,
      averageDuration: durations.length > 0 
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null,
      minDuration: durations.length > 0 ? Math.min(...durations) : null,
      maxDuration: durations.length > 0 ? Math.max(...durations) : null,
    },
    details: subtaskRecords.map(record => ({
      subtaskId: record.subtaskId,
      subtaskTitle: record.subtask.title,
      intendedOrder: record.subtask.orderIndex,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      duration: record.duration,
      durationSeconds: record.duration ? record.duration / 1000 : null,
      orderStarted: record.orderStarted,
      orderCompleted: record.orderCompleted,
    })),
  };

  res.json(analytics);
}));

/**
 * Get timeline of events for a recording session
 */
router.get('/sessions/:sessionId/timeline', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;
  
  // Verify session exists and user has access
  const session = await prisma.recordingSession.findUnique({
    where: { id: sessionId },
    include: {
      assignment: {
        select: {
          assignedTo: true,
        },
      },
    },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  // Check authorization
  if (req.user!.role !== 'admin' && session.assignment.assignedTo !== req.user!.id) {
    throw new AppError('Not authorized to view this session', 403);
  }

  // Get all events for the session
  const events = await prisma.sessionEvent.findMany({
    where: { sessionId },
    orderBy: {
      timestamp: 'asc',
    },
  });

  // Format timeline
  const timeline = events.map(event => ({
    id: event.id,
    timestamp: event.timestamp,
    elapsed: event.elapsed,
    elapsedSeconds: event.elapsed / 1000,
    eventType: event.eventType,
    subtaskId: event.subtaskId,
    cameraSerial: event.cameraSerial,
    data: event.data,
    description: getEventDescription(event),
  }));

  res.json({
    sessionId,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    totalEvents: timeline.length,
    timeline,
  });
}));

/**
 * Get aggregated analytics across multiple sessions
 */
router.get('/assignments/:assignmentId/analytics', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { assignmentId } = req.params;
  
  // Verify assignment exists and user has access
  const assignment = await prisma.taskAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      task: {
        include: {
          subtasks: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new AppError('Assignment not found', 404);
  }

  // Check authorization
  if (req.user!.role !== 'admin' && assignment.assignedTo !== req.user!.id) {
    throw new AppError('Not authorized to view this assignment', 403);
  }

  // Get all completed sessions for this assignment
  const sessions = await prisma.recordingSession.findMany({
    where: {
      taskAssignmentId: assignmentId,
      status: 'completed',
    },
    include: {
      subtaskRecords: {
        include: {
          subtask: true,
        },
      },
    },
    orderBy: {
      iterationNumber: 'asc',
    },
  });

  // Aggregate subtask performance across iterations
  const subtaskPerformance = new Map<string, {
    subtaskId: string;
    title: string;
    completions: number;
    totalDuration: number;
    minDuration: number;
    maxDuration: number;
    durations: number[];
  }>();

  for (const session of sessions) {
    for (const record of session.subtaskRecords) {
      if (record.completedAt && record.duration) {
        const key = record.subtaskId;
        const existing = subtaskPerformance.get(key);
        
        if (existing) {
          existing.completions++;
          existing.totalDuration += record.duration;
          existing.minDuration = Math.min(existing.minDuration, record.duration);
          existing.maxDuration = Math.max(existing.maxDuration, record.duration);
          existing.durations.push(record.duration);
        } else {
          subtaskPerformance.set(key, {
            subtaskId: record.subtaskId,
            title: record.subtask.title,
            completions: 1,
            totalDuration: record.duration,
            minDuration: record.duration,
            maxDuration: record.duration,
            durations: [record.duration],
          });
        }
      }
    }
  }

  // Calculate overall statistics
  const subtaskStats = Array.from(subtaskPerformance.values()).map(stats => ({
    subtaskId: stats.subtaskId,
    title: stats.title,
    completions: stats.completions,
    averageDuration: Math.round(stats.totalDuration / stats.completions),
    averageDurationSeconds: Math.round(stats.totalDuration / stats.completions / 1000),
    minDuration: stats.minDuration,
    maxDuration: stats.maxDuration,
    standardDeviation: calculateStandardDeviation(stats.durations),
  }));

  res.json({
    assignment: {
      id: assignment.id,
      taskTitle: assignment.task.title,
      requiredIterations: assignment.task.requiredIterations,
      completedIterations: sessions.length,
    },
    subtaskPerformance: subtaskStats,
    sessionDetails: sessions.map(session => ({
      sessionId: session.id,
      iterationNumber: session.iterationNumber,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      duration: session.completedAt 
        ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
        : null,
      completedSubtasks: session.subtaskRecords.filter(r => r.completedAt !== null).length,
      totalSubtasks: assignment.task.subtasks.length,
    })),
  });
}));

// Helper functions
function getEventDescription(event: any): string {
  const data = event.data as any;
  
  switch (event.eventType) {
    case 'subtask_started':
      return `Started subtask: ${data.subtaskTitle || 'Unknown'}`;
    case 'subtask_completed':
      return `Completed subtask: ${data.subtaskTitle || 'Unknown'} (${Math.round((data.duration || 0) / 1000)}s)`;
    case 'camera_disconnected':
      return `Camera disconnected: ${event.cameraSerial || 'Unknown'}`;
    case 'camera_reconnected':
      return `Camera reconnected: ${event.cameraSerial || 'Unknown'}`;
    case 'battery_warning':
      return `Battery warning on ${event.cameraSerial || 'camera'}: ${data.batteryLevel}%`;
    case 'storage_warning':
      return `Storage warning on ${event.cameraSerial || 'camera'}: ${data.remainingMB}MB remaining`;
    case 'custom':
      return data.action || 'Custom event';
    default:
      return event.eventType;
  }
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDifferences = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDifferences.reduce((a, b) => a + b, 0) / values.length;
  
  return Math.round(Math.sqrt(variance));
}

export default router;