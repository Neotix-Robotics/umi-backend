import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { asyncHandler } from '../middleware/errorHandler';
import {
  createMapping,
  getValidMappings,
  validateMapping
} from '../controllers/simpleMappingController';

const router = Router();

// Create a new completed mapping with all phase data
router.post('/mappings/create', requireAuth, asyncHandler(createMapping));

// Get all valid mappings for current user
router.get('/mappings/valid', requireAuth, asyncHandler(getValidMappings));

// Validate a mapping for task recording
router.post('/mappings/validate', requireAuth, asyncHandler(validateMapping));

export default router;