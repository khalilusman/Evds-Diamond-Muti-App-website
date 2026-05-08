import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import Button from '../../components/Button'
import LoadingSpinner from '../../components/LoadingSpinner'
import { getSecurityAlerts, voidLabel, SecurityAlert } from '../../api/security.api'

const RESULT_OPTIONS = ['All', 'already_used', 'code_not_found', 'max_activations_reached', 'voided', 'wrong_combination'] as const
type ResultFilter = typeof RESULT_OPTIONS[number]

const RESULT_COLORS: Record<string, string> = {
  already_used:             'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  code_not_found:           'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  max_activations_reached:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  voided:                   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  wrong_combination:        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

interface VoidModalProps {
  alert: SecurityAlert
  onClose: () => void
  onDone: () => void
}

function VoidModal({ alert, onClose, onDone }: VoidModalProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => {
      if (!reason.trim()) { setError(t('security.reason_required')); throw new Error('empty') }
      return voidLabel(alert.id, reason.trim())
    },
    onSuccess: () => {
      toast.success(`Code ${alert.unique_code} voided`)
      onDone()
    },
    onError: (err: any) => { if (err?.message !== 'empty') toast.error('Failed to void code') },
  })

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {t('security.void_title')} <span className="font-mono text-red-600">{alert.unique_code}</span>?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('security.void_desc')}</p>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('security.void_reason_label')} *</label>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError('') }}
            rows={3}
            placeholder={t('security.void_reason_placeholder')}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={mut.isPending}>{t('common.cancel')}</Button>
          <Button variant="danger" fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>{t('security.void_btn')}</Button>
        </div>
      </div>
    </div>
  )
}

export default function SecurityPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [resultFilter, setResultFilter] = useState<ResultFilter>('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [codeSearch, setCodeSearch] = useState('')
  const [page, setPage] = useState(1)
  const [voidTarget, setVoidTarget] = useState<SecurityAlert | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['security-alerts', resultFilter, dateFrom, dateTo, page],
    queryFn: () => getSecurityAlerts({
      result: resultFilter === 'All' ? undefined : resultFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      limit: 30,
    }),
    placeholderData: (prev) => prev,
  })

  const alerts: SecurityAlert[] = data?.data ?? []
  const total = data?.total ?? 0
  const pages = Math.ceil(total / 30)

  const filtered = codeSearch
    ? alerts.filter((a) => a.unique_code.toLowerCase().includes(codeSearch.toLowerCase()))
    : alerts

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const failedToday = alerts.filter((a) => new Date(a.created_at) >= todayStart).length
  const suspicious = alerts.filter((a) => a.suspicious).length
  const voided = alerts.filter((a) => a.result === 'voided').length

  return (
    <DashboardLayout title={t('nav.security')}>
      {voidTarget && (
        <VoidModal
          alert={voidTarget}
          onClose={() => setVoidTarget(null)}
          onDone={() => {
            setVoidTarget(null)
            qc.invalidateQueries({ queryKey: ['security-alerts'] })
          }}
        />
      )}

      <div className="space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: t('security.failed_today'),    value: failedToday, color: 'border-orange-500' },
            { label: t('security.suspicious_codes'), value: suspicious,  color: 'border-red-500' },
            { label: t('security.voided_codes'),     value: voided,      color: 'border-gray-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`bg-white dark:bg-gray-900 rounded-2xl shadow p-4 border-l-4 ${color}`}>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder={t('security.search_placeholder')}
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none"
            />
            <input
              type="date"
              title="From date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none"
            />
            <input
              type="date"
              title="To date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {RESULT_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setResultFilter(r); setPage(1) }}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  resultFilter === r
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                ].join(' ')}
              >
                {r === 'All' ? t('common.all') : t(`security.results.${r}`, { defaultValue: r })}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size="lg" className="text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">{t('security.no_alerts')}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3">{t('security.col_code')}</th>
                      <th className="text-left px-5 py-3">{t('security.col_result')}</th>
                      <th className="text-left px-5 py-3">{t('security.col_ip')}</th>
                      <th className="text-left px-5 py-3">{t('security.col_time')}</th>
                      <th className="text-right px-5 py-3">{t('security.col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((a) => (
                      <tr
                        key={a.id}
                        className={[
                          'transition-colors',
                          a.suspicious
                            ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                        ].join(' ')}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-gray-900 dark:text-white">{a.unique_code}</span>
                            {a.suspicious && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                ⚠️ {t('security.suspicious_badge')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_COLORS[a.result] ?? 'bg-gray-100 text-gray-600'}`}>
                            {t(`security.results.${a.result}`, { defaultValue: a.result })}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                          {a.ip_address ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {new Date(a.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {a.result !== 'voided' && (
                            <Button variant="danger" size="sm" onClick={() => setVoidTarget(a)}>
                              {t('security.void_code')}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm text-gray-500">
                  <span>{t('companies.showing', { from: ((page - 1) * 30) + 1, to: Math.min(page * 30, total), total })}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('common.previous')}</Button>
                    <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t('common.next_page')}</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
