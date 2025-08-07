import { prisma } from '../setup';
import { Task, Subtask, TaskAssignment, RecordingSession } from '@prisma/client';

export async function createTask(
  creatorId: string,
  data?: Partial<Task>
): Promise<Task> {
  return prisma.task.create({
    data: {
      title: data?.title || 'Test Task',
      description: data?.description || 'Test task description',
      demoVideoUrl: data?.demoVideoUrl,
      requiredIterations: data?.requiredIterations || 3,
      createdBy: creatorId,
      ...data,
    },
  });
}

export async function createSubtask(
  taskId: string,
  data?: Partial<Subtask>
): Promise<Subtask> {
  const existingSubtasks = await prisma.subtask.count({ where: { taskId } });
  
  return prisma.subtask.create({
    data: {
      taskId,
      title: data?.title || `Subtask ${existingSubtasks + 1}`,
      description: data?.description || 'Subtask description',
      orderIndex: data?.orderIndex ?? existingSubtasks,
      ...data,
    },
  });
}

export async function createTaskAssignment(
  taskId: string,
  assignedTo: string,
  assignedBy: string,
  data?: Partial<TaskAssignment>
): Promise<TaskAssignment> {
  return prisma.taskAssignment.create({
    data: {
      taskId,
      assignedTo,
      assignedBy,
      status: data?.status || 'pending',
      ...data,
    },
  });
}

export async function createRecordingSession(
  taskAssignmentId: string,
  subtaskId: string,
  data?: Partial<RecordingSession>
): Promise<RecordingSession> {
  return prisma.recordingSession.create({
    data: {
      taskAssignmentId,
      subtaskId,
      localSessionId: data?.localSessionId || 1,
      iterationNumber: data?.iterationNumber || 1,
      cameraCount: data?.cameraCount || 2,
      status: data?.status || 'started',
      metadata: data?.metadata || {},
      completedAt: data?.completedAt,
    },
  });
}

export async function createTaskWithSubtasks(
  creatorId: string,
  subtaskCount: number = 3
): Promise<{ task: Task; subtasks: Subtask[] }> {
  const task = await createTask(creatorId);
  const subtasks: Subtask[] = [];

  for (let i = 0; i < subtaskCount; i++) {
    subtasks.push(
      await createSubtask(task.id, {
        title: `Subtask ${i + 1}`,
        orderIndex: i,
      })
    );
  }

  return { task, subtasks };
}