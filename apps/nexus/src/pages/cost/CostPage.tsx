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

// ─── Constants ────────────────────────────────────────────────────────────────

const FAMILY_MATERIALS: Record<string, string[]> = {
  'THE QUEEN': ['quartzite_es'],
  'THE KING':  ['porcelain', 'quartzite'],
  'HERCULES':  ['porcelain'],
  'V-ARRAY':   ['granite', 'compact_quartz'],
}

const MATERIAL_LABELS: Record<string, string> = {
  quartzite_es:   'Quartzite (Cuarcita)',
  porcelain:      'Porcelain / Dekton',
  quartzite:      'Quartzite (Intl.)',
  granite:        'Granite',
  compact_quartz: 'Compact Quartz',
}

const MATERIAL_THICKNESS: Record<string, number[]> = {
  porcelain: [2.0, 1.2],
}
const DEFAULT_THICKNESS = [2.0, 3.0]

function getThicknesses(material: string): number[] {
  return MATERIAL_THICKNESS[material] ?? DEFAULT_THICKNESS
}

// ─── FormState ────────────────────────────────────────────────────────────────

interface FormState {
  activation_id:     string
  material_type:     string
  thickness:         string
  linear_meters:     string
  disc_price:        string
  material_price_m2: string
  estimated_area:    string
  machine_cost_hour: string
  labor_cost_hour:   string
  energy_cost_kwh:   string
  downtime_pct:      string
  waste_pct:         string
}

const defaultForm = (): FormState => ({
  activation_id:     '',
  material_type:     '',
  thickness:         '2.0',
  linear_meters:     '',
  disc_price:        '',
  material_price_m2: '',
  estimated_area:    '',
  machine_cost_hour: '',
  labor_cost_hour:   '',
  energy_cost_kwh:   '',
  downtime_pct:      '',
  waste_pct:         '',
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
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)

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

  // Auto-select first activation on load
  useEffect(() => {
    if (activations.length > 0 && !form.activation_id) {
      const first = activations[0]
      const fName = first.label?.family?.name ?? ''
      const available = FAMILY_MATERIALS[fName] ?? []
      const defaultMat = available.includes(first.material_type ?? '')
        ? first.material_type!
        : available[0] ?? ''
      const thicknesses = getThicknesses(defaultMat)
      setForm((f) => ({
        ...f,
        activation_id: first.id,
        material_type:  defaultMat,
        thickness:      String(thicknesses[0]),
      }))
    }
  }, [activations])

  // Pre-fill economic params from config
  useEffect(() => {
    if (costConfig) {
      setForm((f) => ({
        ...f,
        disc_price:        f.disc_price        || String(costConfig.default_disc_price ?? ''),
        machine_cost_hour: f.machine_cost_hour || String(costConfig.machine_cost_hour),
        labor_cost_hour:   f.labor_cost_hour   || String(costConfig.labor_cost_hour),
        energy_cost_kwh:   f.energy_cost_kwh   || String(costConfig.energy_cost_kwh),
        downtime_pct:      f.downtime_pct      || String(costConfig.downtime_pct),
        waste_pct:         f.waste_pct         || String(costConfig.waste_pct),
      }))
    }
  }, [costConfig])

  const selectedActivation = activations.find((a) => a.id === form.activation_id) ?? null
  const familyName = selectedActivation?.label?.family?.name ?? ''
  const availableMaterials = FAMILY_MATERIALS[familyName] ?? []
  const thicknessOptions = getThicknesses(form.material_type)

  function handleActivationChange(id: string) {
    const a = activations.find((x) => x.id === id)
    const fName = a?.label?.family?.name ?? ''
    const available = FAMILY_MATERIALS[fName] ?? []
    const defaultMat = available.includes(a?.material_type ?? '')
      ? a!.material_type!
      : available[0] ?? ''
    const thicknesses = getThicknesses(defaultMat)
    setForm((f) => ({
      ...f,
      activation_id: id,
      material_type:  defaultMat,
      thickness:      String(thicknesses[0]),
    }))
  }

  function handleMaterialChange(mat: string) {
    const thicknesses = getThicknesses(mat)
    setForm((f) => ({
      ...f,
      material_type: mat,
      thickness:     String(thicknesses[0]),
    }))
  }

  // Catalog query
  const { data: catalogList = [] } = useQuery({
    queryKey: [
      'catalog',
      selectedActivation?.label?.family?.id,
      form.material_type,
      selectedActivation?.label?.nominal_diameter,
    ],
    queryFn: () =>
      getCatalog({
        family_id:        selectedActivation!.label.family.id,
        material_type:    form.material_type,
        nominal_diameter: selectedActivation!.label.nominal_diameter,
      }),
    enabled: !!selectedActivation && !!form.material_type,
  })
  const catalog: DiscCatalog | null = catalogList[0] ?? null

  const thickness = Number(form.thickness)
  const useT2      = catalog ? Math.abs(Number(catalog.thickness_t2) - thickness) < 0.01 : false
  const previewFeed = catalog ? (useT2 ? catalog.feed_t2 : catalog.feed_t1) : null
  const previewLife = catalog ? (useT2 ? catalog.life_t2 : catalog.life_t1) : null

  const discLabel = selectedActivation
    ? `${selectedActivation.label?.family?.name} ${selectedActivation.label?.nominal_diameter}mm`
    : undefined

  function validate(): boolean {
    const e: typeof errors = {}
    if (inputMethod === 'DXF') {
      if (!dxfResult || dxfResult.pieceCount === 0) e.linear_meters = 'Upload a valid DXF file first'
    } else {
      const lm = Number(form.linear_meters)
      if (!form.linear_meters || lm <= 0) e.linear_meters = 'Must be a positive number'
    }
    if (!form.material_type) e.material_type = 'Select a material'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const calcMut = useMutation({
    mutationFn: () => {
      if (!costConfig) throw new Error('NO_COST_CONFIG')
      const common = {
        activation_id:     form.activation_id || undefined,
        material_type:     form.material_type  || undefined,
        thickness:         Number(form.thickness),
        disc_price:        form.disc_price        ? Number(form.disc_price)        : undefined,
        machine_cost_hour: form.machine_cost_hour ? Number(form.machine_cost_hour) : undefined,
        labor_cost_hour:   form.labor_cost_hour   ? Number(form.labor_cost_hour)   : undefined,
        energy_cost_kwh:   form.energy_cost_kwh   ? Number(form.energy_cost_kwh)   : undefined,
        downtime_pct:      form.downtime_pct       ? Number(form.downtime_pct)      : undefined,
        waste_pct:         form.waste_pct          ? Number(form.waste_pct)         : undefined,
        material_price_m2: form.material_price_m2  ? Number(form.material_price_m2) : undefined,
        estimated_area:    form.estimated_area      ? Number(form.estimated_area)    : undefined,
      }
      if (inputMethod === 'DXF') {
        return calculateCost({
          ...common,
          input_method:    'DXF',
          piece_count:     dxfResult!.pieceCount,
          total_perimeter: dxfResult!.totalPerimeter,
        })
      } else {
        return calculateCost({
          ...common,
          input_method:        'MANUAL',
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
    const base = defaultForm()
    if (costConfig) {
      base.disc_price        = String(costConfig.default_disc_price ?? '')
      base.machine_cost_hour = String(costConfig.machine_cost_hour)
      base.labor_cost_hour   = String(costConfig.labor_cost_hour)
      base.energy_cost_kwh   = String(costConfig.energy_cost_kwh)
      base.downtime_pct      = String(costConfig.downtime_pct)
      base.waste_pct         = String(costConfig.waste_pct)
    }
    setForm(base)
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">No Active Disc</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The cost calculator requires an active disc. Activate a disc first to use the cost calculator.
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
          <CostResultCard result={result} discLabel={discLabel} onReset={handleReset} />
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
              onChange={(e) => handleActivationChange(e.target.value)}
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

          {/* 2 — Material selector */}
          {selectedActivation && availableMaterials.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Material
              </label>
              {availableMaterials.length === 1 ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {MATERIAL_LABELS[availableMaterials[0]] ?? availableMaterials[0]}
                  </span>
                  <span className="text-xs text-blue-400 dark:text-blue-500">auto-selected</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableMaterials.map((mat) => (
                    <button
                      key={mat}
                      type="button"
                      onClick={() => handleMaterialChange(mat)}
                      className={[
                        'px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all',
                        form.material_type === mat
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400',
                      ].join(' ')}
                    >
                      {MATERIAL_LABELS[mat] ?? mat}
                    </button>
                  ))}
                </div>
              )}
              {errors.material_type && (
                <p className="mt-1 text-xs text-red-500">{errors.material_type}</p>
              )}
            </div>
          )}

          {/* 3 — Thickness selector */}
          {form.material_type && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Thickness
              </label>
              <div className="flex gap-2">
                {thicknessOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, thickness: String(t) }))}
                    className={[
                      'px-5 py-2 rounded-xl border-2 text-sm font-medium transition-all',
                      Number(form.thickness) === t
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400',
                    ].join(' ')}
                  >
                    {t} cm
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4 — Catalog params preview */}
          {catalog && (
            <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">RPM</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{catalog.rpm}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Feed rate</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{previewFeed} mm/min</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Disc life</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{previewLife} m</p>
              </div>
            </div>
          )}

          {/* 5 — Input method toggle */}
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

          {/* 6 — DXF or Manual inputs */}
          {inputMethod === 'DXF' ? (
            <div className="space-y-3">
              <DxfUploadZone onResult={(r) => setDxfResult(r)} onError={() => setInputMethod('MANUAL')} />
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
                value={form.linear_meters}
                onChange={(e) => {
                  setForm((f) => ({ ...f, linear_meters: e.target.value }))
                  setErrors((er) => ({ ...er, linear_meters: undefined }))
                }}
                error={errors.linear_meters}
              />
            </div>
          )}

          {/* 7 — Disc price + Material price */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Disc Price (€)"
                type="number"
                min="0"
                step="0.01"
                placeholder="450.00"
                value={form.disc_price}
                onChange={(e) => setForm((f) => ({ ...f, disc_price: e.target.value }))}
              />
              <Input
                label="Material Price (€/m²)"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00 (optional)"
                value={form.material_price_m2}
                onChange={(e) => setForm((f) => ({ ...f, material_price_m2: e.target.value }))}
              />
            </div>
            <Input
              label="Estimated Area (m²)"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 25.00 (optional)"
              value={form.estimated_area}
              onChange={(e) => setForm((f) => ({ ...f, estimated_area: e.target.value }))}
            />
          </div>

          {/* 8 — Advanced settings (collapsible) */}
          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <span>Advanced Settings</span>
              <span className="text-gray-400 text-xs">{showAdvanced ? '▲' : '▼'}</span>
            </button>
            {showAdvanced && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  Pre-filled from your profile. Changes here only affect this calculation.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Machine Cost (€/h)"
                    type="number" min="0" step="0.01"
                    value={form.machine_cost_hour}
                    onChange={(e) => setForm((f) => ({ ...f, machine_cost_hour: e.target.value }))}
                  />
                  <Input
                    label="Labor Cost (€/h)"
                    type="number" min="0" step="0.01"
                    value={form.labor_cost_hour}
                    onChange={(e) => setForm((f) => ({ ...f, labor_cost_hour: e.target.value }))}
                  />
                  <Input
                    label="Energy Cost (€/kWh)"
                    type="number" min="0" step="0.0001"
                    value={form.energy_cost_kwh}
                    onChange={(e) => setForm((f) => ({ ...f, energy_cost_kwh: e.target.value }))}
                  />
                  <Input
                    label="Downtime (%)"
                    type="number" min="0" max="100" step="0.1"
                    value={form.downtime_pct}
                    onChange={(e) => setForm((f) => ({ ...f, downtime_pct: e.target.value }))}
                  />
                  <Input
                    label="Waste (%)"
                    type="number" min="0" max="100" step="0.1"
                    value={form.waste_pct}
                    onChange={(e) => setForm((f) => ({ ...f, waste_pct: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {!costConfig && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400">
              ⚠️ No cost configuration found. Please set up your cost parameters in the Profile page before calculating.
            </div>
          )}

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
