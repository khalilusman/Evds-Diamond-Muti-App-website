import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import es from './locales/es.json'
import de from './locales/de.json'
import fr from './locales/fr.json'
import pt from './locales/pt.json'
import it from './locales/it.json'
import ar from './locales/ar.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, es, de, fr, pt, it, ar },
    fallbackLng: 'es',
    defaultNS: 'translation',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'evds_language',
    },
    interpolation: { escapeValue: false },
  })

export default i18n
