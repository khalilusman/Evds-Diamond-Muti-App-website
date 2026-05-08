import { useState } from 'react'
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
  LotSummary,
  GenerateResult,
} from '../../api/labels.api'

const LOT_REGEX = /^[A-Z]?\d{8}$/

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

interface LotRowProps {
  lot: LotSummary
  expanded: boolean
  onToggle: () => void
}

function LotRow({ lot, expanded, onToggle }: LotRowProps) {
  const [pdfLoading, setPdfLoading] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)

  async function handlePdf() {
    setPdfLoading(true)
    try {
      await exportPdf(lot.lot_number)
    } catch {
      toast.error('Failed to export PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleCsv() {
    setCsvLoading(true)
    try {
      await exportCsv(lot.lot_number)
    } catch {
      toast.error('Failed to export CSV')
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
        <td className="px-5 py-3"><LotBadge count={lot.active} color="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" /></td>
        <td className="px-5 py-3"><LotBadge count={lot.expired_w1} color="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" /></td>
        <td className="px-5 py-3"><LotBadge count={lot.permanently_used} color="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" /></td>
        <td className="px-5 py-3"><LotBadge count={lot.voided} color="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" /></td>
        <td className="px-5 py-3 text-xs text-gray-400 dark:text-gray-500">
          {new Date(lot.generated_at).toLocaleDateString()}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" loading={pdfLoading} onClick={(e) => { e.stopPropagation(); handlePdf() }}>
              📄 PDF
            </Button>
            <Button variant="ghost" size="sm" loading={csvLoading} onClick={(e) => { e.stopPropagation(); handleCsv() }}>
              📊 CSV
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={11} className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Code preview: {lot.lot_number}-001 … {lot.lot_number}-{String(lot.total).padStart(3, '0')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Use PDF/CSV export to see all individual codes.
            </p>
          </td>
        </tr>
      )}
    </>
  )
}

export default function LabelsPage() {
  const qc = useQueryClient()
  const [expandedLot, setExpandedLot] = useState<string | null>(null)

  // Generate form state
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
      toast.success(`${data.count} codes generated`)
      qc.invalidateQueries({ queryKey: ['lots'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Generation failed'
      toast.error(msg)
    },
  })

  function handleGenerate() {
    setLotError('')
    if (!LOT_REGEX.test(lotNumber)) {
      setLotError('Format: 8 digits, optional letter prefix (e.g. 20261231 or I20261231)')
      return
    }
    if (!familyId) { toast.error('Select a disc family'); return }
    if (!quantity || Number(quantity) < 1 || Number(quantity) > 10000) {
      toast.error('Quantity must be between 1 and 10,000')
      return
    }
    genMut.mutate()
  }

  return (
    <DashboardLayout title="Label Generator">
      <div className="space-y-6">

        {/* Generate form */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Generate Disc Labels</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Lot Number"
              placeholder="20261231 or I20261231"
              value={lotNumber}
              onChange={(e) => { setLotNumber(e.target.value.toUpperCase()); setLotError(''); setResult(null) }}
              error={lotError}
              hint="8 digits, optional single letter prefix"
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Disc Family</label>
              {familiesLoading ? (
                <LoadingSpinner size="sm" className="text-blue-500" />
              ) : (
                <select
                  title="Disc Family"
                  value={familyId}
                  onChange={(e) => { setFamilyId(e.target.value); setDiameter(400) }}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">— Select family —</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Diameter</label>
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
              label="Quantity"
              type="number"
              min="1"
              max="10000"
              placeholder="100"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              hint="Min 1 · Max 10,000"
            />
          </div>

          <Button
            onClick={handleGenerate}
            loading={genMut.isPending}
            disabled={!lotNumber || !familyId || !quantity}
          >
            {genMut.isPending ? `Generating ${quantity} codes…` : 'Generate Labels'}
          </Button>

          {/* Success result */}
          {result && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                <p className="font-semibold text-green-700 dark:text-green-400">
                  {result.count} codes generated successfully
                </p>
              </div>
              <p className="text-sm text-green-600 dark:text-green-500">
                Lot: {result.lot_number} · {selectedFamily?.name} · {diameter}mm · {result.count} codes ready
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
                      +{result.count - 5} more
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
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Lot Overview</h2>
          </div>

          {lotsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" className="text-blue-500" />
            </div>
          ) : lots.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              No lots generated yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3">Lot</th>
                    <th className="text-left px-5 py-3">Family</th>
                    <th className="text-left px-5 py-3">Ø</th>
                    <th className="text-left px-5 py-3">Total</th>
                    <th className="text-left px-5 py-3">Unused</th>
                    <th className="text-left px-5 py-3">Active</th>
                    <th className="text-left px-5 py-3">Exp W1</th>
                    <th className="text-left px-5 py-3">Perm Used</th>
                    <th className="text-left px-5 py-3">Voided</th>
                    <th className="text-left px-5 py-3">Generated</th>
                    <th className="text-left px-5 py-3">Export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {lots.map((lot) => (
                    <LotRow
                      key={lot.lot_number}
                      lot={lot}
                      expanded={expandedLot === lot.lot_number}
                      onToggle={() => setExpandedLot(expandedLot === lot.lot_number ? null : lot.lot_number)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
