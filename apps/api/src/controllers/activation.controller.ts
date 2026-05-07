import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { createAuditLog } from '../services/audit.service'
import { FAMILY_VALID_MATERIALS } from '../services/label.service'

const WINDOW_HOURS = 168 // 7 days

function calcWear(newDia: number, wornDia: number, currentDia: number): number {
  if (newDia === wornDia) return 0
  return Math.min(100, Math.max(0, ((newDia - currentDia) / (newDia - wornDia)) * 100))
}

// POST /api/activations
export async function createActivation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { unique_code, machine_id, diameter_at_activation, thickness_cm, material_group, notes } = req.body

    if (!unique_code || !machine_id || !diameter_at_activation || !thickness_cm || !material_group) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'unique_code, machine_id, diameter_at_activation, thickness_cm, material_group are required' })
      return
    }

    const code = String(unique_code).toUpperCase().trim()
    const label = await prisma.discLabel.findUnique({ where: { unique_code: code }, include: { family: true } })

    const logAttempt = async (result: string) => {
      await prisma.activationAttempt.create({
        data: {
          unique_code: code,
          label_id: label?.id ?? null,
          tried_by: req.user!.userId,
          company_id: req.user!.companyId ?? null,
          ip_address: (req.ip ?? req.socket.remoteAddress ?? 'unknown').slice(0, 45),
          result: result as never,
        },
      }).catch(() => null)
    }

    if (!label) {
      await logAttempt('CODE_NOT_FOUND')
      res.status(404).json({ error: 'CODE_NOT_FOUND', message: 'Activation code not found' })
      return
    }

    const statusBlocks: Record<string, [number, string, string]> = {
      VOIDED: [403, 'CODE_VOIDED', 'This code has been voided and cannot be activated'],
      ACTIVE: [409, 'ALREADY_ACTIVE', 'This code already has an active window'],
      ACTIVE_W2: [409, 'ALREADY_ACTIVE', 'This code is in its second and final active window'],
      PERMANENTLY_DEACTIVATED: [410, 'MAX_ACTIVATIONS_REACHED', 'This code has reached its maximum number of activations'],
    }
    if (label.status in statusBlocks) {
      const [status, error, message] = statusBlocks[label.status]
      const resultCode = label.status === 'ACTIVE' || label.status === 'ACTIVE_W2' ? 'ALREADY_USED' : label.status === 'PERMANENTLY_DEACTIVATED' ? 'MAX_ACTIVATIONS_REACHED' : 'VOIDED'
      await logAttempt(resultCode)
      res.status(status).json({ error, message })
      return
    }

    // Verify machine belongs to company
    const machine = await prisma.machine.findUnique({ where: { id: machine_id } })
    if (!machine || machine.company_id !== req.user!.companyId) {
      await logAttempt('WRONG_COMBINATION')
      res.status(403).json({ error: 'FORBIDDEN', message: 'Machine not found in your company' })
      return
    }

    const dia = Number(diameter_at_activation)
    if (!dia || dia <= 0) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'diameter_at_activation must be a positive number' })
      return
    }

    const thick = Number(thickness_cm)
    if (thick !== 2 && thick !== 3) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'thickness_cm must be 2 or 3' })
      return
    }

    // Validate material vs family
    const validMaterials = FAMILY_VALID_MATERIALS[label.family.name] ?? []
    if (!validMaterials.includes(material_group)) {
      res.status(400).json({
        error: 'INVALID_MATERIAL',
        message: `${label.family.name} is not compatible with ${material_group}. Valid materials: ${validMaterials.join(', ')}`,
      })
      return
    }

    const isWindow2 = label.status === 'EXPIRED_W1'
    const activationWindow = isWindow2 ? 2 : 1
    const newLabelStatus = isWindow2 ? 'ACTIVE_W2' : 'ACTIVE'
    const now = new Date()
    const expiresAt = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000)

    const [activation] = await prisma.$transaction([
      prisma.discActivation.create({
        data: {
          label_id: label.id,
          company_id: req.user!.companyId!,
          user_id: req.user!.userId,
          machine_id,
          diameter_at_activation: dia,
          thickness_cm: thick,
          material_group: material_group ?? null,
          activation_window: activationWindow,
          activated_at: now,
          expires_at: expiresAt,
          status: 'ACTIVE',
          notes: notes ?? null,
        },
      }),
      prisma.discLabel.update({
        where: { id: label.id },
        data: {
          status: newLabelStatus,
          activation_count: { increment: 1 },
          activated_by: req.user!.userId,
          company_id: req.user!.companyId,
        },
      }),
    ])

    await logAttempt('SUCCESS')
    await createAuditLog({
      actorId: req.user!.userId,
      entityType: 'disc_activations',
      entityId: activation.id,
      action: 'DISC_ACTIVATED',
      newValue: { label_id: label.id, window: activationWindow, company_id: req.user!.companyId },
    })

    // Fetch catalog options + wear ref for response
    const catalogOptions = await prisma.discCatalog.findMany({
      where: { family_id: label.family_id, nominal_diameter: label.nominal_diameter },
    })
    const wearRef = await prisma.wearReference.findUnique({
      where: { family_id_nominal_diameter: { family_id: label.family_id, nominal_diameter: label.nominal_diameter } },
    })

    res.status(201).json({
      data: {
        ...activation,
        label: { id: label.id, unique_code: label.unique_code, full_code: label.full_code, family: label.family, nominal_diameter: label.nominal_diameter, lot_number: label.lot_number },
        catalog_options: catalogOptions,
        wear_reference: wearRef,
      },
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/activations
export async function listActivations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const skip = (page - 1) * limit
    const isEvds = req.user!.role === 'EVDS_ADMIN' || req.user!.role === 'EVDS_SUPPORT'

    const where: Record<string, unknown> = {}
    if (!isEvds) where.company_id = req.user!.companyId
    else if (req.query.company_id) where.company_id = req.query.company_id
    if (req.query.status) where.status = req.query.status

    const [activations, total] = await prisma.$transaction([
      prisma.discActivation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { activated_at: 'desc' },
        include: {
          label: { include: { family: true } },
          company: { select: { id: true, name: true } },
          machine: { select: { id: true, name: true } },
        },
      }),
      prisma.discActivation.count({ where }),
    ])

    // Compute wear for each activation
    const enriched = await Promise.all(
      activations.map(async (a) => {
        const latestLog = await prisma.usageLog.findFirst({
          where: { activation_id: a.id },
          orderBy: { logged_at: 'desc' },
          select: { current_diameter: true },
        })
        const wearRef = await prisma.wearReference.findUnique({
          where: { family_id_nominal_diameter: { family_id: a.label.family_id, nominal_diameter: a.label.nominal_diameter } },
        })
        const currentDia = latestLog ? Number(latestLog.current_diameter) : Number(a.diameter_at_activation)
        const wearPct = wearRef ? calcWear(wearRef.measured_new, wearRef.measured_worn, currentDia) : null
        return { ...a, current_diameter: currentDia, wear_pct: wearPct, wear_reference: wearRef }
      })
    )

    res.json({ data: enriched, total, page, limit })
  } catch (err) {
    next(err)
  }
}

// GET /api/activations/:id
export async function getActivation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const activation = await prisma.discActivation.findUnique({
      where: { id: req.params.id },
      include: {
        label: { include: { family: true } },
        company: { select: { id: true, name: true } },
        _count: { select: { usage_logs: true } },
      },
    })

    if (!activation) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Activation not found' })
      return
    }

    const isEvds = req.user!.role === 'EVDS_ADMIN' || req.user!.role === 'EVDS_SUPPORT'
    if (!isEvds && activation.company_id !== req.user!.companyId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' })
      return
    }

    const [catalogOptions, wearRef, latestLog] = await Promise.all([
      prisma.discCatalog.findMany({ where: { family_id: activation.label.family_id, nominal_diameter: activation.label.nominal_diameter } }),
      prisma.wearReference.findUnique({ where: { family_id_nominal_diameter: { family_id: activation.label.family_id, nominal_diameter: activation.label.nominal_diameter } } }),
      prisma.usageLog.findFirst({ where: { activation_id: activation.id }, orderBy: { logged_at: 'desc' }, select: { current_diameter: true } }),
    ])

    const currentDia = latestLog ? Number(latestLog.current_diameter) : Number(activation.diameter_at_activation)
    const wearPct = wearRef ? calcWear(wearRef.measured_new, wearRef.measured_worn, currentDia) : null

    res.json({ data: { ...activation, catalog_options: catalogOptions, wear_reference: wearRef, current_diameter: currentDia, wear_pct: wearPct } })
  } catch (err) {
    next(err)
  }
}

// POST /api/activations/:id/replace
export async function replaceActivation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const activation = await prisma.discActivation.findUnique({ where: { id: req.params.id } })
    if (!activation || activation.company_id !== req.user!.companyId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Activation not found in your company' })
      return
    }

    const updated = await prisma.discActivation.update({
      where: { id: req.params.id },
      data: { status: 'REPLACED', expired_at: new Date() },
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
}
