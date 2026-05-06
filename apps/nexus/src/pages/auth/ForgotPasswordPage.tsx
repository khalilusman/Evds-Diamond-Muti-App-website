import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AuthLayout from '../../layouts/AuthLayout'
import Input from '../../components/Input'
import Button from '../../components/Button'
import api from '../../api/client'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(evt: React.FormEvent) {
    evt.preventDefault()
    if (!email) {
      setError(t('common.required'))
      return
    }
    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password', { email })
    } catch {
      // intentionally ignore — always show success
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Check your email
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            If an account exists with this email, you will receive a reset link shortly.
          </p>
          <Link
            to="/login"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('auth.back_to_login')}
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {t('auth.forgot_password')}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Enter your email to receive a reset link
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('auth.email')}
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError('')
          }}
          error={error}
        />
        <Button type="submit" fullWidth loading={loading}>
          {t('auth.send_reset_link')}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          to="/login"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('auth.back_to_login')}
        </Link>
      </div>
    </AuthLayout>
  )
}
