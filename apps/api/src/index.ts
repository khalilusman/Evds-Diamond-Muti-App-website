import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { prisma } from './lib/prisma'
import { apiLimiter } from './middleware/rateLimiter'
import { errorHandler } from './middleware/errorHandler'
import { startActivationCron } from './services/activation.service'

import authRoutes from './routes/auth.routes'
import companyRoutes from './routes/company.routes'
import userRoutes from './routes/user.routes'
import machineRoutes from './routes/machine.routes'
import catalogRoutes from './routes/catalog.routes'
import labelRoutes from './routes/label.routes'
import activationRoutes from './routes/activation.routes'
import usageLogRoutes from './routes/usage-log.routes'
import satRoutes from './routes/sat.routes'
import costRoutes from './routes/cost.routes'
import analyticsRoutes from './routes/analytics.routes'
import adminRoutes from './routes/admin.routes'
import qrRoutes from './routes/qr.routes'

const app = express()
const PORT = process.env.PORT ?? 3000

// ─── Security 
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'https://nexus.evdsdiamond.com',
      'https://dashboard.evdsdiamond.com',
    ]
    // Allow any localhost port in development
    if (!origin || 
        origin.startsWith('http://localhost:') || 
        allowed.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'],
}))
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}))

// ─── Body parsing 
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(apiLimiter)

// ─── Static uploads 
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// ─── Health 
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'connected', uptime: process.uptime(), timestamp: new Date() })
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})

// ─── Routes 
app.use('/api/auth', authRoutes)
app.use('/api/companies', companyRoutes)
app.use('/api/users', userRoutes)
app.use('/api/machines', machineRoutes)
app.use('/api', catalogRoutes)          // handles /api/disc-families, /api/disc-catalog, /api/wear-reference, /api/materials
app.use('/api/labels', labelRoutes)
app.use('/api/activations', activationRoutes)
app.use('/api/usage-logs', usageLogRoutes)
app.use('/api/sat', satRoutes)
app.use('/api/cost', costRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/qr', qrRoutes)

// ─── 404 
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' })
})

// ─── Global error handler 
app.use(errorHandler)

// ─── Start 
app.listen(PORT, () => {
  console.log(`EVDS API running on http://localhost:${PORT}`)
  console.log(`  Environment: ${process.env.NODE_ENV}`)
  startActivationCron()
})

export default app