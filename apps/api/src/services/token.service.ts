import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { UserRole } from '@prisma/client'

export interface JwtPayload {
  userId: string
  email: string
  role: UserRole
  companyId: string | null
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  } as jwt.SignOptions)
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.emailToken.create({
    data: {
      user_id: userId,
      token,
      type: 'PASSWORD_RESET',
      expires_at: expiresAt,
    },
  })

  return token
}

export async function consumePasswordResetToken(token: string) {
  const record = await prisma.emailToken.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!record || record.used_at !== null) {
    return { valid: false, reason: 'TOKEN_INVALID' as const }
  }
  if (record.expires_at < new Date()) {
    return { valid: false, reason: 'TOKEN_EXPIRED' as const }
  }

  return { valid: true, record }
}
