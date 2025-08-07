import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFound = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
  });
};

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction): void => {
  // Log errors
  console.error('Error:', err);
  
  let statusCode = 500;
  let message = 'Internal server error';
  let additionalInfo: any = {};
  
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.name === 'ValidationError' || err.type === 'validation') {
    statusCode = 400;
    message = err.message || 'Validation failed';
    if (err.details) {
      additionalInfo.details = err.details;
    }
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.code === 'P2002') {
    // Prisma unique constraint violation
    statusCode = 409;
    const field = err.meta?.target?.[0] || 'field';
    message = `${field} already exists`;
  } else if (err.code === 'P2025') {
    // Prisma record not found
    statusCode = 404;
    message = 'Record not found';
  } else if (err.name === 'SyntaxError' && err.type === 'entity.parse.failed') {
    // JSON parsing error
    statusCode = 400;
    message = 'Invalid JSON in request body';
  } else if (!err.message && err.statusCode) {
    // Handle errors with only status code
    statusCode = err.statusCode;
    message = getDefaultMessage(statusCode);
  } else if (err.message) {
    message = err.message;
  }
  
  // In production, hide internal error details
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
  }
  
  res.status(statusCode).json({
    error: message,
    ...additionalInfo,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err 
    })
  });
};

function getDefaultMessage(statusCode: number): string {
  const messages: { [key: number]: string } = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    500: 'Internal Server Error',
  };
  return messages[statusCode] || 'Error';
}

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};