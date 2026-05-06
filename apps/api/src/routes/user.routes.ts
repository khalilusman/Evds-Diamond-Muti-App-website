import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/user.controller'

const router = Router()

router.use(authenticate)
router.use(requireRole('CUSTOMER_ADMIN'))

router.post('/', ctrl.createUser)
router.get('/', ctrl.listUsers)
router.patch('/:id', ctrl.updateUser)
router.delete('/:id', ctrl.deactivateUser)

export default router
