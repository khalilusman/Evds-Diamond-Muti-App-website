import api from './client'

export interface CompanyInfo {
  id: string
  name: string
  contact_name: string
  country: string
  language: string
  created_at: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

export const getMyCompany = async (): Promise<CompanyInfo> => {
  const { data } = await api.get('/api/companies/me')
  return data.data
}

export const updateMyCompanyLanguage = async (language: string): Promise<void> => {
  await api.patch('/api/companies/me', { language })
}

export const changePassword = async (
  current_password: string,
  new_password: string,
): Promise<void> => {
  await api.patch('/api/auth/change-password', { current_password, new_password })
}

export const getTeamMembers = async (): Promise<TeamMember[]> => {
  const { data } = await api.get('/api/users')
  return data.data ?? []
}

export const addTeamMember = async (payload: {
  name: string
  email: string
  password: string
  role: string
}): Promise<TeamMember> => {
  const { data } = await api.post('/api/users', payload)
  return data.data
}

export const deactivateTeamMember = async (id: string): Promise<void> => {
  await api.delete(`/api/users/${id}`)
}
