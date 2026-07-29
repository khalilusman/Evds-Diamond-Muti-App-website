import api from './client'

export interface DiscFamily {
  id: string
  name: string
}

export interface LotSummary {
  lot_number: string
  print_job_id: string | null
  family_id: string
  family_name: string
  nominal_diameter: number
  total: number
  unused: number
  used: number
  expired_w1: number
  voided: number
  created_at: string
}

export interface GeneratePayload {
  lot_number: string
  family_id: string
  nominal_diameter: number
  quantity: number
}

export interface GenerateResult {
  count: number
  lot_number: string
  preview_codes: string[]
}

export const getDiscFamilies = async (): Promise<DiscFamily[]> => {
  const { data } = await api.get('/api/disc-families')
  return data.data ?? []
}

export const getLots = async (): Promise<LotSummary[]> => {
  const { data } = await api.get('/api/labels/lots')
  return data.data ?? []
}

export const generateLabels = async (payload: GeneratePayload): Promise<GenerateResult> => {
  const { data } = await api.post('/api/labels/generate', payload)
  return data.data
}

export const exportPdf = async (printJobId: string, lotNumber: string): Promise<void> => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  const token = localStorage.getItem('evds_dashboard_token') ?? ''
  const response = await fetch(`${base}/api/labels/export/pdf/${printJobId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Export failed: ${response.status}`)
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `labels-${lotNumber}-${printJobId}.pdf`
  a.click()
  window.URL.revokeObjectURL(url)
}

export interface DiscLabel {
  id: string
  lot_number: string
  print_job_id: string | null
  nominal_diameter: number
  unique_code: string
  full_code: string
  status: string
  activation_count: number
  created_at: string
  family: { name: string }
}

export const getLabels = async (params: { lot_number?: string; print_job_id?: string; status?: string; limit?: number }): Promise<DiscLabel[]> => {
  const { data } = await api.get('/api/labels', { params: { limit: 200, ...params } })
  return data.data ?? []
}

export const voidLabel = async (id: string, reason: string): Promise<void> => {
  await api.patch(`/api/labels/${id}/void`, { reason })
}

export const voidLot = async (lotNumber: string, reason: string): Promise<{ voided: number }> => {
  const { data } = await api.patch(`/api/labels/lot/${lotNumber}/void`, { reason })
  return data.data
}

export const deleteLabel = async (id: string): Promise<void> => {
  await api.delete(`/api/labels/${id}`)
}

export const deleteLot = async (lotNumber: string): Promise<{ deleted: number }> => {
  const { data } = await api.delete(`/api/labels/lot/${lotNumber}`)
  return data.data
}

export const exportCsv = async (lotNumber: string): Promise<void> => {
  const resp = await api.get(`/api/labels/export/csv/${lotNumber}`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(resp.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `${lotNumber}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
