import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import AppRouter from './router'
import api from './api/client'
import useAuthStore from './stores/auth.store'

export default function App() {
  const { i18n } = useTranslation()
  const { token, updateUser } = useAuthStore()

  useEffect(() => {
    const dir = i18n.language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.dir = dir
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  useEffect(() => {
    if (!token) return
    api.get('/api/auth/me').then(({ data }) => {
      const u = data.data
      updateUser({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        company: u.company
          ? {
              id: u.company.id,
              name: u.company.name,
              status: u.company.status,
              onboarding_complete: u.company.onboarding_complete,
            }
          : undefined,
      })
    }).catch(() => {})
  }, [token])

  return <AppRouter />
}
