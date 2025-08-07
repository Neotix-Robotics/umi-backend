import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../setup';
import { User, Role } from '@prisma/client';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  token: string;
  user: User;
}

export async function createTestUser(
  role: Role = 'collector',
  email?: string
): Promise<TestUser> {
  const password = 'testPassword123!';
  const passwordHash = await bcrypt.hash(password, 10);
  
  const user = await prisma.user.create({
    data: {
      email: email || `test${Date.now()}@example.com`,
      passwordHash,
      fullName: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      role,
    },
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

  return {
    id: user.id,
    email: user.email,
    password,
    token,
    user,
  };
}

export async function createAdminUser(email?: string): Promise<TestUser> {
  return createTestUser('admin', email);
}

export async function createCollectorUser(email?: string): Promise<TestUser> {
  return createTestUser('collector', email);
}

export function getAuthHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}