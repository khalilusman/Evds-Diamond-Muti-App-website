import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import AppLayout from '../../layouts/AppLayout'
import Input from '../../components/Input'
import Button from '../../components/Button'
import api from '../../api/client'
import useAuthStore from '../../stores/auth.store'

interface CostForm {
  machine_cost_hour: string
  labor_cost_hour: string
  energy_cost_kwh: string
  default_disc_price: string
}

interface CostErrors {
  machine_cost_hour?: string
  labor_cost_hour?: string
  energy_cost_kwh?: string
  default_disc_price?: string
}

export default function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  useAuthStore()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [costForm, setCostForm] = useState<CostForm>({
    machine_cost_hour: '',
    labor_cost_hour: '',
    energy_cost_kwh: '',
    default_disc_price: '',
  })
  const [costErrors, setCostErrors] = useState<CostErrors>({})

  const [machineName, setMachineName] = useState('')
  const [machineError, setMachineError] = useState('')

  function setField(field: keyof CostForm, value: string) {
    setCostForm((f) => ({ ...f, [field]: value }))
    setCostErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validateCost() {
    const e: CostErrors = {}
    const fields: (keyof CostForm)[] = [
      'machine_cost_hour',
      'labor_cost_hour',
      'energy_cost_kwh',
      'default_disc_price',
    ]
    for (const f of fields) {
      const val = parseFloat(costForm[f])
      if (!costForm[f]) {
        e[f] = t('common.required')
      } else if (isNaN(val) || val < 0) {
        e[f] = 'Must be a positive number'
      }
    }
    setCostErrors(e)
    return Object.keys(e).length === 0
  }

  function handleStep1Next() {
    if (validateCost()) setStep(2)
  }

  async function handleStep2Next() {
    if (!machineName.trim()) {
      setMachineError(t('common.required'))
      return
    }
    setLoading(true)
    try {
      await api.post('/api/machines', { name: machineName.trim() })
      await api.post('/api/cost/configs', {
        machine_cost_hour: parseFloat(costForm.machine_cost_hour),
        labor_cost_hour: parseFloat(costForm.labor_cost_hour),
        energy_cost_kwh: parseFloat(costForm.energy_cost_kwh),
        default_disc_price: parseFloat(costForm.default_disc_price),
      })
      setStep(3)
    } catch (err: any) {
      toast.error(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  async function handleComplete() {
    setLoading(true)
    try {
      await api.patch('/api/companies/me', { onboarding_complete: true })
      const { data } = await api.get('/api/auth/me')
      const u = data.data
      const token = localStorage.getItem('evds_token') ?? ''
      useAuthStore.getState().setAuth(token, {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        company: u.company
          ? {
              id: u.company.id,
              name: u.company.name,
              status: u.company.status,
              onboarding_complete: u.company.onboarding_complete,
            }
          : undefined,
      })
      navigate('/my-discs')
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    t('onboarding.step1_title'),
    t('onboarding.step2_title'),
    t('onboarding.complete_title'),
  ]

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((label, i) => {
              const num = i + 1
              const isActive = num === step
              const isDone = num < step
              return (
                <div key={num} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={[
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
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
                      className={`text-xs mt-1 text-center max-w-[80px] ${
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
                        num < step
                          ? 'bg-green-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6">
          {/* Step 1 */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {t('onboarding.step1_title')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {t('onboarding.subtitle')}
              </p>
              <div className="space-y-4">
                <Input
                  label={t('onboarding.machine_cost')}
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={costForm.machine_cost_hour}
                  onChange={(e) => setField('machine_cost_hour', e.target.value)}
                  error={costErrors.machine_cost_hour}
                />
                <Input
                  label={t('onboarding.labor_cost')}
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={costForm.labor_cost_hour}
                  onChange={(e) => setField('labor_cost_hour', e.target.value)}
                  error={costErrors.labor_cost_hour}
                />
                <Input
                  label={t('onboarding.energy_cost')}
                  type="number"
                  placeholder="0.0000"
                  min="0"
                  step="0.0001"
                  value={costForm.energy_cost_kwh}
                  onChange={(e) => setField('energy_cost_kwh', e.target.value)}
                  error={costErrors.energy_cost_kwh}
                />
                <Input
                  label={t('onboarding.disc_price')}
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={costForm.default_disc_price}
                  onChange={(e) => setField('default_disc_price', e.target.value)}
                  error={costErrors.default_disc_price}
                />
              </div>
              <div className="mt-6">
                <Button fullWidth onClick={handleStep1Next}>
                  {t('common.next')}
                </Button>
              </div>
            </>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {t('onboarding.step2_title')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                You can add more machines later from the Machines page.
              </p>
              <Input
                label={t('onboarding.machine_name')}
                type="text"
                placeholder={t('onboarding.machine_placeholder')}
                value={machineName}
                onChange={(e) => {
                  setMachineName(e.target.value)
                  setMachineError('')
                }}
                error={machineError}
              />
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  {t('common.back')}
                </Button>
                <Button fullWidth loading={loading} onClick={handleStep2Next}>
                  {t('common.next')}
                </Button>
              </div>
            </>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {t('onboarding.complete_title')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                {t('onboarding.complete_message')}
              </p>
              <Button fullWidth loading={loading} onClick={handleComplete}>
                Start Using EVDS Diamond
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
