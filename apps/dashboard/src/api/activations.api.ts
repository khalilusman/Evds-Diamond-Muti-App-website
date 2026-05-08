import api from './client'

export interface AdminActivation {
  id: string
  status: string
  diameter_at_activation: number
  thickness_cm: number
  material_group?: string | null
  activation_window: number
  expires_at: string
  activated_at: string
  expired_at?: string | null
  current_diameter?: number
  wear_pct?: number | null
  company?: { id: string; name: string }
  machine?: { id: string; name: string } | null
  label: {
    unique_code: string
    full_code: string
    lot_number: string
    nominal_diameter: number
    family: { id: string; name: string }
  }
  wear_reference?: {
    measured_new: number
    measured_worn: number
  } | null
}

export const getAllActivations = async (): Promise<AdminActivation[]> => {
  const { data } = await api.get('/api/activations', { params: { all: true, limit: 500 } })
  return data.data ?? []
}

export const getCompanyActivations = async (companyId: string): Promise<AdminActivation[]> => {
  const { data } = await api.get('/api/activations', { params: { company_id: companyId, limit: 100 } })
  return data.data ?? []
}
