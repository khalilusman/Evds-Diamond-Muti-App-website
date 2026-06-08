import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import LoadingSpinner from '../../components/LoadingSpinner'
import useAuthStore from '../../stores/auth.store'
import api from '../../api/client'

interface StaffMember {
  id: string
  name: string
  email: string
  role: 'EVDS_ADMIN' | 'EVDS_SUPPORT'
  is_active: boolean
  created_at: string
}

const getStaff = async (): Promise<StaffMember[]> => {
  const { data } = await api.get('/api/admin/evds-staff')
  return data.data
}

const createStaff = async (payload: { name: string; email: string; password: string; role: string }): Promise<StaffMember> => {
  const { data } = await api.post('/api/admin/evds-staff', payload, {
    headers: { 'X-Admin-Secret': 'evds-admin-2026-mP3xK9qR7n' },
  })
  return data.data
}

const deactivateStaff = async (id: string): Promise<void> => {
  await api.patch(`/api/admin/evds-staff/${id}`)
}

const reactivateStaff = async (id: string): Promise<void> => {
  await api.patch(`/api/admin/evds-staff/${id}/reactivate`)
}

const deleteStaff = async (id: string): Promise<void> => {
  await api.delete(`/api/admin/evds-staff/${id}`)
}

interface AddModalProps {
  onClose: () => void
  onDone: () => void
}

function AddModal({ onClose, onDone }: AddModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('EVDS_SUPPORT')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mut = useMutation({
    mutationFn: () => {
      const e: Record<string, string> = {}
      if (!name.trim()) e.name = t('staff.name_required')
      if (!email.trim()) e.email = t('staff.email_required')
      if (password.length < 8) e.password = t('staff.password_min')
      if (Object.keys(e).length) { setErrors(e); throw new Error('validation') }
      return createStaff({ name: name.trim(), email: email.trim(), password, role })
    },
    onSuccess: () => {
      toast.success(t('staff.added_success'))
      onDone()
    },
    onError: (err: any) => {
      if (err?.message === 'validation') return
      const msg = err?.response?.data?.message ?? t('staff.add_error')
      toast.error(msg)
    },
  })

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('staff.add_title')}</h2>

        <Input label={t('staff.add_name')} value={name} onChange={(e) => { setName(e.target.value); setErrors({...errors, name: ''}) }} error={errors.name} />
        <Input label={t('staff.add_email')} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors({...errors, email: ''}) }} error={errors.email} />
        <Input label={t('staff.add_password')} type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors({...errors, password: ''}) }} error={errors.password} />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('staff.add_role')}</label>
          <select
            title={t('staff.add_role')}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="EVDS_SUPPORT">{t('staff.role_evds_support')}</option>
            <option value="EVDS_ADMIN">{t('staff.role_evds_admin')}</option>
          </select>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={mut.isPending}>{t('staff.add_cancel')}</Button>
          <Button fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>{t('staff.add_submit')}</Button>
        </div>
      </div>
    </div>
  )
}

export default function StaffPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<StaffMember | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<StaffMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null)

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['evds-staff'],
    queryFn: getStaff,
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateStaff(id),
    onSuccess: () => {
      toast.success(t('staff.deactivated_success'))
      setDeactivateTarget(null)
      qc.invalidateQueries({ queryKey: ['evds-staff'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? t('staff.deactivate_error')
      toast.error(msg)
    },
  })

  const reactivateMut = useMutation({
    mutationFn: (id: string) => reactivateStaff(id),
    onSuccess: () => {
      toast.success('Staff member reactivated')
      setReactivateTarget(null)
      qc.invalidateQueries({ queryKey: ['evds-staff'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to reactivate staff member')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteStaff(id),
    onSuccess: () => {
      toast.success('Staff member permanently deleted')
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['evds-staff'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to delete staff member')
    },
  })

  if (user?.role !== 'EVDS_ADMIN') {
    return (
      <DashboardLayout title={t('staff.title')}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('staff.access_denied')}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('staff.admin_only')}</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title={t('staff.title')}>
      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false)
            qc.invalidateQueries({ queryKey: ['evds-staff'] })
          }}
        />
      )}

      {deactivateTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('staff.deactivate_title', { name: deactivateTarget.name })}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('staff.deactivate_desc')}
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setDeactivateTarget(null)} disabled={deactivateMut.isPending}>{t('common.cancel')}</Button>
              <Button variant="danger" fullWidth loading={deactivateMut.isPending} onClick={() => deactivateMut.mutate(deactivateTarget.id)}>
                {t('staff.deactivate')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {reactivateTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Reactivate {reactivateTarget.name}?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This will restore their access. They will be able to log in again.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setReactivateTarget(null)} disabled={reactivateMut.isPending}>{t('common.cancel')}</Button>
              <Button fullWidth loading={reactivateMut.isPending} onClick={() => reactivateMut.mutate(reactivateTarget.id)}>
                Reactivate
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Permanently delete {deleteTarget.name}?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This will permanently delete this user. Their email can be reused for a new account.
            </p>
            <p className="text-xs text-red-500 dark:text-red-400 font-medium">
              This action cannot be undone. If the user has existing records, deletion will be blocked — deactivate instead.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setDeleteTarget(null)} disabled={deleteMut.isPending}>{t('common.cancel')}</Button>
              <Button variant="danger" fullWidth loading={deleteMut.isPending} onClick={() => deleteMut.mutate(deleteTarget.id)}>
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('staff.active_count', { count: staff.filter((s) => s.is_active).length })}
          </p>
          <Button onClick={() => setShowAdd(true)}>{t('staff.add_button')}</Button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size="lg" className="text-blue-500" /></div>
          ) : staff.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">{t('staff.no_staff')}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">{t('staff.col_name')}</th>
                  <th className="text-left px-5 py-3">{t('staff.col_email')}</th>
                  <th className="text-left px-5 py-3">{t('staff.col_role')}</th>
                  <th className="text-left px-5 py-3">{t('staff.col_status')}</th>
                  <th className="text-left px-5 py-3">{t('staff.col_added')}</th>
                  <th className="text-right px-5 py-3">{t('staff.col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                      {s.name}
                      {s.id === user?.id && (
                        <span className="ml-2 text-xs text-blue-500">{t('staff.you')}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{s.email}</td>
                    <td className="px-5 py-3">
                      <span className={[
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                        s.role === 'EVDS_ADMIN'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      ].join(' ')}>
                        {s.role === 'EVDS_ADMIN' ? t('staff.role_admin') : t('staff.role_support')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={[
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                        s.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
                      ].join(' ')}>
                        {s.is_active ? t('staff.status_active') : t('staff.status_inactive')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 dark:text-gray-500">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {s.is_active && s.id !== user?.id && (
                          <Button variant="danger" size="sm" onClick={() => setDeactivateTarget(s)}>
                            {t('staff.deactivate')}
                          </Button>
                        )}
                        {!s.is_active && (
                          <Button variant="secondary" size="sm" onClick={() => setReactivateTarget(s)}>
                            Reactivate
                          </Button>
                        )}
                        {s.id !== user?.id && (
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(s)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
