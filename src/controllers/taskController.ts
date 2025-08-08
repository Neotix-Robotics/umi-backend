import { Response } from 'express';
import { taskService } from '../services/taskService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../utils/prisma';

export const createTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, description, demoVideoUrl, requiredIterations, requiredCameras, subtasks } = req.body;
  
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  
  const task = await taskService.createTask(
    {
      title,
      description,
      demoVideoUrl,
      requiredIterations,
      requiredCameras: requiredCameras || 1,
      createdBy: req.user.id
    },
    subtasks
  );
  
  res.status(201).json(task);
});

export const getTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tasks = await taskService.getTasks(req.user?.id, req.user?.role);
  res.json(tasks);
});

export const getTaskById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await taskService.getTaskById(req.params.id);
  
  if (!task) {
    throw new AppError('Task not found', 404);
  }
  
  res.json(task);
});

export const updateTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, description, demoVideoUrl, requiredIterations } = req.body;
  
  const task = await taskService.updateTask(req.params.id, {
    title,
    description,
    demoVideoUrl,
    requiredIterations
  });
  
  res.json(task);
});

export const deleteTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  await taskService.deleteTask(req.params.id);
  res.status(204).send();
});

export const assignTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { taskId, assignedTo } = req.body;
  
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  
  const assignment = await taskService.assignTask({
    taskId,
    assignedTo,
    assignedBy: req.user.id
  });
  
  res.status(201).json(assignment);
});

export const getTaskProgress = asyncHandler(async (req: AuthRequest, res: Response) => {
  const progress = await taskService.getTaskProgress(req.params.id);
  res.json(progress);
});

// Upload demo video for a task
export const uploadTaskVideo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  // For now, we'll assume the video URL is provided in the body
  // In a real implementation, this would handle file upload to S3
  const { videoUrl } = req.body;
  
  if (!videoUrl) {
    throw new AppError('Video URL is required', 400);
  }
  
  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id },
  });
  
  if (!task) {
    throw new AppError('Task not found', 404);
  }
  
  // Update task with video URL
  const updatedTask = await prisma.task.update({
    where: { id },
    data: { demoVideoUrl: videoUrl },
    select: {
      id: true,
      title: true,
      demoVideoUrl: true,
    },
  });
  
  res.json({
    message: 'Video uploaded successfully',
    task: updatedTask,
  });
});

// Remove demo video from a task
export const deleteTaskVideo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id },
  });
  
  if (!task) {
    throw new AppError('Task not found', 404);
  }
  
  if (!task.demoVideoUrl) {
    throw new AppError('No video to delete', 404);
  }
  
  // In a real implementation, this would also delete the video from S3
  
  // Remove video URL from task
  await prisma.task.update({
    where: { id },
    data: { demoVideoUrl: null },
  });
  
  res.status(204).send();
});

// Get pre-signed URL for video
export const getTaskVideoUrl = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  // Verify task exists and has a video
  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      demoVideoUrl: true,
    },
  });
  
  if (!task) {
    throw new AppError('Task not found', 404);
  }
  
  if (!task.demoVideoUrl) {
    throw new AppError('No video available for this task', 404);
  }
  
  // In a real implementation, this would generate a pre-signed S3 URL
  // For now, we'll return the stored URL with an expiration time
  
  res.json({
    url: task.demoVideoUrl,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
  });
});