import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/sat.controller'

const router = Router()

router.use(authenticate)

router.post('/', requireRole('CUSTOMER_ADMIN', 'CUSTOMER_USER'), ctrl.createTicket)
router.get('/', ctrl.listTickets)
router.get('/:id', ctrl.getTicket)
router.patch('/:id/resolve', requireRole('EVDS_SUPPORT', 'EVDS_ADMIN'), ctrl.resolveTicket)
router.patch('/:id/escalate', requireRole('EVDS_SUPPORT', 'EVDS_ADMIN'), ctrl.escalateTicket)
router.post('/:id/photos', requireRole('CUSTOMER_ADMIN', 'CUSTOMER_USER'), ctrl.uploadPhotos, ctrl.addPhotos)

export default router
