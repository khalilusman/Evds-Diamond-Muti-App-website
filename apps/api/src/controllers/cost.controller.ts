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
    const { machine_cost_hour, labor_cost_hour, energy_cost_kwh, default_disc_price } = req.body

    if (machine_cost_hour === undefined || labor_cost_hour === undefined || energy_cost_kwh === undefined) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'machine_cost_hour, labor_cost_hour, and energy_cost_kwh are required' })
      return
    }

    const config = await prisma.costConfig.upsert({
      where:  { company_id: req.user!.companyId! },
      update: {
        machine_cost_hour: Number(machine_cost_hour),
        labor_cost_hour:   Number(labor_cost_hour),
        energy_cost_kwh:   Number(energy_cost_kwh),
        default_disc_price: default_disc_price !== undefined ? Number(default_disc_price) : undefined,
      },
      create: {
        company_id:        req.user!.companyId!,
        machine_cost_hour: Number(machine_cost_hour),
        labor_cost_hour:   Number(labor_cost_hour),
        energy_cost_kwh:   Number(energy_cost_kwh),
        default_disc_price: default_disc_price !== undefined ? Number(default_disc_price) : null,
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

    const { machine_cost_hour, labor_cost_hour, energy_cost_kwh, default_disc_price } = req.body

    if (machine_cost_hour === undefined || labor_cost_hour === undefined || energy_cost_kwh === undefined) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'machine_cost_hour, labor_cost_hour, and energy_cost_kwh are required' })
      return
    }

    const config = await prisma.costConfig.upsert({
      where:  { company_id: companyId },
      update: {
        machine_cost_hour: Number(machine_cost_hour),
        labor_cost_hour:   Number(labor_cost_hour),
        energy_cost_kwh:   Number(energy_cost_kwh),
        default_disc_price: default_disc_price !== undefined ? Number(default_disc_price) : undefined,
      },
      create: {
        company_id:        companyId,
        machine_cost_hour: Number(machine_cost_hour),
        labor_cost_hour:   Number(labor_cost_hour),
        energy_cost_kwh:   Number(energy_cost_kwh),
        default_disc_price: default_disc_price !== undefined ? Number(default_disc_price) : null,
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
    const {
      activation_id, input_method, piece_count, total_perimeter,
      total_linear_meters, disc_price, thickness, material_type,
      machine_cost_hour, labor_cost_hour, energy_cost_kwh,
      downtime_pct, waste_pct, material_price_m2, estimated_area,
    } = req.body

    if (!input_method || !['DXF', 'MANUAL', 'dxf', 'manual'].includes(input_method)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'input_method must be DXF or MANUAL' })
      return
    }
    if (thickness === undefined) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'thickness is required' })
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

    const metres_to_cut = isManual
      ? Number(total_linear_meters)
      : Number(total_perimeter) / 1000

    const costConfig = await prisma.costConfig.findUnique({ where: { company_id: req.user!.companyId! } })
    if (!costConfig) {
      res.status(400).json({ error: 'NO_COST_CONFIG', message: 'Set up your cost configuration first via PUT /api/cost/config' })
      return
    }

    const effectiveMachineCost = machine_cost_hour !== undefined ? Number(machine_cost_hour) : Number(costConfig.machine_cost_hour)
    const effectiveLaborCost   = labor_cost_hour   !== undefined ? Number(labor_cost_hour)   : Number(costConfig.labor_cost_hour)
    const effectiveEnergyCost  = energy_cost_kwh   !== undefined ? Number(energy_cost_kwh)   : Number(costConfig.energy_cost_kwh)
    const effectiveDowntime    = downtime_pct       !== undefined ? Number(downtime_pct)      : Number(costConfig.downtime_pct)
    const effectiveWaste       = waste_pct          !== undefined ? Number(waste_pct)         : Number(costConfig.waste_pct)

    let catalogParams = null
    if (activation_id) {
      const activation = await prisma.discActivation.findUnique({
        where: { id: activation_id },
        include: { label: true },
      })
      if (activation) {
        const effectiveMaterialType = (material_type as string | undefined) ?? activation.material_type ?? null
        if (effectiveMaterialType) {
          catalogParams = await prisma.discCatalog.findFirst({
            where: {
              family_id:        activation.label.family_id,
              nominal_diameter: activation.label.nominal_diameter,
              material_type:    effectiveMaterialType,
            },
          })
        }
      }
    }

    const effectiveDiscPrice = Number(disc_price ?? costConfig.default_disc_price ?? 0)

    const result = calculateCost({
      metres_to_cut,
      disc_price:        effectiveDiscPrice,
      thickness:         Number(thickness),
      material_price_m2: material_price_m2 ? Number(material_price_m2) : 0,
      estimated_area:    estimated_area    ? Number(estimated_area)    : 0,
      config: {
        machine_cost_hour: effectiveMachineCost,
        labor_cost_hour:   effectiveLaborCost,
        energy_cost_kwh:   effectiveEnergyCost,
        downtime_pct:      effectiveDowntime,
        waste_pct:         effectiveWaste,
      },
      catalog: catalogParams,
    })

    await prisma.costCalculation.create({
      data: {
        company_id:      req.user!.companyId!,
        activation_id:   activation_id ?? null,
        input_method:    input_method.toUpperCase() as 'DXF' | 'MANUAL',
        piece_count:     isManual ? 1 : Number(piece_count),
        total_perimeter: metres_to_cut * 1000,
        result_json:     result as object,
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
    const page  = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const skip  = (page - 1) * limit

    const [calcs, total] = await prisma.$transaction([
      prisma.costCalculation.findMany({
        where:   { company_id: req.user!.companyId! },
        skip,
        take:    limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.costCalculation.count({ where: { company_id: req.user!.companyId! } }),
    ])

    res.json({ data: calcs, total, page, limit })
  } catch (err) {
    next(err)
  }
}
