import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions' })
      return
    }
    next()
  }
}
