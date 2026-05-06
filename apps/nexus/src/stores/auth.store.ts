import { create } from 'zustand'

interface User {
  id: string
  name: string
  email: string
  role: string
  company?: {
    id: string
    name: string
    status: string
    onboarding_complete: boolean
  }
}

interface AuthStore {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  setAuth: (token: string, user: User) => void
  logout: () => void
  updateUser: (user: User) => void
}

const useAuthStore = create<AuthStore>((set) => ({
  token: localStorage.getItem('evds_token'),
  user: JSON.parse(localStorage.getItem('evds_user') || 'null'),
  isAuthenticated: !!localStorage.getItem('evds_token'),

  setAuth: (token, user) => {
    localStorage.setItem('evds_token', token)
    localStorage.setItem('evds_user', JSON.stringify(user))
    set({ token, user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('evds_token')
    localStorage.removeItem('evds_user')
    set({ token: null, user: null, isAuthenticated: false })
  },

  updateUser: (user) => {
    localStorage.setItem('evds_user', JSON.stringify(user))
    set({ user })
  },
}))

export default useAuthStore
