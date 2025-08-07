import { Router } from 'express';
import { 
  getUsers, 
  getCurrentUser, 
  updateCurrentUser,
  createUser,
  updateUser, 
  deleteUser 
} from '../controllers/userController';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';
import { validate, userValidators } from '../utils/validators';

const router = Router();

router.get('/', requireAuth, requireAdmin, getUsers);
router.get('/me', requireAuth, getCurrentUser);
router.post('/', requireAuth, requireAdmin, validate(userValidators.createUser), createUser);
router.put('/me', requireAuth, validate(userValidators.updateProfile), updateCurrentUser);
router.put('/:id', requireAuth, requireAdmin, validate(userValidators.updateUser), updateUser);
router.delete('/:id', requireAuth, requireAdmin, deleteUser);

export default router;