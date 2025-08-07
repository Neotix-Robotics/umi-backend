import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { Task, Subtask, TaskAssignment, Prisma } from '@prisma/client';

type TaskWithSubtasks = Task & {
  subtasks: Subtask[];
};

type TaskCreateInput = {
  title: string;
  description?: string;
  demoVideoUrl?: string;
  requiredIterations: number;
  requiredCameras: number;
  createdBy: string;
};

type SubtaskCreateInput = {
  title: string;
  description?: string;
  orderIndex?: number;
};

export class TaskService {
  async createTask(
    input: TaskCreateInput,
    subtasks: SubtaskCreateInput[]
  ): Promise<TaskWithSubtasks> {
    return prisma.$transaction(async (tx) => {
      // Create task
      const task = await tx.task.create({
        data: {
          title: input.title,
          description: input.description,
          demoVideoUrl: input.demoVideoUrl,
          requiredIterations: input.requiredIterations,
          requiredCameras: input.requiredCameras,
          createdBy: input.createdBy,
        },
      });

      // Create subtasks
      const subtasksData = subtasks.map((subtask, index) => ({
        taskId: task.id,
        title: subtask.title,
        description: subtask.description,
        orderIndex: subtask.orderIndex ?? index,
      }));

      await tx.subtask.createMany({
        data: subtasksData,
      });

      // Fetch the complete task with subtasks
      return tx.task.findUniqueOrThrow({
        where: { id: task.id },
        include: {
          subtasks: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
    });
  }

  async updateTask(
    id: string,
    input: Partial<Omit<TaskCreateInput, 'createdBy'>>
  ): Promise<Task> {
    try {
      return await prisma.task.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description,
          demoVideoUrl: input.demoVideoUrl,
          requiredIterations: input.requiredIterations,
          requiredCameras: input.requiredCameras,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new AppError('Task not found', 404);
        }
      }
      throw error;
    }
  }

  async getTaskById(id: string): Promise<TaskWithSubtasks | null> {
    return prisma.task.findUnique({
      where: { id },
      include: {
        subtasks: {
          orderBy: { orderIndex: 'asc' },
        },
        creator: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  async getTasks(userId?: string, role?: string): Promise<TaskWithSubtasks[]> {
    if (role === 'collector' && userId) {
      // Get only assigned tasks for collectors
      return prisma.task.findMany({
        where: {
          assignments: {
            some: {
              assignedTo: userId,
            },
          },
        },
        include: {
          subtasks: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Get all tasks for admins
      return prisma.task.findMany({
        include: {
          subtasks: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  async assignTask(input: {
    taskId: string;
    assignedTo: string;
    assignedBy: string;
  }): Promise<TaskAssignment> {
    // Check if task exists
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check if assignedTo user exists
    const assignedUser = await prisma.user.findUnique({
      where: { id: input.assignedTo },
    });

    if (!assignedUser) {
      throw new AppError('User not found', 404);
    }

    // Check if already assigned
    const existingAssignment = await prisma.taskAssignment.findFirst({
      where: {
        taskId: input.taskId,
        assignedTo: input.assignedTo,
        status: {
          not: 'completed',
        },
      },
    });

    if (existingAssignment) {
      throw new AppError('Task already assigned to this user', 409);
    }

    return prisma.taskAssignment.create({
      data: {
        taskId: input.taskId,
        assignedTo: input.assignedTo,
        assignedBy: input.assignedBy,
        status: 'pending',
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            requiredIterations: true,
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
      },
    });
  }

  async getTaskProgress(assignmentId: string): Promise<any> {
    const assignment = await prisma.taskAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        task: {
          include: {
            subtasks: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        sessions: {
          where: {
            sessionType: 'task',
          },
          include: {
            subtaskRecords: {
              include: {
                subtask: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    // Count completed iterations
    const completedIterations = assignment.sessions.filter(s => s.status === 'completed').length;
    const totalIterations = assignment.task.requiredIterations;
    const completionPercentage = totalIterations > 0 ? (completedIterations / totalIterations) * 100 : 0;

    // Get detailed progress by iteration
    const iterationProgress = [];
    for (let i = 1; i <= totalIterations; i++) {
      // Get ALL sessions for this iteration number
      const iterationSessions = assignment.sessions.filter(s => s.iterationNumber === i);
      
      if (iterationSessions.length === 0) {
        iterationProgress.push({
          iterationNumber: i,
          status: 'pending',
          completedSubtasks: 0,
          totalSubtasks: assignment.task.subtasks.length,
        });
      } else {
        // Sort sessions by status priority: completed > started > failed
        // Then by startedAt date (most recent first)
        const sortedSessions = iterationSessions.sort((a, b) => {
          if (a.status === 'completed' && b.status !== 'completed') return -1;
          if (b.status === 'completed' && a.status !== 'completed') return 1;
          if (a.status === 'started' && b.status === 'failed') return -1;
          if (b.status === 'started' && a.status === 'failed') return 1;
          // If same status, sort by date (most recent first)
          return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
        });
        
        // Use the highest priority session (completed > started > failed)
        const primarySession = sortedSessions[0];
        const completedSubtasks = primarySession.subtaskRecords.filter(r => r.completedAt !== null).length;
        
        iterationProgress.push({
          iterationNumber: i,
          sessionId: primarySession.id,
          status: primarySession.status,
          completedSubtasks,
          totalSubtasks: assignment.task.subtasks.length,
          attemptCount: iterationSessions.length,
          failedAttempts: iterationSessions.filter(s => s.status === 'failed').length,
          subtasks: primarySession.subtaskRecords.map(record => ({
            subtaskId: record.subtaskId,
            subtaskTitle: record.subtask.title,
            completed: record.completedAt !== null,
            completedAt: record.completedAt,
            orderCompleted: record.orderCompleted,
          })).sort((a, b) => {
            // Sort by order index from subtask
            const subtaskA = assignment.task.subtasks.find(s => s.id === a.subtaskId);
            const subtaskB = assignment.task.subtasks.find(s => s.id === b.subtaskId);
            return (subtaskA?.orderIndex || 0) - (subtaskB?.orderIndex || 0);
          }),
        });
      }
    }

    return {
      assignment: {
        id: assignment.id,
        taskId: assignment.taskId,
        assignedTo: assignment.assignedTo,
        assignedBy: assignment.assignedBy,
        status: assignment.status,
        assignedAt: assignment.assignedAt,
        completedAt: assignment.completedAt,
      },
      task: {
        id: assignment.task.id,
        title: assignment.task.title,
        requiredIterations: assignment.task.requiredIterations,
        subtaskCount: assignment.task.subtasks.length,
      },
      progress: {
        completedIterations,
        totalIterations,
        percentage: Math.round(completionPercentage),
        byIteration: iterationProgress,
      },
    };
  }

  async deleteTask(id: string): Promise<void> {
    try {
      await prisma.task.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new AppError('Task not found', 404);
        }
      }
      throw error;
    }
  }
}

export const taskService = new TaskService();