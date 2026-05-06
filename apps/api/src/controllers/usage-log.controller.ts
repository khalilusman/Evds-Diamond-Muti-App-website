import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

// POST /api/usage-logs
export async function createUsageLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { activation_id, current_diameter, meters_cut, rpm_used, feed_used, thickness_cm, cut_type, water_flow_ok, notes } = req.body

    if (!activation_id || current_diameter === undefined || !meters_cut || !thickness_cm) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'activation_id, current_diameter, meters_cut, thickness_cm are required' })
      return
    }

    const activation = await prisma.discActivation.findUnique({
      where: { id: activation_id },
      include: { label: true },
    })

    if (!activation) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Activation not found' })
      return
    }
    if (activation.company_id !== req.user!.companyId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Activation does not belong to your company' })
      return
    }
    if (activation.status !== 'ACTIVE') {
      res.status(400).json({ error: 'ACTIVATION_NOT_ACTIVE', message: 'This activation window is not active. Cannot log usage.' })
      return
    }

    const currentDia = Number(current_diameter)
    const activationDia = Number(activation.diameter_at_activation)
    const maxAllowed = activationDia + 1.0

    if (currentDia > maxAllowed) {
      res.status(400).json({
        error: 'DIAMETER_FRAUD',
        message: 'Current diameter cannot exceed activation diameter by more than 1mm',
        activation_diameter: activationDia,
        max_allowed: maxAllowed,
        provided: currentDia,
      })
      return
    }

    const metersCut = Number(meters_cut)
    if (!metersCut || metersCut <= 0) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'meters_cut must be a positive number' })
      return
    }

    // machine_id: use body value if provided, else fall back to activation's machine
    const machineId = req.body.machine_id ?? activation.machine_id

    // material_group: use body value if provided, else last log's value, else 'unknown'
    let materialGroup = req.body.material_group ?? null
    if (!materialGroup) {
      const lastLog = await prisma.usageLog.findFirst({
        where: { activation_id },
        orderBy: { logged_at: 'desc' },
        select: { material_group: true },
      })
      materialGroup = lastLog?.material_group ?? 'unknown'
    }

    const log = await prisma.usageLog.create({
      data: {
        activation_id,
        company_id: req.user!.companyId!,
        user_id: req.user!.userId,
        machine_id: machineId,
        current_diameter: currentDia,
        meters_cut: metersCut,
        rpm_used: rpm_used ? Number(rpm_used) : null,
        feed_used: feed_used ? Number(feed_used) : null,
        material_group: materialGroup,
        thickness_cm: Number(thickness_cm),
        cut_type: cut_type ?? null,
        water_flow_ok: water_flow_ok !== undefined ? Boolean(water_flow_ok) : null,
        notes: notes ?? null,
      },
    })

    res.status(201).json({ data: log })
  } catch (err) {
    next(err)
  }
}

// GET /api/usage-logs
export async function listUsageLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const skip = (page - 1) * limit
    const isEvds = req.user!.role === 'EVDS_ADMIN' || req.user!.role === 'EVDS_SUPPORT'

    const where: Record<string, unknown> = {}
    if (!isEvds) where.company_id = req.user!.companyId
    if (req.query.activation_id) where.activation_id = req.query.activation_id
    if (req.query.date_from || req.query.date_to) {
      const loggedAt: Record<string, Date> = {}
      if (req.query.date_from) loggedAt.gte = new Date(String(req.query.date_from))
      if (req.query.date_to) loggedAt.lte = new Date(String(req.query.date_to))
      where.logged_at = loggedAt
    }

    const [logs, total] = await prisma.$transaction([
      prisma.usageLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { logged_at: 'desc' },
        include: {
          machine: { select: { id: true, name: true } },
          activation: { select: { id: true, label: { select: { unique_code: true, nominal_diameter: true, family: { select: { name: true } } } } } },
        },
      }),
      prisma.usageLog.count({ where }),
    ])

    res.json({ data: logs, total, page, limit })
  } catch (err) {
    next(err)
  }
}
