import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { notFound, errorHandler } from './middleware/errorHandler';
import { extractApiVersion } from './middleware/apiVersion';
import { prisma } from './utils/prisma';
import { getRedisClient, closeRedisConnection } from './utils/redis';
import { startTokenCleanupJob } from './utils/tokenCleanup';

// Import routes
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import userRoutes from './routes/userRoutes';
import recordingRoutes from './routes/recordingRoutes';
import simpleRecordingRoutes from './routes/simpleRecordingRoutes';
import metadataRoutes from './routes/metadataRoutes';
import sessionRoutes from './routes/sessionRoutes';
import mappingRoutes from './routes/mappingRoutes';
import simpleMappingRoutes from './routes/simpleMappingRoutes';

const app = express();

// Middleware
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(extractApiVersion);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Health check (no versioning for health check)
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.env
  });
});

// API Version
app.get('/api/v1', (_req, res) => {
  res.json({
    version: 'v1',
    endpoints: {
      auth: '/api/v1/auth',
      tasks: '/api/v1/tasks',
      users: '/api/v1/users',
      assignments: '/api/v1/assignments',
      sessions: '/api/v1/sessions'
    }
  });
});

// Routes with API versioning
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1', recordingRoutes);
app.use('/api/v1', simpleRecordingRoutes);
app.use('/api/v1/metadata', metadataRoutes);
app.use('/api/v1', sessionRoutes);
app.use('/api/v1', mappingRoutes);
app.use('/api/v1/simple', simpleMappingRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server only if not in test environment
if (config.env !== 'test') {
  const PORT = config.port;
  const HOST = '0.0.0.0'; // Listen on all network interfaces

  // Initialize Redis connection
  getRedisClient()
    .then(() => {
      // Start token cleanup job
      const cleanupInterval = startTokenCleanupJob();
      
      app.listen(PORT, HOST, () => {
        console.log(`Server running on http://${HOST}:${PORT} in ${config.env} mode`);
        console.log(`Accessible on local network at http://<your-ip>:${PORT}`);
      });
      
      // Store cleanup interval for graceful shutdown
      (global as any).tokenCleanupInterval = cleanupInterval;
    })
    .catch((err) => {
      console.error('Failed to connect to Redis:', err);
      process.exit(1);
    });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  await closeRedisConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await prisma.$disconnect();
  await closeRedisConnection();
  process.exit(0);
});

export default app;