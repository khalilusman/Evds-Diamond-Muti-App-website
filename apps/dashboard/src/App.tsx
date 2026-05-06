import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function App() {
  const { i18n } = useTranslation()

  useEffect(() => {
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <h1 className="text-3xl font-bold text-gray-900">EVDS Dashboard</h1>
    </div>
  )
}
