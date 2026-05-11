import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import AppLayout from '../../layouts/AppLayout'
import { Link } from 'react-router-dom'
import Button from '../../components/Button'
import Input from '../../components/Input'
import LoadingSpinner from '../../components/LoadingSpinner'
import CostResultCard from '../../components/CostResultCard'
import { parseDxfFile, DxfParseResult } from '../../services/dxf.service'
import { getCostConfig, calculateCost, getCalculations, CostResult, CostCalculation } from '../../api/cost.api'
import { getActivations } from '../../api/activations.api'
import { getCatalog, DiscCatalog } from '../../api/catalog.api'

type InputMethod = 'DXF' | 'MANUAL'

interface FormState {
  activation_id: string
  linear_meters: string
  material_price: string
  disc_price: string
  copies: string
  thickness_cm: 2 | 3
  machine_cost_hour: string
  labor_cost_hour: string
  energy_cost_kwh: string
  downtime_pct: string
  waste_pct: string
}

const defaultForm = (): FormState => ({
  activation_id: '',
  linear_meters: '',
  material_price: '',
  disc_price: '',
  copies: '1',
  thickness_cm: 2,
  machine_cost_hour: '',
  labor_cost_hour: '',
  energy_cost_kwh: '',
  downtime_pct: '',
  waste_pct: '',
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
          title="Upload DXF file"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  )
}

// ─── DXF Result Preview ───────────────────────────────────────────────────────

function DxfResultBox({ result }: { result: DxfParseResult }) {
  const linearMeters = (result.totalPerimeter / 1000).toFixed(3)
  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-green-600 dark:text-green-400 font-bold text-sm">✓</span>
        <p className="font-semibold text-green-700 dark:text-green-400 text-sm">
          {result.pieceCount} piece{result.pieceCount !== 1 ? 's' : ''} detected
        </p>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
        {result.pieces.map((p) => (
          <div key={p.id} className="flex justify-between text-xs text-green-700 dark:text-green-400">
            <span>Piece {p.id}</span>
            <span>{Math.round(p.perimeter).toLocaleString()}mm</span>
          </div>
        ))}
      </div>
      <div className="border-t border-green-200 dark:border-green-800 pt-2 flex justify-between text-sm font-semibold text-green-800 dark:text-green-300">
        <span>Total</span>
        <span>{Math.round(result.totalPerimeter).toLocaleString()}mm ({linearMeters} linear meters)</span>
      </div>
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

  const { data: activations = [], isLoading: activationsLoading } = useQuery({
    queryKey: ['activations', 'active'],
    queryFn: () => getActivations('ACTIVE'),
  })

  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['cost-calculations'],
    queryFn: getCalculations,
  })

  useEffect(() => {
    if (activations.length > 0 && !form.activation_id) {
      setForm((f) => ({ ...f, activation_id: activations[0].id }))
    }
  }, [activations])

  useEffect(() => {
    if (costConfig) {
      setForm((f) => ({
        ...f,
        machine_cost_hour: String(costConfig.machine_cost_hour),
        labor_cost_hour:   String(costConfig.labor_cost_hour),
        energy_cost_kwh:   String(costConfig.energy_cost_kwh),
        downtime_pct:      String(costConfig.downtime_pct),
        waste_pct:         String(costConfig.waste_pct),
      }))
    }
  }, [costConfig])

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
    enabled: !!selectedActivation && !!selectedActivation.material_group,
  })
  const catalog: DiscCatalog | null = catalogList[0] ?? null

  function handleDxfResult(r: DxfParseResult) {
    setDxfResult(r)
  }

  function validate(): boolean {
    const e: typeof errors = {}
    const mPrice = Number(form.material_price)
    const copies = Number(form.copies)

    if (inputMethod === 'DXF') {
      if (!dxfResult || dxfResult.pieceCount === 0) e.linear_meters = 'Upload a valid DXF file first'
    } else {
      const lm = Number(form.linear_meters)
      if (!form.linear_meters || lm <= 0) e.linear_meters = 'Must be a positive number'
    }
    if (!form.material_price || mPrice < 0) e.material_price = 'Required'
    if (!form.copies || copies <= 0) e.copies = 'Must be at least 1'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const calcMut = useMutation({
    mutationFn: () => {
      if (!costConfig) throw new Error('NO_COST_CONFIG')
      const common = {
        activation_id: form.activation_id || undefined,
        material_price: Number(form.material_price),
        disc_price: form.disc_price ? Number(form.disc_price) : undefined,
        copies: Number(form.copies),
        thickness_cm: form.thickness_cm,
        machine_cost_hour: form.machine_cost_hour ? Number(form.machine_cost_hour) : undefined,
        labor_cost_hour:   form.labor_cost_hour   ? Number(form.labor_cost_hour)   : undefined,
        energy_cost_kwh:   form.energy_cost_kwh   ? Number(form.energy_cost_kwh)   : undefined,
        downtime_pct:      form.downtime_pct      ? Number(form.downtime_pct)      : undefined,
        waste_pct:         form.waste_pct         ? Number(form.waste_pct)         : undefined,
      }
      if (inputMethod === 'DXF') {
        return calculateCost({
          ...common,
          input_method: 'DXF',
          piece_count: dxfResult!.pieceCount,
          total_perimeter: dxfResult!.totalPerimeter,
        })
      } else {
        return calculateCost({
          ...common,
          input_method: 'MANUAL',
          total_linear_meters: Number(form.linear_meters),
        })
      }
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
    setForm({
      ...defaultForm(),
      ...(costConfig ? {
        machine_cost_hour: String(costConfig.machine_cost_hour),
        labor_cost_hour:   String(costConfig.labor_cost_hour),
        energy_cost_kwh:   String(costConfig.energy_cost_kwh),
        downtime_pct:      String(costConfig.downtime_pct),
        waste_pct:         String(costConfig.waste_pct),
      } : {}),
    })
    setDxfResult(null)
    setErrors({})
  }

  function handleHistoryReload(calc: CostCalculation) {
    setResult(calc.result_json)
  }

  // ── Loading state ──
  if (activationsLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" className="text-blue-600" />
        </div>
      </AppLayout>
    )
  }

  // ── No active disc gate ──
  if (activations.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center mt-16 text-center px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 max-w-md w-full space-y-4">
            <div className="text-6xl">🧮</div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              No Active Disc
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The cost calculator requires an active disc. Activate a disc first
              to use the cost calculator with the correct disc parameters.
            </p>
            <Link to="/activate">
              <Button fullWidth>Activate a Disc</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  // ── Result view ──
  if (result) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <CostResultCard
            result={result}
            discLabel={discLabel}
            materialGroup={selectedActivation?.material_group ?? undefined}
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

          {/* 1 — Disc selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Active Disc
            </label>
            <select
              title="Active Disc"
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
            {selectedActivation?.material_group && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  Material:
                </span>
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  {selectedActivation.material_group}
                </span>
                <span className="text-xs text-blue-400 dark:text-blue-500 ml-auto italic">
                  from disc
                </span>
              </div>
            )}
          </div>

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
              {errors.linear_meters && (
                <p className="text-xs text-red-500">{errors.linear_meters}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                label="Total Linear Meters (m)"
                type="number"
                min="0"
                step="0.001"
                placeholder="e.g. 22.000"
                {...field('linear_meters')}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Enter total linear meters to cut
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                Example: 22.000 linear meters of granite cut with V-ARRAY 450mm
              </p>
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
            {catalog && (
              <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Recommended feed</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {form.thickness_cm === 2 ? catalog.feed_2cm : catalog.feed_3cm} mm/min
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Expected life</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {form.thickness_cm === 2 ? catalog.life_2cm : catalog.life_3cm} m
                  </p>
                </div>
              </div>
            )}
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
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Machine Cost (€/h)"  type="number" min="0" step="0.01"  {...field('machine_cost_hour')} />
                      <Input label="Labor Cost (€/h)"    type="number" min="0" step="0.01"  {...field('labor_cost_hour')} />
                      <Input label="Energy Cost (€/kWh)" type="number" min="0" step="0.001" {...field('energy_cost_kwh')} />
                      <Input label="Downtime %"          type="number" min="0" max="100"    {...field('downtime_pct')} />
                      <Input label="Waste %"             type="number" min="0" max="100"    {...field('waste_pct')} />
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600">
                      These values are pre-filled from your profile settings. Changes here only affect this calculation.
                    </p>
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
