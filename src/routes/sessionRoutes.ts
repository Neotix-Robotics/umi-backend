import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';

const router = Router();

// Get all sessions for the current user with metadata and timeline
router.get('/sessions', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  
  // Get all sessions for tasks assigned to this user
  const sessions = await prisma.recordingSession.findMany({
    where: {
      assignment: {
        assignedTo: userId,
      },
    },
    include: {
      assignment: {
        include: {
          task: {
            include: {
              subtasks: true,
            },
          },
        },
      },
      subtaskRecords: {
        include: {
          subtask: true,
        },
        orderBy: {
          startedAt: 'asc',
        },
      },
      sessionEvents: {
        orderBy: {
          timestamp: 'asc',
        },
      },
    },
    orderBy: {
      startedAt: 'desc',
    },
  });

  // Transform the data for the frontend
  const transformedSessions = sessions.map(session => {
    const duration = session.completedAt && session.startedAt 
      ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
      : null;

    // Group events by type for easier display
    const eventsByType = session.sessionEvents.reduce((acc, event) => {
      if (!acc[event.eventType]) {
        acc[event.eventType] = [];
      }
      acc[event.eventType].push(event);
      return acc;
    }, {} as Record<string, typeof session.sessionEvents>);

    // Calculate subtask completion rate
    const completedSubtasks = session.subtaskRecords.filter(sr => sr.completedAt).length;
    const totalSubtasks = session.assignment.task.subtasks.length;
    const completionRate = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

    return {
      id: session.id,
      taskTitle: session.assignment.task.title,
      taskId: session.assignment.taskId,
      assignmentId: session.assignment.id,
      iterationNumber: session.iterationNumber,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      duration,
      cameraCount: session.cameraCount,
      metadata: session.metadata,
      completionRate: Math.round(completionRate),
      subtasks: {
        completed: completedSubtasks,
        total: totalSubtasks,
        records: session.subtaskRecords.map(sr => ({
          id: sr.id,
          subtaskId: sr.subtaskId,
          title: sr.subtask.title,
          startedAt: sr.startedAt,
          completedAt: sr.completedAt,
          duration: sr.duration,
          orderStarted: sr.orderStarted,
          orderCompleted: sr.orderCompleted,
        })),
      },
      events: {
        total: session.sessionEvents.length,
        byType: Object.entries(eventsByType).map(([type, events]) => ({
          type,
          count: events.length,
        })),
        timeline: session.sessionEvents.slice(0, 10).map(event => ({
          id: event.id,
          timestamp: event.timestamp,
          eventType: event.eventType,
          data: event.data,
          elapsed: event.elapsed,
          cameraSerial: event.cameraSerial,
          subtaskId: event.subtaskId,
        })),
      },
    };
  });

  res.json(transformedSessions);
}));

// Get detailed session with full timeline
router.get('/sessions/:sessionId', requireAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<any> => {
  const { sessionId } = req.params;
  const userId = req.user!.id;
  
  const session = await prisma.recordingSession.findFirst({
    where: {
      id: sessionId,
      assignment: {
        assignedTo: userId,
      },
    },
    include: {
      assignment: {
        include: {
          task: {
            include: {
              subtasks: true,
            },
          },
        },
      },
      subtaskRecords: {
        include: {
          subtask: true,
        },
        orderBy: {
          startedAt: 'asc',
        },
      },
      sessionEvents: {
        orderBy: {
          timestamp: 'asc',
        },
      },
    },
  });

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Build complete timeline including subtask events
  const timeline = [];
  
  // Add session start
  if (session.startedAt) {
    timeline.push({
      timestamp: session.startedAt,
      type: 'session_start',
      title: 'Recording Started',
      description: `Started iteration ${session.iterationNumber} of ${session.assignment.task.title}`,
      elapsed: 0,
    });
  }

  // Add events from sessionEvents
  session.sessionEvents.forEach(event => {
    timeline.push({
      timestamp: event.timestamp,
      type: event.eventType,
      title: event.eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: event.data,
      elapsed: event.elapsed,
      cameraSerial: event.cameraSerial,
      subtaskId: event.subtaskId,
    });
  });

  // Add subtask events if not already in sessionEvents
  session.subtaskRecords.forEach(sr => {
    if (sr.startedAt) {
      const startExists = session.sessionEvents.some(e => 
        e.eventType === 'subtask_started' && e.subtaskId === sr.subtaskId
      );
      if (!startExists) {
        const elapsed = new Date(sr.startedAt).getTime() - new Date(session.startedAt!).getTime();
        timeline.push({
          timestamp: sr.startedAt,
          type: 'subtask_started',
          title: 'Subtask Started',
          description: sr.subtask.title,
          elapsed,
          subtaskId: sr.subtaskId,
        });
      }
    }
    
    if (sr.completedAt) {
      const completeExists = session.sessionEvents.some(e => 
        e.eventType === 'subtask_completed' && e.subtaskId === sr.subtaskId
      );
      if (!completeExists) {
        const elapsed = new Date(sr.completedAt).getTime() - new Date(session.startedAt!).getTime();
        timeline.push({
          timestamp: sr.completedAt,
          type: 'subtask_completed',
          title: 'Subtask Completed',
          description: sr.subtask.title,
          elapsed,
          subtaskId: sr.subtaskId,
          duration: sr.duration,
        });
      }
    }
  });

  // Add session end
  if (session.completedAt) {
    timeline.push({
      timestamp: session.completedAt,
      type: 'session_end',
      title: session.status === 'completed' ? 'Recording Completed' : 'Recording Stopped',
      description: `${session.status === 'completed' ? 'Successfully completed' : 'Stopped before completion'}`,
      elapsed: new Date(session.completedAt).getTime() - new Date(session.startedAt!).getTime(),
    });
  }

  // Sort timeline by timestamp
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({
    ...session,
    timeline,
  });
}));

// Delete a session
router.delete('/sessions/:sessionId', requireAuth, asyncHandler(async (req: AuthRequest, res: Response): Promise<any> => {
  const { sessionId } = req.params;
  const userId = req.user!.id;
  
  // Verify ownership
  const session = await prisma.recordingSession.findFirst({
    where: {
      id: sessionId,
      assignment: {
        assignedTo: userId,
      },
    },
  });

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Delete session (cascades to subtaskRecords and sessionEvents)
  await prisma.recordingSession.delete({
    where: { id: sessionId },
  });

  res.json({ message: 'Session deleted successfully' });
}));

export default router;