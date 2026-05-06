import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/usage-log.controller'

const router = Router()

router.use(authenticate)

router.post('/', requireRole('CUSTOMER_ADMIN', 'CUSTOMER_USER'), ctrl.createUsageLog)
router.get('/', ctrl.listUsageLogs)

export default router
