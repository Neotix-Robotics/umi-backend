import { Router } from 'express';
import { 
  getAssignmentSessions,
  getAssignments,
  getAssignment,
  updateAssignmentStatus
} from '../controllers/recordingController';
import { assignTask, getTaskProgress } from '../controllers/taskController';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';
import { validate, taskValidators, assignmentValidators } from '../utils/validators';

const router = Router();

// Assignment routes
router.get('/assignments', requireAuth, getAssignments);
router.get('/assignments/:id', requireAuth, getAssignment);
router.post('/assignments', requireAuth, requireAdmin, validate(taskValidators.assignTask), assignTask);
router.put('/assignments/:id', requireAuth, validate(assignmentValidators.updateStatus), updateAssignmentStatus);
router.get('/assignments/:id/sessions', requireAuth, getAssignmentSessions);
router.get('/assignments/:id/progress', requireAuth, getTaskProgress);

export default router;