import api from './client'

export interface AnalyticsSummary {
  active_companies: number
  pending_companies: number
  discs_in_field: number
  open_sat_tickets: number
  wear_alerts: number
  new_this_week: number
  labels_generated: number
  activation_rate_pct: number
  first_pending_company?: { id: string; name: string } | null
  oldest_open_ticket?: { id: string; symptom_code: string; company_name: string; created_at: string } | null
}

export interface WeeklyPoint {
  week_start: string
  week_end: string
  new_companies: number
  new_activations: number
  usage_logs_count: number
  sat_tickets_count: number
}

export interface MaterialPoint {
  material_type: string
  count: number
  percentage: number
}

export interface GeographyPoint {
  country: string
  company_count: number
}

export interface WearAlert {
  activation_id: string
  company: { id: string; name: string }
  machine_name: string | null
  family: string
  nominal_diameter: number
  wear_pct: number
  level: 'warning' | 'critical'
  expires_at: string
}

export interface PerformanceData {
  avg_rpm_deviation_pct: number
  avg_feed_deviation_pct: number
  abnormal_wear_cases: number
  top_symptoms: { symptom_code: string; count: number }[]
}

export const getAnalyticsSummary = async (): Promise<AnalyticsSummary> => {
  const { data } = await api.get('/api/analytics/summary')
  return data.data
}

export const getWeekly = async (weeks = 12): Promise<WeeklyPoint[]> => {
  const { data } = await api.get('/api/analytics/weekly', { params: { weeks } })
  return data.data
}

export const getMaterials = async (): Promise<MaterialPoint[]> => {
  const { data } = await api.get('/api/analytics/materials')
  return data.data
}

export const getGeography = async (): Promise<GeographyPoint[]> => {
  const { data } = await api.get('/api/analytics/geography')
  return data.data
}

export const getWearAlerts = async (): Promise<WearAlert[]> => {
  const { data } = await api.get('/api/analytics/wear-alerts')
  return data.data
}

export const getPerformance = async (): Promise<PerformanceData> => {
  const { data } = await api.get('/api/analytics/performance')
  return data.data
}
