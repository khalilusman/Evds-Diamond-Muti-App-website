import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma'

const router = Router()

// POST /api/admin/evds-staff
// Protected by X-Admin-Secret header — no JWT required
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

export default router
