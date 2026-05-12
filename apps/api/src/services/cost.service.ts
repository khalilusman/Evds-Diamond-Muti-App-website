interface CostConfig {
  machine_cost_hour: number
  labor_cost_hour:   number
  energy_cost_kwh:   number
  downtime_pct:      number
  waste_pct:         number
}

interface CatalogParams {
  thickness_t1: number
  feed_t1:      number
  life_t1:      number
  thickness_t2: number
  feed_t2:      number
  life_t2:      number
}

interface CostInput {
  metres_to_cut:      number
  disc_price:         number
  thickness:          number
  material_price_m2?: number
  estimated_area?:    number
  config:             CostConfig
  catalog?:           CatalogParams | null
}

export interface CostResult {
  disc_fraction:     number
  disc_cost:         number
  time_minutes:      number
  machine_cost:      number
  labor_cost:        number
  energy_cost:       number
  material_cost:     number
  total:             number
  cost_per_lm:       number
  feed_used:         number
  life_used:         number
  metres_to_cut:     number
  disc_price:        number
  machine_cost_hour: number
  labor_cost_hour:   number
  energy_cost_kwh:   number
  downtime_pct:      number
  waste_pct:         number
}

export function calculateCost(input: CostInput): CostResult {
  const {
    metres_to_cut, disc_price, thickness, config, catalog,
    material_price_m2 = 0, estimated_area = 0,
  } = input

  let feed_mm_min = 2000
  let life_lm = 1000
  if (catalog) {
    const useT2 = Math.abs(Number(catalog.thickness_t2) - thickness) < 0.01
    feed_mm_min = useT2 ? catalog.feed_t2 : catalog.feed_t1
    life_lm     = useT2 ? catalog.life_t2  : catalog.life_t1
  }

  const time_minutes  = (metres_to_cut * 1000) / feed_mm_min
  const time_hours    = time_minutes / 60

  const disc_fraction = metres_to_cut / life_lm
  const disc_cost     = disc_fraction * disc_price

  const machine_cost  = time_hours * config.machine_cost_hour * (1 + config.downtime_pct / 100)
  const labor_cost    = time_hours * config.labor_cost_hour
  const energy_cost   = time_hours * 3.5 * config.energy_cost_kwh
  const material_cost = material_price_m2 > 0
    ? material_price_m2 * estimated_area * (1 + config.waste_pct / 100)
    : 0

  const total       = disc_cost + machine_cost + labor_cost + energy_cost + material_cost
  const cost_per_lm = metres_to_cut > 0 ? total / metres_to_cut : 0

  return {
    disc_fraction:     round(disc_fraction, 4),
    disc_cost:         round(disc_cost),
    time_minutes:      round(time_minutes, 1),
    machine_cost:      round(machine_cost),
    labor_cost:        round(labor_cost),
    energy_cost:       round(energy_cost),
    material_cost:     round(material_cost),
    total:             round(total),
    cost_per_lm:       round(cost_per_lm, 4),
    feed_used:         feed_mm_min,
    life_used:         life_lm,
    metres_to_cut:     round(metres_to_cut, 3),
    disc_price,
    machine_cost_hour: config.machine_cost_hour,
    labor_cost_hour:   config.labor_cost_hour,
    energy_cost_kwh:   config.energy_cost_kwh,
    downtime_pct:      config.downtime_pct,
    waste_pct:         config.waste_pct,
  }
}

function round(val: number, decimals = 2): number {
  return Math.round(val * 10 ** decimals) / 10 ** decimals
}
