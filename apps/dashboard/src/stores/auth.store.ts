import { create } from 'zustand'
import { DashboardUser } from '../api/auth.api'

const ALLOWED_ROLES = new Set(['EVDS_ADMIN', 'EVDS_SUPPORT'])

interface AuthState {
  token: string | null
  user: DashboardUser | null
  isAuthenticated: boolean
  setAuth: (token: string, user: DashboardUser) => void
  logout: () => void
}

function loadStored(): { token: string | null; user: DashboardUser | null } {
  try {
    const token = localStorage.getItem('evds_dashboard_token')
    const raw = localStorage.getItem('evds_dashboard_user')
    const user: DashboardUser | null = raw ? JSON.parse(raw) : null
    if (token && user && ALLOWED_ROLES.has(user.role)) {
      return { token, user }
    }
  } catch {
    // ignore
  }
  return { token: null, user: null }
}

const stored = loadStored()

const useAuthStore = create<AuthState>((set) => ({
  token: stored.token,
  user: stored.user,
  isAuthenticated: !!stored.token,

  setAuth: (token, user) => {
    localStorage.setItem('evds_dashboard_token', token)
    localStorage.setItem('evds_dashboard_user', JSON.stringify(user))
    set({ token, user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('evds_dashboard_token')
    localStorage.removeItem('evds_dashboard_user')
    set({ token: null, user: null, isAuthenticated: false })
  },
}))

export { ALLOWED_ROLES }
export default useAuthStore
