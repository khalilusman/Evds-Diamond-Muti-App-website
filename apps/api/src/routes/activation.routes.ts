import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/activation.controller'

const router = Router()

router.use(authenticate)

router.post('/', requireRole('CUSTOMER_ADMIN'), ctrl.createActivation)
router.get('/', ctrl.listActivations)
router.get('/:id', ctrl.getActivation)
router.post('/:id/replace', requireRole('CUSTOMER_ADMIN'), ctrl.replaceActivation)

export default router
