import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/qr.controller'

const router = Router()

router.use(authenticate)
router.get('/nexus', requireRole('EVDS_ADMIN', 'EVDS_SUPPORT'), ctrl.getNexusQr)

export default router
