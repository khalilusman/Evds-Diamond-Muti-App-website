import api from './client'

export interface SatTicketSummary {
  id: string
  status: string
  symptom_code: string
  created_at: string
  resolved_at: string | null
  company_id: string
  activation: {
    id: string
    diameter_at_activation: number
    material_group: string | null
    company: { name: string }
    label: {
      unique_code: string
      nominal_diameter: number
      family: { name: string }
    }
  }
}

export interface SatTicketDetail {
  id: string
  status: string
  symptom_code: string
  symptom_detail: string | null
  created_at: string
  resolved_at: string | null
  company_id: string
  rpm_reported: number | null
  feed_reported: number | null
  diameter_reported: number | null
  auto_diagnosis: string | null
  probable_cause: string | null
  recommended_fix: string | null
  prevention: string | null
  evds_solution: string | null
  resolved_by: string | null
  photo_urls: string[]
  activation: {
    id: string
    diameter_at_activation: number
    thickness_cm: number
    material_group: string | null
    activated_at: string
    company: {
      name: string
      contact_name: string
      email: string
      country: string
    }
    machine: {
      name: string
    }
    label: {
      unique_code: string
      lot_number: string
      nominal_diameter: number
      family: { name: string }
    }
  }
  reporter: { name: string; email: string } | null
  catalog_params: {
    recommended_rpm: number
    feed_2cm: number
    feed_3cm: number
  } | null
  comparison: {
    rpm: { reported: number | null; recommended: number }
    feed: { reported: number | null; recommended: number }
  } | null
}

export interface SatListParams {
  status?: string
  page?: number
  limit?: number
  date_from?: string
  date_to?: string
}

export const getSatTickets = async (params: SatListParams = {}): Promise<{ data: SatTicketSummary[]; total: number; page: number }> => {
  const { data } = await api.get('/api/sat', { params })
  return data
}

export const getSatTicket = async (id: string): Promise<SatTicketDetail> => {
  const { data } = await api.get(`/api/sat/${id}`)
  return data.data
}

export const resolveSatTicket = async (id: string, solution: string): Promise<void> => {
  await api.patch(`/api/sat/${id}/resolve`, { evds_solution: solution })
}

export const escalateSatTicket = async (id: string, note?: string): Promise<void> => {
  await api.patch(`/api/sat/${id}/escalate`, { note })
}

export const markInReview = async (id: string): Promise<void> => {
  await api.patch(`/api/sat/${id}/status`, { status: 'IN_REVIEW' })
}
