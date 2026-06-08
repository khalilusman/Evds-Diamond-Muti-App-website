import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/catalog.controller'

const router = Router()

router.use(authenticate)

// reads — any authenticated EVDS role
router.get('/disc-families', ctrl.getDiscFamilies)
router.get('/disc-catalog', ctrl.getCatalog)
router.get('/disc-catalog/:id', ctrl.getCatalogEntry)
router.get('/wear-reference', ctrl.getWearReference)
router.get('/materials', ctrl.getMaterials)

// writes — EVDS_ADMIN only
router.post('/disc-families', requireRole('EVDS_ADMIN'), ctrl.createDiscFamily)
router.patch('/disc-families/:id', requireRole('EVDS_ADMIN'), ctrl.updateDiscFamily)
router.delete('/disc-families/:id', requireRole('EVDS_ADMIN'), ctrl.deleteDiscFamily)
router.post('/disc-catalog', requireRole('EVDS_ADMIN'), ctrl.createCatalogEntry)
router.patch('/disc-catalog/:id', requireRole('EVDS_ADMIN'), ctrl.updateCatalogEntry)
router.delete('/disc-catalog/:id', requireRole('EVDS_ADMIN'), ctrl.deleteCatalogEntry)
router.post('/wear-reference', requireRole('EVDS_ADMIN'), ctrl.createWearReference)
router.patch('/wear-reference/:id', requireRole('EVDS_ADMIN'), ctrl.updateWearReference)

export default router
