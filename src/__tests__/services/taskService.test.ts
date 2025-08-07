import { prisma } from '../setup';
import { taskService } from '../../services/taskService';
import { createTestUser, createAdminUser } from '../helpers/auth';
import { createTask, createTaskWithSubtasks, createTaskAssignment } from '../helpers/factories';

describe('Task Service', () => {
  describe('createTask', () => {
    it('should create task with subtasks', async () => {
      const admin = await createAdminUser();
      
      const taskData = {
        title: 'New Task',
        description: 'Task description',
        requiredIterations: 5,
        createdBy: admin.id
      };

      const subtasks = [
        { title: 'Subtask 1', description: 'First' },
        { title: 'Subtask 2', description: 'Second' }
      ];

      const task = await taskService.createTask(taskData, subtasks);

      expect(task.title).toBe(taskData.title);
      expect(task.createdBy).toBe(admin.id);
      expect(task.subtasks).toHaveLength(2);
      expect(task.subtasks[0].orderIndex).toBe(0);
      expect(task.subtasks[1].orderIndex).toBe(1);
    });

    it('should handle empty subtasks array', async () => {
      const admin = await createAdminUser();
      
      const task = await taskService.createTask(
        {
          title: 'Task without subtasks',
          requiredIterations: 1,
          createdBy: admin.id
        },
        []
      );

      expect(task.subtasks).toHaveLength(0);
    });

    it('should set default values', async () => {
      const admin = await createAdminUser();
      
      const task = await taskService.createTask(
        {
          title: 'Minimal Task',
          requiredIterations: 1,
          createdBy: admin.id
        },
        []
      );

      expect(task.requiredIterations).toBe(1);
      expect(task.description).toBeNull();
      expect(task.demoVideoUrl).toBeNull();
    });
  });

  describe('getTasks', () => {
    it('should return all tasks', async () => {
      const admin = await createAdminUser();
      
      // Create multiple tasks
      for (let i = 0; i < 5; i++) {
        await createTask(admin.id, { title: `Task ${i + 1}` });
      }

      const tasks = await taskService.getTasks();

      expect(tasks).toHaveLength(5);
      expect(tasks[0].title).toContain('Task');
    });

    it('should filter by user role for collectors', async () => {
      const admin = await createAdminUser();
      const collector = await createTestUser('collector');
      
      const task1 = await createTask(admin.id, { title: 'Assigned Task' });
      await createTask(admin.id, { title: 'Unassigned Task' });
      
      await createTaskAssignment(task1.id, collector.id, admin.id);

      const tasks = await taskService.getTasks(collector.id, 'collector');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(task1.id);
    });

    it('should include subtasks', async () => {
      const admin = await createAdminUser();
      const { task } = await createTaskWithSubtasks(admin.id, 3);

      const tasks = await taskService.getTasks();
      const foundTask = tasks.find(t => t.id === task.id);

      expect(foundTask).toBeDefined();
      expect(foundTask!.subtasks).toHaveLength(3);
    });

    it('should sort by creation date descending', async () => {
      const admin = await createAdminUser();
      
      const task1 = await createTask(admin.id, { title: 'First' });
      await new Promise(resolve => setTimeout(resolve, 10));
      const task2 = await createTask(admin.id, { title: 'Second' });

      const tasks = await taskService.getTasks();

      expect(tasks[0].id).toBe(task2.id);
      expect(tasks[1].id).toBe(task1.id);
    });
  });

  describe('getTaskById', () => {
    it('should return task with all relations', async () => {
      const admin = await createAdminUser();
      const { task } = await createTaskWithSubtasks(admin.id, 2);

      const result = await taskService.getTaskById(task.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(task.id);
      expect(result!.subtasks).toHaveLength(2);
    });

    it('should return null for non-existent task', async () => {
      const result = await taskService.getTaskById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });

  describe('updateTask', () => {
    it('should update task fields', async () => {
      const admin = await createAdminUser();
      const task = await createTask(admin.id, {
        title: 'Original',
        description: 'Original desc'
      });

      const updated = await taskService.updateTask(task.id, {
        title: 'Updated',
        requiredIterations: 10
      });

      expect(updated.title).toBe('Updated');
      expect(updated.requiredIterations).toBe(10);
      expect(updated.description).toBe('Original desc');
    });

    it('should throw error for non-existent task', async () => {
      await expect(
        taskService.updateTask('00000000-0000-0000-0000-000000000000', { title: 'Updated' })
      ).rejects.toThrow();
    });
  });

  describe('deleteTask', () => {
    it('should delete task and cascade subtasks', async () => {
      const admin = await createAdminUser();
      const { task } = await createTaskWithSubtasks(admin.id, 3);

      await taskService.deleteTask(task.id);

      const deletedTask = await prisma.task.findUnique({ where: { id: task.id } });
      const subtasks = await prisma.subtask.findMany({ where: { taskId: task.id } });

      expect(deletedTask).toBeNull();
      expect(subtasks).toHaveLength(0);
    });

    it('should throw error for non-existent task', async () => {
      await expect(
        taskService.deleteTask('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Task not found');
    });
  });

  describe('assignTask', () => {
    it('should create task assignment', async () => {
      const admin = await createAdminUser();
      const collector = await createTestUser('collector');
      const task = await createTask(admin.id);

      const assignment = await taskService.assignTask({
        taskId: task.id,
        assignedTo: collector.id,
        assignedBy: admin.id
      });

      expect(assignment.taskId).toBe(task.id);
      expect(assignment.assignedTo).toBe(collector.id);
      expect(assignment.assignedBy).toBe(admin.id);
      expect(assignment.status).toBe('pending');
    });

    it('should prevent duplicate assignments', async () => {
      const admin = await createAdminUser();
      const collector = await createTestUser('collector');
      const task = await createTask(admin.id);

      await taskService.assignTask({
        taskId: task.id,
        assignedTo: collector.id,
        assignedBy: admin.id
      });

      await expect(
        taskService.assignTask({
          taskId: task.id,
          assignedTo: collector.id,
          assignedBy: admin.id
        })
      ).rejects.toThrow('already assigned');
    });

    it('should throw error for non-existent task', async () => {
      const admin = await createAdminUser();
      const collector = await createTestUser('collector');

      await expect(
        taskService.assignTask({
          taskId: '00000000-0000-0000-0000-000000000000',
          assignedTo: collector.id,
          assignedBy: admin.id
        })
      ).rejects.toThrow('Task not found');
    });
  });

  describe('getTaskProgress', () => {
    it('should calculate progress correctly', async () => {
      const admin = await createAdminUser();
      const collector = await createTestUser('collector');
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 3);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);

      // Create sessions for 2 out of 3 subtasks
      await prisma.recordingSession.createMany({
        data: [
          {
            taskAssignmentId: assignment.id,
            subtaskId: subtasks[0].id,
            localSessionId: 1,
            iterationNumber: 1,
            cameraCount: 2,
            status: 'completed'
          },
          {
            taskAssignmentId: assignment.id,
            subtaskId: subtasks[1].id,
            localSessionId: 2,
            iterationNumber: 1,
            cameraCount: 2,
            status: 'completed'
          }
        ]
      });

      const progress = await taskService.getTaskProgress(assignment.id);

      expect(progress.progress.completed).toBe(2);
      expect(progress.progress.total).toBe(3 * task.requiredIterations);
    });

    it('should handle multiple iterations', async () => {
      const admin = await createAdminUser();
      const collector = await createTestUser('collector');
      const task = await createTask(admin.id, { requiredIterations: 3 });
      const subtask = await prisma.subtask.create({
        data: { taskId: task.id, title: 'Single subtask', orderIndex: 0 }
      });
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);

      // Complete all iterations
      for (let i = 1; i <= 3; i++) {
        await prisma.recordingSession.create({
          data: {
            taskAssignmentId: assignment.id,
            subtaskId: subtask.id,
            localSessionId: i,
            iterationNumber: i,
            cameraCount: 2,
            status: 'completed'
          }
        });
      }

      const progress = await taskService.getTaskProgress(assignment.id);

      expect(progress.progress.completed).toBe(3);
      expect(progress.progress.percentage).toBe(100);
    });

    it('should throw error for non-existent assignment', async () => {
      await expect(
        taskService.getTaskProgress('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Assignment not found');
    });
  });
});