import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { getCompanies, updateCompanyStatus, Company } from '../../api/companies.api'

const STATUS_TABS = ['All', 'PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const
type StatusTab = typeof STATUS_TABS[number]

interface StatusModalProps {
  company: Company
  onClose: () => void
  onDone: () => void
}

function StatusModal({ company, onClose, onDone }: StatusModalProps) {
  const [status, setStatus] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const nextOptions: string[] = (() => {
    switch (company.status) {
      case 'PENDING':     return ['ACTIVE', 'DEACTIVATED']
      case 'ACTIVE':      return ['SUSPENDED', 'DEACTIVATED']
      case 'SUSPENDED':   return ['ACTIVE', 'DEACTIVATED']
      case 'DEACTIVATED': return ['ACTIVE']
      default:            return []
    }
  })()

  const requiresReason = status === 'SUSPENDED' || status === 'DEACTIVATED'

  const mut = useMutation({
    mutationFn: () => updateCompanyStatus(company.id, status, reason || undefined),
    onSuccess: () => {
      const label = status === 'ACTIVE' ? 'Company reactivated successfully' : `Status changed to ${status}`
      toast.success(label)
      onDone()
    },
    onError: () => toast.error('Failed to update status'),
  })

  function handleConfirm() {
    if (!status) { setError('Select a status'); return }
    if (requiresReason && !reason.trim()) { setError('Reason is required'); return }
    setError('')
    mut.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Change Company Status</h2>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Current:</span>
          <StatusBadge status={company.status} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">New Status</label>
          <select
            title="New status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setError('') }}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">— Select —</option>
            {nextOptions.map((s) => (
              <option key={s} value={s}>
                {s === 'ACTIVE' ? 'ACTIVE (Reactivate)' : s}
              </option>
            ))}
          </select>
        </div>

        {requiresReason && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError('') }}
              rows={3}
              placeholder="Provide a reason..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button onClick={handleConfirm} loading={mut.isPending}>Confirm</Button>
        </div>
      </div>
    </div>
  )
}

export default function CompaniesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [page, setPage] = useState(1)
  const [statusModal, setStatusModal] = useState<Company | null>(null)

  const activeTab = (searchParams.get('status') ?? 'All') as StatusTab

  const { data, isLoading } = useQuery({
    queryKey: ['companies', activeTab, search, country, page],
    queryFn: () =>
      getCompanies({
        status: activeTab === 'All' ? undefined : activeTab,
        search: search || undefined,
        country: country || undefined,
        page,
        limit: 20,
      }),
    placeholderData: (prev) => prev,
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => updateCompanyStatus(id, 'ACTIVE'),
    onSuccess: () => {
      toast.success('Company approved')
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['analytics-summary'] })
    },
    onError: () => toast.error('Failed to approve'),
  })

  const reactivateMut = useMutation({
    mutationFn: (id: string) => updateCompanyStatus(id, 'ACTIVE'),
    onSuccess: () => {
      toast.success('Company reactivated successfully')
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['analytics-summary'] })
    },
    onError: () => toast.error('Failed to reactivate'),
  })

  const companies = data?.data ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  return (
    <DashboardLayout title="Companies">
      {statusModal && (
        <StatusModal
          company={statusModal}
          onClose={() => setStatusModal(null)}
          onDone={() => {
            setStatusModal(null)
            qc.invalidateQueries({ queryKey: ['companies'] })
            qc.invalidateQueries({ queryKey: ['analytics-summary'] })
          }}
        />
      )}

      <div className="space-y-5">
        {/* Filter bar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <input
              title="Filter by country"
              placeholder="Country"
              value={country}
              onChange={(e) => { setCountry(e.target.value); setPage(1) }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-full sm:w-36"
            />
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setSearchParams(tab === 'All' ? {} : { status: tab })
                  setPage(1)
                }}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                ].join(' ')}
              >
                {tab === 'All' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" className="text-blue-500" />
            </div>
          ) : companies.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
              No companies found
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3">Company</th>
                      <th className="text-left px-5 py-3">Contact</th>
                      <th className="text-left px-5 py-3">Email</th>
                      <th className="text-left px-5 py-3">Country</th>
                      <th className="text-left px-5 py-3">Status</th>
                      <th className="text-left px-5 py-3">Registered</th>
                      <th className="text-left px-5 py-3">Discs</th>
                      <th className="text-right px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {companies.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{c.name}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.contact_name}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.email}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.country}</td>
                        <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                          {c._count?.activations ?? '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            {c.status === 'PENDING' && (
                              <Button
                                variant="success"
                                size="sm"
                                loading={approveMut.isPending}
                                onClick={() => approveMut.mutate(c.id)}
                              >
                                Approve
                              </Button>
                            )}
                            {c.status === 'ACTIVE' && (
                              <Button
                                variant="warning"
                                size="sm"
                                onClick={() => setStatusModal(c)}
                              >
                                Suspend
                              </Button>
                            )}
                            {(c.status === 'SUSPENDED' || c.status === 'DEACTIVATED') && (
                              <Button
                                variant="success"
                                size="sm"
                                loading={reactivateMut.isPending}
                                onClick={() => reactivateMut.mutate(c.id)}
                              >
                                Reactivate
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/companies/${c.id}`)}
                            >
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                {companies.map((c) => (
                  <div key={c.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {c.contact_name} · {c.country} · {new Date(c.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {c.status === 'PENDING' && (
                        <Button variant="success" size="sm" onClick={() => approveMut.mutate(c.id)}>
                          Approve
                        </Button>
                      )}
                      {c.status === 'ACTIVE' && (
                        <Button variant="warning" size="sm" onClick={() => setStatusModal(c)}>
                          Suspend
                        </Button>
                      )}
                      {(c.status === 'SUSPENDED' || c.status === 'DEACTIVATED') && (
                        <Button variant="success" size="sm" loading={reactivateMut.isPending} onClick={() => reactivateMut.mutate(c.id)}>
                          Reactivate
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/companies/${c.id}`)}>
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>
                  Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
