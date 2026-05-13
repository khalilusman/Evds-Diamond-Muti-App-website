import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  getSatTickets,
  getSatTicket,
  resolveSatTicket,
  escalateSatTicket,
  markInReview,
  SatTicketSummary,
} from '../../api/sat.api'

const STATUS_TABS = ['All', 'OPEN', 'IN_REVIEW', 'RESOLVED', 'ESCALATED'] as const
type StatusTab = typeof STATUS_TABS[number]

function formatMaterial(group: string | null): string {
  if (!group) return '—'
  return group.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function deviationColor(reported: number | null, recommended: number): string {
  if (reported == null) return 'text-gray-400 dark:text-gray-500'
  const pct = Math.abs((reported - recommended) / recommended) * 100
  return pct > 15 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400'
}

function PhotoGallery({ urls, label }: { urls: string[]; label: string }) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  if (urls.length === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {urls.map((url) => (
          <img
            key={url}
            src={`${base}${url}`}
            alt="SAT photo"
            className="w-20 h-20 object-cover rounded-lg cursor-pointer border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
            onClick={() => setLightbox(`${base}${url}`)}
          />
        ))}
      </div>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Full size" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  )
}

function TicketPanel({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [solution, setSolution] = useState('')
  const [solutionError, setSolutionError] = useState('')

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['sat-ticket', ticketId],
    queryFn: () => getSatTicket(ticketId),
  })

  const resolveMut = useMutation({
    mutationFn: () => {
      if (!solution.trim()) {
        setSolutionError(t('sat.solution_required'))
        throw new Error('empty')
      }
      return resolveSatTicket(ticketId, solution.trim())
    },
    onSuccess: () => {
      toast.success('Ticket resolved successfully')
      qc.invalidateQueries({ queryKey: ['sat-ticket', ticketId] })
      qc.invalidateQueries({ queryKey: ['sat-tickets'] })
      qc.invalidateQueries({ queryKey: ['analytics-summary'] })
    },
    onError: (err: any) => { if (err?.message !== 'empty') toast.error('Failed to resolve ticket') },
  })

  const reviewMut = useMutation({
    mutationFn: () => markInReview(ticketId),
    onSuccess: () => {
      toast.success('Ticket marked In Review')
      qc.invalidateQueries({ queryKey: ['sat-ticket', ticketId] })
      qc.invalidateQueries({ queryKey: ['sat-tickets'] })
    },
    onError: () => toast.error('Failed to update ticket'),
  })

  const escalateMut = useMutation({
    mutationFn: () => escalateSatTicket(ticketId),
    onSuccess: () => {
      toast.success('Ticket escalated')
      qc.invalidateQueries({ queryKey: ['sat-ticket', ticketId] })
      qc.invalidateQueries({ queryKey: ['sat-tickets'] })
    },
    onError: () => toast.error('Failed to escalate ticket'),
  })

  const isOpen = ticket?.status === 'OPEN' || ticket?.status === 'IN_REVIEW'

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl bg-white dark:bg-gray-900 h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('sat.panel_header')}</h2>
            {ticket && <StatusBadge status={ticket.status} />}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><LoadingSpinner size="lg" className="text-blue-500" /></div>
        ) : !ticket ? (
          <div className="p-6 text-center text-gray-400">{t('sat.no_tickets_found')}</div>
        ) : (
          <div className="p-6 space-y-6 flex-1">
            {/* Customer */}
            <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t('sat.customer')}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <span className="text-gray-500 dark:text-gray-400">{t('sat.field_company')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{ticket.activation.company.name}</span>
                <span className="text-gray-500 dark:text-gray-400">{t('sat.field_contact')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{ticket.activation.company.contact_name}</span>
                <span className="text-gray-500 dark:text-gray-400">{t('sat.field_email')}</span>
                <span className="font-medium text-gray-900 dark:text-white break-all">{ticket.activation.company.email}</span>
                <span className="text-gray-500 dark:text-gray-400">{t('sat.field_country')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{ticket.activation.company.country}</span>
              </div>
            </section>

            {/* Disc */}
            <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t('sat.disc_section')}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <span className="text-gray-500 dark:text-gray-400">{t('sat.field_family')}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {ticket.activation.label.family.name} {ticket.activation.label.nominal_diameter}mm
                </span>
                <span className="text-gray-500 dark:text-gray-400">{t('sat.field_lot')}</span>
                <span className="font-mono text-gray-900 dark:text-white">{ticket.activation.label.lot_number}</span>
                <span className="text-gray-500 dark:text-gray-400">{t('sat.field_code')}</span>
                <span className="font-mono text-gray-900 dark:text-white">{ticket.activation.label.unique_code}</span>
                <span className="text-gray-500 dark:text-gray-400">{t('sat.field_machine')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{ticket.activation.machine.name}</span>
                <span className="text-gray-500 dark:text-gray-400">{t('sat.field_material')}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {ticket.activation.material_type ?? '—'} · {ticket.activation.thickness ? `${ticket.activation.thickness}cm` : '—'}
                </span>
                <span className="text-gray-500 dark:text-gray-400">{t('sat.field_activated')}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {new Date(ticket.activation.activated_at).toLocaleDateString()}
                </span>
              </div>
            </section>

            {/* Incident */}
            <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-1 text-sm">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t('sat.incident')}</p>
              <p><span className="text-gray-500 dark:text-gray-400">{t('sat.symptom')}: </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {t(`sat.symptoms.${ticket.symptom_code}`, { defaultValue: ticket.symptom_code })}
                </span>
              </p>
              {ticket.symptom_detail && (
                <p><span className="text-gray-500 dark:text-gray-400">{t('sat.detail')}: </span>{ticket.symptom_detail}</p>
              )}
              <p><span className="text-gray-500 dark:text-gray-400">{t('sat.opened')}: </span>{new Date(ticket.created_at).toLocaleString()}</p>
              {ticket.reporter && (
                <p><span className="text-gray-500 dark:text-gray-400">{t('sat.reported_by')}: </span>{ticket.reporter.name}</p>
              )}
            </section>

            {/* Usage at time of incident */}
            <section>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {t('sat.usage_at_incident')}
              </p>
              <table className="w-full text-sm rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="text-left px-3 py-2">{t('sat.col_parameter')}</th>
                    <th className="text-left px-3 py-2">{t('sat.col_catalog')}</th>
                    <th className="text-left px-3 py-2">{t('sat.col_reported')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  <tr>
                    <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{t('sat.col_diameter')}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{ticket.activation.label.nominal_diameter}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{ticket.diameter_reported ?? '—'}</td>
                  </tr>
                  {ticket.comparison && (
                    <>
                      <tr>
                        <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{t('sat.col_rpm')}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{ticket.comparison.rpm.recommended}</td>
                        <td className={`px-3 py-2 ${deviationColor(ticket.comparison.rpm.reported, ticket.comparison.rpm.recommended)}`}>
                          {ticket.comparison.rpm.reported ?? '—'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{t('sat.col_feed')}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{ticket.comparison.feed.recommended}</td>
                        <td className={`px-3 py-2 ${deviationColor(ticket.comparison.feed.reported, ticket.comparison.feed.recommended)}`}>
                          {ticket.comparison.feed.reported ?? '—'}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </section>

            {/* Auto-diagnosis */}
            {ticket.auto_diagnosis && (
              <section className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-blue-800 dark:text-blue-300">{t('sat.diagnosis')}</p>
                <p className="text-blue-700 dark:text-blue-400">{ticket.auto_diagnosis}</p>
                {ticket.probable_cause && (
                  <p><span className="font-medium text-blue-800 dark:text-blue-300">{t('sat.probable_cause')}: </span>
                    <span className="text-blue-700 dark:text-blue-400">{ticket.probable_cause}</span>
                  </p>
                )}
                {ticket.recommended_fix && (
                  <p><span className="font-medium text-blue-800 dark:text-blue-300">{t('sat.recommended_fix')}: </span>
                    <span className="text-blue-700 dark:text-blue-400">{ticket.recommended_fix}</span>
                  </p>
                )}
                {ticket.prevention && (
                  <p><span className="font-medium text-blue-800 dark:text-blue-300">{t('sat.prevention')}: </span>
                    <span className="text-blue-700 dark:text-blue-400">{ticket.prevention}</span>
                  </p>
                )}
              </section>
            )}

            {/* Photos */}
            <PhotoGallery urls={ticket.photo_urls ?? []} label={t('sat.photos')} />

            {/* EVDS Solution */}
            <section className={[
              'rounded-xl p-4 space-y-3 border-2',
              ticket.status === 'RESOLVED'
                ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                : ticket.status === 'ESCALATED'
                ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900',
            ].join(' ')}>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('sat.evds_solution')}</p>

              {ticket.status === 'RESOLVED' && ticket.evds_solution ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.evds_solution}</p>
              ) : ticket.status === 'ESCALATED' ? (
                <p className="text-sm text-amber-700 dark:text-amber-400 whitespace-pre-wrap">
                  {ticket.evds_solution ?? t('sat.escalated_default')}
                </p>
              ) : isOpen ? (
                <>
                  <textarea
                    rows={4}
                    value={solution}
                    onChange={(e) => { setSolution(e.target.value); setSolutionError('') }}
                    placeholder={t('sat.solution_placeholder')}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                  {solutionError && <p className="text-xs text-red-500">{solutionError}</p>}
                  <div className="flex gap-2 flex-wrap">
                    {ticket.status === 'OPEN' && (
                      <Button variant="secondary" size="sm" loading={reviewMut.isPending} onClick={() => reviewMut.mutate()}>
                        {t('sat.mark_in_review')}
                      </Button>
                    )}
                    <Button size="sm" loading={resolveMut.isPending} onClick={() => resolveMut.mutate()}>
                      {t('sat.mark_resolved')}
                    </Button>
                    <Button variant="warning" size="sm" loading={escalateMut.isPending} onClick={() => escalateMut.mutate()}>
                      {t('sat.escalate')}
                    </Button>
                  </div>
                </>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SatPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<StatusTab>('All')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sat-tickets', activeTab, page, dateFrom, dateTo],
    queryFn: () => getSatTickets({
      status: activeTab === 'All' ? undefined : activeTab,
      page,
      limit: 20,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    placeholderData: (prev) => prev,
  })

  const tickets: SatTicketSummary[] = data?.data ?? []
  const total = data?.total ?? 0
  const pages = Math.ceil(total / 20)

  const filtered = search
    ? tickets.filter((tk) =>
        tk.symptom_code.toLowerCase().includes(search.toLowerCase()) ||
        tk.activation.label.unique_code.toLowerCase().includes(search.toLowerCase())
      )
    : tickets

  function tabLabel(tab: StatusTab) {
    if (tab === 'All') return t('common.all')
    return t(`sat.status_${tab.toLowerCase()}`, { defaultValue: tab.replace('_', ' ') })
  }

  return (
    <DashboardLayout title={t('sat.title')}>
      {selectedId && <TicketPanel ticketId={selectedId} onClose={() => setSelectedId(null)} />}

      <div className="space-y-5">
        {/* Filter bar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder={t('sat.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setActiveTab(tab); setPage(1) }}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                ].join(' ')}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size="lg" className="text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">{t('sat.no_tickets_found')}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3">{t('sat.col_disc')}</th>
                      <th className="text-left px-5 py-3">{t('sat.symptom')}</th>
                      <th className="text-left px-5 py-3">{t('sat.status')}</th>
                      <th className="text-left px-5 py-3">{t('sat.col_company')}</th>
                      <th className="hidden sm:table-cell text-left px-5 py-3">{t('sat.col_material')}</th>
                      <th className="text-left px-5 py-3">{t('sat.col_opened')}</th>
                      <th className="text-left px-5 py-3">{t('sat.col_resolved')}</th>
                      <th className="text-right px-5 py-3">{t('sat.col_action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((tk) => (
                      <tr key={tk.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {tk.activation.label.family.name} {tk.activation.label.nominal_diameter}mm
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{tk.activation.label.unique_code}</p>
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                          {t(`sat.symptoms.${tk.symptom_code}`, { defaultValue: tk.symptom_code })}
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={tk.status} /></td>
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{tk.activation.company.name}</p>
                        </td>
                        <td className="hidden sm:table-cell px-5 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatMaterial(tk.activation.material_type)}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {new Date(tk.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {tk.resolved_at ? new Date(tk.resolved_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedId(tk.id)}>
                            {t('common.view')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm text-gray-500">
                  <span>{t('companies.showing', { from: ((page - 1) * 20) + 1, to: Math.min(page * 20, total), total })}</span>
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
