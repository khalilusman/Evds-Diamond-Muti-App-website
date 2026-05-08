import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import AppRouter from './router'
import useThemeStore from './stores/theme.store'

export default function App() {
  const { i18n } = useTranslation()
  const { apply } = useThemeStore()

  useEffect(() => {
    apply()
  }, [])

  useEffect(() => {
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  return <AppRouter />
}
