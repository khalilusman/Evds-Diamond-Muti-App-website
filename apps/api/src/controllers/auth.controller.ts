import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma'
import { signJwt, createPasswordResetToken, consumePasswordResetToken } from '../services/token.service'
import {
  sendRegistrationConfirm,
  sendEvdsNewCompanyNotification,
  sendPasswordReset,
} from '../services/email.service'

// POST /api/auth/register
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { company_name, contact_name, email, password, country, language } = req.body

    if (!company_name || !contact_name || !email || !password || !country) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'All fields are required: company_name, contact_name, email, password, country' })
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

    const company = await prisma.company.create({
      data: {
        name: company_name,
        contact_name,
        email,
        country,
        language: language ?? 'es',
        status: 'PENDING',
        onboarding_complete: false,
      },
    })

    await prisma.user.create({
      data: {
        company_id: company.id,
        name: contact_name,
        email,
        password_hash: passwordHash,
        role: 'CUSTOMER_ADMIN',
        is_active: true,
      },
    })

    // fire-and-forget emails
    sendRegistrationConfirm(email, company_name).catch(() => null)
    sendEvdsNewCompanyNotification(company_name, contact_name, country, email).catch(() => null)

    res.status(201).json({ message: 'Registration successful. Pending approval.' })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/login
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email and password are required' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    })

    if (!user || !user.is_active) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' })
      return
    }

    if (user.company) {
      const { status, status_reason } = user.company
      if (status === 'PENDING') {
        res.status(403).json({ error: 'PENDING_APPROVAL', message: 'Your account is pending approval by EVDS' })
        return
      }
      if (status === 'SUSPENDED') {
        res.status(403).json({ error: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended', reason: status_reason })
        return
      }
      if (status === 'DEACTIVATED') {
        res.status(403).json({ error: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated' })
        return
      }
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' })
      return
    }

    const token = signJwt({
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
    })

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company
            ? { id: user.company.id, name: user.company.name, status: user.company.status }
            : null,
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/auth/me
export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        company: {
          include: {
            _count: {
              select: { activations: { where: { status: 'ACTIVE' } } },
            },
          },
        },
      },
    })

    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' })
      return
    }

    const { password_hash: _, ...safeUser } = user
    res.json({ data: safeUser })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/forgot-password
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Always 200 to prevent email enumeration
  res.json({ message: 'If an account with that email exists, a reset link has been sent.' })

  try {
    const { email } = req.body
    if (!email) return

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return

    const token = await createPasswordResetToken(user.id)
    const resetLink = `${process.env.FRONTEND_NEXUS_URL}/reset-password?token=${token}`
    await sendPasswordReset(email, resetLink)
  } catch (err) {
    console.error('[FORGOT PASSWORD ERROR]', (err as Error).message)
  }
}

// POST /api/auth/reset-password
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, new_password } = req.body

    if (!token || !new_password) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Token and new_password are required' })
      return
    }
    if (new_password.length < 8) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' })
      return
    }

    const result = await consumePasswordResetToken(token)
    if (!result.valid) {
      const status = result.reason === 'TOKEN_EXPIRED' ? 400 : 400
      res.status(status).json({ error: result.reason, message: result.reason === 'TOKEN_EXPIRED' ? 'Reset link has expired' : 'Invalid reset link' })
      return
    }

    const passwordHash = await bcrypt.hash(new_password, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: result.record!.user_id },
        data: { password_hash: passwordHash },
      }),
      prisma.emailToken.update({
        where: { id: result.record!.id },
        data: { used_at: new Date() },
      }),
    ])

    res.json({ message: 'Password reset successful' })
  } catch (err) {
    next(err)
  }
}
