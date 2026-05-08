import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/machine.controller'

const router = Router()

router.use(authenticate)

router.post('/', requireRole('CUSTOMER_ADMIN'), ctrl.createMachine)
router.get('/', requireRole('CUSTOMER_ADMIN', 'CUSTOMER_USER'), ctrl.listMachines)
router.get('/:id/activations', requireRole('CUSTOMER_ADMIN', 'CUSTOMER_USER'), ctrl.listMachineActivations)
router.patch('/:id', requireRole('CUSTOMER_ADMIN'), ctrl.updateMachine)
router.delete('/:id', requireRole('CUSTOMER_ADMIN'), ctrl.deleteMachine)

export default router
