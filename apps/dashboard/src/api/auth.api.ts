import api from './client'

export interface DashboardUser {
  id: string
  name: string
  email: string
  role: string
  company_id?: string | null
}

export interface LoginResponse {
  token: string
  user: DashboardUser
}

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const { data } = await api.post('/api/auth/login', { email, password })
  return data.data
}

export const getMe = async (): Promise<DashboardUser> => {
  const { data } = await api.get('/api/auth/me')
  return data.data
}

export const updateMyEmail = async (email: string): Promise<DashboardUser> => {
  const { data } = await api.patch('/api/users/me/email', { email })
  return data.data
}

export const updateMyPassword = async (
  current_password: string,
  new_password: string,
): Promise<void> => {
  await api.patch('/api/users/me/password', { current_password, new_password })
}
