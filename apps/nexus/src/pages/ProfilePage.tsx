import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import AppLayout from '../layouts/AppLayout'
import Button from '../components/Button'
import Input from '../components/Input'
import LoadingSpinner from '../components/LoadingSpinner'
import useAuthStore from '../stores/auth.store'
import {
  getMyCompany,
  updateMyCompanyLanguage,
  changePassword,
  getTeamMembers,
  addTeamMember,
  deactivateTeamMember,
  TeamMember,
} from '../api/profile.api'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'ar', label: 'العربية' },
]

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-5">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white">{value ?? '—'}</span>
    </div>
  )
}

function MemberAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  )
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────

interface AddMemberModalProps {
  onClose: () => void
  onDone: () => void
}

function AddMemberModal({ onClose, onDone }: AddMemberModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'CUSTOMER_USER' | 'CUSTOMER_ADMIN'>('CUSTOMER_USER')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mut = useMutation({
    mutationFn: () => addTeamMember({ name, email, password, role }),
    onSuccess: () => {
      toast.success(t('profile.member_added'))
      onDone()
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error
      if (code === 'EMAIL_TAKEN') {
        setErrors({ email: t('profile.email_taken') })
      } else {
        toast.error(err?.response?.data?.message ?? t('errors.generic'))
      }
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const e2: Record<string, string> = {}
    if (!name.trim()) e2.name = t('profile.field_required')
    if (!email.trim()) e2.email = t('profile.field_required')
    if (!password || password.length < 8) e2.password = t('profile.password_min')
    setErrors(e2)
    if (Object.keys(e2).length > 0) return
    mut.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {t('profile.add_member')}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('profile.name')}
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((er) => ({ ...er, name: '' })) }}
            error={errors.name}
          />
          <Input
            label={t('profile.email')}
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: '' })) }}
            error={errors.email}
          />
          <Input
            label={t('profile.password')}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: '' })) }}
            error={errors.password}
          />

          {/* Role toggle */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('profile.role')}
            </p>
            <div className="flex gap-2">
              {(['CUSTOMER_USER', 'CUSTOMER_ADMIN'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={[
                    'flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all',
                    role === r
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400',
                  ].join(' ')}
                >
                  {r === 'CUSTOMER_USER' ? t('profile.role_operator') : t('profile.role_admin')}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            {t('profile.share_credentials_note')}
          </p>

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" type="button" onClick={onClose} disabled={mut.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={mut.isPending} fullWidth>
              {t('profile.add_member')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const isAdmin = user?.role === 'CUSTOMER_ADMIN'

  // Company info
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['my-company'],
    queryFn: getMyCompany,
  })

  // Team members — admin only
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: getTeamMembers,
    enabled: isAdmin,
  })

  // Language preference
  const [selectedLang, setSelectedLang] = useState(i18n.resolvedLanguage ?? i18n.language ?? 'es')

  const langMut = useMutation({
    mutationFn: () => updateMyCompanyLanguage(selectedLang),
    onSuccess: () => {
      i18n.changeLanguage(selectedLang)
      localStorage.setItem('evds_language', selectedLang)
      toast.success(t('profile.preferences_saved'))
      qc.invalidateQueries({ queryKey: ['my-company'] })
    },
    onError: () => toast.error(t('errors.generic')),
  })

  // Change password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')

  const pwMut = useMutation({
    mutationFn: () => changePassword(currentPw, newPw),
    onSuccess: () => {
      toast.success(t('profile.password_changed'))
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setPwError('')
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error
      const msg =
        code === 'WRONG_PASSWORD'
          ? t('profile.wrong_password')
          : (err?.response?.data?.message ?? t('errors.generic'))
      setPwError(msg)
      toast.error(msg)
    },
  })

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (!currentPw) { setPwError(t('profile.field_required')); return }
    if (newPw.length < 8) { setPwError(t('profile.password_min')); return }
    if (newPw !== confirmPw) { setPwError(t('profile.passwords_mismatch')); return }
    pwMut.mutate()
  }

  // Team member deactivate
  const [confirmDeactivate, setConfirmDeactivate] = useState<TeamMember | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateTeamMember(id),
    onSuccess: () => {
      toast.success(t('profile.member_deactivated'))
      setConfirmDeactivate(null)
      qc.invalidateQueries({ queryKey: ['team-members'] })
    },
    onError: () => toast.error(t('errors.generic')),
  })

  const countryLabel = company?.country ?? '—'
  const langLabel = LANGUAGES.find((l) => l.code === company?.language)?.label ?? company?.language ?? '—'

  return (
    <AppLayout>
      {/* Deactivate confirm modal */}
      {confirmDeactivate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {t('profile.deactivate_confirm_title')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('profile.deactivate_confirm_body', { name: confirmDeactivate.name })}
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setConfirmDeactivate(null)} disabled={deactivateMut.isPending}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                loading={deactivateMut.isPending}
                onClick={() => deactivateMut.mutate(confirmDeactivate.id)}
              >
                {t('profile.deactivate')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onDone={() => {
            setShowAddModal(false)
            qc.invalidateQueries({ queryKey: ['team-members'] })
          }}
        />
      )}

      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('profile.title')}
        </h1>

        {/* Section 1 — Company Info */}
        <SectionCard title={t('profile.company_info')}>
          {companyLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner size="md" className="text-blue-600" />
            </div>
          ) : (
            <>
              <InfoRow label={t('profile.company_name')} value={company?.name} />
              <InfoRow label={t('profile.contact_name')} value={company?.contact_name} />
              <InfoRow label={t('profile.country')} value={countryLabel} />
              <InfoRow label={t('profile.language')} value={langLabel} />
              <InfoRow
                label={t('profile.member_since')}
                value={company?.created_at ? new Date(company.created_at).toLocaleDateString() : '—'}
              />
            </>
          )}
        </SectionCard>

        {/* Section 2 — Preferences */}
        <SectionCard title={t('profile.preferences')}>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('profile.language_label')}
            </label>
            <select
              title="Language"
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <Button
            loading={langMut.isPending}
            onClick={() => langMut.mutate()}
            disabled={selectedLang === (company?.language ?? i18n.resolvedLanguage)}
          >
            {t('common.save')}
          </Button>
        </SectionCard>

        {/* Section 3 — Change Password (admin only) */}
        {isAdmin && (
          <SectionCard title={t('profile.change_password')}>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                label={t('profile.current_password')}
                type="password"
                autoComplete="current-password"
                value={currentPw}
                onChange={(e) => { setCurrentPw(e.target.value); setPwError('') }}
              />
              <Input
                label={t('profile.new_password')}
                type="password"
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value); setPwError('') }}
              />
              <Input
                label={t('profile.confirm_password')}
                type="password"
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setPwError('') }}
                error={pwError}
              />
              <Button
                type="submit"
                loading={pwMut.isPending}
                disabled={!currentPw || !newPw || !confirmPw}
              >
                {t('profile.save_password')}
              </Button>
            </form>
          </SectionCard>
        )}

        {/* Section 4 — Team Members (admin only) */}
        {isAdmin && <SectionCard title={t('profile.team_members')}>
          {membersLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner size="md" className="text-blue-600" />
            </div>
          ) : (
            <div className="space-y-3">
              {members.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">{t('profile.no_members')}</p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <MemberAvatar name={m.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.email}</p>
                    </div>
                    <span className={[
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                      m.role === 'CUSTOMER_ADMIN'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                    ].join(' ')}>
                      {m.role === 'CUSTOMER_ADMIN' ? t('profile.role_admin') : t('profile.role_operator')}
                    </span>
                    {!m.is_active && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                        {t('profile.inactive')}
                      </span>
                    )}
                    {isAdmin && m.is_active && m.id !== user?.id && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setConfirmDeactivate(m)}
                      >
                        {t('profile.deactivate')}
                      </Button>
                    )}
                  </div>
                ))
              )}

              {isAdmin && (
                <div className="pt-2">
                  <Button onClick={() => setShowAddModal(true)}>
                    + {t('profile.add_member')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </SectionCard>}
      </div>
    </AppLayout>
  )
}
