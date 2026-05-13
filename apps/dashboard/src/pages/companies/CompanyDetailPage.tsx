import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
import WearBadge from '../../components/WearBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { getCompany, updateCompanyStatus, getCompanyAuditLogs, getCompanyUsers, CompanyUser } from '../../api/companies.api'
import { getCompanyActivations } from '../../api/activations.api'
import { getSatTickets } from '../../api/sat.api'

type Tab = 'info' | 'machines' | 'discs' | 'users' | 'sat' | 'audit'

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'info',     labelKey: 'company_detail.tab_info' },
  { key: 'machines', labelKey: 'company_detail.tab_machines' },
  { key: 'discs',    labelKey: 'company_detail.tab_discs' },
  { key: 'users',    labelKey: 'company_detail.tab_users' },
  { key: 'sat',      labelKey: 'company_detail.tab_sat' },
  { key: 'audit',    labelKey: 'company_detail.tab_audit' },
]

function satStatusColor(status: string): string {
  switch (status) {
    case 'RESOLVED':  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'ESCALATED': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'IN_REVIEW': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    default:          return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white">{value ?? '—'}</span>
    </div>
  )
}

export default function CompanyDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('info')
  const [statusModal, setStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [reason, setReason] = useState('')

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => getCompany(id!),
    enabled: !!id,
  })

  const { data: activations = [] } = useQuery({
    queryKey: ['company-activations', id],
    queryFn: () => getCompanyActivations(id!),
    enabled: !!id && tab === 'discs',
  })

  const { data: companyUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['company-users', id],
    queryFn: () => getCompanyUsers(id!),
    enabled: !!id && tab === 'users',
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['company-audit', id],
    queryFn: () => getCompanyAuditLogs(id!),
    enabled: !!id && tab === 'audit',
  })

  const { data: satTickets = [], isLoading: satLoading } = useQuery({
    queryKey: ['company-sat', id],
    queryFn: () => getSatTickets({ company_id: id, limit: 50 }).then((r) => r.data),
    enabled: !!id && tab === 'sat',
  })

  const statusMut = useMutation({
    mutationFn: () => updateCompanyStatus(id!, newStatus, reason || undefined),
    onSuccess: () => {
      const label = newStatus === 'ACTIVE' ? 'Company reactivated successfully' : `Status changed to ${newStatus}`
      toast.success(label)
      setStatusModal(false)
      setNewStatus('')
      setReason('')
      qc.invalidateQueries({ queryKey: ['company', id] })
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['analytics-summary'] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  const reactivateMut = useMutation({
    mutationFn: () => updateCompanyStatus(id!, 'ACTIVE'),
    onSuccess: () => {
      toast.success('Company reactivated successfully')
      qc.invalidateQueries({ queryKey: ['company', id] })
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['analytics-summary'] })
    },
    onError: () => toast.error('Failed to reactivate'),
  })

  if (isLoading) {
    return (
      <DashboardLayout title="Company Detail">
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" className="text-blue-500" />
        </div>
      </DashboardLayout>
    )
  }

  if (!company) {
    return (
      <DashboardLayout title="Company Detail">
        <div className="text-center py-20 text-gray-400">{t('company_detail.not_found')}</div>
      </DashboardLayout>
    )
  }

  const statusOptions: string[] = (() => {
    switch (company.status) {
      case 'PENDING':     return ['ACTIVE', 'DEACTIVATED']
      case 'ACTIVE':      return ['SUSPENDED', 'DEACTIVATED']
      case 'SUSPENDED':   return ['ACTIVE', 'DEACTIVATED']
      case 'DEACTIVATED': return ['ACTIVE']
      default:            return []
    }
  })()

  return (
    <DashboardLayout title={company.name}>
      {statusModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('company_detail.change_status')}</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('company_detail.current_status')}</span>
              <StatusBadge status={company.status} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('company_detail.new_status')}</label>
              <select
                title="New status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none"
              >
                <option value="">— Select —</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s === 'ACTIVE' ? 'ACTIVE (Reactivate)' : s}</option>
                ))}
              </select>
            </div>
            {(newStatus === 'SUSPENDED' || newStatus === 'DEACTIVATED') && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('company_detail.reason_label')}</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none resize-none"
                />
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStatusModal(false)}>Cancel</Button>
              <Button
                loading={statusMut.isPending}
                disabled={!newStatus}
                onClick={() => statusMut.mutate()}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{company.name}</h1>
            <StatusBadge status={company.status} />
          </div>
          <div className="flex items-center gap-2">
            {(company.status === 'SUSPENDED' || company.status === 'DEACTIVATED') && (
              <Button
                variant="success"
                size="sm"
                loading={reactivateMut.isPending}
                onClick={() => reactivateMut.mutate()}
              >
                {t('company_detail.reactivate')}
              </Button>
            )}
            {statusOptions.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setStatusModal(true)}>
                {t('company_detail.change_status')}
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow overflow-hidden">
          <div className="flex border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
            {TABS.map(({ key, labelKey }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={[
                  'px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                  tab === key
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                ].join(' ')}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* INFO TAB */}
            {tab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {t('company_detail.section_details')}
                  </h3>
                  <InfoRow label={t('company_detail.field_name')} value={company.name} />
                  <InfoRow label={t('company_detail.field_contact')} value={company.contact_name} />
                  <InfoRow label={t('company_detail.field_email')} value={company.email} />
                  <InfoRow label={t('company_detail.field_country')} value={company.country} />
                  <InfoRow label={t('company_detail.field_language')} value={company.language} />
                  <InfoRow label={t('company_detail.field_status')} value={company.status} />
                  <InfoRow label={t('company_detail.field_registered')} value={new Date(company.created_at).toLocaleString()} />
                  <InfoRow label={t('company_detail.field_onboarding')} value={company.onboarding_complete ? t('company_detail.onboarding_complete') : t('company_detail.onboarding_incomplete')} />
                  {company.status_reason && (
                    <InfoRow label={t('company_detail.field_status_reason')} value={company.status_reason} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {t('company_detail.section_cost')}
                  </h3>
                  {company.cost_config ? (
                    <>
                      <InfoRow label={t('company_detail.field_machine_cost')} value={`€${company.cost_config.machine_cost_hour}/h`} />
                      <InfoRow label={t('company_detail.field_labor_cost')} value={`€${company.cost_config.labor_cost_hour}/h`} />
                      <InfoRow label={t('company_detail.field_energy_cost')} value={`€${company.cost_config.energy_cost_kwh}/kWh`} />
                      <InfoRow label={t('company_detail.field_disc_price')} value={`€${company.cost_config.default_disc_price}`} />
                      <InfoRow label={t('company_detail.field_downtime')} value={`${company.cost_config.downtime_pct}%`} />
                      <InfoRow label={t('company_detail.field_waste')} value={`${company.cost_config.waste_pct}%`} />
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500">{t('company_detail.no_cost_config')}</p>
                  )}
                </div>
              </div>
            )}

            {/* MACHINES TAB */}
            {tab === 'machines' && (
              <div className="space-y-2">
                {(company.machines ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">{t('company_detail.no_machines')}</p>
                ) : (
                  (company.machines ?? []).map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{m.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('company_detail.machine_added')} {new Date(m.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {m._count?.activations ?? 0} {t('company_detail.activations')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ACTIVE DISCS TAB */}
            {tab === 'discs' && (
              <div className="space-y-2">
                {activations.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">{t('company_detail.no_active_discs')}</p>
                ) : (
                  activations.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 gap-3 flex-wrap">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {a.label?.family?.name} {a.label?.nominal_diameter}mm
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {a.label?.full_code} · {a.machine?.name ?? '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <WearBadge pct={a.wear_pct} expired={a.status === 'EXPIRED_W1'} />
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {t('company_detail.expires')} {new Date(a.expires_at).toLocaleDateString()}
                        </span>
                        <StatusBadge status={a.status} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* USERS TAB */}
            {tab === 'users' && (
              <div>
                {usersLoading ? (
                  <div className="flex justify-center py-10"><LoadingSpinner size="md" className="text-blue-500" /></div>
                ) : companyUsers.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">{t('company_detail.no_users')}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-2">{t('company_detail.col_name')}</th>
                        <th className="text-left px-4 py-2">{t('company_detail.col_email')}</th>
                        <th className="text-left px-4 py-2">{t('company_detail.col_role')}</th>
                        <th className="text-left px-4 py-2">{t('company_detail.col_status')}</th>
                        <th className="text-left px-4 py-2">{t('company_detail.col_created')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {companyUsers.map((u: CompanyUser) => (
                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{u.name}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{u.email}</td>
                          <td className="px-4 py-2.5">
                            <span className={[
                              'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                              u.role === 'CUSTOMER_ADMIN'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                            ].join(' ')}>
                              {u.role === 'CUSTOMER_ADMIN' ? t('company_detail.role_admin') : t('company_detail.role_operator')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={[
                              'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                              u.is_active
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                            ].join(' ')}>
                              {u.is_active ? t('company_detail.user_active') : t('company_detail.user_inactive')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* SAT HISTORY TAB */}
            {tab === 'sat' && (
              <div>
                {satLoading ? (
                  <div className="flex justify-center py-10"><LoadingSpinner size="md" className="text-blue-500" /></div>
                ) : satTickets.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No SAT tickets yet</p>
                ) : (
                  <div className="space-y-1">
                    {satTickets.map((ticket) => (
                      <div key={ticket.id} className="py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                              {ticket.symptom_code.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {ticket.activation.label.family.name} {ticket.activation.label.nominal_diameter}mm
                              {' · '}{new Date(ticket.created_at).toLocaleDateString()}
                            </p>
                            {ticket.status === 'RESOLVED' && ticket.resolved_at && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                Resolved {new Date(ticket.resolved_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${satStatusColor(ticket.status)}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AUDIT TRAIL TAB */}
            {tab === 'audit' && (
              <div className="space-y-1">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">{t('company_detail.no_audit')}</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{log.action}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      {log.actor_email && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('company_detail.audit_by')} {log.actor_email}</p>
                      )}
                      {(log.old_values || log.new_values) && (
                        <div className="mt-1.5 flex gap-4 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
                          {log.old_values && (
                            <span>{t('company_detail.audit_before')} <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{JSON.stringify(log.old_values)}</code></span>
                          )}
                          {log.new_values && (
                            <span>{t('company_detail.audit_after')} <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{JSON.stringify(log.new_values)}</code></span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
