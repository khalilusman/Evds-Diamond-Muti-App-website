import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import AppLayout from '../../layouts/AppLayout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import LoadingSpinner from '../../components/LoadingSpinner'
import CostResultCard from '../../components/CostResultCard'
import { parseDxfFile, DxfParseResult } from '../../services/dxf.service'
import { getCostConfig, calculateCost, getCalculations, CostResult, CostCalculation } from '../../api/cost.api'
import { getActivations } from '../../api/activations.api'

type InputMethod = 'DXF' | 'MANUAL'

interface FormState {
  activation_id: string
  piece_count: string
  total_perimeter: string
  material_price: string
  disc_price: string
  copies: string
  thickness_cm: 2 | 3
}

const defaultForm = (): FormState => ({
  activation_id: '',
  piece_count: '',
  total_perimeter: '',
  material_price: '',
  disc_price: '',
  copies: '1',
  thickness_cm: 2,
})

// ─── DXF Upload Zone ──────────────────────────────────────────────────────────

function DxfUploadZone({
  onResult,
  onError,
}: {
  onResult: (r: DxfParseResult) => void
  onError: () => void
}) {
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.dxf')) {
      toast.error('Please upload a .dxf file')
      return
    }
    setFileName(file.name)
    setParsing(true)
    try {
      const result = await parseDxfFile(file)
      if (result.warnings.length > 0) {
        result.warnings.forEach((w) => toast.error(w, { duration: 6000 }))
      }
      if (result.pieceCount === 0) {
        onError()
      } else {
        onResult(result)
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to parse DXF file')
      onError()
    } finally {
      setParsing(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0] ?? null)
  }

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {parsing ? (
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size="md" className="text-blue-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Analysing file…</p>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-2">📐</div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {fileName || 'Drop DXF file here or click to browse'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              .dxf files only · Max 10MB · Parsed client-side
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".dxf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  )
}

// ─── DXF Result Preview ───────────────────────────────────────────────────────

function DxfResultBox({ result }: { result: DxfParseResult }) {
  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-green-600 dark:text-green-400 font-bold text-sm">✓</span>
        <p className="font-semibold text-green-700 dark:text-green-400 text-sm">
          {result.pieceCount} piece{result.pieceCount !== 1 ? 's' : ''} detected
        </p>
        <p className="text-xs text-green-600 dark:text-green-500 ml-auto">
          Total: {result.totalPerimeter.toFixed(1)}mm
        </p>
      </div>
      {result.pieces.length <= 10 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {result.pieces.map((p) => (
            <div key={p.id} className="flex justify-between text-xs text-green-700 dark:text-green-400">
              <span>Piece {p.id}</span>
              <span>{p.perimeter.toFixed(1)}mm</span>
            </div>
          ))}
        </div>
      )}
      {result.pieces.length > 10 && (
        <p className="text-xs text-green-600 dark:text-green-500">
          {result.pieces.length} pieces (showing summary only)
        </p>
      )}
    </div>
  )
}

// ─── Calculation History ──────────────────────────────────────────────────────

function CalcHistoryRow({
  calc,
  onReload,
}: {
  calc: CostCalculation
  onReload: (calc: CostCalculation) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onReload(calc)}
      className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors bg-white dark:bg-gray-900 flex items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {calc.input_method}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(calc.created_at).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
          {calc.piece_count} pieces · {calc.total_perimeter}mm
        </p>
      </div>
      <p className="text-base font-bold text-blue-600 dark:text-blue-400 shrink-0">
        €{(calc.result_json as any)?.total?.toFixed(2) ?? '—'}
      </p>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CostPage() {
  const { t } = useTranslation()

  const [inputMethod, setInputMethod] = useState<InputMethod>('MANUAL')
  const [form, setForm] = useState<FormState>(defaultForm())
  const [dxfResult, setDxfResult] = useState<DxfParseResult | null>(null)
  const [result, setResult] = useState<CostResult | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  // Queries
  const { data: costConfig } = useQuery({
    queryKey: ['cost-config'],
    queryFn: getCostConfig,
  })

  const { data: activations = [] } = useQuery({
    queryKey: ['activations', 'active'],
    queryFn: () => getActivations('ACTIVE'),
  })

  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['cost-calculations'],
    queryFn: getCalculations,
  })

  // Auto-fill disc price from config when config loads
  const discPriceDefault = costConfig?.default_disc_price?.toString() ?? ''

  function field(key: keyof FormState) {
    return {
      value: form[key] as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((f) => ({ ...f, [key]: e.target.value }))
        setErrors((er) => ({ ...er, [key]: undefined }))
      },
      error: errors[key],
    }
  }

  // Selected disc label for result card
  const selectedActivation = activations.find((a) => a.id === form.activation_id)
  const discLabel = selectedActivation
    ? `${selectedActivation.label?.family?.name} ${selectedActivation.label?.nominal_diameter}mm`
    : undefined

  // When DXF parse succeeds, auto-fill piece count and perimeter
  function handleDxfResult(r: DxfParseResult) {
    setDxfResult(r)
    setForm((f) => ({
      ...f,
      piece_count: String(r.pieceCount),
      total_perimeter: String(r.totalPerimeter),
    }))
  }

  function validate(): boolean {
    const e: typeof errors = {}
    const pCount = Number(form.piece_count)
    const pPerim = Number(form.total_perimeter)
    const mPrice = Number(form.material_price)
    const copies = Number(form.copies)

    if (!form.piece_count || pCount <= 0) e.piece_count = 'Must be a positive number'
    if (!form.total_perimeter || pPerim <= 0) e.total_perimeter = 'Must be a positive number'
    if (!form.material_price || mPrice < 0) e.material_price = 'Required'
    if (!form.copies || copies <= 0) e.copies = 'Must be at least 1'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const calcMut = useMutation({
    mutationFn: () => {
      if (!costConfig) throw new Error('NO_COST_CONFIG')
      return calculateCost({
        activation_id: form.activation_id || undefined,
        input_method: inputMethod,
        piece_count: Number(form.piece_count),
        total_perimeter: Number(form.total_perimeter),
        material_price: Number(form.material_price),
        disc_price: form.disc_price ? Number(form.disc_price) : undefined,
        copies: Number(form.copies),
        thickness_cm: form.thickness_cm,
      })
    },
    onSuccess: (data) => {
      setResult(data)
      refetchHistory()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error
      if (code === 'NO_COST_CONFIG') {
        toast.error('Please set up your cost configuration first (Profile page)')
      } else {
        toast.error(t('errors.generic'))
      }
    },
  })

  function handleCalculate() {
    if (!validate()) return
    if (!costConfig) {
      toast.error('Please set up your cost configuration first (Profile page)')
      return
    }
    calcMut.mutate()
  }

  function handleReset() {
    setResult(null)
    setForm(defaultForm())
    setDxfResult(null)
    setErrors({})
  }

  function handleHistoryReload(calc: CostCalculation) {
    setResult(calc.result_json)
  }

  // ── Result view ──
  if (result) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <CostResultCard
            result={result}
            discLabel={discLabel}
            thickness={form.thickness_cm}
            inputMethod={inputMethod}
            onReset={handleReset}
          />
        </div>
      </AppLayout>
    )
  }

  // ── Form view ──
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('cost.title')}
        </h1>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 space-y-6">

          {/* 1 — Optional disc selector */}
          {activations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Active Disc (optional — fills catalog parameters)
              </label>
              <select
                value={form.activation_id}
                onChange={(e) => setForm((f) => ({ ...f, activation_id: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">— No disc selected —</option>
                {activations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label?.family?.name} {a.label?.nominal_diameter}mm · {a.label?.unique_code} · {a.machine?.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 2 — Input method toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('cost.input_method')}
            </label>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
              {(['DXF', 'MANUAL'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setInputMethod(m)
                    if (m === 'MANUAL') setDxfResult(null)
                  }}
                  className={[
                    'px-5 py-2 rounded-lg text-sm font-medium transition-colors',
                    inputMethod === m
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                  ].join(' ')}
                >
                  {m === 'DXF' ? '📐 Upload DXF' : '✏️ Manual Input'}
                </button>
              ))}
            </div>
          </div>

          {/* 3 — DXF or Manual inputs */}
          {inputMethod === 'DXF' ? (
            <div className="space-y-3">
              <DxfUploadZone onResult={handleDxfResult} onError={() => setInputMethod('MANUAL')} />
              {dxfResult && <DxfResultBox result={dxfResult} />}
              {dxfResult && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t('cost.piece_count')}
                    type="number"
                    min="1"
                    {...field('piece_count')}
                  />
                  <Input
                    label={`${t('cost.total_perimeter')} (mm)`}
                    type="number"
                    min="0"
                    step="0.1"
                    {...field('total_perimeter')}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('cost.piece_count')}
                type="number"
                min="1"
                placeholder="5"
                {...field('piece_count')}
              />
              <Input
                label={`${t('cost.total_perimeter')} (mm)`}
                type="number"
                min="0"
                step="0.1"
                placeholder="2500"
                {...field('total_perimeter')}
              />
            </div>
          )}

          {/* 4 — Thickness */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('cost.thickness')}
            </label>
            <div className="flex gap-3">
              {([2, 3] as const).map((cm) => (
                <button
                  key={cm}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, thickness_cm: cm }))}
                  className={[
                    'flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                    form.thickness_cm === cm
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400',
                  ].join(' ')}
                >
                  {cm} cm
                </button>
              ))}
            </div>
          </div>

          {/* 5 — Economic parameters */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Economic Parameters
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`${t('cost.material_price')} (€/m²)`}
                type="number"
                min="0"
                step="0.01"
                placeholder="45.00"
                {...field('material_price')}
              />
              <Input
                label={`${t('cost.disc_price')} (€)`}
                type="number"
                min="0"
                step="0.01"
                placeholder={discPriceDefault || '450.00'}
                value={form.disc_price || discPriceDefault}
                onChange={(e) => setForm((f) => ({ ...f, disc_price: e.target.value }))}
                error={errors.disc_price}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('cost.copies')}
                type="number"
                min="1"
                placeholder="1"
                {...field('copies')}
              />
            </div>

            {/* Advanced collapsible */}
            {costConfig && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showAdvanced ? '▲ Hide' : '▼ Show'} advanced settings
                </button>
                {showAdvanced && (
                  <div className="mt-3 grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-500 dark:text-gray-400">
                    {[
                      { label: 'Machine Cost (€/h)', value: costConfig.machine_cost_hour },
                      { label: 'Labor Cost (€/h)', value: costConfig.labor_cost_hour },
                      { label: 'Energy Cost (€/kWh)', value: costConfig.energy_cost_kwh },
                      { label: 'Downtime %', value: costConfig.downtime_pct },
                      { label: 'Waste %', value: costConfig.waste_pct },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-gray-400 dark:text-gray-500">{label}</p>
                        <p className="font-medium text-gray-700 dark:text-gray-300">
                          {value}
                        </p>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <p className="text-[10px] text-gray-400 dark:text-gray-600">
                        To change these values, update your cost configuration in the Profile page.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!costConfig && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                ⚠️ No cost configuration found. Please set up your cost parameters in the Profile page before calculating.
              </div>
            )}
          </div>

          {/* Calculate button */}
          <Button
            fullWidth
            loading={calcMut.isPending}
            onClick={handleCalculate}
            disabled={!costConfig}
          >
            {t('cost.calculate')}
          </Button>
        </div>

        {/* Calculation history */}
        {history.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Recent Calculations
            </h2>
            <div className="space-y-2">
              {history.map((calc) => (
                <CalcHistoryRow key={calc.id} calc={calc} onReload={handleHistoryReload} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
