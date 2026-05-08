import { create } from 'zustand'

type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  toggle: () => void
  apply: () => void
}

const STORAGE_KEY = 'evds_dashboard_theme'

function getInitial(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light') return 'light'
  return 'dark'
}

const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitial(),

  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    set({ theme: next })
    get().apply()
  },

  apply: () => {
    const { theme } = get()
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  },
}))

export default useThemeStore
