import api from './client'

export interface SatTicket {
  id: string
  activation_id: string
  company_id: string
  reported_by: string
  symptom_code: string
  symptom_detail?: string | null
  rpm_reported?: number | null
  feed_reported?: number | null
  diameter_reported?: number | null
  auto_diagnosis: string
  probable_cause: string
  recommended_fix: string
  prevention: string
  photo_urls: string[]
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED'
  evds_solution?: string | null
  resolved_at?: string | null
  created_at: string
  activation?: {
    id: string
    diameter_at_activation: number
    thickness_cm: number
    label: {
      unique_code: string
      nominal_diameter: number
      family: { name: string }
    }
  }
  catalog_params?: {
    recommended_rpm: number
    feed_2cm: number
    life_2cm: number
    feed_3cm: number
    life_3cm: number
  } | null
}

export interface CreateSatTicketData {
  activation_id: string
  symptom_code: string
  symptom_detail?: string
  rpm_reported?: number | null
  feed_reported?: number | null
  diameter_reported?: number | null
}

export const createSatTicket = async (data: CreateSatTicketData): Promise<SatTicket> => {
  const { data: res } = await api.post('/api/sat', data)
  return res.data
}

export const getSatTickets = async (status?: string): Promise<SatTicket[]> => {
  const { data } = await api.get('/api/sat', {
    params: status ? { status } : undefined,
  })
  return data.data
}

export const getSatTicket = async (id: string): Promise<SatTicket> => {
  const { data } = await api.get(`/api/sat/${id}`)
  return data.data
}

export const uploadSatPhotos = async (ticketId: string, files: File[]): Promise<string[]> => {
  const formData = new FormData()
  files.forEach((f) => formData.append('photos', f))
  const { data } = await api.post(`/api/sat/${ticketId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data.photo_urls
}

export const escalateTicket = async (id: string): Promise<SatTicket> => {
  const { data } = await api.patch(`/api/sat/${id}/escalate`)
  return data.data
}
