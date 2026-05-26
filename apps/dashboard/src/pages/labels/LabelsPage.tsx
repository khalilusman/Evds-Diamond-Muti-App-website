import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  getDiscFamilies,
  getLots,
  generateLabels,
  exportPdf,
  exportCsv,
  getLabels,
  voidLabel as voidLabelApi,
  voidLot as voidLotApi,
  deleteLabel as deleteLabelApi,
  LotSummary,
  GenerateResult,
  DiscLabel,
} from '../../api/labels.api'
import useAuthStore from '../../stores/auth.store'

const LOT_REGEX = /^[A-Z0-9-]{3,20}$/i

const DIAMETERS_BY_FAMILY: Record<string, number[]> = {
  QUEEN:    [350, 400, 450],
  KING:     [350, 400, 450],
  HERCULES: [350, 400, 450],
  'V-ARRAY': [350, 400, 450, 500],
}

function defaultDiameters(familyName: string): number[] {
  for (const [key, vals] of Object.entries(DIAMETERS_BY_FAMILY)) {
    if (familyName.toUpperCase().includes(key)) return vals
  }
  return [350, 400, 450]
}

function LotBadge({ count, color }: { count: number; color: string }) {
  if (count === 0) return <span className="text-gray-400 dark:text-gray-600">—</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {count}
    </span>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  type: 'void' | 'delete'
  title: string
  description: string
  reason: string
  onReasonChange?: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function ConfirmModal({ type, title, description, reason, onReasonChange, onConfirm, onCancel, loading }: ConfirmModalProps) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        {type === 'void' && onReasonChange && (
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={3}
            placeholder={t('labels.void_reason_placeholder')}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
          />
        )}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || (type === 'void' && !reason.trim())}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 ${
              type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? '…' : type === 'delete' ? t('labels.delete_forever') : t('labels.void')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Expanded Lot Labels ──────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'UNUSED':   return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'VOIDED':   return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'ACTIVE':
    case 'ACTIVE_W2': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    default:         return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}

interface ExpandedLotLabelsProps {
  lot_number: string
  isAdmin: boolean
  onVoidLabel: (id: string) => void
  onDeleteLabel: (id: string) => void
}

function ExpandedLotLabels({ lot_number, isAdmin, onVoidLabel, onDeleteLabel }: ExpandedLotLabelsProps) {
  const { t } = useTranslation()
  const { data: labels = [], isLoading } = useQuery({
    queryKey: ['labels', lot_number],
    queryFn: () => getLabels({ lot_number, limit: 200 }),
  })

  if (isLoading) {
    return (
      <div className="py-4 flex justify-center">
        <LoadingSpinner size="sm" className="text-blue-500" />
      </div>
    )
  }
  if (labels.length === 0) {
    return <p className="text-xs text-gray-400 py-4 text-center">{t('labels.no_labels_found')}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 dark:text-gray-500">
            <th className="text-left py-1.5 pr-3 font-medium">{t('labels.col_code')}</th>
            <th className="text-left py-1.5 px-2 font-medium">{t('labels.col_full_code')}</th>
            <th className="text-left py-1.5 px-2 font-medium">{t('labels.col_status')}</th>
            <th className="text-left py-1.5 pl-2 font-medium">{t('labels.col_actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {labels.map((label: DiscLabel) => {
            const canVoid = label.status !== 'VOIDED'
            const canDelete = label.status === 'UNUSED' && isAdmin
            return (
              <tr key={label.id}>
                <td className="py-1.5 pr-3 font-mono">{label.unique_code}</td>
                <td className="py-1.5 px-2 font-mono text-gray-500 dark:text-gray-400">{label.full_code}</td>
                <td className="py-1.5 px-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColor(label.status)}`}>
                    {label.status}
                  </span>
                </td>
                <td className="py-1.5 pl-2">
                  <div className="flex items-center gap-1">
                    {canVoid && (
                      <button
                        type="button"
                        onClick={() => onVoidLabel(label.id)}
                        className="px-2 py-1 rounded text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 transition-colors"
                      >
                        {t('labels.void')}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDeleteLabel(label.id)}
                        className="px-2 py-1 rounded text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Lot Row ──────────────────────────────────────────────────────────────────

interface LotRowProps {
  lot: LotSummary
  expanded: boolean
  onToggle: () => void
  onVoidLot: (lotNumber: string, unusedCount: number) => void
  onVoidLabel: (id: string) => void
  onDeleteLabel: (id: string) => void
  isAdmin: boolean
}

function LotRow({ lot, expanded, onToggle, onVoidLot, onVoidLabel, onDeleteLabel, isAdmin }: LotRowProps) {
  const { t } = useTranslation()
  const [pdfLoading, setPdfLoading] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)

  async function handlePdf() {
    setPdfLoading(true)
    try {
      await exportPdf(lot.lot_number, lot.family_id, lot.nominal_diameter)
    } catch {
      toast.error(t('labels.pdf_error'))
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleCsv() {
    setCsvLoading(true)
    try {
      await exportCsv(lot.lot_number)
    } catch {
      toast.error(t('labels.csv_error'))
    } finally {
      setCsvLoading(false)
    }
  }

  return (
    <>
      <tr
        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-5 py-3 font-mono text-sm font-medium text-gray-900 dark:text-white">{lot.lot_number}</td>
        <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">{lot.family_name}</td>
        <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">{lot.nominal_diameter}mm</td>
        <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">{lot.total}</td>
        <td className="px-5 py-3"><LotBadge count={lot.unused} color="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" /></td>
        <td className="px-5 py-3"><LotBadge count={lot.used} color="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" /></td>
        <td className="px-5 py-3"><LotBadge count={lot.expired_w1} color="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" /></td>
        <td className="px-5 py-3"><LotBadge count={lot.voided} color="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" /></td>
        <td className="px-5 py-3 text-xs text-gray-400 dark:text-gray-500">
          {new Date(lot.generated_at).toLocaleDateString()}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onToggle() }}>
              {expanded ? t('labels.collapse_labels') : t('labels.expand_labels')}
            </Button>
            <Button variant="ghost" size="sm" loading={pdfLoading} onClick={(e) => { e.stopPropagation(); handlePdf() }}>
              {t('labels.export_pdf')}
            </Button>
            <Button variant="ghost" size="sm" loading={csvLoading} onClick={(e) => { e.stopPropagation(); handleCsv() }}>
              {t('labels.export_csv')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={lot.unused === 0}
              onClick={(e) => { e.stopPropagation(); onVoidLot(lot.lot_number, lot.unused) }}
            >
              {t('labels.void_lot')}
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={11} className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50">
            <ExpandedLotLabels
              lot_number={lot.lot_number}
              isAdmin={isAdmin}
              onVoidLabel={onVoidLabel}
              onDeleteLabel={onDeleteLabel}
            />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ModalState =
  | { type: 'void-label'; id: string }
  | { type: 'void-lot'; lotNumber: string; unusedCount: number }
  | { type: 'delete'; id: string }
  | null

export default function LabelsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'EVDS_ADMIN'
  const [expandedLot, setExpandedLot] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [reason, setReason] = useState('')

  const [lotNumber, setLotNumber] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [diameter, setDiameter] = useState<number>(400)
  const [quantity, setQuantity] = useState('')
  const [lotError, setLotError] = useState('')
  const [result, setResult] = useState<GenerateResult | null>(null)

  const { data: families = [], isLoading: familiesLoading } = useQuery({
    queryKey: ['disc-families'],
    queryFn: getDiscFamilies,
  })

  const { data: lots = [], isLoading: lotsLoading } = useQuery({
    queryKey: ['lots'],
    queryFn: getLots,
  })

  const selectedFamily = families.find((f) => f.id === familyId)
  const diameters = selectedFamily ? defaultDiameters(selectedFamily.name) : [350, 400, 450]

  const genMut = useMutation({
    mutationFn: () => generateLabels({
      lot_number: lotNumber,
      family_id: familyId,
      nominal_diameter: diameter,
      quantity: Number(quantity),
    }),
    onSuccess: (data) => {
      setResult(data)
      toast.success(t('labels.codes_generated', { count: data.count }))
      qc.invalidateQueries({ queryKey: ['lots'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Generation failed'
      toast.error(msg)
    },
  })

  const voidLabelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => voidLabelApi(id, reason),
    onSuccess: () => {
      toast.success(t('labels.label_voided'))
      qc.invalidateQueries({ queryKey: ['labels'] })
      qc.invalidateQueries({ queryKey: ['lots'] })
      setModal(null)
      setReason('')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? t('labels.void_label_error')),
  })

  const voidLotMut = useMutation({
    mutationFn: ({ lotNumber, reason }: { lotNumber: string; reason: string }) => voidLotApi(lotNumber, reason),
    onSuccess: (data) => {
      toast.success(t('labels.labels_voided', { count: data.voided }))
      qc.invalidateQueries({ queryKey: ['lots'] })
      qc.invalidateQueries({ queryKey: ['labels'] })
      setModal(null)
      setReason('')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? t('labels.void_lot_error')),
  })

  const deleteLabelMut = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteLabelApi(id),
    onSuccess: () => {
      toast.success(t('labels.label_deleted'))
      qc.invalidateQueries({ queryKey: ['labels'] })
      qc.invalidateQueries({ queryKey: ['lots'] })
      setModal(null)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? t('labels.delete_label_error')),
  })

  const mutationLoading = voidLabelMut.isPending || voidLotMut.isPending || deleteLabelMut.isPending

  function handleConfirm() {
    if (!modal) return
    if (modal.type === 'void-label') voidLabelMut.mutate({ id: modal.id, reason })
    else if (modal.type === 'void-lot') voidLotMut.mutate({ lotNumber: modal.lotNumber, reason })
    else deleteLabelMut.mutate({ id: modal.id })
  }

  function handleGenerate() {
    setLotError('')
    if (!LOT_REGEX.test(lotNumber)) {
      setLotError(t('labels.lot_format_error'))
      return
    }
    if (!familyId) { toast.error(t('labels.select_family_error')); return }
    if (!quantity || Number(quantity) < 1 || Number(quantity) > 10000) {
      toast.error(t('labels.quantity_error'))
      return
    }
    genMut.mutate()
  }

  const modalConfig = modal ? {
    type: modal.type === 'delete' ? 'delete' as const : 'void' as const,
    title: modal.type === 'delete'
      ? t('labels.delete_title')
      : modal.type === 'void-lot'
      ? t('labels.void_lot_title', { count: modal.unusedCount })
      : t('labels.void_label_title'),
    description: modal.type === 'delete'
      ? t('labels.delete_desc')
      : modal.type === 'void-lot'
      ? t('labels.void_lot_desc', { count: modal.unusedCount, lotNumber: modal.lotNumber })
      : t('labels.void_label_desc'),
  } : null

  return (
    <DashboardLayout title={t('labels.title')}>
      <div className="space-y-6">

        {/* Generate form */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('labels.generate_title')}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('labels.lot_number')}
              placeholder={t('labels.lot_placeholder')}
              value={lotNumber}
              onChange={(e) => { setLotNumber(e.target.value.toUpperCase()); setLotError(''); setResult(null) }}
              error={lotError}
              hint={t('labels.lot_hint')}
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labels.family')}</label>
              {familiesLoading ? (
                <LoadingSpinner size="sm" className="text-blue-500" />
              ) : (
                <select
                  title={t('labels.family')}
                  value={familyId}
                  onChange={(e) => { setFamilyId(e.target.value); setDiameter(400) }}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">— {t('labels.select_family')} —</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('labels.diameter')}</label>
              <div className="flex gap-2">
                {diameters.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDiameter(d)}
                    className={[
                      'flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all',
                      diameter === d
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400',
                    ].join(' ')}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label={t('labels.quantity')}
              type="number"
              min="1"
              max="10000"
              placeholder="100"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              hint={t('labels.quantity_hint')}
            />
          </div>

          <Button
            onClick={handleGenerate}
            loading={genMut.isPending}
            disabled={!lotNumber || !familyId || !quantity}
          >
            {genMut.isPending ? t('labels.generating', { count: Number(quantity) }) : t('labels.generate')}
          </Button>

          {result && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                <p className="font-semibold text-green-700 dark:text-green-400">
                  {t('labels.generated_success', { count: result.count })}
                </p>
              </div>
              <p className="text-sm text-green-600 dark:text-green-500">
                {t('labels.result_detail', { lot: result.lot_number, family: selectedFamily?.name ?? '', diameter, count: result.count })}
              </p>
              {result.preview_codes?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {result.preview_codes.map((code) => (
                    <span key={code} className="font-mono text-xs bg-green-100 dark:bg-green-800/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                      {code}
                    </span>
                  ))}
                  {result.count > 5 && (
                    <span className="text-xs text-green-600 dark:text-green-500 self-center">
                      {t('labels.more_codes', { count: result.count - 5 })}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lots table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('labels.lot_overview')}</h2>
          </div>

          {lotsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" className="text-blue-500" />
            </div>
          ) : lots.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              {t('labels.no_lots')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3">{t('labels.col_lot')}</th>
                    <th className="text-left px-5 py-3">{t('labels.col_family')}</th>
                    <th className="text-left px-5 py-3">Ø</th>
                    <th className="text-left px-5 py-3">{t('labels.col_total')}</th>
                    <th className="text-left px-5 py-3">{t('labels.col_unused')}</th>
                    <th className="text-left px-5 py-3">Active / Used</th>
                    <th className="text-left px-5 py-3">{t('labels.col_exp_w1')}</th>
                    <th className="text-left px-5 py-3">{t('labels.col_voided')}</th>
                    <th className="text-left px-5 py-3">{t('labels.generated_at')}</th>
                    <th className="text-left px-5 py-3">{t('labels.col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {lots.map((lot) => (
                    <LotRow
                      key={lot.lot_number}
                      lot={lot}
                      expanded={expandedLot === lot.lot_number}
                      onToggle={() => setExpandedLot(expandedLot === lot.lot_number ? null : lot.lot_number)}
                      onVoidLot={(lotNumber, unusedCount) => { setReason(''); setModal({ type: 'void-lot', lotNumber, unusedCount }) }}
                      onVoidLabel={(id) => { setReason(''); setModal({ type: 'void-label', id }) }}
                      onDeleteLabel={(id) => setModal({ type: 'delete', id })}
                      isAdmin={isAdmin}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modal && modalConfig && (
        <ConfirmModal
          type={modalConfig.type}
          title={modalConfig.title}
          description={modalConfig.description}
          reason={reason}
          onReasonChange={setReason}
          onConfirm={handleConfirm}
          onCancel={() => { setModal(null); setReason('') }}
          loading={mutationLoading}
        />
      )}
    </DashboardLayout>
  )
}
