import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import AuthLayout from '../../layouts/AuthLayout'
import Input from '../../components/Input'
import Button from '../../components/Button'
import api from '../../api/client'

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
]

interface FormErrors {
  company_name?: string
  contact_name?: string
  email?: string
  password?: string
  confirm_password?: string
  country?: string
  language?: string
}

export default function RegisterPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    password: '',
    confirm_password: '',
    country: '',
    language: i18n.language || 'es',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const e: FormErrors = {}
    if (!form.company_name.trim()) e.company_name = t('common.required')
    if (!form.contact_name.trim()) e.contact_name = t('common.required')
    if (!form.email.trim()) {
      e.email = t('common.required')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Invalid email address'
    }
    if (!form.password) {
      e.password = t('common.required')
    } else if (form.password.length < 8) {
      e.password = 'Password must be at least 8 characters'
    }
    if (!form.confirm_password) {
      e.confirm_password = t('common.required')
    } else if (form.password !== form.confirm_password) {
      e.confirm_password = 'Passwords do not match'
    }
    if (!form.country.trim()) e.country = t('common.required')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(evt: React.FormEvent) {
    evt.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await api.post('/api/auth/register', {
        company_name: form.company_name,
        contact_name: form.contact_name,
        email: form.email,
        password: form.password,
        country: form.country,
        language: form.language,
      })
      navigate('/pending')
    } catch (err: any) {
      const code = err.response?.data?.error
      if (code === 'EMAIL_TAKEN') {
        setErrors((e) => ({ ...e, email: 'Email already registered' }))
      } else {
        toast.error(t('errors.generic'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {t('auth.register_title')}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        {t('auth.register_subtitle')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('registration.company_name')}
          type="text"
          placeholder="ACME Stone SL"
          value={form.company_name}
          onChange={(e) => set('company_name', e.target.value)}
          error={errors.company_name}
        />
        <Input
          label={t('registration.contact_name')}
          type="text"
          placeholder="John Smith"
          value={form.contact_name}
          onChange={(e) => set('contact_name', e.target.value)}
          error={errors.contact_name}
        />
        <Input
          label={t('auth.email')}
          type="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          error={errors.email}
        />
        <Input
          label={t('auth.password')}
          type="password"
          placeholder="Min. 8 characters"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          error={errors.password}
        />
        <Input
          label={t('auth.confirm_password')}
          type="password"
          placeholder="Repeat password"
          value={form.confirm_password}
          onChange={(e) => set('confirm_password', e.target.value)}
          error={errors.confirm_password}
        />
        <Input
          label={t('registration.country')}
          type="text"
          placeholder="Spain"
          value={form.country}
          onChange={(e) => set('country', e.target.value)}
          error={errors.country}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t('registration.language')}
          </label>
          <select
            value={form.language}
            onChange={(e) => set('language', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" fullWidth loading={loading} className="mt-2">
          {t('registration.submit')}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {t('auth.have_account')}{' '}
        </span>
        <Link
          to="/login"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('auth.login')}
        </Link>
      </div>
    </AuthLayout>
  )
}
