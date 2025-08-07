import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authMiddleware';
import bcrypt from 'bcrypt';
import { config } from '../config';

export const getUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignmentsReceived: true,
            tasksCreated: true,
            assignmentsGiven: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  
  res.json({
    users,
    total,
    page,
    limit,
  });
});

export const getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          assignmentsReceived: true,
          tasksCreated: true,
        },
      },
    },
  });
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  res.json(user);
});

export const updateCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  
  const { fullName, password } = req.body;
  const updateData: any = {};
  
  if (fullName !== undefined) {
    updateData.fullName = fullName;
  }
  
  if (password !== undefined) {
    updateData.passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);
  }
  
  if (Object.keys(updateData).length === 0) {
    throw new AppError('No updates provided', 400);
  }
  
  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: updateData,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  res.json(updatedUser);
});

export const createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password, fullName, role } = req.body;
  
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  
  if (existingUser) {
    throw new AppError('User with this email already exists', 400);
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: role || 'collector',
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          assignmentsReceived: true,
          tasksCreated: true,
        },
      },
    },
  });
  
  res.status(201).json(user);
});

export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { fullName, role } = req.body;
  
  // Prevent changing your own role
  if (req.user && req.user.id === id && role !== undefined) {
    throw new AppError('Cannot change your own role', 400);
  }
  
  const updateData: any = {};
  
  if (fullName !== undefined) {
    updateData.fullName = fullName;
  }
  
  if (role !== undefined) {
    updateData.role = role;
  }
  
  if (Object.keys(updateData).length === 0) {
    throw new AppError('No updates provided', 400);
  }
  
  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignmentsReceived: true,
            tasksCreated: true,
          },
        },
      },
    });
    
    res.json(updatedUser);
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw new AppError('User not found', 404);
    }
    throw error;
  }
});

export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  // Prevent deleting yourself
  if (req.user && req.user.id === id) {
    throw new AppError('Cannot delete your own account', 400);
  }
  
  try {
    await prisma.user.delete({
      where: { id },
    });
    
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw new AppError('User not found', 404);
    }
    throw error;
  }
});