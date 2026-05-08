import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { authLimiter } from '../middleware/rateLimiter'
import * as ctrl from '../controllers/auth.controller'

const router = Router()

router.post('/register', authLimiter, ctrl.register)
router.post('/login', authLimiter, ctrl.login)
router.get('/me', authenticate, ctrl.me)
router.post('/forgot-password', authLimiter, ctrl.forgotPassword)
router.post('/reset-password', authLimiter, ctrl.resetPassword)
router.patch('/change-password', authenticate, ctrl.changePassword)

export default router
