import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import AppLayout from '../../layouts/AppLayout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import LoadingSpinner from '../../components/LoadingSpinner'
import { getActivations } from '../../api/activations.api'
import { createUsageLog, getUsageLogs } from '../../api/usage-logs.api'
import { getCatalog } from '../../api/catalog.api'

const CUT_TYPES = [
  { value: 'straight', label: 'Straight' },
  { value: 'miter', label: '45° Miter' },
  { value: 'curve', label: 'Curve' },
]

interface FormState {
  activation_id: string
  current_diameter: string
  meters_cut: string
  rpm_used: string
  feed_used: string
  cut_type: string
  water_flow_ok: boolean
  notes: string
}

const defaultForm = (): FormState => ({
  activation_id: '',
  current_diameter: '',
  meters_cut: '',
  rpm_used: '',
  feed_used: '',
  cut_type: '',
  water_flow_ok: true,
  notes: '',
})

interface DiameterFraudAlert {
  entered: number
  max: number
}

export default function UsagePage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()

  const [form, setForm] = useState<FormState>(defaultForm())
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [fraudAlert, setFraudAlert] = useState<DiameterFraudAlert | null>(null)

  const { data: activations = [], isLoading: activationsLoading } = useQuery({
    queryKey: ['activations', 'active'],
    queryFn: () => getActivations('ACTIVE'),
  })

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['usage-logs', form.activation_id || null],
    queryFn: () => getUsageLogs(form.activation_id || undefined),
  })

  const selectedActivation = activations.find((a) => a.id === form.activation_id) ?? null

  const { data: catalogList = [] } = useQuery({
    queryKey: [
      'catalog',
      selectedActivation?.label?.family?.id,
      selectedActivation?.material_type,
      selectedActivation?.label?.nominal_diameter,
    ],
    queryFn: () =>
      getCatalog({
        family_id: selectedActivation!.label.family.id,
        material_type: selectedActivation!.material_type ?? undefined,
        nominal_diameter: selectedActivation!.label.nominal_diameter,
      }),
    enabled: !!selectedActivation,
  })
  const catalog = catalogList[0]
  const useT2 = catalog && selectedActivation
    ? Math.abs(Number(catalog.thickness_t2) - (selectedActivation.thickness ?? 2.0)) < 0.01
    : false
  const recommendedFeed = catalog ? (useT2 ? catalog.feed_t2 : catalog.feed_t1) : null
  const recommendedRpm = catalog?.rpm ?? null

  // Pre-select from URL param
  useEffect(() => {
    const id = searchParams.get('activation_id')
    if (id && activations.find((a) => a.id === id)) {
      setForm((f) => ({ ...f, activation_id: id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activations])

  // Anti-fraud visual check
  useEffect(() => {
    if (!selectedActivation || !form.current_diameter) {
      setFraudAlert(null)
      return
    }
    const entered = Number(form.current_diameter)
    const max = selectedActivation.diameter_at_activation + 1
    if (entered > max) {
      setFraudAlert({ entered, max })
    } else {
      setFraudAlert(null)
    }
  }, [form.current_diameter, selectedActivation])

  const submitMut = useMutation({
    mutationFn: async () => {
      const payload = {
        activation_id: form.activation_id,
        current_diameter: parseFloat(form.current_diameter),
        meters_cut: parseFloat(form.meters_cut),
        thickness: selectedActivation?.thickness ?? 2.0,
        material_type: selectedActivation?.material_type ?? 'unknown',
        rpm_used: form.rpm_used ? parseInt(form.rpm_used, 10) : null,
        feed_used: form.feed_used ? parseInt(form.feed_used, 10) : null,
        cut_type: form.cut_type || null,
        water_flow_ok: form.water_flow_ok,
        notes: form.notes || null,
      }
      const response = await createUsageLog(payload)
      return response.data
    },
    onSuccess: () => {
      toast.success(t('usage.success'))
      setForm((f) => ({
        ...defaultForm(),
        activation_id: f.activation_id,
      }))
      setFraudAlert(null)
      qc.invalidateQueries({ queryKey: ['usage-logs'] })
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error
      if (!code && !err?.response) return
      if (code === 'DIAMETER_FRAUD') {
        // shown inline via serverFraud below
      } else if (code === 'ACTIVATION_EXPIRED') {
        toast.error(t('usage.errors.expired'))
      } else {
        toast.error(t('errors.generic'))
      }
    },
  })

  const serverFraud =
    submitMut.isError && (submitMut.error as any)?.response?.data?.error === 'DIAMETER_FRAUD'

  function validate() {
    const e: Partial<FormState> = {}
    if (!form.activation_id) e.activation_id = t('common.required') as any
    if (!form.current_diameter) e.current_diameter = t('common.required') as any
    else if (Number(form.current_diameter) <= 0) e.current_diameter = 'Must be positive' as any
    if (!form.meters_cut) e.meters_cut = t('common.required') as any
    else if (Number(form.meters_cut) <= 0) e.meters_cut = 'Must be positive' as any
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) submitMut.mutate()
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  if (activationsLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" className="text-blue-600" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('usage.title')}
        </h1>

        {/* No active discs empty state */}
        {activations.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-10 text-center">
            <div className="text-5xl mb-4">💿</div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('discs.no_discs')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {t('discs.activate_first')}
            </p>
            <Link to="/activate">
              <Button>{t('nav.activate')}</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* ── LOG FORM ── */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 space-y-5">
              {/* Select active disc */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Active Disc
                </label>
                <div className="space-y-2">
                  {activations.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setField('activation_id', a.id)}
                      className={[
                        'w-full text-left px-4 py-3 rounded-xl border-2 transition-all',
                        form.activation_id === a.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-400',
                      ].join(' ')}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">
                            {a.label?.family?.name} — {a.label?.nominal_diameter}mm
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                            {a.label?.unique_code} · {a.machine?.name}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                          Exp {new Date(a.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                {errors.activation_id && (
                  <p className="mt-1 text-sm text-red-500">{errors.activation_id as string}</p>
                )}
              </div>

              {/* Current diameter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('usage.current_diameter')}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={form.current_diameter}
                  onChange={(e) => setField('current_diameter', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g. 390.0"
                />
                {errors.current_diameter && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.current_diameter as string}</p>
                )}
                {fraudAlert && (
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                    ⚠️ Diameter exceeds activation diameter by more than 1mm
                    <br />
                    Max allowed: {fraudAlert.max}mm &nbsp;|&nbsp; You entered: {fraudAlert.entered}mm
                  </div>
                )}
                {!fraudAlert && form.current_diameter && selectedActivation && (
                  <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">✓ Valid diameter</p>
                )}
              </div>

              {/* Meters cut */}
              <Input
                label={t('usage.meters_cut')}
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={form.meters_cut}
                onChange={(e) => setField('meters_cut', e.target.value)}
                error={errors.meters_cut as string}
              />

              {/* RPM */}
              <div>
                <Input
                  label={`${t('usage.rpm_used')} (${t('common.optional')})`}
                  type="number"
                  placeholder={recommendedRpm != null ? String(recommendedRpm) : '0'}
                  min="0"
                  value={form.rpm_used}
                  onChange={(e) => setField('rpm_used', e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Recommended: {recommendedRpm != null ? `${recommendedRpm} RPM` : '—'}
                </p>
              </div>

              {/* Feed */}
              <div>
                <Input
                  label={`${t('usage.feed_used')} (${t('common.optional')})`}
                  type="number"
                  placeholder={recommendedFeed != null ? String(recommendedFeed) : '0'}
                  min="0"
                  value={form.feed_used}
                  onChange={(e) => setField('feed_used', e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Recommended: {recommendedFeed != null ? `${recommendedFeed} mm/min` : '—'}
                </p>
              </div>

              {/* Cut type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('usage.cut_type')} ({t('common.optional')})
                </label>
                <div className="flex gap-2">
                  {CUT_TYPES.map((ct) => (
                    <button
                      key={ct.value}
                      type="button"
                      onClick={() =>
                        setField('cut_type', form.cut_type === ct.value ? '' : ct.value)
                      }
                      className={[
                        'flex-1 py-2 px-2 rounded-xl border-2 text-xs font-medium transition-all',
                        form.cut_type === ct.value
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400',
                      ].join(' ')}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Water flow */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('usage.water_flow')}
                </label>
                <div className="flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 p-0.5">
                  {[true, false].map((val) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => setField('water_flow_ok', val)}
                      className={[
                        'px-4 py-1 rounded-full text-sm font-medium transition-colors',
                        form.water_flow_ok === val
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
                      ].join(' ')}
                    >
                      {val ? t('common.yes') : t('common.no')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('usage.notes')} ({t('common.optional')})
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Any observations..."
                  className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none text-sm"
                />
              </div>

              {/* Server-side fraud error */}
              {serverFraud && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                  {t('usage.errors.diameter_fraud')}
                </div>
              )}

              <Button fullWidth loading={submitMut.isPending} onClick={handleSubmit}>
                {t('usage.submit')}
              </Button>
            </div>

            {/* ── HISTORY ── */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recent Usage
              </h2>

              {logsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="md" className="text-blue-600" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No usage logged yet
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {logs.slice(0, 10).map((log) => (
                    <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {log.activation?.label?.family?.name} ·{' '}
                          <span className="font-mono">{log.activation?.label?.unique_code}</span>
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          <span>{log.meters_cut}m cut</span>
                          <span>Ø {log.current_diameter}mm</span>
                          {log.rpm_used && <span>{log.rpm_used} RPM</span>}
                          {log.cut_type && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              {log.cut_type}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(log.logged_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
