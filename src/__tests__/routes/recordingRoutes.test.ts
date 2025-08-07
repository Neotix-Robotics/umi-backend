import request from 'supertest';
import app from '../../app';
import { 
  createAdminUser, 
  createCollectorUser, 
  getAuthHeader 
} from '../helpers/auth';
import { 
  createTask, 
  createTaskWithSubtasks,
  createTaskAssignment,
  createRecordingSession,
  createSubtask
} from '../helpers/factories';

describe('Recording Routes', () => {
  describe('GET /api/v1/assignments', () => {
    it('should return assignments for collector', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const task1 = await createTask(admin.id, { title: 'Task 1' });
      const task2 = await createTask(admin.id, { title: 'Task 2' });
      
      await createTaskAssignment(task1.id, collector.id, admin.id);
      await createTaskAssignment(task2.id, collector.id, admin.id);

      const response = await request(app)
        .get('/api/v1/assignments')
        .set(getAuthHeader(collector.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].task).toBeDefined();
      expect(response.body[0].task.title).toBeDefined();
    });

    it('should return all assignments for admin', async () => {
      const admin = await createAdminUser();
      const collector1 = await createCollectorUser('collector1@example.com');
      const collector2 = await createCollectorUser('collector2@example.com');
      const task = await createTask(admin.id);
      
      await createTaskAssignment(task.id, collector1.id, admin.id);
      await createTaskAssignment(task.id, collector2.id, admin.id);

      const response = await request(app)
        .get('/api/v1/assignments')
        .set(getAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const task1 = await createTask(admin.id);
      const task2 = await createTask(admin.id);
      
      await createTaskAssignment(task1.id, collector.id, admin.id, { status: 'pending' });
      await createTaskAssignment(task2.id, collector.id, admin.id, { status: 'completed' });

      const response = await request(app)
        .get('/api/v1/assignments?status=pending')
        .set(getAuthHeader(collector.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('pending');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/assignments');

      expect(response.status).toBe(401);
    });

    it('should include task details and subtasks', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const { task } = await createTaskWithSubtasks(admin.id, 2);
      
      await createTaskAssignment(task.id, collector.id, admin.id);

      const response = await request(app)
        .get('/api/v1/assignments')
        .set(getAuthHeader(collector.token));

      expect(response.status).toBe(200);
      expect(response.body[0].task.subtasks).toHaveLength(2);
      expect(response.body[0].task.subtasks[0].title).toBe('Subtask 1');
    });
  });

  describe('POST /api/v1/assignments', () => {
    it('should create new assignment as admin', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const task = await createTask(admin.id);

      const response = await request(app)
        .post('/api/v1/assignments')
        .set(getAuthHeader(admin.token))
        .send({
          taskId: task.id,
          assignedTo: collector.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.taskId).toBe(task.id);
      expect(response.body.assignedTo).toBe(collector.id);
      expect(response.body.assignedBy).toBe(admin.id);
      expect(response.body.status).toBe('pending');
    });

    it('should prevent duplicate assignments', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const task = await createTask(admin.id);

      // First assignment
      await createTaskAssignment(task.id, collector.id, admin.id);

      // Try duplicate
      const response = await request(app)
        .post('/api/v1/assignments')
        .set(getAuthHeader(admin.token))
        .send({
          taskId: task.id,
          assignedTo: collector.id,
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Task already assigned to this user');
    });

    it('should require admin role', async () => {
      const collector = await createCollectorUser();
      const collector2 = await createCollectorUser('collector2@example.com');
      const task = await createTask(collector.id);

      const response = await request(app)
        .post('/api/v1/assignments')
        .set(getAuthHeader(collector.token))
        .send({
          taskId: task.id,
          assignedTo: collector2.id,
        });

      expect(response.status).toBe(403);
    });

    it('should validate task exists', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const fakeTaskId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .post('/api/v1/assignments')
        .set(getAuthHeader(admin.token))
        .send({
          taskId: fakeTaskId,
          assignedTo: collector.id,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });

    it('should validate user exists', async () => {
      const admin = await createAdminUser();
      const task = await createTask(admin.id);
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .post('/api/v1/assignments')
        .set(getAuthHeader(admin.token))
        .send({
          taskId: task.id,
          assignedTo: fakeUserId,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('PUT /api/v1/assignments/:id', () => {
    it('should update assignment status', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const task = await createTask(admin.id);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);

      const response = await request(app)
        .put(`/api/v1/assignments/${assignment.id}`)
        .set(getAuthHeader(collector.token))
        .send({
          status: 'in_progress',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('in_progress');
    });

    it('should set completedAt when status is completed', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const task = await createTask(admin.id);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);

      const response = await request(app)
        .put(`/api/v1/assignments/${assignment.id}`)
        .set(getAuthHeader(collector.token))
        .send({
          status: 'completed',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
      expect(response.body.completedAt).toBeDefined();
    });

    it('should only allow assigned user or admin to update', async () => {
      const admin = await createAdminUser();
      const collector1 = await createCollectorUser('collector1@example.com');
      const collector2 = await createCollectorUser('collector2@example.com');
      const task = await createTask(admin.id);
      const assignment = await createTaskAssignment(task.id, collector1.id, admin.id);

      // Other collector cannot update
      const response = await request(app)
        .put(`/api/v1/assignments/${assignment.id}`)
        .set(getAuthHeader(collector2.token))
        .send({ status: 'completed' });

      expect(response.status).toBe(403);
    });

    it('should validate status enum', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const task = await createTask(admin.id);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);

      const response = await request(app)
        .put(`/api/v1/assignments/${assignment.id}`)
        .set(getAuthHeader(collector.token))
        .send({
          status: 'invalid-status',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/assignments/:id/sessions', () => {
    it('should return recording sessions for assignment', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 2);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);
      
      await createRecordingSession(assignment.id, subtasks[0].id, {
        iterationNumber: 1,
        localSessionId: 1,
      });
      await createRecordingSession(assignment.id, subtasks[1].id, {
        iterationNumber: 1,
        localSessionId: 2,
      });

      const response = await request(app)
        .get(`/api/v1/assignments/${assignment.id}/sessions`)
        .set(getAuthHeader(collector.token));

      expect(response.status).toBe(200);
      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.assignment).toBeDefined();
      expect(response.body.assignment.id).toBe(assignment.id);
    });

    it('should only allow assigned user or admin to view', async () => {
      const admin = await createAdminUser();
      const collector1 = await createCollectorUser('collector1@example.com');
      const collector2 = await createCollectorUser('collector2@example.com');
      const task = await createTask(admin.id);
      const assignment = await createTaskAssignment(task.id, collector1.id, admin.id);

      const response = await request(app)
        .get(`/api/v1/assignments/${assignment.id}/sessions`)
        .set(getAuthHeader(collector2.token));

      expect(response.status).toBe(403);
    });

    it('should include subtask details', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 1);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);
      
      await createRecordingSession(assignment.id, subtasks[0].id);

      const response = await request(app)
        .get(`/api/v1/assignments/${assignment.id}/sessions`)
        .set(getAuthHeader(collector.token));

      expect(response.status).toBe(200);
      expect(response.body.sessions[0].subtask).toBeDefined();
      expect(response.body.sessions[0].subtask.title).toBe('Subtask 1');
    });
  });

  describe('POST /api/v1/sessions', () => {
    it('should start a new recording session', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 2);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);

      const response = await request(app)
        .post('/api/v1/sessions')
        .set(getAuthHeader(collector.token))
        .send({
          taskAssignmentId: assignment.id,
          subtaskId: subtasks[0].id,
          localSessionId: 1,
          iterationNumber: 1,
          cameraCount: 3,
        });

      expect(response.status).toBe(201);
      expect(response.body.taskAssignmentId).toBe(assignment.id);
      expect(response.body.subtaskId).toBe(subtasks[0].id);
      expect(response.body.cameraCount).toBe(3);
      expect(response.body.status).toBe('started');
    });

    it('should only allow assigned user to start session', async () => {
      const admin = await createAdminUser();
      const collector1 = await createCollectorUser('collector1@example.com');
      const collector2 = await createCollectorUser('collector2@example.com');
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 1);
      const assignment = await createTaskAssignment(task.id, collector1.id, admin.id);

      const response = await request(app)
        .post('/api/v1/sessions')
        .set(getAuthHeader(collector2.token))
        .send({
          taskAssignmentId: assignment.id,
          subtaskId: subtasks[0].id,
          localSessionId: 1,
          iterationNumber: 1,
          cameraCount: 2,
        });

      expect(response.status).toBe(403);
    });

    it('should validate subtask belongs to task', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const task1 = await createTask(admin.id);
      const task2 = await createTask(admin.id);
      const subtask2 = await createSubtask(task2.id);
      const assignment = await createTaskAssignment(task1.id, collector.id, admin.id);

      const response = await request(app)
        .post('/api/v1/sessions')
        .set(getAuthHeader(collector.token))
        .send({
          taskAssignmentId: assignment.id,
          subtaskId: subtask2.id, // Wrong task's subtask
          localSessionId: 1,
          iterationNumber: 1,
          cameraCount: 2,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Subtask does not belong to the assigned task');
    });

    it('should enforce iteration limits', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 1);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);

      const response = await request(app)
        .post('/api/v1/sessions')
        .set(getAuthHeader(collector.token))
        .send({
          taskAssignmentId: assignment.id,
          subtaskId: subtasks[0].id,
          localSessionId: 1,
          iterationNumber: task.requiredIterations + 1, // Exceeds limit
          cameraCount: 2,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('exceeds required iterations');
    });
  });

  describe('PUT /api/v1/sessions/:id', () => {
    it('should update session status and metadata', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 1);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);
      const session = await createRecordingSession(assignment.id, subtasks[0].id);

      const metadata = {
        notes: 'Recording completed successfully',
        duration: 180,
        quality: 'good',
      };

      const response = await request(app)
        .put(`/api/v1/sessions/${session.id}`)
        .set(getAuthHeader(collector.token))
        .send({
          status: 'completed',
          metadata,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
      expect(response.body.completedAt).toBeDefined();
      expect(response.body.metadata).toEqual(metadata);
    });

    it('should only allow assigned user to update', async () => {
      const admin = await createAdminUser();
      const collector1 = await createCollectorUser('collector1@example.com');
      const collector2 = await createCollectorUser('collector2@example.com');
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 1);
      const assignment = await createTaskAssignment(task.id, collector1.id, admin.id);
      const session = await createRecordingSession(assignment.id, subtasks[0].id);

      const response = await request(app)
        .put(`/api/v1/sessions/${session.id}`)
        .set(getAuthHeader(collector2.token))
        .send({ status: 'completed' });

      expect(response.status).toBe(403);
    });

    it('should validate session status enum', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 1);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);
      const session = await createRecordingSession(assignment.id, subtasks[0].id);

      const response = await request(app)
        .put(`/api/v1/sessions/${session.id}`)
        .set(getAuthHeader(collector.token))
        .send({ status: 'invalid-status' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/sessions/:id/metadata', () => {
    it('should upload session metadata', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 1);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);
      const session = await createRecordingSession(assignment.id, subtasks[0].id);

      const metadata = {
        cameras: [
          { serial: 'CAM001', model: 'Hero11', status: 'connected' },
          { serial: 'CAM002', model: 'Hero10', status: 'connected' },
        ],
        environment: {
          location: 'Lab A',
          lighting: 'bright',
          temperature: 22,
        },
        customFields: {
          experiment: 'Test 1',
          participant: 'P001',
        },
      };

      const response = await request(app)
        .post(`/api/v1/sessions/${session.id}/metadata`)
        .set(getAuthHeader(collector.token))
        .send({ metadata });

      expect(response.status).toBe(200);
      expect(response.body.metadata).toEqual(metadata);
    });

    it('should merge with existing metadata', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 1);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);
      const session = await createRecordingSession(assignment.id, subtasks[0].id, {
        metadata: { existing: 'data' },
      });

      const newMetadata = { additional: 'info' };

      const response = await request(app)
        .post(`/api/v1/sessions/${session.id}/metadata`)
        .set(getAuthHeader(collector.token))
        .send({ metadata: newMetadata });

      expect(response.status).toBe(200);
      expect(response.body.metadata).toEqual({
        existing: 'data',
        additional: 'info',
      });
    });

    it('should validate metadata is object', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();
      const { task, subtasks } = await createTaskWithSubtasks(admin.id, 1);
      const assignment = await createTaskAssignment(task.id, collector.id, admin.id);
      const session = await createRecordingSession(assignment.id, subtasks[0].id);

      const response = await request(app)
        .post(`/api/v1/sessions/${session.id}/metadata`)
        .set(getAuthHeader(collector.token))
        .send('not an object');

      expect(response.status).toBe(400);
    });
  });
});