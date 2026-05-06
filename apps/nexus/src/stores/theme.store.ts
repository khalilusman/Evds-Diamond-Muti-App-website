import { create } from 'zustand'

interface ThemeStore {
  theme: 'dark' | 'light'
  toggleTheme: () => void
  setTheme: (theme: 'dark' | 'light') => void
}

const getInitialTheme = (): 'dark' | 'light' => {
  const saved = localStorage.getItem('evds_theme')
  if (saved === 'light') return 'light'
  return 'dark'
}

const applyTheme = (theme: 'dark' | 'light') => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  localStorage.setItem('evds_theme', theme)
}

const useThemeStore = create<ThemeStore>((set) => {
  const initial = getInitialTheme()
  applyTheme(initial)
  return {
    theme: initial,
    toggleTheme: () =>
      set((state) => {
        const next = state.theme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        return { theme: next }
      }),
    setTheme: (theme) => {
      applyTheme(theme)
      set({ theme })
    },
  }
})

export default useThemeStore
