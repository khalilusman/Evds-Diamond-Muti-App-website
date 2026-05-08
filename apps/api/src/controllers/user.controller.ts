import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma'

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  is_active: true,
  company_id: true,
  created_at: true,
  updated_at: true,
}

// PATCH /api/users/me/email  (any authenticated user)
export async function updateMyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'email is required' })
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid email format' })
      return
    }

    const conflict = await prisma.user.findUnique({ where: { email } })
    if (conflict && conflict.id !== req.user!.userId) {
      res.status(409).json({ error: 'EMAIL_TAKEN', message: 'Email already in use' })
      return
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { email },
      select: SAFE_SELECT,
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/users/me/password  (any authenticated user)
export async function updateMyPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { current_password, new_password } = req.body
    if (!current_password || !new_password) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'current_password and new_password are required' })
      return
    }
    if (new_password.length < 8) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'New password must be at least 8 characters' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' })
      return
    }

    const valid = await bcrypt.compare(current_password, user.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'WRONG_PASSWORD', message: 'Current password is incorrect' })
      return
    }

    const password_hash = await bcrypt.hash(new_password, 12)
    await prisma.user.update({ where: { id: user.id }, data: { password_hash } })

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    next(err)
  }
}

// POST /api/users  (CUSTOMER_ADMIN)
export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, role } = req.body

    if (!name || !email || !password) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'name, email and password are required' })
      return
    }
    if (role && role !== 'CUSTOMER_USER') {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You can only create CUSTOMER_USER accounts' })
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
      data: {
        name,
        email,
        password_hash: passwordHash,
        role: 'CUSTOMER_USER',
        company_id: req.user!.companyId,
        is_active: true,
      },
      select: SAFE_SELECT,
    })

    res.status(201).json({ data: user })
  } catch (err) {
    next(err)
  }
}

// GET /api/users  (CUSTOMER_ADMIN — own company; EVDS_ADMIN/EVDS_SUPPORT — any company via ?company_id=)
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const isEvds = req.user!.role === 'EVDS_ADMIN' || req.user!.role === 'EVDS_SUPPORT'

    if (isEvds) {
      const companyId = req.query.company_id as string | undefined
      if (!companyId) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'company_id query param is required for EVDS staff' })
        return
      }
      const users = await prisma.user.findMany({
        where: { company_id: companyId },
        select: SAFE_SELECT,
        orderBy: { created_at: 'asc' },
      })
      res.json({ data: users, total: users.length })
      return
    }

    const users = await prisma.user.findMany({
      where: { company_id: req.user!.companyId },
      select: SAFE_SELECT,
      orderBy: { created_at: 'asc' },
    })

    res.json({ data: users, total: users.length })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/users/:id  (CUSTOMER_ADMIN)
export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } })

    if (!target || target.company_id !== req.user!.companyId) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found in your company' })
      return
    }

    const { name, email, password } = req.body
    const data: Record<string, unknown> = {}
    if (name) data.name = name
    if (email) {
      const conflict = await prisma.user.findUnique({ where: { email } })
      if (conflict && conflict.id !== target.id) {
        res.status(409).json({ error: 'EMAIL_TAKEN', message: 'Email already in use' })
        return
      }
      data.email = email
    }
    if (password) {
      if (password.length < 8) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' })
        return
      }
      data.password_hash = await bcrypt.hash(password, 12)
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: SAFE_SELECT,
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/users/:id  (CUSTOMER_ADMIN — soft delete)
export async function deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.params.id === req.user!.userId) {
      res.status(400).json({ error: 'CANNOT_SELF_DELETE', message: 'You cannot deactivate your own account' })
      return
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } })

    if (!target || target.company_id !== req.user!.companyId) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found in your company' })
      return
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { is_active: false },
    })

    res.json({ message: 'User deactivated' })
  } catch (err) {
    next(err)
  }
}
