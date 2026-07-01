import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.validation.js';
import { signup, login, logout, me, refresh, forgotPassword, resetPassword } from './auth.controller.js';

const router = Router();

router.post('/signup', authLimiter, validate(signupSchema), signup);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);

export default router;
