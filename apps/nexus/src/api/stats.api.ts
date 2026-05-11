import api from './client'

export interface StatsByMaterial {
  material_group: string
  total_meters: number
  sessions: number
  avg_rpm: number | null
  avg_feed: number | null
}

export interface StatsByMachineMaterial {
  material_group: string
  meters: number
  sessions: number
  avg_rpm: number | null
  avg_feed: number | null
}

export interface StatsByMachine {
  machine_id: string
  machine_name: string
  total_meters: number
  sessions: number
  most_used_material: string | null
  last_activity: string | null
  by_material: StatsByMachineMaterial[]
}

export interface StatsByDate {
  date: string
  meters: number
  sessions: number
}

export interface StatsByMachineDate {
  date: string
  machine_id: string
  machine_name: string
  meters: number
}

export interface UsageStats {
  total_meters: number
  total_sessions: number
  active_discs: number
  by_material: StatsByMaterial[]
  by_machine: StatsByMachine[]
  by_date: StatsByDate[]
  by_machine_date: StatsByMachineDate[]
}

export const getUsageStats = async (params?: {
  date_from?: string
  date_to?: string
}): Promise<UsageStats> => {
  const { data } = await api.get('/api/usage-logs/stats', { params })
  return data.data
}
