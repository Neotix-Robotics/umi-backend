import bcrypt from 'bcrypt';
import { config } from '../config';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { User, Prisma } from '@prisma/client';
import { tokenService } from './tokenService';

export class AuthService {
  async createUser(input: {
    email: string;
    password: string;
    fullName: string;
    role: 'admin' | 'collector';
  }): Promise<Omit<User, 'passwordHash'>> {
    const passwordHash = await bcrypt.hash(input.password, config.bcrypt.rounds);
    
    try {
      const user = await prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          role: input.role,
        },
      });
      
      return this.toPublicUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new AppError('User with this email already exists', 409);
        }
      }
      throw error;
    }
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return user;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async generateTokens(
    user: User | Omit<User, 'passwordHash'>,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { accessToken, refreshToken } = await tokenService.generateTokenPair(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      userAgent,
      ipAddress
    );

    return { accessToken, refreshToken };
  }

  async refreshTokens(
    oldRefreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    return tokenService.refreshTokenRotation(oldRefreshToken, userAgent, ipAddress);
  }

  async blacklistToken(token: string): Promise<void> {
    return tokenService.blacklistAccessToken(token);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    return tokenService.revokeAllUserTokens(userId);
  }

  async getUserSessions(userId: string): Promise<any[]> {
    return tokenService.getUserSessions(userId);
  }

  async revokeTokenFamily(tokenFamily: string): Promise<void> {
    return tokenService.revokeTokenFamily(tokenFamily);
  }

  private toPublicUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }
}

export const authService = new AuthService();