import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
import WearBadge from '../../components/WearBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { getCompany, updateCompanyStatus, getCompanyAuditLogs } from '../../api/companies.api'
import { getCompanyActivations } from '../../api/activations.api'

type Tab = 'info' | 'machines' | 'discs' | 'sat' | 'audit'

const TABS: { key: Tab; label: string }[] = [
  { key: 'info',     label: 'Info' },
  { key: 'machines', label: 'Machines' },
  { key: 'discs',    label: 'Active Discs' },
  { key: 'sat',      label: 'SAT History' },
  { key: 'audit',    label: 'Audit Trail' },
]

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white">{value ?? '—'}</span>
    </div>
  )
}

export default function CompanyDetailPage() {
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

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['company-audit', id],
    queryFn: () => getCompanyAuditLogs(id!),
    enabled: !!id && tab === 'audit',
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
        <div className="text-center py-20 text-gray-400">Company not found</div>
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
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Change Status</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Current:</span>
              <StatusBadge status={company.status} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">New Status</label>
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
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason *</label>
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
                Reactivate
              </Button>
            )}
            {statusOptions.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setStatusModal(true)}>
                Change Status
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow overflow-hidden">
          <div className="flex border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
            {TABS.map(({ key, label }) => (
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
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* INFO TAB */}
            {tab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Company Details
                  </h3>
                  <InfoRow label="Name" value={company.name} />
                  <InfoRow label="Contact" value={company.contact_name} />
                  <InfoRow label="Email" value={company.email} />
                  <InfoRow label="Country" value={company.country} />
                  <InfoRow label="Language" value={company.language} />
                  <InfoRow label="Status" value={company.status} />
                  <InfoRow label="Registered" value={new Date(company.created_at).toLocaleString()} />
                  <InfoRow label="Onboarding" value={company.onboarding_complete ? 'Complete' : 'Incomplete'} />
                  {company.status_reason && (
                    <InfoRow label="Status Reason" value={company.status_reason} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Cost Configuration
                  </h3>
                  {company.cost_config ? (
                    <>
                      <InfoRow label="Machine Cost" value={`€${company.cost_config.machine_cost_hour}/h`} />
                      <InfoRow label="Labor Cost" value={`€${company.cost_config.labor_cost_hour}/h`} />
                      <InfoRow label="Energy Cost" value={`€${company.cost_config.energy_cost_kwh}/kWh`} />
                      <InfoRow label="Default Disc Price" value={`€${company.cost_config.default_disc_price}`} />
                      <InfoRow label="Downtime %" value={`${company.cost_config.downtime_pct}%`} />
                      <InfoRow label="Waste %" value={`${company.cost_config.waste_pct}%`} />
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500">No cost config set</p>
                  )}
                </div>
              </div>
            )}

            {/* MACHINES TAB */}
            {tab === 'machines' && (
              <div className="space-y-2">
                {(company.machines ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No machines registered</p>
                ) : (
                  (company.machines ?? []).map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{m.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Added {new Date(m.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {m._count?.activations ?? 0} activations
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
                  <p className="text-sm text-gray-400 dark:text-gray-500">No active discs</p>
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
                          Expires {new Date(a.expires_at).toLocaleDateString()}
                        </span>
                        <StatusBadge status={a.status} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SAT HISTORY TAB */}
            {tab === 'sat' && (
              <p className="text-sm text-gray-400 dark:text-gray-500">SAT history available in Day 11.</p>
            )}

            {/* AUDIT TRAIL TAB */}
            {tab === 'audit' && (
              <div className="space-y-1">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No audit records</p>
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
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">by {log.actor_email}</p>
                      )}
                      {(log.old_values || log.new_values) && (
                        <div className="mt-1.5 flex gap-4 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
                          {log.old_values && (
                            <span>Before: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{JSON.stringify(log.old_values)}</code></span>
                          )}
                          {log.new_values && (
                            <span>After: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{JSON.stringify(log.new_values)}</code></span>
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
