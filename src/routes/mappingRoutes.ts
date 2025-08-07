import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';
import {
  startMapping,
  updatePhase,
  completeMapping,
  extendMapping,
  getActiveMapping,
  validateMapping,
  getValidMappings
} from '../controllers/mappingController';

const router = Router();

// Start a new mapping session
router.post('/mappings/start', requireAuth, asyncHandler(startMapping));

// Update a phase (start or complete)
router.put('/mappings/:mappingId/phases/:phaseType', requireAuth, asyncHandler(updatePhase));

// Complete a mapping session (manual completion)
router.post('/mappings/:mappingId/complete', requireAuth, asyncHandler(completeMapping));

// Extend a completed mapping session
router.post('/mappings/:mappingId/extend', requireAuth, asyncHandler(extendMapping));

// Get active mapping for current user
router.get('/mappings/active', requireAuth, asyncHandler(getActiveMapping));

// Get all valid mappings for current user
router.get('/mappings/valid', requireAuth, asyncHandler(getValidMappings));

// Validate a mapping for task recording
router.post('/mappings/validate', requireAuth, asyncHandler(validateMapping));

export default router;