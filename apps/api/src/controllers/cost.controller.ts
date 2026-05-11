import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { calculateCost } from '../services/cost.service'

// GET /api/cost/config
export async function getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = await prisma.costConfig.findUnique({ where: { company_id: req.user!.companyId! } })
    if (!config) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'No cost configuration set for this company. Set it up first.' })
      return
    }
    res.json({ data: config })
  } catch (err) {
    next(err)
  }
}

// PUT /api/cost/config
export async function upsertConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { machine_cost_hour, labor_cost_hour, energy_cost_kwh, default_disc_price, downtime_pct, waste_pct } = req.body

    if (machine_cost_hour === undefined || labor_cost_hour === undefined || energy_cost_kwh === undefined || default_disc_price === undefined) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'machine_cost_hour, labor_cost_hour, energy_cost_kwh, default_disc_price are required' })
      return
    }

    const config = await prisma.costConfig.upsert({
      where: { company_id: req.user!.companyId! },
      update: {
        machine_cost_hour: Number(machine_cost_hour),
        labor_cost_hour: Number(labor_cost_hour),
        energy_cost_kwh: Number(energy_cost_kwh),
        default_disc_price: Number(default_disc_price),
        downtime_pct: downtime_pct !== undefined ? Number(downtime_pct) : 10,
        waste_pct: waste_pct !== undefined ? Number(waste_pct) : 5,
      },
      create: {
        company_id: req.user!.companyId!,
        machine_cost_hour: Number(machine_cost_hour),
        labor_cost_hour: Number(labor_cost_hour),
        energy_cost_kwh: Number(energy_cost_kwh),
        default_disc_price: Number(default_disc_price),
        downtime_pct: downtime_pct !== undefined ? Number(downtime_pct) : 10,
        waste_pct: waste_pct !== undefined ? Number(waste_pct) : 5,
      },
    })

    res.json({ data: config })
  } catch (err) {
    next(err)
  }
}

// POST /api/cost/configs  (create or update — both CUSTOMER_ADMIN and CUSTOMER_USER)
export async function createOrUpdateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.user!.companyId
    if (!companyId) {
      res.status(400).json({ error: 'NO_COMPANY', message: 'No company associated with this account' })
      return
    }

    const { machine_cost_hour, labor_cost_hour, energy_cost_kwh, default_disc_price, downtime_pct, waste_pct } = req.body

    if (machine_cost_hour === undefined || labor_cost_hour === undefined || energy_cost_kwh === undefined || default_disc_price === undefined) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'machine_cost_hour, labor_cost_hour, energy_cost_kwh, default_disc_price are required' })
      return
    }

    const config = await prisma.costConfig.upsert({
      where: { company_id: companyId },
      update: {
        machine_cost_hour: Number(machine_cost_hour),
        labor_cost_hour: Number(labor_cost_hour),
        energy_cost_kwh: Number(energy_cost_kwh),
        default_disc_price: Number(default_disc_price),
        downtime_pct: downtime_pct !== undefined ? Number(downtime_pct) : undefined,
        waste_pct: waste_pct !== undefined ? Number(waste_pct) : undefined,
      },
      create: {
        company_id: companyId,
        machine_cost_hour: Number(machine_cost_hour),
        labor_cost_hour: Number(labor_cost_hour),
        energy_cost_kwh: Number(energy_cost_kwh),
        default_disc_price: Number(default_disc_price),
        downtime_pct: downtime_pct !== undefined ? Number(downtime_pct) : 10,
        waste_pct: waste_pct !== undefined ? Number(waste_pct) : 5,
      },
    })

    res.status(200).json({ data: config })
  } catch (err) {
    next(err)
  }
}

// POST /api/cost/calculate
export async function calculate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { activation_id, input_method, piece_count, total_perimeter, total_linear_meters, material_price, disc_price, copies, thickness_cm, machine_cost_hour, labor_cost_hour, energy_cost_kwh, downtime_pct, waste_pct } = req.body

    if (!input_method || !['DXF', 'MANUAL', 'dxf', 'manual'].includes(input_method)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'input_method must be DXF or MANUAL' })
      return
    }
    if (material_price === undefined || copies === undefined || thickness_cm === undefined) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'material_price, copies, thickness_cm are required' })
      return
    }

    const isManual = input_method.toUpperCase() === 'MANUAL'

    if (isManual && total_linear_meters === undefined) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'total_linear_meters is required for MANUAL input' })
      return
    }
    if (!isManual && (piece_count === undefined || total_perimeter === undefined)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'piece_count and total_perimeter are required for DXF input' })
      return
    }

    const effectivePerimeter = isManual
      ? Number(total_linear_meters) * 1000
      : Number(total_perimeter)
    const effectivePieceCount = isManual ? 1 : Number(piece_count)

    const costConfig = await prisma.costConfig.findUnique({ where: { company_id: req.user!.companyId! } })
    if (!costConfig) {
      res.status(400).json({ error: 'NO_COST_CONFIG', message: 'Set up your cost configuration first via PUT /api/cost/config' })
      return
    }

    let catalogParams = null
    if (activation_id) {
      const activation = await prisma.discActivation.findUnique({
        where: { id: activation_id },
        include: { label: true },
      })
      if (activation?.material_group) {
        catalogParams = await prisma.discCatalog.findFirst({
          where: {
            family_id: activation.label.family_id,
            nominal_diameter: activation.label.nominal_diameter,
            material_group: activation.material_group,
          },
        })
      }
    }

    const effectiveDiscPrice = Number(disc_price ?? costConfig.default_disc_price)

    const result = calculateCost({
      piece_count: effectivePieceCount,
      total_perimeter: effectivePerimeter,
      material_price: Number(material_price),
      disc_price: effectiveDiscPrice,
      copies: Number(copies),
      thickness_cm: Number(thickness_cm) === 3 ? 3 : 2,
      config: {
        machine_cost_hour: machine_cost_hour !== undefined ? Number(machine_cost_hour) : Number(costConfig.machine_cost_hour),
        labor_cost_hour:   labor_cost_hour   !== undefined ? Number(labor_cost_hour)   : Number(costConfig.labor_cost_hour),
        energy_cost_kwh:   energy_cost_kwh   !== undefined ? Number(energy_cost_kwh)   : Number(costConfig.energy_cost_kwh),
        downtime_pct:      downtime_pct      !== undefined ? Number(downtime_pct)      : Number(costConfig.downtime_pct),
        waste_pct:         waste_pct         !== undefined ? Number(waste_pct)         : Number(costConfig.waste_pct),
      },
      catalog: catalogParams,
    })

    await prisma.costCalculation.create({
      data: {
        company_id: req.user!.companyId!,
        activation_id: activation_id ?? null,
        input_method: input_method.toUpperCase() as 'DXF' | 'MANUAL',
        piece_count: effectivePieceCount,
        total_perimeter: effectivePerimeter,
        result_json: result as object,
      },
    })

    res.json({ data: result })
  } catch (err) {
    next(err)
  }
}

// GET /api/cost/calculations
export async function listCalculations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const [calcs, total] = await prisma.$transaction([
      prisma.costCalculation.findMany({
        where: { company_id: req.user!.companyId! },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.costCalculation.count({ where: { company_id: req.user!.companyId! } }),
    ])

    res.json({ data: calcs, total, page, limit })
  } catch (err) {
    next(err)
  }
}
