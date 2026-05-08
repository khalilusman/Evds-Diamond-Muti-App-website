import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/user.controller'

const router = Router()

router.use(authenticate)

// Self-service routes — any authenticated role
router.patch('/me/email', ctrl.updateMyEmail)
router.patch('/me/password', ctrl.updateMyPassword)

// List users — CUSTOMER_ADMIN (own company) or EVDS staff (by ?company_id=)
router.get('/', requireRole('CUSTOMER_ADMIN', 'EVDS_ADMIN', 'EVDS_SUPPORT'), ctrl.listUsers)

// Mutation routes — CUSTOMER_ADMIN only
router.use(requireRole('CUSTOMER_ADMIN'))

router.post('/', ctrl.createUser)
router.patch('/:id', ctrl.updateUser)
router.delete('/:id', ctrl.deactivateUser)

export default router
