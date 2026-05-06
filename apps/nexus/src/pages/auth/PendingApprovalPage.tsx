import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import AuthLayout from '../../layouts/AuthLayout'
import Button from '../../components/Button'
import api from '../../api/client'
import useAuthStore from '../../stores/auth.store'

export default function PendingApprovalPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setAuth, logout } = useAuthStore()
  const [checking, setChecking] = useState(false)

  async function checkStatus() {
    setChecking(true)
    try {
      const { data } = await api.get('/api/auth/me')
      const user = data.data
      if (user.company?.status === 'ACTIVE') {
        setAuth(localStorage.getItem('evds_token')!, user)
        if (!user.company.onboarding_complete) {
          navigate('/onboarding')
        } else {
          navigate('/')
        }
      } else {
        toast('Account is still pending approval.', { icon: '⏳' })
      }
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setChecking(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <AuthLayout>
      <div className="text-center">
        <div className="text-6xl mb-4">⏳</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
          {t('registration.pending_title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          {t('registration.pending_message')}
        </p>

        <div className="border-t border-amber-200 dark:border-amber-800/50 pt-6 space-y-3">
          <Button fullWidth onClick={checkStatus} loading={checking} variant="secondary">
            Check Status
          </Button>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {t('common.logout')}
          </button>
        </div>
      </div>
    </AuthLayout>
  )
}
