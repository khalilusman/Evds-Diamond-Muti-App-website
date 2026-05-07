import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import AppLayout from '../../layouts/AppLayout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import LoadingSpinner from '../../components/LoadingSpinner'
import PhotoUpload from '../../components/PhotoUpload'
import { getActivations } from '../../api/activations.api'
import { getCatalog } from '../../api/catalog.api'
import {
  createSatTicket,
  getSatTickets,
  escalateTicket,
  SatTicket,
} from '../../api/sat.api'

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMPTOM_LIST = [
  { code: 'polishing', emoji: '🔄' },
  { code: 'chipping', emoji: '💥' },
  { code: 'overheating', emoji: '🌡️' },
  { code: 'oval_disc', emoji: '⭕' },
  { code: 'not_cutting', emoji: '✋' },
  { code: 'undercutting', emoji: '⬇️' },
  { code: 'excessive_wear', emoji: '📉' },
  { code: 'vibration', emoji: '📳' },
  { code: 'crown_blocked', emoji: '🚫' },
  { code: 'support_fissure', emoji: '🔩' },
  { code: 'reverse_mount', emoji: '🔃' },
  { code: 'deformation', emoji: '🌀' },
  { code: 'other', emoji: '❓' },
] as const

type SymptomCode = typeof SYMPTOM_LIST[number]['code']

type ReportStep = 1 | 2 | 3 | 4

interface SatForm {
  activation_id: string
  symptom_code: string
  symptom_detail: string
  rpm_reported: string
  feed_reported: string
  diameter_reported: string
}

const defaultForm = (): SatForm => ({
  activation_id: '',
  symptom_code: '',
  symptom_detail: '',
  rpm_reported: '',
  feed_reported: '',
  diameter_reported: '',
})

type TicketFilter = 'ALL' | 'OPEN' | 'RESOLVED' | 'ESCALATED'

// ─── Helper components ────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'OPEN': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'RESOLVED': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'ESCALATED': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}

function DiagnosisCard({
  ticket,
  onUploadComplete,
  onEscalate,
  onDone,
}: {
  ticket: SatTicket
  onUploadComplete: (urls: string[]) => void
  onEscalate: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [photosUploaded, setPhotosUploaded] = useState(ticket.photo_urls.length > 0)
  const [showUpload, setShowUpload] = useState(false)

  const thickness = ticket.activation?.thickness_cm ?? 2
  const catalogFeed = ticket.catalog_params
    ? (thickness === 3 ? ticket.catalog_params.feed_3cm : ticket.catalog_params.feed_2cm)
    : null
  const catalogRpm = ticket.catalog_params?.recommended_rpm ?? null

  function handlePhotosDone(urls: string[]) {
    onUploadComplete(urls)
    setPhotosUploaded(true)
    setShowUpload(false)
  }

  return (
    <div className="space-y-4">
      {/* Diagnosis result */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔍</span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('sat.diagnosis_title')}
          </h2>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">
              {t('sat.probable_cause')}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{ticket.probable_cause}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">
              {t('sat.recommended_fix')}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{ticket.recommended_fix}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">
              {t('sat.prevention')}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{ticket.prevention}</p>
          </div>
        </div>

        {/* Comparison table */}
        {(catalogRpm !== null || catalogFeed !== null) && (
          <div className="border-t border-green-200 dark:border-green-800 pt-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Parameters Comparison
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500">
                  <th className="text-left pb-1 font-medium">Parameter</th>
                  <th className="text-center pb-1 font-medium">Catalog</th>
                  <th className="text-center pb-1 font-medium">You Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-200 dark:divide-green-800">
                {catalogRpm !== null && (
                  <tr>
                    <td className="py-1.5 text-gray-600 dark:text-gray-400">RPM</td>
                    <td className="py-1.5 text-center font-medium text-gray-900 dark:text-white">
                      {catalogRpm}
                    </td>
                    <td
                      className={[
                        'py-1.5 text-center font-medium',
                        ticket.rpm_reported
                          ? Math.abs(ticket.rpm_reported - catalogRpm) / catalogRpm > 0.15
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                          : 'text-gray-400',
                      ].join(' ')}
                    >
                      {ticket.rpm_reported ?? '—'}
                    </td>
                  </tr>
                )}
                {catalogFeed !== null && (
                  <tr>
                    <td className="py-1.5 text-gray-600 dark:text-gray-400">Feed</td>
                    <td className="py-1.5 text-center font-medium text-gray-900 dark:text-white">
                      {catalogFeed}
                    </td>
                    <td
                      className={[
                        'py-1.5 text-center font-medium',
                        ticket.feed_reported
                          ? Math.abs(ticket.feed_reported - catalogFeed) / catalogFeed > 0.15
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                          : 'text-gray-400',
                      ].join(' ')}
                    >
                      {ticket.feed_reported ?? '—'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Photo upload section */}
      {!photosUploaded && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('sat.photos_label')}
            </p>
            {!showUpload && (
              <Button size="sm" variant="secondary" onClick={() => setShowUpload(true)}>
                Add Photos
              </Button>
            )}
          </div>
          {showUpload && (
            <PhotoUpload ticketId={ticket.id} onUploadComplete={handlePhotosDone} />
          )}
        </div>
      )}
      {photosUploaded && (
        <p className="text-xs text-green-600 dark:text-green-400 text-center">
          ✓ Photos uploaded
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onEscalate}>
          {t('sat.escalate')}
        </Button>
        <Button fullWidth onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}

// ─── Report Issue form ─────────────────────────────────────────────────────

function ReportIssueTab() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()

  const [step, setStep] = useState<ReportStep>(1)
  const [form, setForm] = useState<SatForm>(defaultForm())
  const [createdTicket, setCreatedTicket] = useState<SatTicket | null>(null)

  const { data: activations = [], isLoading: activationsLoading } = useQuery({
    queryKey: ['activations', 'active'],
    queryFn: () => getActivations('ACTIVE'),
  })

  const selectedActivation = activations.find((a) => a.id === form.activation_id) ?? null

  const { data: catalogList = [] } = useQuery({
    queryKey: [
      'catalog',
      selectedActivation?.label?.family?.id,
      selectedActivation?.material_group,
      selectedActivation?.label?.nominal_diameter,
    ],
    queryFn: () =>
      getCatalog({
        family_id: selectedActivation!.label.family.id,
        material_group: selectedActivation!.material_group ?? undefined,
        nominal_diameter: selectedActivation!.label.nominal_diameter,
      }),
    enabled: !!selectedActivation,
  })
  const catalog = catalogList[0]
  const catalogFeed = catalog
    ? (selectedActivation?.thickness_cm === 3 ? catalog.feed_3cm : catalog.feed_2cm)
    : null

  // Pre-select from URL
  useEffect(() => {
    const id = searchParams.get('activation_id')
    if (id && activations.find((a) => a.id === id)) {
      setForm((f) => ({ ...f, activation_id: id }))
      if (step === 1) setStep(2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activations])

  const submitMut = useMutation({
    mutationFn: () =>
      createSatTicket({
        activation_id: form.activation_id,
        symptom_code: form.symptom_code,
        symptom_detail: form.symptom_detail || undefined,
        rpm_reported: form.rpm_reported ? Number(form.rpm_reported) : null,
        feed_reported: form.feed_reported ? Number(form.feed_reported) : null,
        diameter_reported: form.diameter_reported ? Number(form.diameter_reported) : null,
      }),
    onSuccess: (ticket) => {
      setCreatedTicket(ticket)
      qc.invalidateQueries({ queryKey: ['sat-tickets'] })
    },
    onError: () => toast.error(t('errors.generic')),
  })

  const escalateMut = useMutation({
    mutationFn: () => escalateTicket(createdTicket!.id),
    onSuccess: () => {
      toast.success('Ticket escalated to EVDS support')
      qc.invalidateQueries({ queryKey: ['sat-tickets'] })
    },
    onError: () => toast.error(t('errors.generic')),
  })

  function resetFlow() {
    setForm(defaultForm())
    setCreatedTicket(null)
    setStep(1)
  }

  // ── Result screen ──
  if (createdTicket) {
    return (
      <DiagnosisCard
        ticket={createdTicket}
        onUploadComplete={() => {}}
        onEscalate={() => escalateMut.mutate()}
        onDone={resetFlow}
      />
    )
  }

  // ── Step 1: Select disc ──
  if (step === 1) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {t('sat.select_disc')}
        </h2>
        {activationsLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size="md" className="text-blue-600" />
          </div>
        ) : activations.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('discs.no_discs')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activations.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, activation_id: a.id }))
                  setStep(2)
                }}
                className={[
                  'w-full text-left px-4 py-3 rounded-xl border-2 transition-all',
                  form.activation_id === a.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-400',
                ].join(' ')}
              >
                <p className="font-semibold text-sm text-gray-900 dark:text-white">
                  {a.label?.family?.name} — {a.label?.nominal_diameter}mm
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                  {a.label?.unique_code} · {a.machine?.name}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Step 2: Select symptom ──
  if (step === 2) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ← {t('common.back')}
          </button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('sat.symptom_label')}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SYMPTOM_LIST.map(({ code, emoji }) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, symptom_code: code }))
                setStep(3)
              }}
              className={[
                'flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                form.symptom_code === code
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-400',
              ].join(' ')}
            >
              <span className="text-xl shrink-0">{emoji}</span>
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-tight">
                {t(`sat.symptoms.${code}` as any)}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Step 3: Operating data ──
  if (step === 3) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ← {t('common.back')}
          </button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Operating Data ({t('common.optional')})
          </h2>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Providing these values helps us give a more accurate diagnosis.
        </p>

        <div className="space-y-4">
          <div>
            <Input
              label={t('sat.rpm_reported')}
              type="number"
              placeholder={catalog ? String(catalog.recommended_rpm) : '0'}
              min="0"
              value={form.rpm_reported}
              onChange={(e) => setForm((f) => ({ ...f, rpm_reported: e.target.value }))}
            />
            {catalog && (
              <p className="mt-1 text-xs text-gray-400">
                Catalog recommends: {catalog.recommended_rpm} RPM
              </p>
            )}
          </div>

          <div>
            <Input
              label={t('sat.feed_reported')}
              type="number"
              placeholder={catalogFeed ? String(catalogFeed) : '0'}
              min="0"
              value={form.feed_reported}
              onChange={(e) => setForm((f) => ({ ...f, feed_reported: e.target.value }))}
            />
            {catalogFeed !== null && (
              <p className="mt-1 text-xs text-gray-400">
                Catalog recommends: {catalogFeed} mm/min
              </p>
            )}
          </div>

          <Input
            label={t('sat.diameter_reported')}
            type="number"
            step="0.1"
            min="0"
            placeholder={selectedActivation ? String(selectedActivation.diameter_at_activation) : '0'}
            value={form.diameter_reported}
            onChange={(e) => setForm((f) => ({ ...f, diameter_reported: e.target.value }))}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={() => setStep(4)}>
            Skip
          </Button>
          <Button fullWidth onClick={() => setStep(4)}>
            {t('common.next')}
          </Button>
        </div>
      </div>
    )
  }

  // ── Step 4: Describe + Submit ──
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(3)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          ← {t('common.back')}
        </button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {t('sat.detail_label')}
        </h2>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {t('sat.detail_label')} ({t('common.optional')})
        </label>
        <textarea
          value={form.symptom_detail}
          onChange={(e) => setForm((f) => ({ ...f, symptom_detail: e.target.value }))}
          rows={4}
          maxLength={1000}
          placeholder="Describe what you are experiencing in detail..."
          className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none text-sm"
        />
      </div>

      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm space-y-1">
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>Disc</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {selectedActivation?.label?.family?.name} — {selectedActivation?.label?.nominal_diameter}mm
          </span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>Symptom</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {SYMPTOM_LIST.find((s) => s.code === form.symptom_code)?.emoji}{' '}
            {t(`sat.symptoms.${form.symptom_code as SymptomCode}` as any)}
          </span>
        </div>
      </div>

      <Button
        fullWidth
        loading={submitMut.isPending}
        onClick={() => submitMut.mutate()}
      >
        {t('sat.submit')}
      </Button>
    </div>
  )
}

// ─── My Tickets tab ───────────────────────────────────────────────────────────

function TicketCard({ ticket }: { ticket: SatTicket }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const isResolved = ticket.status === 'RESOLVED'

  const symptom = SYMPTOM_LIST.find((s) => s.code === ticket.symptom_code)

  return (
    <div
      className={[
        'bg-white dark:bg-gray-900 rounded-2xl shadow p-5 border-l-4',
        isResolved
          ? 'border-l-green-500'
          : ticket.status === 'ESCALATED'
          ? 'border-l-orange-500'
          : 'border-l-blue-500',
      ].join(' ')}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">{symptom?.emoji}</span>
              <span className="font-semibold text-sm text-gray-900 dark:text-white">
                {t(`sat.symptoms.${ticket.symptom_code as SymptomCode}` as any)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(ticket.status)}`}>
                {t(`sat.status_${ticket.status.toLowerCase()}` as any)}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {ticket.activation?.label?.family?.name} · {ticket.activation?.label?.unique_code} ·{' '}
              {new Date(ticket.created_at).toLocaleDateString()}
            </p>
            {ticket.probable_cause && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {ticket.probable_cause.slice(0, 100)}
                {ticket.probable_cause.length > 100 ? '…' : ''}
              </p>
            )}
          </div>
          <span className="text-gray-400 shrink-0 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              {t('sat.probable_cause')}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{ticket.probable_cause}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              {t('sat.recommended_fix')}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{ticket.recommended_fix}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              {t('sat.prevention')}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{ticket.prevention}</p>
          </div>

          {isResolved && ticket.evds_solution && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">
                EVDS Solution
              </p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{ticket.evds_solution}</p>
            </div>
          )}

          {ticket.photo_urls.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {ticket.photo_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" title={`Photo ${i + 1}`}>
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img src={url} alt={`Ticket photo ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MyTicketsTab() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<TicketFilter>('ALL')

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['sat-tickets'],
    queryFn: () => getSatTickets(),
  })

  const filtered = filter === 'ALL' ? tickets : tickets.filter((tk) => tk.status === filter)

  const FILTER_TABS: { key: TicketFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'OPEN', label: t('sat.status_open') },
    { key: 'RESOLVED', label: t('sat.status_resolved') },
    { key: 'ESCALATED', label: t('sat.status_escalated') },
  ]

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
              filter === key
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner size="md" className="text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔧</div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">{t('sat.no_tickets')}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Report an issue with one of your discs
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageTab = 'report' | 'tickets'

export default function SatPage() {
  const { t } = useTranslation()
  const [pageTab, setPageTab] = useState<PageTab>('report')

  const PAGE_TABS: { key: PageTab; label: string }[] = [
    { key: 'report', label: t('sat.new_ticket') },
    { key: 'tickets', label: 'My Tickets' },
  ]

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('sat.title')}
        </h1>

        {/* Page tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {PAGE_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPageTab(key)}
              className={[
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                pageTab === key
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6">
          {pageTab === 'report' ? <ReportIssueTab /> : <MyTicketsTab />}
        </div>
      </div>
    </AppLayout>
  )
}
