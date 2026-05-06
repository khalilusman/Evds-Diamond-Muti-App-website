import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Logo from '../../components/Logo'
import ThemeToggle from '../../components/ThemeToggle'
import Button from '../../components/Button'

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
]

export default function LanguageSelectPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)

  function handleContinue() {
    if (!selected) return
    localStorage.setItem('evds_language', selected)
    i18n.changeLanguage(selected)
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <Logo size="lg" className="mb-8" />

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          {t('language_select.title')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-center">
          {t('language_select.subtitle')}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 w-full max-w-2xl mb-8">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setSelected(lang.code)}
              className={[
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200',
                'bg-white dark:bg-gray-900',
                selected === lang.code
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-105'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:scale-105',
              ].join(' ')}
            >
              <span className="text-4xl">{lang.flag}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {lang.label}
              </span>
            </button>
          ))}
        </div>

        <Button
          onClick={handleContinue}
          disabled={!selected}
          className="max-w-xs w-full"
        >
          {t('language_select.continue')}
        </Button>
      </div>
    </div>
  )
}
