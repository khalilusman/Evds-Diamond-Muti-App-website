import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import useAuthStore from '../../stores/auth.store'
import { updateMyEmail, updateMyPassword } from '../../api/auth.api'

export default function ProfilePage() {
  const { t } = useTranslation()
  const { user, setAuth, token } = useAuthStore()

  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const emailMut = useMutation({
    mutationFn: () => updateMyEmail(newEmail),
    onSuccess: (updatedUser) => {
      toast.success(t('profile.email_updated'))
      setNewEmail('')
      if (token) setAuth(token, updatedUser)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? t('profile.email_update_error')
      setEmailError(msg)
      toast.error(msg)
    },
  })

  const passwordMut = useMutation({
    mutationFn: () => updateMyPassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success(t('profile.password_updated'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? t('profile.password_update_error')
      setPasswordError(msg)
      toast.error(msg)
    },
  })

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError('')
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!newEmail) { setEmailError(t('profile.email_required')); return }
    if (!emailRegex.test(newEmail)) { setEmailError(t('profile.email_invalid')); return }
    emailMut.mutate()
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    if (!currentPassword) { setPasswordError(t('profile.current_password_required')); return }
    if (newPassword.length < 8) { setPasswordError(t('profile.new_password_min')); return }
    if (newPassword !== confirmPassword) { setPasswordError(t('profile.passwords_mismatch')); return }
    passwordMut.mutate()
  }

  return (
    <DashboardLayout title={t('profile.my_profile')}>
      <div className="max-w-xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('profile.my_profile')}</h1>

        {/* Current user info */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5 space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.signed_in_as')}</p>
          <p className="text-base font-semibold text-gray-900 dark:text-white">{user?.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            {user?.role?.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Update Email */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('profile.update_email')}</h2>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <Input
              label={t('profile.current_email')}
              value={user?.email ?? ''}
              readOnly
              className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed opacity-60"
            />
            <Input
              label={t('profile.new_email')}
              type="email"
              placeholder={t('profile.new_email_placeholder')}
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setEmailError('') }}
              error={emailError}
            />
            <Button
              type="submit"
              loading={emailMut.isPending}
              disabled={!newEmail}
            >
              {t('profile.update_email_btn')}
            </Button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('profile.change_password')}</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              label={t('profile.current_password')}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError('') }}
            />
            <Input
              label={t('profile.new_password')}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
              hint={t('profile.password_hint')}
            />
            <Input
              label={t('profile.confirm_new_password')}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError('') }}
              error={passwordError}
            />
            <Button
              type="submit"
              loading={passwordMut.isPending}
              disabled={!currentPassword || !newPassword || !confirmPassword}
            >
              {t('profile.change_password_btn')}
            </Button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
