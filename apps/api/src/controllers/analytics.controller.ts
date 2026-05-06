import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

// GET /api/analytics/summary
export async function summary(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      activeCompanies,
      pendingCompanies,
      discsInField,
      openTickets,
      newRegistrations,
      totalLabels,
      activatedLabels,
    ] = await Promise.all([
      prisma.company.count({ where: { status: 'ACTIVE' } }),
      prisma.company.count({ where: { status: 'PENDING' } }),
      prisma.discActivation.count({ where: { status: 'ACTIVE' } }),
      prisma.satTicket.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
      prisma.company.count({ where: { created_at: { gte: weekAgo } } }),
      prisma.discLabel.count(),
      prisma.discLabel.count({ where: { status: { not: 'UNUSED' } } }),
    ])

    // Wear alerts: activations where latest diameter is >= 80% worn
    const activeActivations = await prisma.discActivation.findMany({
      where: { status: 'ACTIVE' },
      include: { label: { include: { family: true } } },
    })

    let wearAlerts = 0
    for (const act of activeActivations) {
      const wearRef = await prisma.wearReference.findUnique({
        where: { family_id_nominal_diameter: { family_id: act.label.family_id, nominal_diameter: act.label.nominal_diameter } },
      })
      if (!wearRef) continue
      const latestLog = await prisma.usageLog.findFirst({
        where: { activation_id: act.id },
        orderBy: { logged_at: 'desc' },
        select: { current_diameter: true },
      })
      const currentDia = latestLog ? Number(latestLog.current_diameter) : Number(act.diameter_at_activation)
      const wearPct = ((wearRef.measured_new - currentDia) / (wearRef.measured_new - wearRef.measured_worn)) * 100
      if (wearPct >= 80) wearAlerts++
    }

    const activationRate = totalLabels > 0 ? Math.round((activatedLabels / totalLabels) * 100) : 0

    res.json({
      data: {
        active_companies: activeCompanies,
        pending_companies: pendingCompanies,
        discs_in_field: discsInField,
        open_sat_tickets: openTickets,
        wear_alerts: wearAlerts,
        new_registrations_this_week: newRegistrations,
        total_labels_generated: totalLabels,
        activation_rate_pct: activationRate,
      },
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/analytics/weekly
export async function weekly(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const weeks = Math.min(52, Math.max(1, Number(req.query.weeks) || 12))
    const result = []

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const [newCompanies, newActivations, usageLogs, satTickets] = await Promise.all([
        prisma.company.count({ where: { created_at: { gte: weekStart, lt: weekEnd } } }),
        prisma.discActivation.count({ where: { activated_at: { gte: weekStart, lt: weekEnd } } }),
        prisma.usageLog.count({ where: { logged_at: { gte: weekStart, lt: weekEnd } } }),
        prisma.satTicket.count({ where: { created_at: { gte: weekStart, lt: weekEnd } } }),
      ])

      result.push({ week_start: weekStart, week_end: weekEnd, new_companies: newCompanies, new_activations: newActivations, usage_logs_count: usageLogs, sat_tickets_count: satTickets })
    }

    res.json({ data: result })
  } catch (err) {
    next(err)
  }
}

// GET /api/analytics/materials
export async function materials(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const groups = await prisma.usageLog.groupBy({
      by: ['material_group'],
      _count: { material_group: true },
      orderBy: { _count: { material_group: 'desc' } },
    })
    const total = groups.reduce((s, g) => s + g._count.material_group, 0)
    const data = groups.map((g) => ({
      material_group: g.material_group,
      count: g._count.material_group,
      percentage: total > 0 ? Math.round((g._count.material_group / total) * 100) : 0,
    }))
    res.json({ data })
  } catch (err) {
    next(err)
  }
}

// GET /api/analytics/wear-alerts
export async function wearAlerts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const activations = await prisma.discActivation.findMany({
      where: { status: 'ACTIVE' },
      include: {
        label: { include: { family: true } },
        company: { select: { id: true, name: true } },
      },
    })

    const alerts = []
    for (const act of activations) {
      const wearRef = await prisma.wearReference.findUnique({
        where: { family_id_nominal_diameter: { family_id: act.label.family_id, nominal_diameter: act.label.nominal_diameter } },
      })
      if (!wearRef) continue

      const latestLog = await prisma.usageLog.findFirst({
        where: { activation_id: act.id },
        orderBy: { logged_at: 'desc' },
        select: { current_diameter: true, machine_id: true },
      })
      const currentDia = latestLog ? Number(latestLog.current_diameter) : Number(act.diameter_at_activation)
      const wearPct = Math.round(((wearRef.measured_new - currentDia) / (wearRef.measured_new - wearRef.measured_worn)) * 100)
      if (wearPct < 80) continue

      const machine = latestLog?.machine_id
        ? await prisma.machine.findUnique({ where: { id: latestLog.machine_id }, select: { name: true } })
        : null

      alerts.push({
        activation_id: act.id,
        company: act.company,
        machine_name: machine?.name ?? null,
        family: act.label.family.name,
        nominal_diameter: act.label.nominal_diameter,
        diameter_at_activation: Number(act.diameter_at_activation),
        current_diameter: currentDia,
        measured_new: wearRef.measured_new,
        measured_worn: wearRef.measured_worn,
        wear_pct: wearPct,
        level: wearPct >= 95 ? 'critical' : 'warning',
        expires_at: act.expires_at,
      })
    }

    alerts.sort((a, b) => b.wear_pct - a.wear_pct)
    res.json({ data: alerts, total: alerts.length })
  } catch (err) {
    next(err)
  }
}

// GET /api/analytics/geography
export async function geography(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const groups = await prisma.company.groupBy({
      by: ['country'],
      _count: { country: true },
      orderBy: { _count: { country: 'desc' } },
    })
    res.json({ data: groups.map((g) => ({ country: g.country, company_count: g._count.country })) })
  } catch (err) {
    next(err)
  }
}

// GET /api/analytics/performance
export async function performance(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const symptoms = await prisma.satTicket.groupBy({
      by: ['symptom_code'],
      _count: { symptom_code: true },
      orderBy: { _count: { symptom_code: 'desc' } },
      take: 10,
    })

    const abnormalWear = await prisma.discActivation.count({
      where: { status: { in: ['EXPIRED', 'REPLACED'] } },
    })

    // Average deviations from SAT tickets
    const ticketsWithRpm = await prisma.satTicket.findMany({
      where: { rpm_reported: { not: null } },
      select: { rpm_reported: true, activation: { select: { label: { select: { family_id: true, nominal_diameter: true } } } } },
      take: 500,
    })

    let totalRpmDeviation = 0, rpmCount = 0
    for (const t of ticketsWithRpm) {
      const catalog = await prisma.discCatalog.findFirst({
        where: { family_id: t.activation.label.family_id, nominal_diameter: t.activation.label.nominal_diameter },
        select: { recommended_rpm: true },
      })
      if (catalog && t.rpm_reported) {
        totalRpmDeviation += Math.abs((Number(t.rpm_reported) - catalog.recommended_rpm) / catalog.recommended_rpm) * 100
        rpmCount++
      }
    }

    res.json({
      data: {
        avg_rpm_deviation_pct: rpmCount > 0 ? Math.round(totalRpmDeviation / rpmCount) : 0,
        avg_feed_deviation_pct: 0, // requires similar calculation — can extend later
        abnormal_wear_cases: abnormalWear,
        top_symptoms: symptoms.map((s) => ({ symptom_code: s.symptom_code, count: s._count.symptom_code })),
      },
    })
  } catch (err) {
    next(err)
  }
}
