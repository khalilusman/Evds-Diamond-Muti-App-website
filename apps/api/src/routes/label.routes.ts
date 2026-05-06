import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/label.controller'

const router = Router()

router.use(authenticate)

// EVDS_ADMIN only
router.post('/generate', requireRole('EVDS_ADMIN'), ctrl.generateLabels)
router.get('/', requireRole('EVDS_ADMIN'), ctrl.listLabels)
router.get('/lots', requireRole('EVDS_ADMIN'), ctrl.listLots)
router.get('/security-alerts', requireRole('EVDS_ADMIN', 'EVDS_SUPPORT'), ctrl.securityAlerts)
router.get('/export/pdf/:lot_number', requireRole('EVDS_ADMIN'), ctrl.exportPdf)
router.get('/export/csv/:lot_number', requireRole('EVDS_ADMIN'), ctrl.exportCsv)
router.patch('/:id/void', requireRole('EVDS_ADMIN'), ctrl.voidLabel)
router.get('/lookup', ctrl.lookupLabel)   // any authenticated role
router.get('/:id', requireRole('EVDS_ADMIN'), ctrl.getLabelById)

export default router
