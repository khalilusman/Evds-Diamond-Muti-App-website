import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(helmet())
app.use(cors({
  origin: [
    process.env.FRONTEND_NEXUS_URL ?? 'http://localhost:5173',
    'http://localhost:5174',
  ],
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'EVDS API', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`EVDS API running on http://localhost:${PORT}`)
})

export default app
