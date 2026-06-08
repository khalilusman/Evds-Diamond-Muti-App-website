import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/sat-config.controller'

const router = Router()

router.use(authenticate)

router.get('/', ctrl.listRules)
router.patch('/:symptom_code', requireRole('EVDS_ADMIN'), ctrl.upsertRule)

export default router
