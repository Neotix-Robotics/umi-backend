import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authMiddleware';
import { taskService } from '../services/taskService';
import { Prisma } from '@prisma/client';



export const getAssignmentProgress = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  const progress = await taskService.getTaskProgress(id);
  
  res.json(progress);
});

export const getAssignmentSessions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  
  // Check if assignment exists and user has permission
  const assignment = await prisma.taskAssignment.findUnique({
    where: { id },
    include: {
      task: true,
    },
  });
  
  if (!assignment) {
    throw new AppError('Assignment not found', 404);
  }
  
  // Only the assigned user or an admin can view sessions
  if (req.user.role !== 'admin' && assignment.assignedTo !== req.user.id) {
    throw new AppError('Not authorized to view this assignment', 403);
  }
  
  // Get sessions with subtask records
  const sessions = await prisma.recordingSession.findMany({
    where: { taskAssignmentId: id },
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
  
  res.json({
    assignment: {
      id: assignment.id,
      taskId: assignment.task.id,
      taskTitle: assignment.task.title,
    },
    sessions,
  });
});

// Get all assignments (filtered by role)
export const getAssignments = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  let whereClause: Prisma.TaskAssignmentWhereInput = {};

  if (req.user.role === 'collector') {
    // Collectors only see their own assignments
    whereClause.assignedTo = req.user.id;
  }
  // Admins see all assignments (no filter needed)

  // Add status filter if provided
  const { status } = req.query;
  if (status && ['pending', 'in_progress', 'completed'].includes(status as string)) {
    whereClause.status = status as 'pending' | 'in_progress' | 'completed';
  }

  const assignments = await prisma.taskAssignment.findMany({
    where: whereClause,
    include: {
      task: {
        select: {
          id: true,
          title: true,
          description: true,
          demoVideoUrl: true,
          requiredIterations: true,
          subtasks: {
            orderBy: {
              orderIndex: 'asc',
            },
          },
        },
      },
      assignedUser: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      assignerUser: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      sessions: {
        where: {
          sessionType: 'task',
          status: 'completed', // Only count successful completions
        },
        select: {
          id: true,
          iterationNumber: true,
        },
      },
    },
    orderBy: {
      assignedAt: 'desc',
    },
  });

  // Calculate progress for each assignment
  const assignmentsWithProgress = assignments.map(assignment => {
    const totalIterations = assignment.task.requiredIterations;
    // Count unique iteration numbers that were completed successfully
    const completedIterationNumbers = new Set(assignment.sessions.map((s: any) => s.iterationNumber));
    const completedIterations = completedIterationNumbers.size;

    const { sessions, ...assignmentWithoutSessions } = assignment;
    
    return {
      ...assignmentWithoutSessions,
      progress: {
        completedIterations,
        totalIterations,
        totalSubtasks: assignment.task.subtasks.length,
      },
    };
  });

  res.json(assignmentsWithProgress);
});

// Get single assignment by ID
export const getAssignment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const assignment = await prisma.taskAssignment.findUnique({
    where: { id },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          description: true,
          demoVideoUrl: true,
          requiredIterations: true,
          subtasks: {
            orderBy: {
              orderIndex: 'asc',
            },
          },
        },
      },
      assignedUser: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      sessions: {
        where: {
          sessionType: 'task',
          status: 'completed',
        },
        select: {
          id: true,
          iterationNumber: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new AppError('Assignment not found', 404);
  }

  // Check authorization: only assigned user or admin can view
  if (req.user.role !== 'admin' && assignment.assignedTo !== req.user.id) {
    throw new AppError('Not authorized to view this assignment', 403);
  }

  // Calculate progress
  const totalIterations = assignment.task.requiredIterations;
  // Count unique iteration numbers that were completed successfully
  const completedIterationNumbers = new Set(assignment.sessions.map((s: any) => s.iterationNumber));
  const completedIterations = completedIterationNumbers.size;
  const totalSubtasks = assignment.task.subtasks.length;

  const { sessions, ...assignmentWithoutSessions } = assignment;

  res.json({
    ...assignmentWithoutSessions,
    progress: {
      completedIterations,
      totalIterations,
      totalSubtasks,
    },
  });
});

// Update assignment status
export const updateAssignmentStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Check if assignment exists and user has permission
  const assignment = await prisma.taskAssignment.findUnique({
    where: { id },
  });

  if (!assignment) {
    throw new AppError('Assignment not found', 404);
  }

  // Only the assigned user or an admin can update the status
  if (req.user.role !== 'admin' && assignment.assignedTo !== req.user.id) {
    throw new AppError('Not authorized to update this assignment', 403);
  }

  // Validate status transition
  if (assignment.status === 'completed' && status !== 'completed') {
    throw new AppError('Cannot change status of completed assignment', 400);
  }

  const updateData: any = { status };
  
  if (status === 'completed') {
    updateData.completedAt = new Date();
  }

  const updatedAssignment = await prisma.taskAssignment.update({
    where: { id },
    data: updateData,
    include: {
      task: {
        select: {
          id: true,
          title: true,
        },
      },
      assignedUser: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
  });

  res.json(updatedAssignment);
});