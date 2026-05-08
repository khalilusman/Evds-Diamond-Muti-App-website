import api from './client'

export interface SecurityAlert {
  id: string
  unique_code: string
  result: string
  company_id: string | null
  user_id: string | null
  ip_address: string | null
  created_at: string
  suspicious: boolean
}

export interface SecurityListParams {
  result?: string
  date_from?: string
  date_to?: string
  page?: number
  limit?: number
}

export const getSecurityAlerts = async (params: SecurityListParams = {}): Promise<{ data: SecurityAlert[]; total: number; page: number }> => {
  const { data } = await api.get('/api/labels/security-alerts', { params })
  return data
}

export const voidLabel = async (id: string, reason: string): Promise<void> => {
  await api.patch(`/api/labels/${id}/void`, { reason })
}
