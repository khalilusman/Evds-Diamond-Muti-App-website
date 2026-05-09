import api from './client'

export interface Machine {
  id: string
  name: string
  company_id: string
  created_at: string
  active_disc_count: number
}

export interface MachineActivation {
  id: string
  status: string
  diameter_at_activation: number
  expires_at: string
  activated_at: string
  label: {
    unique_code: string
    lot_number: string
    nominal_diameter: number
    status: string
    family: { name: string }
  }
}

export const getMachines = async (): Promise<Machine[]> => {
  const { data } = await api.get('/api/machines')
  return data.data
}

export const getMachineActivations = async (id: string): Promise<MachineActivation[]> => {
  const { data } = await api.get(`/api/machines/${id}/activations`)
  return data.data
}

export const createMachine = async (name: string): Promise<Machine> => {
  const { data } = await api.post('/api/machines', { name })
  return data.data
}

export const renameMachine = async (id: string, name: string): Promise<Machine> => {
  const { data } = await api.patch(`/api/machines/${id}`, { name })
  return data.data
}

export const deleteMachine = async (id: string): Promise<void> => {
  await api.delete(`/api/machines/${id}`)
}
