import { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { createAuditLog } from '../services/audit.service'
import { sendSatTicketResolved } from '../services/email.service'
import { runDiagnosis } from '../services/sat.service'

// ─── Multer setup ─────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(process.env.UPLOAD_DIR ?? './uploads', 'sat', String(req.params.id))
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp']
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true)
    else cb(new Error('Only jpg, jpeg, png, webp images are allowed'))
  },
})

export const uploadPhotos = upload.array('photos', 5)

// ─── POST /api/sat ─────────────────────────────────────────────────────────────

export async function createTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { activation_id, symptom_code, symptom_detail, rpm_reported, feed_reported, diameter_reported } = req.body

    if (!activation_id || !symptom_code) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'activation_id and symptom_code are required' })
      return
    }

    const activation = await prisma.discActivation.findUnique({
      where: { id: activation_id },
      include: { label: { include: { family: true } } },
    })

    if (!activation || activation.company_id !== req.user!.companyId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Activation not found in your company' })
      return
    }

    // Get catalog params — use last usage log material or first valid catalog entry
    const lastLog = await prisma.usageLog.findFirst({
      where: { activation_id },
      orderBy: { logged_at: 'desc' },
      select: { material_type: true },
    })
    const materialType = lastLog?.material_type ?? null

    const catalogEntry = await prisma.discCatalog.findFirst({
      where: {
        family_id: activation.label.family_id,
        nominal_diameter: activation.label.nominal_diameter,
        ...(materialType ? { material_type: materialType } : {}),
      },
    })

    const diagnosis = catalogEntry
      ? runDiagnosis({
          symptom_code,
          rpm_reported: rpm_reported ? Number(rpm_reported) : null,
          feed_reported: feed_reported ? Number(feed_reported) : null,
          thickness: Number(activation.thickness),
          catalog: {
            rpm:          catalogEntry.rpm,
            thickness_t2: Number(catalogEntry.thickness_t2),
            feed_t1:      catalogEntry.feed_t1,
            feed_t2:      catalogEntry.feed_t2,
            life_t1:      catalogEntry.life_t1,
            life_t2:      catalogEntry.life_t2,
          },
        })
      : {
          auto_diagnosis: 'Catalog parameters not found — manual review required',
          probable_cause: 'Unknown',
          recommended_fix: 'Contact EVDS support',
          prevention: 'Ensure disc family and diameter are registered in catalog',
        }

    const ticket = await prisma.satTicket.create({
      data: {
        activation_id,
        company_id: req.user!.companyId!,
        reported_by: req.user!.userId,
        symptom_code,
        symptom_detail: symptom_detail ?? null,
        rpm_reported: rpm_reported ? Number(rpm_reported) : null,
        feed_reported: feed_reported ? Number(feed_reported) : null,
        diameter_reported: diameter_reported ? Number(diameter_reported) : null,
        auto_diagnosis: diagnosis.auto_diagnosis,
        probable_cause: diagnosis.probable_cause,
        recommended_fix: diagnosis.recommended_fix,
        prevention: diagnosis.prevention,
        photo_urls: [],
      },
      include: { activation: { include: { label: { include: { family: true } } } } },
    })

    res.status(201).json({ data: { ...ticket, catalog_params: catalogEntry } })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/sat ──────────────────────────────────────────────────────────────

export async function listTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const skip = (page - 1) * limit
    const isEvds = req.user!.role === 'EVDS_ADMIN' || req.user!.role === 'EVDS_SUPPORT'

    const where: Record<string, unknown> = {}
    if (!isEvds) where.company_id = req.user!.companyId
    else if (req.query.company_id) where.company_id = req.query.company_id
    if (req.query.status) where.status = req.query.status
    if (req.query.date_from || req.query.date_to) {
      const createdAt: Record<string, Date> = {}
      if (req.query.date_from) createdAt.gte = new Date(String(req.query.date_from))
      if (req.query.date_to) createdAt.lte = new Date(String(req.query.date_to))
      where.created_at = createdAt
    }

    const [tickets, total] = await prisma.$transaction([
      prisma.satTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          activation: {
            select: {
              id: true,
              diameter_at_activation: true,
              thickness: true,
              material_type: true,
              label: { select: { unique_code: true, nominal_diameter: true, family: { select: { name: true } } } },
              company: { select: { name: true } },
            },
          },
        },
      }),
      prisma.satTicket.count({ where }),
    ])

    res.json({ data: tickets, total, page, limit })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/sat/:id ──────────────────────────────────────────────────────────

export async function getTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await prisma.satTicket.findUnique({
      where: { id: String(req.params.id) },
      include: {
        activation: {
          include: {
            label: { include: { family: true } },
            machine: true,
            company: true,
          },
        },
      },
    })

    if (!ticket) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Ticket not found' })
      return
    }

    const isEvds = req.user!.role === 'EVDS_ADMIN' || req.user!.role === 'EVDS_SUPPORT'
    if (!isEvds && ticket.company_id !== req.user!.companyId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' })
      return
    }

    const [lastLog, reporter] = await Promise.all([
      prisma.usageLog.findFirst({
        where: { activation_id: ticket.activation_id },
        orderBy: { logged_at: 'desc' },
        select: { material_type: true },
      }),
      ticket.reported_by
        ? prisma.user.findUnique({ where: { id: ticket.reported_by }, select: { name: true, email: true } })
        : null,
    ])

    const catalogParams = await prisma.discCatalog.findFirst({
      where: {
        family_id: ticket.activation.label.family_id,
        nominal_diameter: ticket.activation.label.nominal_diameter,
        ...(lastLog?.material_type ? { material_type: lastLog.material_type } : {}),
      },
    })

    const activationThickness = Number((ticket.activation as any).thickness ?? 2.0)
    const useT2 = catalogParams ? Math.abs(Number(catalogParams.thickness_t2) - activationThickness) < 0.01 : false

    res.json({
      data: {
        ...ticket,
        reporter,
        catalog_params: catalogParams,
        comparison: catalogParams ? {
          rpm: { reported: ticket.rpm_reported, recommended: catalogParams.rpm },
          feed: {
            reported: ticket.feed_reported,
            recommended: useT2 ? catalogParams.feed_t2 : catalogParams.feed_t1,
          },
        } : null,
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/sat/:id/resolve ───────────────────────────────────────────────

export async function resolveTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { evds_solution } = req.body
    if (!evds_solution || String(evds_solution).trim().length === 0) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'evds_solution is required' })
      return
    }

    const ticket = await prisma.satTicket.findUnique({ where: { id: String(req.params.id) } })
    if (!ticket) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Ticket not found' })
      return
    }

    const updated = await prisma.satTicket.update({
      where: { id: String(req.params.id) },
      data: { status: 'RESOLVED', resolved_by: req.user!.userId, resolved_at: new Date(), evds_solution },
    })

    await createAuditLog({ actorId: req.user!.userId, entityType: 'sat_tickets', entityId: ticket.id, action: 'SAT_RESOLVED', newValue: { evds_solution } })

    const adminUser = await prisma.user.findFirst({
      where: { company_id: ticket.company_id, role: 'CUSTOMER_ADMIN' },
      select: { email: true },
    })
    if (adminUser) sendSatTicketResolved(adminUser.email, ticket.id, evds_solution).catch(() => null)

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/sat/:id/status ────────────────────────────────────────────────

export async function updateTicketStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body
    const allowed = ['OPEN', 'IN_REVIEW', 'ESCALATED']
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: `Status must be one of: ${allowed.join(', ')}` })
      return
    }

    const ticket = await prisma.satTicket.findUnique({ where: { id: String(req.params.id) } })
    if (!ticket) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Ticket not found' })
      return
    }

    const updated = await prisma.satTicket.update({
      where: { id: String(req.params.id) },
      data: { status },
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/sat/:id/escalate ──────────────────────────────────────────────

export async function escalateTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { note } = req.body
    const ticket = await prisma.satTicket.findUnique({ where: { id: String(req.params.id) } })
    if (!ticket) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Ticket not found' })
      return
    }

    const updated = await prisma.satTicket.update({
      where: { id: String(req.params.id) },
      data: { status: 'ESCALATED', evds_solution: note ?? 'Escalated for further review' },
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/sat/:id/photos ─────────────────────────────────────────────────

export async function addPhotos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await prisma.satTicket.findUnique({ where: { id: String(req.params.id) } })
    if (!ticket || ticket.company_id !== req.user!.companyId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Ticket not found in your company' })
      return
    }

    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No files uploaded' })
      return
    }

    const newUrls = files.map((f) => `/uploads/sat/${req.params.id}/${f.filename}`)
    const updated = await prisma.satTicket.update({
      where: { id: String(req.params.id) },
      data: { photo_urls: { push: newUrls } },
    })

    res.json({ data: { photo_urls: updated.photo_urls } })
  } catch (err) {
    next(err)
  }
}
