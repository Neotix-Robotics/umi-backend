import request from 'supertest';
import app from '../../app';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../setup';
import { createAdminUser, createCollectorUser, getAuthHeader } from '../helpers/auth';

describe('Auth Routes', () => {
  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const password = 'validPassword123!';
      const passwordHash = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          email: 'login@example.com',
          passwordHash,
          fullName: 'Test User',
          role: 'collector',
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password,
        });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(user.id);
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.user.role).toBe(user.role);
      expect(response.body.user.passwordHash).toBeUndefined();
    });

    it('should fail with invalid password', async () => {
      const password = 'validPassword123!';
      const passwordHash = await bcrypt.hash(password, 10);
      
      await prisma.user.create({
        data: {
          email: 'login2@example.com',
          passwordHash,
          fullName: 'Test User',
          role: 'collector',
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login2@example.com',
          password: 'wrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anyPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'not-an-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should require both email and password', async () => {
      const response1 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' });

      expect(response1.status).toBe(400);

      const response2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'password123' });

      expect(response2.status).toBe(400);
    });

    it('should set proper JWT expiration', async () => {
      const collector = await createCollectorUser();

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: collector.email,
          password: collector.password,
        });

      const decoded = jwt.decode(response.body.accessToken) as any;
      expect(decoded.exp - decoded.iat).toBe(86400); // 24 hours
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should create new user with admin authorization', async () => {
      const admin = await createAdminUser();

      const newUserData = {
        email: 'newuser@example.com',
        password: 'securePassword123!',
        fullName: 'New User',
        role: 'collector',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set(getAuthHeader(admin.token))
        .send(newUserData);

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(newUserData.email);
      expect(response.body.user.fullName).toBe(newUserData.fullName);
      expect(response.body.user.role).toBe(newUserData.role);
      expect(response.body.user.passwordHash).toBeUndefined();

      // Verify user was created in database
      const createdUser = await prisma.user.findUnique({
        where: { email: newUserData.email },
      });
      expect(createdUser).toBeDefined();
    });

    it('should create admin user when specified', async () => {
      const admin = await createAdminUser();

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set(getAuthHeader(admin.token))
        .send({
          email: 'newadmin@example.com',
          password: 'adminPassword123!',
          fullName: 'New Admin',
          role: 'admin',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('admin');
    });

    it('should require admin authorization', async () => {
      const collector = await createCollectorUser();

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set(getAuthHeader(collector.token))
        .send({
          email: 'newuser@example.com',
          password: 'password123!',
          fullName: 'New User',
          role: 'collector',
        });

      expect(response.status).toBe(403);
    });

    it('should prevent duplicate email registration', async () => {
      const admin = await createAdminUser();
      await createCollectorUser('existing@example.com');

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set(getAuthHeader(admin.token))
        .send({
          email: 'existing@example.com',
          password: 'Password123!',  // Need uppercase
          fullName: 'Duplicate User',
          role: 'collector',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('User with this email already exists');
    });

    it('should validate password strength', async () => {
      const admin = await createAdminUser();

      const weakPasswords = ['short', '12345678', 'password'];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .set(getAuthHeader(admin.token))
          .send({
            email: `test${Date.now()}@example.com`,
            password,
            fullName: 'Test User',
            role: 'collector',
          });

        expect(response.status).toBe(400);
      }
    });

    it('should validate role enum', async () => {
      const admin = await createAdminUser();

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set(getAuthHeader(admin.token))
        .send({
          email: 'test@example.com',
          password: 'password123!',
          fullName: 'Test User',
          role: 'invalid-role',
        });

      expect(response.status).toBe(400);
    });

    it('should hash password before storing', async () => {
      const admin = await createAdminUser();
      const plainPassword = 'securePassword123!';

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set(getAuthHeader(admin.token))
        .send({
          email: 'hashtest@example.com',
          password: plainPassword,
          fullName: 'Hash Test',
          role: 'collector',
        });

      expect(response.status).toBe(201);

      const user = await prisma.user.findUnique({
        where: { email: 'hashtest@example.com' },
      });

      expect(user?.passwordHash).not.toBe(plainPassword);
      const isValid = await bcrypt.compare(plainPassword, user!.passwordHash);
      expect(isValid).toBe(true);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      const user = await createCollectorUser();
      
      // First login to get tokens
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: user.email,
          password: user.password,
        });

      const refreshToken = loginResponse.body.refreshToken;

      // Wait a bit to ensure different token timestamps
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Use refresh token
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.accessToken).not.toBe(loginResponse.body.accessToken);
    });

    it('should fail with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid refresh token');
    });

    it('should fail with expired refresh token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-id', type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || 'test-refresh-secret',
        { expiresIn: '-1h' } // Already expired
      );

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: expiredToken });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid refresh token');
    });

    it('should validate refresh token is provided', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const user = await createCollectorUser();

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set(getAuthHeader(user.token));

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');

      expect(response.status).toBe(401);
    });

    it('should handle invalid token gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set({ Authorization: 'Bearer invalid-token' });

      expect(response.status).toBe(401);
    });
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/v1/tasks');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization header missing or invalid');
    });

    it('should reject requests with invalid token format', async () => {
      const response = await request(app)
        .get('/api/v1/tasks')
        .set({ Authorization: 'InvalidFormat token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization header missing or invalid');
    });

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-id', email: 'test@example.com', role: 'collector' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/v1/tasks')
        .set({ Authorization: `Bearer ${expiredToken}` });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token expired');
    });

    it('should reject tokens for non-existent users', async () => {
      const token = jwt.sign(
        { userId: '00000000-0000-0000-0000-000000000000', email: 'fake@example.com', role: 'collector' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/v1/tasks')
        .set({ Authorization: `Bearer ${token}` });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('User not found');
    });
  });
});