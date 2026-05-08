import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  SatTicketDetail,
} from '../../api/sat.api'

const STATUS_TABS = ['All', 'OPEN', 'IN_REVIEW', 'RESOLVED', 'ESCALATED'] as const
type StatusTab = typeof STATUS_TABS[number]

const SYMPTOM_LABELS: Record<string, string> = {
  ABNORMAL_WEAR: 'Abnormal Wear',
  OVERHEATING: 'Overheating',
  CHIPPING: 'Chipping / Edge Damage',
  VIBRATION: 'Excessive Vibration',
  NOISE: 'Abnormal Noise',
  SURFACE_QUALITY: 'Poor Surface Quality',
  BREAKAGE: 'Disc Breakage',
  OTHER: 'Other',
}

function deviationColor(reported: number | null, recommended: number): string {
  if (reported == null) return 'text-gray-400 dark:text-gray-500'
  const pct = Math.abs((reported - recommended) / recommended) * 100
  return pct > 15 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400'
}

function PhotoGallery({ urls }: { urls: string[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  if (urls.length === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Photos</p>
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
        setSolutionError('Solution text is required before marking as resolved')
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
            <h2 className="text-base font-bold text-gray-900 dark:text-white">SAT Ticket</h2>
            {ticket && <StatusBadge status={ticket.status} />}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><LoadingSpinner size="lg" className="text-blue-500" /></div>
        ) : !ticket ? (
          <div className="p-6 text-center text-gray-400">Ticket not found</div>
        ) : (
          <div className="p-6 space-y-6 flex-1">
            {/* Context */}
            <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-1 text-sm">
              <p><span className="text-gray-500 dark:text-gray-400">Symptom: </span>
                <span className="font-medium text-gray-900 dark:text-white">{SYMPTOM_LABELS[ticket.symptom_code] ?? ticket.symptom_code}</span>
              </p>
              <p><span className="text-gray-500 dark:text-gray-400">Disc: </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {ticket.activation.label.family.name} {ticket.activation.label.nominal_diameter}mm — {ticket.activation.label.unique_code}
                </span>
              </p>
              {ticket.symptom_detail && (
                <p><span className="text-gray-500 dark:text-gray-400">Detail: </span>{ticket.symptom_detail}</p>
              )}
              <p><span className="text-gray-500 dark:text-gray-400">Opened: </span>{new Date(ticket.created_at).toLocaleString()}</p>
            </section>

            {/* Comparison table */}
            {ticket.comparison && (
              <section>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Parameter Comparison</p>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="text-left px-3 py-2">Parameter</th>
                      <th className="text-left px-3 py-2">Catalog</th>
                      <th className="text-left px-3 py-2">Reported</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    <tr>
                      <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">RPM</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{ticket.comparison.rpm.recommended}</td>
                      <td className={`px-3 py-2 ${deviationColor(ticket.comparison.rpm.reported, ticket.comparison.rpm.recommended)}`}>
                        {ticket.comparison.rpm.reported ?? '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Feed (mm/min)</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{ticket.comparison.feed.recommended}</td>
                      <td className={`px-3 py-2 ${deviationColor(ticket.comparison.feed.reported, ticket.comparison.feed.recommended)}`}>
                        {ticket.comparison.feed.reported ?? '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            )}

            {/* Auto-diagnosis */}
            {ticket.auto_diagnosis && (
              <section className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-blue-800 dark:text-blue-300">Auto Diagnosis</p>
                <p className="text-blue-700 dark:text-blue-400">{ticket.auto_diagnosis}</p>
                {ticket.probable_cause && (
                  <p><span className="font-medium text-blue-800 dark:text-blue-300">Probable cause: </span>
                    <span className="text-blue-700 dark:text-blue-400">{ticket.probable_cause}</span>
                  </p>
                )}
                {ticket.recommended_fix && (
                  <p><span className="font-medium text-blue-800 dark:text-blue-300">Recommended fix: </span>
                    <span className="text-blue-700 dark:text-blue-400">{ticket.recommended_fix}</span>
                  </p>
                )}
                {ticket.prevention && (
                  <p><span className="font-medium text-blue-800 dark:text-blue-300">Prevention: </span>
                    <span className="text-blue-700 dark:text-blue-400">{ticket.prevention}</span>
                  </p>
                )}
              </section>
            )}

            {/* Photos */}
            <PhotoGallery urls={ticket.photo_urls ?? []} />

            {/* EVDS Solution */}
            <section className={[
              'rounded-xl p-4 space-y-3 border-2',
              ticket.status === 'RESOLVED'
                ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                : ticket.status === 'ESCALATED'
                ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900',
            ].join(' ')}>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">EVDS Technical Solution</p>

              {ticket.status === 'RESOLVED' && ticket.evds_solution ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.evds_solution}</p>
              ) : ticket.status === 'ESCALATED' ? (
                <p className="text-sm text-amber-700 dark:text-amber-400 whitespace-pre-wrap">
                  {ticket.evds_solution ?? 'Escalated for further review'}
                </p>
              ) : isOpen ? (
                <>
                  <textarea
                    rows={4}
                    value={solution}
                    onChange={(e) => { setSolution(e.target.value); setSolutionError('') }}
                    placeholder="Write your technical solution here..."
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                  {solutionError && <p className="text-xs text-red-500">{solutionError}</p>}
                  <div className="flex gap-2 flex-wrap">
                    {ticket.status === 'OPEN' && (
                      <Button variant="secondary" size="sm" loading={reviewMut.isPending} onClick={() => reviewMut.mutate()}>
                        Mark In Review
                      </Button>
                    )}
                    <Button
                      size="sm"
                      loading={resolveMut.isPending}
                      onClick={() => resolveMut.mutate()}
                    >
                      Mark Resolved
                    </Button>
                    <Button
                      variant="warning"
                      size="sm"
                      loading={escalateMut.isPending}
                      onClick={() => escalateMut.mutate()}
                    >
                      Escalate
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
    ? tickets.filter((t) =>
        t.symptom_code.toLowerCase().includes(search.toLowerCase()) ||
        t.activation.label.unique_code.toLowerCase().includes(search.toLowerCase())
      )
    : tickets

  return (
    <DashboardLayout title="SAT Tickets">
      {selectedId && <TicketPanel ticketId={selectedId} onClose={() => setSelectedId(null)} />}

      <div className="space-y-5">
        {/* Filter bar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by symptom or disc code…"
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
                {tab === 'All' ? 'All' : tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size="lg" className="text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">No tickets found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3">Disc</th>
                      <th className="text-left px-5 py-3">Symptom</th>
                      <th className="text-left px-5 py-3">Status</th>
                      <th className="text-left px-5 py-3">Opened</th>
                      <th className="text-left px-5 py-3">Resolved</th>
                      <th className="text-right px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {t.activation.label.family.name} {t.activation.label.nominal_diameter}mm
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{t.activation.label.unique_code}</p>
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                          {SYMPTOM_LABELS[t.symptom_code] ?? t.symptom_code}
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                        <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {new Date(t.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {t.resolved_at ? new Date(t.resolved_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedId(t.id)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm text-gray-500">
                  <span>Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Previous</Button>
                    <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
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
