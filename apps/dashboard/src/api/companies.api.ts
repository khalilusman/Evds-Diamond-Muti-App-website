import api from './client'

export interface Company {
  id: string
  name: string
  contact_name: string
  email: string
  country: string
  language: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
  status_reason?: string | null
  onboarding_complete: boolean
  created_at: string
  updated_at: string
  _count?: {
    activations?: number
    machines?: number
  }
}

export interface CompanyDetail extends Company {
  machines?: Array<{
    id: string
    name: string
    created_at: string
    _count?: { activations: number }
  }>
  cost_config?: {
    machine_cost_hour: number
    labor_cost_hour: number
    energy_cost_kwh: number
    default_disc_price: number
    downtime_pct: number
    waste_pct: number
  } | null
}

export interface AuditLog {
  id: string
  action: string
  actor_id: string
  actor_email?: string
  entity_type: string
  entity_id: string
  old_values?: Record<string, unknown> | null
  new_values?: Record<string, unknown> | null
  created_at: string
}

export const getCompanies = async (params?: {
  status?: string
  search?: string
  country?: string
  page?: number
  limit?: number
}): Promise<{ data: Company[]; total: number; page: number; pages: number }> => {
  const { data } = await api.get('/api/companies', { params: { limit: 20, ...params } })
  return data
}

export const getCompany = async (id: string): Promise<CompanyDetail> => {
  const { data } = await api.get(`/api/companies/${id}`)
  return data.data
}

export const updateCompanyStatus = async (
  id: string,
  status: string,
  reason?: string,
): Promise<Company> => {
  const { data } = await api.patch(`/api/companies/${id}/status`, { status, reason })
  return data.data
}

export const getCompanyAuditLogs = async (companyId: string): Promise<AuditLog[]> => {
  const { data } = await api.get(`/api/companies/${companyId}/audit-logs`)
  return data.data ?? []
}

export interface CompanyUser {
  id: string
  name: string
  email: string
  role: 'CUSTOMER_ADMIN' | 'CUSTOMER_USER'
  is_active: boolean
  created_at: string
}

export const getCompanyUsers = async (companyId: string): Promise<CompanyUser[]> => {
  const { data } = await api.get('/api/users', { params: { company_id: companyId } })
  return data.data ?? []
}
