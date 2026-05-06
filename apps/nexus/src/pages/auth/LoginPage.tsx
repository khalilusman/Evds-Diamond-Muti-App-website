import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import AuthLayout from '../../layouts/AuthLayout'
import Input from '../../components/Input'
import Button from '../../components/Button'
import api from '../../api/client'
import useAuthStore from '../../stores/auth.store'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate() {
    const e: typeof errors = {}
    if (!email) e.email = t('common.required')
    if (!password) e.password = t('common.required')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(evt: React.FormEvent) {
    evt.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', { email, password })
      const { token, user } = data.data
      setAuth(token, user)

      if (user.company?.status === 'PENDING') {
        navigate('/pending')
      } else if (!user.company?.onboarding_complete) {
        navigate('/onboarding')
      } else {
        navigate('/')
      }
    } catch (err: any) {
      const code = err.response?.data?.error
      const status = err.response?.status
      if (code === 'PENDING_APPROVAL') {
        toast.error('Your account is pending approval by the EVDS team.')
      } else if (code === 'ACCOUNT_SUSPENDED') {
        const reason = err.response?.data?.reason
        toast.error(`Account suspended${reason ? `: ${reason}` : ''}. Contact EVDS support.`)
      } else if (code === 'ACCOUNT_DEACTIVATED') {
        toast.error('Account deactivated. Contact EVDS support.')
      } else if (status === 401) {
        toast.error('Invalid email or password.')
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
        {t('auth.login_title')}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        {t('auth.login_subtitle')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('auth.email')}
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label={t('auth.password')}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="current-password"
        />

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('auth.forgot_password')}
          </Link>
        </div>

        <Button type="submit" fullWidth loading={loading}>
          {t('auth.login')}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {t('auth.no_account')}{' '}
        </span>
        <Link
          to="/register"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('auth.register')}
        </Link>
      </div>
    </AuthLayout>
  )
}
