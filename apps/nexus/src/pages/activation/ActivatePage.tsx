import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import AppLayout from '../../layouts/AppLayout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import LoadingSpinner from '../../components/LoadingSpinner'
import { lookupCode, createActivation, LabelLookup, Activation } from '../../api/activations.api'
import { getMachines } from '../../api/machines.api'
import { getCatalog, getWearReference } from '../../api/catalog.api'

// Family → valid material groups
const FAMILY_MATERIALS: Record<string, { value: string; label: string }[]> = {
  'THE QUEEN': [{ value: 'quartzite', label: 'Quartzite' }],
  'THE KING': [
    { value: 'porcelain', label: 'Porcelain / Dekton' },
    { value: 'quartzite', label: 'Quartzite' },
  ],
  HERCULES: [{ value: 'porcelain', label: 'Porcelain / Dekton' }],
  'V-ARRAY': [
    { value: 'granite', label: 'Granite' },
    { value: 'compact_quartz', label: 'Compact Quartz' },
  ],
}

interface FormData {
  unique_code: string
  machine_id: string
  diameter_at_activation: string
  thickness_cm: 2 | 3
  material_group: string
  notes: string
}

function StepIndicator({ step }: { step: number }) {
  const { t } = useTranslation()
  const steps = [
    t('activation.step1_title'),
    t('activation.step2_title'),
    t('activation.step3_title'),
  ]
  return (
    <div className="flex items-center mb-8">
      {steps.map((label, i) => {
        const num = i + 1
        const isActive = num === step
        const isDone = num < step
        return (
          <div key={num} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                  isDone
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                ].join(' ')}
              >
                {isDone ? '✓' : num}
              </div>
              <span
                className={`text-xs mt-1 text-center max-w-[72px] leading-tight ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-5 ${
                  num < step ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1 ──────────────────────────────────────────────────────────────────

function Step1({
  onNext,
}: {
  onNext: (label: LabelLookup, code: string) => void
}) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code')?.toUpperCase() ?? '')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{ type: 'error' | 'warn'; message: string } | null>(null)
  const [window2Label, setWindow2Label] = useState<LabelLookup | null>(null)

  useEffect(() => {
    if (searchParams.get('code')) handleLookup(searchParams.get('code')!.toUpperCase())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLookup(lookupVal?: string) {
    const val = (lookupVal ?? code).trim().toUpperCase()
    if (!val) return
    setAlert(null)
    setWindow2Label(null)
    setLoading(true)
    try {
      const label = await lookupCode(val)
      if (label.status === 'EXPIRED_W1') {
        setWindow2Label(label)
      } else {
        onNext(label, val)
      }
    } catch (err: any) {
      const status = err.response?.status
      const errCode = err.response?.data?.error
      if (status === 404 || errCode === 'CODE_NOT_FOUND') {
        setAlert({ type: 'error', message: t('activation.errors.code_not_found') })
      } else if (errCode === 'ALREADY_ACTIVE') {
        setAlert({ type: 'warn', message: t('activation.errors.already_active') })
      } else if (status === 410 || errCode === 'MAX_ACTIVATIONS_REACHED') {
        setAlert({ type: 'error', message: t('activation.errors.max_reached') })
      } else if (errCode === 'CODE_VOIDED') {
        setAlert({ type: 'error', message: t('activation.errors.voided') })
      } else {
        setAlert({ type: 'error', message: t('errors.generic') })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          {t('activation.enter_code')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {t('activation.code_hint')}
        </p>

        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setAlert(null)
            setWindow2Label(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          placeholder={t('activation.code_placeholder')}
          className="w-full px-4 py-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-mono text-2xl text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase mb-4"
          maxLength={8}
          autoFocus
        />

        {alert && (
          <div
            className={`rounded-xl p-3 mb-4 text-sm ${
              alert.type === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            }`}
          >
            {alert.message}
            {alert.message === t('activation.errors.already_active') && (
              <Link
                to="/my-discs"
                className="block mt-1 font-medium underline"
              >
                View in My Discs →
              </Link>
            )}
          </div>
        )}

        {window2Label && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
              ⚠️ {t('activation.window_2_notice')}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
              This is your final activation for this disc. After expiry, this code cannot be used again.
            </p>
            <Button fullWidth onClick={() => onNext(window2Label, code.trim().toUpperCase())}>
              Continue
            </Button>
          </div>
        )}

        {!window2Label && (
          <Button fullWidth loading={loading} onClick={() => handleLookup()}>
            {t('activation.lookup_code')}
          </Button>
        )}

        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('activation.scan_qr')}? The code will be pre-filled automatically from the QR link.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Step 2 ──────────────────────────────────────────────────────────────────

function Step2({
  label,
  formData,
  setFormData,
  onNext,
  onBack,
}: {
  label: LabelLookup
  formData: FormData
  setFormData: (f: FormData) => void
  onNext: () => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const familyName = label.family.name.toUpperCase()
  const materialOptions = FAMILY_MATERIALS[familyName] ?? []

  const { data: machines = [], isLoading: machinesLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: getMachines,
  })

  const { data: catalogList = [] } = useQuery({
    queryKey: ['catalog', label.family.id, formData.material_group, label.nominal_diameter],
    queryFn: () =>
      getCatalog({
        family_id: label.family.id,
        material_group: formData.material_group || undefined,
        nominal_diameter: label.nominal_diameter,
      }),
    enabled: !!formData.material_group,
  })

  const { data: wearList = [] } = useQuery({
    queryKey: ['wear', label.family.id, label.nominal_diameter],
    queryFn: () =>
      getWearReference({ family_id: label.family.id, nominal_diameter: label.nominal_diameter }),
  })

  const catalog = catalogList[0]
  const wear = wearList[0]
  const recommendedFeed = catalog
    ? (formData.thickness_cm === 3 ? catalog.feed_3cm : catalog.feed_2cm)
    : null
  const expectedLife = catalog
    ? (formData.thickness_cm === 3 ? catalog.life_3cm : catalog.life_2cm)
    : null

  // Auto-select if only one material
  useEffect(() => {
    if (materialOptions.length === 1 && !formData.material_group) {
      setFormData({ ...formData, material_group: materialOptions[0].value })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function validate() {
    const e: Record<string, string> = {}
    if (!formData.material_group) e.material = 'Please select a material'
    if (!formData.machine_id) e.machine = 'Please select a machine'
    if (!formData.diameter_at_activation) {
      e.diameter = t('common.required')
    } else if (Number(formData.diameter_at_activation) <= 0) {
      e.diameter = 'Must be a positive number'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (validate()) onNext()
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Disc info card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Family</span>
          <span className="font-medium text-gray-900 dark:text-white">{label.family.name}</span>
          <span className="text-gray-500 dark:text-gray-400">Diameter</span>
          <span className="font-medium text-gray-900 dark:text-white">{label.nominal_diameter}mm</span>
          <span className="text-gray-500 dark:text-gray-400">Lot</span>
          <span className="font-medium text-gray-900 dark:text-white">{label.lot_number}</span>
          <span className="text-gray-500 dark:text-gray-400">Code</span>
          <span className="font-mono font-medium text-gray-900 dark:text-white">{label.unique_code}</span>
          <span className="text-gray-500 dark:text-gray-400">Full Code</span>
          <span className="font-mono text-xs font-medium text-gray-900 dark:text-white break-all">{label.full_code}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 space-y-5">
        {/* Material */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('activation.select_material')}
          </label>
          <div className="grid grid-cols-1 gap-2">
            {materialOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setFormData({ ...formData, material_group: opt.value })
                  setErrors((e) => ({ ...e, material: '' }))
                }}
                className={[
                  'px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all',
                  formData.material_group === opt.value
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {errors.material && (
            <p className="mt-1 text-sm text-red-500">{errors.material}</p>
          )}
        </div>

        {/* Thickness */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('activation.select_thickness')}
          </label>
          <div className="flex gap-3">
            {([2, 3] as const).map((cm) => (
              <button
                key={cm}
                type="button"
                onClick={() => setFormData({ ...formData, thickness_cm: cm })}
                className={[
                  'flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all',
                  formData.thickness_cm === cm
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400',
                ].join(' ')}
              >
                {cm} cm
              </button>
            ))}
          </div>
        </div>

        {/* Machine */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('activation.select_machine')}
          </label>
          {machinesLoading ? (
            <LoadingSpinner size="sm" className="text-blue-600" />
          ) : machines.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              No machines found.{' '}
              <Link to="/machines" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
                Create a machine first →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {machines.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, machine_id: m.id })
                    setErrors((e) => ({ ...e, machine: '' }))
                  }}
                  className={[
                    'px-4 py-3 rounded-xl border-2 text-left transition-all',
                    formData.machine_id === m.id
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-400',
                  ].join(' ')}
                >
                  <span className="font-medium text-gray-900 dark:text-white text-sm">{m.name}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {m._count?.activations ?? 0} active
                  </span>
                </button>
              ))}
            </div>
          )}
          {errors.machine && (
            <p className="mt-1 text-sm text-red-500">{errors.machine}</p>
          )}
        </div>

        {/* Diameter */}
        <div>
          <Input
            label={t('activation.measured_diameter')}
            type="number"
            placeholder={String(label.nominal_diameter)}
            min="0"
            step="0.1"
            value={formData.diameter_at_activation}
            onChange={(e) => {
              setFormData({ ...formData, diameter_at_activation: e.target.value })
              setErrors((er) => ({ ...er, diameter: '' }))
            }}
            error={errors.diameter}
          />
          {wear && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-500 dark:text-gray-400">
              New disc: ~{wear.new_diameter}mm &nbsp;|&nbsp; Worn: ~{wear.worn_diameter}mm
              <br />
              {t('activation.diameter_hint')}
            </div>
          )}
        </div>

        {/* Catalog preview */}
        {catalog && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2 uppercase tracking-wide">
              Recommended Parameters
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{catalog.recommended_rpm}</p>
                <p className="text-xs text-gray-400">{t('activation.recommended_rpm')}</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{recommendedFeed ?? '—'}</p>
                <p className="text-xs text-gray-400">{t('activation.recommended_feed')}</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{expectedLife != null ? `~${expectedLife}m` : '—'}</p>
                <p className="text-xs text-gray-400">{t('activation.expected_life')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Notes (optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            maxLength={500}
            rows={3}
            placeholder="Any observations..."
            className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onBack}>
            {t('common.back')}
          </Button>
          <Button fullWidth onClick={handleNext}>
            {t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Step 3 ──────────────────────────────────────────────────────────────────

function Step3({
  label,
  formData,
  onBack,
  onSuccess,
}: {
  label: LabelLookup
  formData: FormData
  onBack: () => void
  onSuccess: (activation: Activation) => void
}) {
  const { t } = useTranslation()

  const { data: machines = [] } = useQuery({ queryKey: ['machines'], queryFn: getMachines })
  const machine = machines.find((m) => m.id === formData.machine_id)

  const { data: catalogList = [] } = useQuery({
    queryKey: ['catalog', label.family.id, formData.material_group, label.nominal_diameter],
    queryFn: () =>
      getCatalog({
        family_id: label.family.id,
        material_group: formData.material_group,
        nominal_diameter: label.nominal_diameter,
      }),
  })

  const { data: wearList = [] } = useQuery({
    queryKey: ['wear', label.family.id, label.nominal_diameter],
    queryFn: () =>
      getWearReference({ family_id: label.family.id, nominal_diameter: label.nominal_diameter }),
  })

  const catalog = catalogList[0]
  const wear = wearList[0]
  const recommendedFeed = catalog
    ? (formData.thickness_cm === 3 ? catalog.feed_3cm : catalog.feed_2cm)
    : null
  const expectedLife = catalog
    ? (formData.thickness_cm === 3 ? catalog.life_3cm : catalog.life_2cm)
    : null

  const expiresAt = new Date(Date.now() + 168 * 60 * 60 * 1000)
  const isWindow2 = label.activation_count >= 1

  const activateMut = useMutation({
    mutationFn: () =>
      createActivation({
        unique_code: formData.unique_code,
        machine_id: formData.machine_id,
        diameter_at_activation: Number(formData.diameter_at_activation),
        thickness_cm: formData.thickness_cm,
        material_group: formData.material_group,
        notes: formData.notes || undefined,
      }),
    onSuccess: (data) => onSuccess(data),
    onError: (err: any) => {
      const code = err.response?.data?.error
      if (code === 'ALREADY_ACTIVE') {
        toast.error(t('activation.errors.already_active'))
      } else if (code === 'MAX_ACTIVATIONS_REACHED') {
        toast.error(t('activation.errors.max_reached'))
      } else {
        toast.error(t('errors.generic'))
      }
    },
  })

  const materialOptions = FAMILY_MATERIALS[label.family.name.toUpperCase()] ?? []
  const materialLabel =
    materialOptions.find((m) => m.value === formData.material_group)?.label ?? formData.material_group

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Summary */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {t('activation.step3_title')}
        </h2>
        <dl className="divide-y divide-gray-100 dark:divide-gray-800">
          {[
            ['Disc Code', <span className="font-mono">{label.unique_code}</span>],
            ['Full Code', <span className="font-mono text-xs">{label.full_code}</span>],
            ['Family', label.family.name],
            ['Diameter', `${label.nominal_diameter}mm`],
            ['Lot', label.lot_number],
            ['Material', materialLabel],
            ['Thickness', `${formData.thickness_cm}cm`],
            ['Machine', machine?.name ?? '—'],
            ['Measured Diameter', `${formData.diameter_at_activation}mm`],
          ].map(([k, v]) => (
            <div key={String(k)} className="py-2 flex justify-between items-center gap-4">
              <dt className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{k}</dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Catalog params */}
      {catalog && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2 uppercase tracking-wide">
            Recommended Parameters
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="font-bold text-gray-900 dark:text-white">{catalog.recommended_rpm}</p>
              <p className="text-xs text-gray-400">{t('activation.recommended_rpm')}</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white">{recommendedFeed ?? '—'}</p>
              <p className="text-xs text-gray-400">{t('activation.recommended_feed')}</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white">{expectedLife != null ? `~${expectedLife}m` : '—'}</p>
              <p className="text-xs text-gray-400">{t('activation.expected_life')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Wear reference */}
      {wear && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 uppercase tracking-wide">
            Wear Reference
          </p>
          <div className="flex justify-between text-gray-700 dark:text-gray-300">
            <span>New: {wear.new_diameter}mm</span>
            <span>Worn: {wear.worn_diameter}mm</span>
          </div>
        </div>
      )}

      {/* Expiry */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 text-sm">
        <span className="text-gray-500 dark:text-gray-400">{t('activation.expires_at')}: </span>
        <span className="font-semibold text-gray-900 dark:text-white">
          {expiresAt.toLocaleString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Window 2 warning */}
      {isWindow2 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          ⚠️ This is your <strong>FINAL</strong> activation for this disc. After expiry, this code cannot be used again.
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} disabled={activateMut.isPending}>
          {t('common.back')}
        </Button>
        <Button fullWidth loading={activateMut.isPending} onClick={() => activateMut.mutate()}>
          {t('activation.activate_button')}
        </Button>
      </div>
    </div>
  )
}

// ── Success Screen ──────────────────────────────────────────────────────────

function SuccessScreen({ activation }: { activation: Activation }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('activation.success_title')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {t('activation.expires_at')}:{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {new Date(activation.expires_at).toLocaleString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </p>
        <div className="flex flex-col gap-3 mt-6">
          <Button fullWidth onClick={() => navigate('/my-discs')}>
            View My Discs
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate(`/usage?activation_id=${activation.id}`)}
          >
            Log Usage Now
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ActivatePage() {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [labelData, setLabelData] = useState<LabelLookup | null>(null)
  const [formData, setFormData] = useState<FormData>({
    unique_code: '',
    machine_id: '',
    diameter_at_activation: '',
    thickness_cm: 2,
    material_group: '',
    notes: '',
  })
  const [activated, setActivated] = useState<Activation | null>(null)

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t('activation.title')}
        </h1>

        {!activated && <StepIndicator step={step} />}

        {activated ? (
          <SuccessScreen activation={activated} />
        ) : step === 1 ? (
          <Step1
            onNext={(label, code) => {
              setLabelData(label)
              setFormData((f) => ({ ...f, unique_code: code }))
              setStep(2)
            }}
          />
        ) : step === 2 && labelData ? (
          <Step2
            label={labelData}
            formData={formData}
            setFormData={setFormData}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        ) : step === 3 && labelData ? (
          <Step3
            label={labelData}
            formData={formData}
            onBack={() => setStep(2)}
            onSuccess={(a) => setActivated(a)}
          />
        ) : null}
      </div>
    </AppLayout>
  )
}
