import api from './client'

export interface DiscFamily {
  id: string
  name: string
}

export interface LotSummary {
  lot_number: string
  family_id: string
  family_name: string
  nominal_diameter: number
  total: number
  unused: number
  active: number
  expired_w1: number
  permanently_used: number
  voided: number
  generated_at: string
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

export const exportPdf = async (lotNumber: string): Promise<void> => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  const token = localStorage.getItem('evds_dashboard_token') ?? ''
  const response = await fetch(`${base}/api/labels/export/pdf/${lotNumber}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Export failed: ${response.status}`)
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `labels-${lotNumber}.pdf`
  a.click()
  window.URL.revokeObjectURL(url)
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
