import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white p-0.5">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => i18n.changeLanguage(lang.code)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            i18n.language === lang.code
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  )
}
