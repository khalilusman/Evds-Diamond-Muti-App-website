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
import { parseDxfFile, DxfResult } from '../../services/dxf.service'
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
  multiplier:        string
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
  multiplier:        '1.0',
})

// ─── DXF Upload Zone ──────────────────────────────────────────────────────────

function DxfUploadZone({
  onResult,
  onError,
}: {
  onResult: (r: DxfResult) => void
  onError: () => void
}) {
  const { t } = useTranslation()
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.dxf')) {
      toast.error(t('cost.dxf_error_format'))
      return
    }
    setFileName(file.name)
    setParsing(true)
    try {
      const result = await parseDxfFile(file)
      if (result.warnings.length > 0) {
        result.warnings.forEach((w) => toast.error(w, { duration: 6000 }))
      }
      if (result.piece_count === 0) {
        onError()
      } else {
        onResult(result)
      }
    } catch (err: any) {
      toast.error(err.message ?? t('cost.dxf_error_parse'))
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
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('cost.dxf_analysing')}</p>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-2">📐</div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {fileName || t('cost.dxf_drop')}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {t('cost.dxf_hint_text')}
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

function DxfResultBox({ result }: { result: DxfResult }) {
  const { t } = useTranslation()
  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-green-600 dark:text-green-400 font-bold text-sm">✓</span>
        <p className="font-semibold text-green-700 dark:text-green-400 text-sm">
          {t('cost.dxf_detected', { count: result.piece_count })}
        </p>
      </div>
      <div className="overflow-x-auto mb-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-green-600 dark:text-green-500 border-b border-green-200 dark:border-green-800">
              <th className="text-left pb-1.5 font-medium">{t('cost.dxf_col_piece')}</th>
              <th className="text-right pb-1.5 font-medium">{t('cost.dxf_col_perimeter')}</th>
              <th className="text-right pb-1.5 font-medium">{t('cost.dxf_col_area')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-green-100 dark:divide-green-900/50">
            {result.pieces.map((p) => (
              <tr key={p.id} className="text-green-700 dark:text-green-400">
                <td className="py-1">{p.label}</td>
                <td className="py-1 text-right">
                  {p.perimeter_mm.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm
                </td>
                <td className="py-1 text-right">{p.area_m2.toFixed(4)} m²</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-green-300 dark:border-green-700 font-semibold text-green-800 dark:text-green-300">
              <td className="pt-2">{t('cost.dxf_total')}</td>
              <td className="pt-2 text-right">
                {result.total_perimeter_mm.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm
                <span className="block font-normal text-green-600 dark:text-green-500">
                  = {result.total_perimeter_m.toFixed(3)} m
                </span>
              </td>
              <td className="pt-2 text-right">{result.total_area_m2.toFixed(4)} m²</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {result.internal_cuts.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
          {t('cost.dxf_internal_cuts', { count: result.internal_cuts.length })}
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
  const [dxfResult, setDxfResult] = useState<DxfResult | null>(null)
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
      if (!dxfResult || dxfResult.piece_count === 0) e.linear_meters = t('cost.dxf_upload_first')
    } else {
      const lm = Number(form.linear_meters)
      if (!form.linear_meters || lm <= 0) e.linear_meters = t('cost.linear_meters_invalid')
    }
    if (!form.material_type) e.material_type = t('cost.material_required')
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
          piece_count:     dxfResult!.piece_count,
          total_perimeter: dxfResult!.total_perimeter_mm,
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
        toast.error(t('cost.no_config_warning'))
      } else {
        toast.error(t('errors.generic'))
      }
    },
  })

  function handleCalculate() {
    if (!validate()) return
    if (!costConfig) {
      toast.error(t('cost.no_config_warning'))
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('cost.no_disc_title')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('cost.no_disc_body')}
            </p>
            <Link to="/activate">
              <Button fullWidth>{t('cost.activate_disc')}</Button>
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
          <CostResultCard result={result} discLabel={discLabel} multiplier={Number(form.multiplier) || 1.0} onReset={handleReset} />
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
              {t('cost.active_disc')}
            </label>
            <select
              title={t('cost.active_disc')}
              value={form.activation_id}
              onChange={(e) => handleActivationChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">{t('cost.no_disc_selected')}</option>
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
                {t('cost.material')}
              </label>
              {availableMaterials.length === 1 ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {MATERIAL_LABELS[availableMaterials[0]] ?? availableMaterials[0]}
                  </span>
                  <span className="text-xs text-blue-400 dark:text-blue-500">{t('cost.auto_selected')}</span>
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
                {t('cost.thickness_label')}
              </label>
              <div className="flex gap-2">
                {thicknessOptions.map((thk) => (
                  <button
                    key={thk}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, thickness: String(thk) }))}
                    className={[
                      'px-5 py-2 rounded-xl border-2 text-sm font-medium transition-all',
                      Number(form.thickness) === thk
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400',
                    ].join(' ')}
                  >
                    {thk} cm
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
                <p className="text-xs text-gray-400 dark:text-gray-500">{t('cost.feed_rate')}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{previewFeed} mm/min</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">{t('cost.disc_life')}</p>
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
                  {m === 'DXF' ? `📐 ${t('cost.upload_dxf_btn')}` : `✏️ ${t('cost.manual_input_btn')}`}
                </button>
              ))}
            </div>
          </div>

          {/* 6 — DXF or Manual inputs */}
          {inputMethod === 'DXF' ? (
            <div className="space-y-3">
              <DxfUploadZone
                onResult={(r) => {
                  setDxfResult(r)
                  setForm((f) => ({ ...f, estimated_area: String(r.total_area_m2) }))
                }}
                onError={() => setInputMethod('MANUAL')}
              />
              {dxfResult && <DxfResultBox result={dxfResult} />}
              {errors.linear_meters && (
                <p className="text-xs text-red-500">{errors.linear_meters}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                label={t('cost.linear_meters')}
                type="number"
                min="0"
                step="0.001"
                placeholder={t('cost.linear_meters_placeholder')}
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
                label={t('cost.disc_price_label')}
                type="number"
                min="0"
                step="0.01"
                placeholder="450.00"
                value={form.disc_price}
                onChange={(e) => setForm((f) => ({ ...f, disc_price: e.target.value }))}
              />
              <Input
                label={t('cost.material_price_label')}
                type="number"
                min="0"
                step="0.01"
                placeholder={t('cost.material_price_placeholder')}
                value={form.material_price_m2}
                onChange={(e) => setForm((f) => ({ ...f, material_price_m2: e.target.value }))}
              />
            </div>
            <Input
              label={t('cost.estimated_area')}
              type="number"
              min="0"
              step="0.01"
              placeholder={t('cost.estimated_area_placeholder')}
              value={form.estimated_area}
              onChange={(e) => setForm((f) => ({ ...f, estimated_area: e.target.value }))}
            />
          </div>

          {/* 8 — Price Multiplier */}
          <Input
            label={t('cost.price_multiplier')}
            type="number"
            min="1.0"
            step="0.1"
            placeholder={t('cost.multiplier_placeholder')}
            value={form.multiplier}
            onChange={(e) => setForm((f) => ({ ...f, multiplier: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-1">{t('cost.multiplier_hint')}</p>

          {/* 9 — Advanced settings (collapsible) */}
          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <span>{t('cost.advanced_settings')}</span>
              <span className="text-gray-400 text-xs">{showAdvanced ? '▲' : '▼'}</span>
            </button>
            {showAdvanced && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  {t('cost.advanced_hint')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t('cost.machine_cost_hour')}
                    type="number" min="0" step="0.01"
                    value={form.machine_cost_hour}
                    onChange={(e) => setForm((f) => ({ ...f, machine_cost_hour: e.target.value }))}
                  />
                  <Input
                    label={t('cost.labor_cost_hour')}
                    type="number" min="0" step="0.01"
                    value={form.labor_cost_hour}
                    onChange={(e) => setForm((f) => ({ ...f, labor_cost_hour: e.target.value }))}
                  />
                  <Input
                    label={t('cost.energy_cost_kwh')}
                    type="number" min="0" step="0.0001"
                    value={form.energy_cost_kwh}
                    onChange={(e) => setForm((f) => ({ ...f, energy_cost_kwh: e.target.value }))}
                  />
                  <Input
                    label={t('cost.downtime_pct')}
                    type="number" min="0" max="100" step="0.1"
                    value={form.downtime_pct}
                    onChange={(e) => setForm((f) => ({ ...f, downtime_pct: e.target.value }))}
                  />
                  <Input
                    label={t('cost.waste_pct')}
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
              ⚠️ {t('cost.no_config_warning')}
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
              {t('cost.recent_calculations')}
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
