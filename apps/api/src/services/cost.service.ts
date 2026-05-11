interface CostConfig {
  machine_cost_hour: number
  labor_cost_hour: number
  energy_cost_kwh: number
  downtime_pct: number
  waste_pct: number
}

interface CatalogParams {
  feed_2cm: number
  feed_3cm: number
  life_2cm: number
  life_3cm: number
}

interface CostInput {
  piece_count: number
  total_perimeter: number  // in mm
  material_price: number
  disc_price: number
  copies: number
  thickness_cm: 2 | 3
  config: CostConfig
  catalog?: CatalogParams | null
}

export interface CostResult {
  cutting_time_min: number
  machine_cost: number
  labor_cost: number
  disc_wear_cost: number
  energy_cost: number
  material_cost: number
  subtotal: number
  total: number
  cost_per_meter: number
  cost_per_piece: number
  total_linear_meters: number
  copies: number
  piece_count: number
  total_perimeter: number
}

export function calculateCost(input: CostInput): CostResult {
  const { piece_count, total_perimeter, material_price, disc_price, copies, thickness_cm, config, catalog } = input

  const feedSpeed = catalog ? (thickness_cm === 3 ? catalog.feed_3cm : catalog.feed_2cm) : 2000
  const expectedLife = catalog ? (thickness_cm === 3 ? catalog.life_3cm : catalog.life_2cm) : 1000

  const cutting_time_min = total_perimeter / feedSpeed

  const machine_cost = (cutting_time_min / 60) * config.machine_cost_hour * (1 + config.downtime_pct / 100)
  const labor_cost = (cutting_time_min / 60) * config.labor_cost_hour
  const disc_wear_cost = (total_perimeter / (expectedLife * 1000)) * disc_price
  const energy_cost = (cutting_time_min / 60) * 3.5 * config.energy_cost_kwh
  const material_cost = piece_count * 0.1 * material_price * (1 + config.waste_pct / 100)

  const subtotal = machine_cost + labor_cost + disc_wear_cost + energy_cost + material_cost
  const total = subtotal * copies
  const total_linear_meters = total_perimeter / 1000
  const cost_per_meter = total_linear_meters * copies > 0
    ? total / (total_linear_meters * copies)
    : 0
  const cost_per_piece = piece_count * copies > 0 ? total / (piece_count * copies) : 0

  return {
    cutting_time_min: round(cutting_time_min),
    machine_cost: round(machine_cost),
    labor_cost: round(labor_cost),
    disc_wear_cost: round(disc_wear_cost),
    energy_cost: round(energy_cost),
    material_cost: round(material_cost),
    subtotal: round(subtotal),
    total: round(total),
    cost_per_meter: round(cost_per_meter, 4),
    cost_per_piece: round(cost_per_piece),
    total_linear_meters: round(total_linear_meters, 3),
    copies,
    piece_count,
    total_perimeter,
  }
}

function round(val: number, decimals = 2): number {
  return Math.round(val * 10 ** decimals) / 10 ** decimals
}
