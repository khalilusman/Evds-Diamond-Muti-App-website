import api from './client'

export interface CostConfig {
  id: string
  company_id: string
  machine_cost_hour:  number
  labor_cost_hour:    number
  energy_cost_kwh:    number
  default_disc_price: number | null
  downtime_pct:       number
  waste_pct:          number
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

export interface CostCalculation {
  id: string
  company_id: string
  activation_id?: string | null
  input_method: 'DXF' | 'MANUAL'
  piece_count: number
  total_perimeter: number
  result_json: CostResult
  created_at: string
}

export interface CalculatePayload {
  activation_id?:       string
  input_method:         'DXF' | 'MANUAL'
  piece_count?:         number
  total_perimeter?:     number
  total_linear_meters?: number
  disc_price?:          number
  thickness?:           number
  material_type?:       string
  machine_cost_hour?:   number
  labor_cost_hour?:     number
  energy_cost_kwh?:     number
  downtime_pct?:        number
  waste_pct?:           number
  material_price_m2?:   number
  estimated_area?:      number
}

export const getCostConfig = async (): Promise<CostConfig | null> => {
  try {
    const { data } = await api.get('/api/cost/config')
    return data.data
  } catch {
    return null
  }
}

export const calculateCost = async (payload: CalculatePayload): Promise<CostResult> => {
  const { data } = await api.post('/api/cost/calculate', payload)
  return data.data
}

export const getCalculations = async (): Promise<CostCalculation[]> => {
  const { data } = await api.get('/api/cost/calculations', { params: { limit: 5 } })
  return data.data
}
