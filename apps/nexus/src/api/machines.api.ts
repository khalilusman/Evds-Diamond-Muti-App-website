import api from './client'

export interface Machine {
  id: string
  name: string
  company_id: string
  created_at: string
  _count?: { activations: number }
}

export const getMachines = async (): Promise<Machine[]> => {
  const { data } = await api.get('/api/machines')
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
