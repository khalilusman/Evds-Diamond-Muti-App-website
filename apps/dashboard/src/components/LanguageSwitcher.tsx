import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
]

const STORAGE_KEY = 'evds_dashboard_language'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  function handleChange(code: string) {
    localStorage.setItem(STORAGE_KEY, code)
    i18n.changeLanguage(code)
  }

  // resolvedLanguage handles browser variants like 'en-US' → 'en'
  const active = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className="flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => handleChange(lang.code)}
          className={[
            'px-3 py-1 rounded-full text-sm font-medium transition-colors',
            active === lang.code
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100',
          ].join(' ')}
        >
          {lang.label}
        </button>
      ))}
    </div>
  )
}
