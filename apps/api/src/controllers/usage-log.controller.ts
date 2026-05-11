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

// GET /api/usage-logs/stats
export async function getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.user!.companyId!
    const where: Record<string, unknown> = { company_id: companyId }

    if (req.query.date_from || req.query.date_to) {
      const loggedAt: Record<string, Date> = {}
      if (req.query.date_from) loggedAt.gte = new Date(String(req.query.date_from))
      if (req.query.date_to) loggedAt.lte = new Date(String(req.query.date_to))
      where.logged_at = loggedAt
    }

    const [aggregate, byMaterialRaw, byMachineRaw, active_discs] = await Promise.all([
      prisma.usageLog.aggregate({ where, _sum: { meters_cut: true }, _count: { id: true } }),
      prisma.usageLog.groupBy({
        by: ['material_group'],
        where,
        _sum: { meters_cut: true },
        _count: { id: true },
        _avg: { rpm_used: true, feed_used: true },
        orderBy: { _sum: { meters_cut: 'desc' } },
      }),
      prisma.usageLog.groupBy({
        by: ['machine_id'],
        where,
        _sum: { meters_cut: true },
        _count: { id: true },
        orderBy: { _sum: { meters_cut: 'desc' } },
      }),
      prisma.discActivation.count({ where: { company_id: companyId, status: 'ACTIVE' } }),
    ])

    const total_meters = Math.round(Number(aggregate._sum.meters_cut ?? 0) * 100) / 100
    const total_sessions = aggregate._count.id

    const by_material = byMaterialRaw.map((g) => ({
      material_group: g.material_group,
      total_meters: Math.round(Number(g._sum.meters_cut ?? 0) * 100) / 100,
      sessions: g._count.id,
      avg_rpm: g._avg.rpm_used != null ? Math.round(Number(g._avg.rpm_used)) : null,
      avg_feed: g._avg.feed_used != null ? Math.round(Number(g._avg.feed_used)) : null,
    }))

    const by_machine = await Promise.all(
      byMachineRaw.map(async (g) => {
        const [machine, byMatRaw, lastLog] = await Promise.all([
          prisma.machine.findUnique({ where: { id: g.machine_id }, select: { name: true } }),
          prisma.usageLog.groupBy({
            by: ['material_group'],
            where: { ...where, machine_id: g.machine_id },
            _sum: { meters_cut: true },
            _count: { id: true },
            _avg: { rpm_used: true, feed_used: true },
            orderBy: { _sum: { meters_cut: 'desc' } },
          }),
          prisma.usageLog.findFirst({
            where: { ...where, machine_id: g.machine_id },
            orderBy: { logged_at: 'desc' },
            select: { logged_at: true },
          }),
        ])
        return {
          machine_id: g.machine_id,
          machine_name: machine?.name ?? 'Unknown',
          total_meters: Math.round(Number(g._sum.meters_cut ?? 0) * 100) / 100,
          sessions: g._count.id,
          most_used_material: byMatRaw[0]?.material_group ?? null,
          last_activity: lastLog?.logged_at?.toISOString() ?? null,
          by_material: byMatRaw.map((m) => ({
            material_group: m.material_group,
            meters: Math.round(Number(m._sum.meters_cut ?? 0) * 100) / 100,
            sessions: m._count.id,
            avg_rpm: m._avg.rpm_used != null ? Math.round(Number(m._avg.rpm_used)) : null,
            avg_feed: m._avg.feed_used != null ? Math.round(Number(m._avg.feed_used)) : null,
          })),
        }
      })
    )

    // Single pass over raw logs for by_date + by_machine_date
    const allLogs = await prisma.usageLog.findMany({
      where,
      select: { logged_at: true, meters_cut: true, machine_id: true },
      orderBy: { logged_at: 'asc' },
    })

    const dateMap = new Map<string, { meters: number; sessions: number }>()
    const machineDateMap = new Map<string, Map<string, number>>()

    for (const log of allLogs) {
      const date = log.logged_at.toISOString().slice(0, 10)
      const m = Number(log.meters_cut)

      const day = dateMap.get(date) ?? { meters: 0, sessions: 0 }
      dateMap.set(date, { meters: day.meters + m, sessions: day.sessions + 1 })

      if (!machineDateMap.has(log.machine_id)) machineDateMap.set(log.machine_id, new Map())
      const mDay = machineDateMap.get(log.machine_id)!
      mDay.set(date, (mDay.get(date) ?? 0) + m)
    }

    const by_date = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, meters: Math.round(v.meters * 100) / 100, sessions: v.sessions }))

    const machineNameMap = new Map(by_machine.map((m) => [m.machine_id, m.machine_name]))
    const by_machine_date = Array.from(machineDateMap.entries())
      .flatMap(([machine_id, dayMap]) =>
        Array.from(dayMap.entries()).map(([date, meters]) => ({
          date,
          machine_id,
          machine_name: machineNameMap.get(machine_id) ?? 'Unknown',
          meters: Math.round(meters * 100) / 100,
        }))
      )
      .sort((a, b) => a.date.localeCompare(b.date))

    res.json({ data: { total_meters, total_sessions, active_discs, by_material, by_machine, by_date, by_machine_date } })
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
