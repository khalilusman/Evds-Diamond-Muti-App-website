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

export const getAnalyticsSummary = async (): Promise<AnalyticsSummary> => {
  const { data } = await api.get('/api/analytics/summary')
  return data.data
}
