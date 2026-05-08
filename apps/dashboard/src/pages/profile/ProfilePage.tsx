import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import useAuthStore from '../../stores/auth.store'
import { updateMyEmail, updateMyPassword } from '../../api/auth.api'

export default function ProfilePage() {
  const { user, setAuth, token } = useAuthStore()

  // Email section
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')

  // Password section
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const emailMut = useMutation({
    mutationFn: () => updateMyEmail(newEmail),
    onSuccess: (updatedUser) => {
      toast.success('Email updated successfully')
      setNewEmail('')
      // Update stored user with new email
      if (token) setAuth(token, updatedUser)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to update email'
      setEmailError(msg)
      toast.error(msg)
    },
  })

  const passwordMut = useMutation({
    mutationFn: () => updateMyPassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to update password'
      setPasswordError(msg)
      toast.error(msg)
    },
  })

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError('')
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!newEmail) { setEmailError('Email is required'); return }
    if (!emailRegex.test(newEmail)) { setEmailError('Invalid email format'); return }
    emailMut.mutate()
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    if (!currentPassword) { setPasswordError('Current password is required'); return }
    if (newPassword.length < 8) { setPasswordError('New password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    passwordMut.mutate()
  }

  return (
    <DashboardLayout title="My Profile">
      <div className="max-w-xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>

        {/* Current user info */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5 space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">Signed in as</p>
          <p className="text-base font-semibold text-gray-900 dark:text-white">{user?.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            {user?.role?.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Update Email */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Update Email</h2>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <Input
              label="Current Email"
              value={user?.email ?? ''}
              readOnly
              className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed opacity-60"
            />
            <Input
              label="New Email"
              type="email"
              placeholder="new@example.com"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setEmailError('') }}
              error={emailError}
            />
            <Button
              type="submit"
              loading={emailMut.isPending}
              disabled={!newEmail}
            >
              Update Email
            </Button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Change Password</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError('') }}
            />
            <Input
              label="New Password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
              hint="Minimum 8 characters"
            />
            <Input
              label="Confirm New Password"
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
              Change Password
            </Button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
