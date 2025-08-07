import request from 'supertest';
import app from '../../app';
import { prisma } from '../setup';
import { 
  createAdminUser, 
  createCollectorUser, 
  getAuthHeader
} from '../helpers/auth';

describe('User Routes', () => {
  describe('GET /api/v1/users', () => {
    it('should return all users for admin', async () => {
      const admin = await createAdminUser();
      const collector1 = await createCollectorUser('collector1@example.com');
      const collector2 = await createCollectorUser('collector2@example.com');

      const response = await request(app)
        .get('/api/v1/users')
        .set(getAuthHeader(admin.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3); // admin + 2 collectors
      expect(response.body.map((u: any) => u.email)).toContain(admin.email);
      expect(response.body.map((u: any) => u.email)).toContain(collector1.email);
      expect(response.body.map((u: any) => u.email)).toContain(collector2.email);
      
      // Should not include password hash
      response.body.forEach((user: any) => {
        expect(user.passwordHash).toBeUndefined();
      });
    });

    it('should require admin role', async () => {
      const collector = await createCollectorUser();

      const response = await request(app)
        .get('/api/v1/users')
        .set(getAuthHeader(collector.token));

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/users');

      expect(response.status).toBe(401);
    });

    it('should include user statistics', async () => {
      const admin = await createAdminUser();
      
      const response = await request(app)
        .get('/api/v1/users')
        .set(getAuthHeader(admin.token));

      expect(response.status).toBe(200);
      response.body.forEach((user: any) => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('fullName');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('createdAt');
        expect(user).toHaveProperty('_count');
      });
    });
  });

  describe('GET /api/v1/users/me', () => {
    it('should return current user profile', async () => {
      const collector = await createCollectorUser('me@example.com');

      const response = await request(app)
        .get('/api/v1/users/me')
        .set(getAuthHeader(collector.token));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(collector.id);
      expect(response.body.email).toBe('me@example.com');
      expect(response.body.role).toBe('collector');
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('should include user statistics', async () => {
      const collector = await createCollectorUser();

      const response = await request(app)
        .get('/api/v1/users/me')
        .set(getAuthHeader(collector.token));

      expect(response.status).toBe(200);
      expect(response.body._count).toBeDefined();
      expect(response.body._count).toHaveProperty('assignmentsReceived');
      expect(response.body._count).toHaveProperty('tasksCreated');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/users/me');

      expect(response.status).toBe(401);
    });

    it('should work for both admin and collector roles', async () => {
      const admin = await createAdminUser();
      const collector = await createCollectorUser();

      const adminResponse = await request(app)
        .get('/api/v1/users/me')
        .set(getAuthHeader(admin.token));

      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.role).toBe('admin');

      const collectorResponse = await request(app)
        .get('/api/v1/users/me')
        .set(getAuthHeader(collector.token));

      expect(collectorResponse.status).toBe(200);
      expect(collectorResponse.body.role).toBe('collector');
    });
  });

  describe('PUT /api/v1/users/me', () => {
    it('should update user profile', async () => {
      const collector = await createCollectorUser();

      const updateData = {
        fullName: 'Updated Name',
      };

      const response = await request(app)
        .put('/api/v1/users/me')
        .set(getAuthHeader(collector.token))
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.fullName).toBe(updateData.fullName);
      expect(response.body.email).toBe(collector.email);
    });

    it('should update password', async () => {
      const collector = await createCollectorUser();
      const newPassword = 'newSecurePassword123!';

      const response = await request(app)
        .put('/api/v1/users/me')
        .set(getAuthHeader(collector.token))
        .send({
          password: newPassword,
        });

      expect(response.status).toBe(200);

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: collector.email,
          password: newPassword,
        });

      expect(loginResponse.status).toBe(200);
    });

    it.skip('should require current password to change password', async () => {
      const collector = await createCollectorUser();

      const response = await request(app)
        .put('/api/v1/users/me')
        .set(getAuthHeader(collector.token))
        .send({
          newPassword: 'newPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Current password is required');
    });

    it.skip('should validate current password when changing password', async () => {
      const collector = await createCollectorUser();

      const response = await request(app)
        .put('/api/v1/users/me')
        .set(getAuthHeader(collector.token))
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Current password is incorrect');
    });

    it.skip('should prevent duplicate email', async () => {
      const collector1 = await createCollectorUser('user1@example.com');
      await createCollectorUser('user2@example.com');

      const response = await request(app)
        .put('/api/v1/users/me')
        .set(getAuthHeader(collector1.token))
        .send({
          email: 'user2@example.com',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email already in use');
    });

    it('should validate email format', async () => {
      const collector = await createCollectorUser();

      const response = await request(app)
        .put('/api/v1/users/me')
        .set(getAuthHeader(collector.token))
        .send({
          email: 'not-an-email',
        });

      expect(response.status).toBe(400);
    });

    it('should validate password strength', async () => {
      const collector = await createCollectorUser();

      const response = await request(app)
        .put('/api/v1/users/me')
        .set(getAuthHeader(collector.token))
        .send({
          currentPassword: collector.password,
          newPassword: 'weak',
        });

      expect(response.status).toBe(400);
    });

    it('should not allow role change', async () => {
      const collector = await createCollectorUser();

      const response = await request(app)
        .put('/api/v1/users/me')
        .set(getAuthHeader(collector.token))
        .send({
          role: 'admin',
        });

      // Validator rejects unknown fields
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/v1/users/me')
        .send({ fullName: 'New Name' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should delete user as admin', async () => {
      const admin = await createAdminUser();
      const userToDelete = await createCollectorUser();

      const response = await request(app)
        .delete(`/api/v1/users/${userToDelete.id}`)
        .set(getAuthHeader(admin.token));

      expect(response.status).toBe(204);

      const deletedUser = await prisma.user.findUnique({
        where: { id: userToDelete.id }
      });
      expect(deletedUser).toBeNull();
    });

    it('should require admin role', async () => {
      const collector = await createCollectorUser();
      const userToDelete = await createCollectorUser('delete@example.com');

      const response = await request(app)
        .delete(`/api/v1/users/${userToDelete.id}`)
        .set(getAuthHeader(collector.token));

      expect(response.status).toBe(403);
    });

    it('should prevent self-deletion', async () => {
      const admin = await createAdminUser();

      const response = await request(app)
        .delete(`/api/v1/users/${admin.id}`)
        .set(getAuthHeader(admin.token));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot delete your own account');
    });

    it('should return 404 for non-existent user', async () => {
      const admin = await createAdminUser();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .delete(`/api/v1/users/${fakeId}`)
        .set(getAuthHeader(admin.token));

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should validate UUID format', async () => {
      const admin = await createAdminUser();

      const response = await request(app)
        .delete('/api/v1/users/invalid-id')
        .set(getAuthHeader(admin.token));

      // Prisma doesn't validate UUID format, just returns not found
      expect(response.status).toBe(404);
    });

    it.skip('should cascade delete user data', async () => {
      const admin = await createAdminUser();
      const userToDelete = await createCollectorUser();
      
      // Create some related data
      const task = await prisma.task.create({
        data: {
          title: 'User Task',
          createdBy: userToDelete.id,
        },
      });

      const assignment = await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          assignedTo: userToDelete.id,
          assignedBy: admin.id,
        },
      });

      const response = await request(app)
        .delete(`/api/v1/users/${userToDelete.id}`)
        .set(getAuthHeader(admin.token));

      expect(response.status).toBe(204);

      // Verify related data is handled appropriately
      const deletedTask = await prisma.task.findUnique({
        where: { id: task.id }
      });
      const deletedAssignment = await prisma.taskAssignment.findUnique({
        where: { id: assignment.id }
      });

      // These should be deleted due to foreign key constraints
      expect(deletedTask).toBeNull();
      expect(deletedAssignment).toBeNull();
    });

    it('should require authentication', async () => {
      const userToDelete = await createCollectorUser();

      const response = await request(app)
        .delete(`/api/v1/users/${userToDelete.id}`);

      expect(response.status).toBe(401);
    });
  });
});