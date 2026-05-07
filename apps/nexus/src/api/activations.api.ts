import api from './client'

export interface LabelLookup {
  id: string
  unique_code: string
  full_code: string
  lot_number: string
  nominal_diameter: number
  status: string
  activation_count: number
  family: {
    id: string
    name: string
  }
}

export interface Activation {
  id: string
  status: string
  diameter_at_activation: number
  thickness_cm: number
  material_group?: string | null
  activation_window: number
  notes?: string | null
  expires_at: string
  expired_at?: string | null
  activated_at: string
  machine?: { id: string; name: string } | null
  label: {
    unique_code: string
    full_code: string
    lot_number: string
    nominal_diameter: number
    family: { id: string; name: string }
  }
  current_diameter?: number
  wear_pct?: number | null
  wear_reference?: {
    measured_new: number
    measured_worn: number
  } | null
}

export interface CreateActivationData {
  unique_code: string
  machine_id: string
  diameter_at_activation: number
  thickness_cm: number
  material_group: string
  notes?: string
}

export const lookupCode = async (code: string): Promise<LabelLookup> => {
  const { data } = await api.get('/api/labels/lookup', { params: { code } })
  return data.data
}

export const createActivation = async (payload: CreateActivationData): Promise<Activation> => {
  const { data } = await api.post('/api/activations', payload)
  return data.data
}

export const getActivations = async (status?: string): Promise<Activation[]> => {
  const { data } = await api.get('/api/activations', {
    params: status ? { status } : undefined,
  })
  return data.data
}

export const getAllActivations = async (): Promise<Activation[]> => {
  const { data } = await api.get('/api/activations')
  return data.data
}
