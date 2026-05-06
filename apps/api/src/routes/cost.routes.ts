import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/cost.controller'

const router = Router()

router.use(authenticate)
router.use(requireRole('CUSTOMER_ADMIN', 'CUSTOMER_USER'))

router.get('/config', ctrl.getConfig)
router.put('/config', requireRole('CUSTOMER_ADMIN'), ctrl.upsertConfig)
router.get('/configs', ctrl.getConfig)
router.post('/configs', ctrl.createOrUpdateConfig)
router.post('/calculate', ctrl.calculate)
router.get('/calculations', ctrl.listCalculations)

export default router
