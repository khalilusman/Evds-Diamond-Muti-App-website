import api from './client'

export interface UsageLog {
  id: string
  activation_id: string
  current_diameter: number
  meters_cut: number
  rpm_used?: number
  feed_used?: number
  cut_type?: string
  water_flow_ok: boolean
  notes?: string
  logged_at: string
  activation?: {
    full_code: string
    label: {
      unique_code: string
      family: { name: string }
    }
  }
}

export interface CreateUsageLogData {
  activation_id: string
  current_diameter: number
  meters_cut: number
  thickness: number
  material_type: string
  rpm_used?: number | null
  feed_used?: number | null
  cut_type?: string | null
  water_flow_ok?: boolean
  notes?: string | null
}

export const createUsageLog = async (payload: CreateUsageLogData): Promise<{ data: UsageLog }> => {
  const { data } = await api.post('/api/usage-logs', payload)
  return data
}

export const getUsageLogs = async (activationId?: string): Promise<UsageLog[]> => {
  const { data } = await api.get('/api/usage-logs', {
    params: activationId ? { activation_id: activationId } : undefined,
  })
  return data.data
}
