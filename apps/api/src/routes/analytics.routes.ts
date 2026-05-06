import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/analytics.controller'

const router = Router()

router.use(authenticate)
router.use(requireRole('EVDS_ADMIN', 'EVDS_SUPPORT'))

router.get('/summary', ctrl.summary)
router.get('/weekly', ctrl.weekly)
router.get('/materials', ctrl.materials)
router.get('/wear-alerts', ctrl.wearAlerts)
router.get('/geography', ctrl.geography)
router.get('/performance', ctrl.performance)

export default router
