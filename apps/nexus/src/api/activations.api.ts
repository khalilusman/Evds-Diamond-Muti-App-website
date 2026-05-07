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
  unique_code: string
  full_code: string
  status: string
  diameter_at_activation: number
  thickness_cm: number
  material_group: string
  notes?: string
  expires_at: string
  activated_at: string
  machine: { id: string; name: string }
  label: {
    unique_code: string
    full_code: string
    lot_number: string
    nominal_diameter: number
    family: { id: string; name: string }
  }
  catalog?: {
    recommended_rpm: number
    feed_2cm: number
    life_2cm: number
    feed_3cm: number
    life_3cm: number
  }
  wear_reference?: {
    new_diameter: number
    worn_diameter: number
  }
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
