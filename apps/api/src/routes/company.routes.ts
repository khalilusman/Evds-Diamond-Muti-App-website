import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import * as ctrl from '../controllers/company.controller'

const router = Router()

router.use(authenticate)

router.get('/', requireRole('EVDS_ADMIN', 'EVDS_SUPPORT'), ctrl.listCompanies)
router.get('/me', requireRole('CUSTOMER_ADMIN', 'CUSTOMER_USER'), ctrl.getMyCompany)
router.get('/:id', requireRole('EVDS_ADMIN', 'EVDS_SUPPORT'), ctrl.getCompany)
router.patch('/me', requireRole('CUSTOMER_ADMIN'), ctrl.updateMyCompany)
router.patch('/:id/status', requireRole('EVDS_ADMIN'), ctrl.updateCompanyStatus)

export default router
