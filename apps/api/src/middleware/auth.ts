import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as Express.Request['user']
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'TOKEN_INVALID', message: 'Token is invalid or expired' })
  }
}
