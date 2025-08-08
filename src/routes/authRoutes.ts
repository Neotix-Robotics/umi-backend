import { Router } from 'express';
import { 
  login, 
  register, 
  refreshToken, 
  logout, 
  getCurrentUser,
  getSessions,
  revokeSession,
  revokeAllSessions
} from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';
import { validate, authValidators } from '../utils/validators';

const router = Router();

router.post('/login', validate(authValidators.login), login);
// Allow public registration - remove requireAuth and requireAdmin for self-registration
router.post('/register', validate(authValidators.register), register);
router.post('/refresh', validate(authValidators.refreshToken), refreshToken);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getCurrentUser);

// Session management
router.get('/sessions', requireAuth, getSessions);
router.post('/sessions/revoke', requireAuth, revokeSession);
router.post('/sessions/revoke-all', requireAuth, revokeAllSessions);

export default router;