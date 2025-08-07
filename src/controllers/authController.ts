import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authMiddleware';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  const user = await authService.validateCredentials(email, password);
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }
  
  // Get user agent and IP for session tracking
  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip || req.socket.remoteAddress;
  
  const { accessToken, refreshToken } = await authService.generateTokens(
    user,
    userAgent,
    ipAddress
  );
  
  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    },
    accessToken,
    refreshToken
  });
});

export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password, fullName, role = 'collector' } = req.body;
  
  const user = await authService.createUser({
    email,
    password,
    fullName,
    role
  });
  
  // Get user agent and IP for session tracking
  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip || req.socket.remoteAddress;
  
  const { accessToken, refreshToken } = await authService.generateTokens(
    user,
    userAgent,
    ipAddress
  );
  
  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    },
    accessToken,
    refreshToken
  });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    throw new AppError('Refresh token required', 400);
  }
  
  // Get user agent and IP for session tracking
  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip || req.socket.remoteAddress;
  
  try {
    const tokens = await authService.refreshTokens(refreshToken, userAgent, ipAddress);
    
    if (!tokens) {
      throw new AppError('Invalid refresh token', 401);
    }
    
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error: any) {
    if (error.message?.includes('security breach')) {
      // Possible token reuse attack detected
      res.status(401).json({
        error: 'Security breach detected. All sessions have been terminated.',
        code: 'TOKEN_REUSE_DETECTED'
      });
      return;
    }
    throw error;
  }
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Get the access token from the Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    await authService.blacklistToken(token);
  }
  
  res.json({
    message: 'Logged out successfully'
  });
});

export const getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  const user = await authService.findUserById(req.user.id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  });
});

export const getSessions = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  const sessions = await authService.getUserSessions(req.user.id);
  
  res.json({
    sessions,
    currentSession: req.headers.authorization?.substring(7) // Current token
  });
});

export const revokeSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  const { tokenFamily } = req.body;
  
  if (!tokenFamily) {
    throw new AppError('Token family required', 400);
  }
  
  await authService.revokeTokenFamily(tokenFamily);
  
  res.json({
    message: 'Session revoked successfully'
  });
});

export const revokeAllSessions = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  await authService.revokeAllUserTokens(req.user.id);
  
  res.json({
    message: 'All sessions revoked successfully'
  });
});