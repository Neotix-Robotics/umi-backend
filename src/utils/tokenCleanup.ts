import { tokenService } from '../services/tokenService';

export const startTokenCleanupJob = () => {
  // Run cleanup every hour
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

  const runCleanup = async () => {
    try {
      console.log('Running token cleanup job...');
      await tokenService.cleanupExpiredTokens();
      console.log('Token cleanup completed');
    } catch (error) {
      console.error('Token cleanup failed:', error);
    }
  };

  // Run immediately on startup
  runCleanup();

  // Then run periodically
  return setInterval(runCleanup, CLEANUP_INTERVAL);
};