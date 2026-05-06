import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { prisma } from './lib/prisma'
import { apiLimiter } from './middleware/rateLimiter'
import { errorHandler } from './middleware/errorHandler'
import authRoutes from './routes/auth.routes'
import companyRoutes from './routes/company.routes'
import userRoutes from './routes/user.routes'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(helmet())
app.use(cors({
  origin: [
    process.env.FRONTEND_NEXUS_URL ?? 'http://localhost:5173',
    process.env.FRONTEND_DASHBOARD_URL ?? 'http://localhost:5174',
  ],
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(apiLimiter)

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'connected', uptime: process.uptime(), timestamp: new Date() })
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/companies', companyRoutes)
app.use('/api/users', userRoutes)

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' })
})

// Global error handler
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`EVDS API running on http://localhost:${PORT}`)
  console.log(`  Environment: ${process.env.NODE_ENV}`)
})

export default app
