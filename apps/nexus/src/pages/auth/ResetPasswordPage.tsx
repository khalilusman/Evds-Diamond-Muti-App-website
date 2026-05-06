import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import AuthLayout from '../../layouts/AuthLayout'
import Input from '../../components/Input'
import Button from '../../components/Button'
import api from '../../api/client'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})

  function validate() {
    const e: typeof errors = {}
    if (!password) {
      e.password = t('common.required')
    } else if (password.length < 8) {
      e.password = 'Password must be at least 8 characters'
    }
    if (!confirm) {
      e.confirm = t('common.required')
    } else if (password !== confirm) {
      e.confirm = 'Passwords do not match'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(evt: React.FormEvent) {
    evt.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await api.post('/api/auth/reset-password', {
        token,
        new_password: password,
      })
      setDone(true)
    } catch (err: any) {
      const code = err.response?.data?.error
      if (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN') {
        toast.error('This reset link has expired. Request a new one.')
      } else {
        toast.error(t('errors.generic'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Password reset successfully
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Your password has been updated. You can now log in.
          </p>
          <Link
            to="/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
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
        {t('auth.reset_password')}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Enter your new password below
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('auth.password')}
          type="password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setErrors((er) => ({ ...er, password: undefined }))
          }}
          error={errors.password}
        />
        <Input
          label={t('auth.confirm_password')}
          type="password"
          placeholder="Repeat password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            setErrors((er) => ({ ...er, confirm: undefined }))
          }}
          error={errors.confirm}
        />
        <Button type="submit" fullWidth loading={loading}>
          {t('auth.reset_password')}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          to="/forgot-password"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Request a new link
        </Link>
      </div>
    </AuthLayout>
  )
}
