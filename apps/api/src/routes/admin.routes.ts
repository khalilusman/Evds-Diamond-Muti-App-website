import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/roles'

const router = Router()

// POST /api/admin/evds-staff — secret-header protected, no JWT required
router.post('/evds-staff', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const secret = req.headers['x-admin-secret']
    if (!secret || secret !== process.env.ADMIN_SECRET_KEY) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid admin secret' })
      return
    }

    const { name, email, password, role } = req.body

    if (!name || !email || !password || !role) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'name, email, password, role are required' })
      return
    }
    if (!['EVDS_ADMIN', 'EVDS_SUPPORT'].includes(role)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'role must be EVDS_ADMIN or EVDS_SUPPORT' })
      return
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'EMAIL_TAKEN', message: 'An account with this email already exists' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, password_hash: passwordHash, role, is_active: true, company_id: null },
      select: { id: true, name: true, email: true, role: true, is_active: true, created_at: true },
    })

    res.status(201).json({ data: user })
  } catch (err) {
    next(err)
  }
})

// JWT-authenticated routes for dashboard staff management
router.use(authenticate)
router.use(requireRole('EVDS_ADMIN'))

// GET /api/admin/evds-staff — list all EVDS staff
router.get('/evds-staff', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ['EVDS_ADMIN', 'EVDS_SUPPORT'] } },
      select: { id: true, name: true, email: true, role: true, is_active: true, created_at: true },
      orderBy: { created_at: 'asc' },
    })
    res.json({ data: staff })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/admin/evds-staff/:id — deactivate a staff member
router.patch('/evds-staff/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.params.id === req.user!.userId) {
      res.status(400).json({ error: 'FORBIDDEN', message: 'You cannot deactivate yourself' })
      return
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!target || !['EVDS_ADMIN', 'EVDS_SUPPORT'].includes(target.role)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Staff member not found' })
      return
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { is_active: false },
      select: { id: true, name: true, email: true, role: true, is_active: true, created_at: true },
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

export default router
