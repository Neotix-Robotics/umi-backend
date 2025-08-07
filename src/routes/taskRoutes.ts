import { Router } from 'express';
import { 
  createTask, 
  getTasks, 
  getTaskById, 
  updateTask, 
  deleteTask,
  uploadTaskVideo,
  deleteTaskVideo,
  getTaskVideoUrl
} from '../controllers/taskController';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';
import { validate, taskValidators } from '../utils/validators';

const router = Router();

router.get('/', requireAuth, getTasks);
router.post('/', requireAuth, requireAdmin, validate(taskValidators.createTask), createTask);
router.get('/:id', requireAuth, getTaskById);
router.put('/:id', requireAuth, requireAdmin, validate(taskValidators.updateTask), updateTask);
router.delete('/:id', requireAuth, requireAdmin, deleteTask);

// Video endpoints
router.post('/:id/video', requireAuth, requireAdmin, validate(taskValidators.uploadVideo), uploadTaskVideo);
router.delete('/:id/video', requireAuth, requireAdmin, deleteTaskVideo);
router.get('/:id/video-url', requireAuth, getTaskVideoUrl);

export default router;