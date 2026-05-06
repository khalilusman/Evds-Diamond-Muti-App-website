import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import * as ctrl from '../controllers/catalog.controller'

const router = Router()

router.use(authenticate)

router.get('/disc-families', ctrl.getDiscFamilies)
router.get('/disc-catalog', ctrl.getCatalog)
router.get('/disc-catalog/:id', ctrl.getCatalogEntry)
router.get('/wear-reference', ctrl.getWearReference)
router.get('/materials', ctrl.getMaterials)

export default router
