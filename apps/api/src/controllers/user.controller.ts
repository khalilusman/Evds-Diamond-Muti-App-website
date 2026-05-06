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

// GET /api/users  (CUSTOMER_ADMIN)
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
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
