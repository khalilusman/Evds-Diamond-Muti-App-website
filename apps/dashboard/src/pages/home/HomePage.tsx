import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import DashboardLayout from '../../layouts/DashboardLayout'
import Button from '../../components/Button'
import LoadingSpinner from '../../components/LoadingSpinner'
import { getAnalyticsSummary } from '../../api/analytics.api'
import { updateCompanyStatus } from '../../api/companies.api'

interface KpiCardProps {
  icon: string
  label: string
  value: number | string
  borderColor: string
  onClick?: () => void
}

function KpiCard({ icon, label, value, borderColor, onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        'bg-white dark:bg-gray-900 rounded-2xl shadow p-5 border-l-4',
        borderColor,
        onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 mb-1">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
    </div>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: summary, isLoading, isError, error } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: getAnalyticsSummary,
    staleTime: 30_000,
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => updateCompanyStatus(id, 'ACTIVE'),
    onSuccess: () => {
      toast.success('Company approved')
      qc.invalidateQueries({ queryKey: ['analytics-summary'] })
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: () => toast.error('Failed to approve company'),
  })

  if (isLoading) {
    return (
      <DashboardLayout title="Home">
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" className="text-blue-500" />
        </div>
      </DashboardLayout>
    )
  }

  if (isError) {
    return (
      <DashboardLayout title="Home">
        <div className="flex flex-col items-center py-20 gap-3">
          <span className="text-4xl">⚠️</span>
          <p className="text-red-600 dark:text-red-400 font-medium">
            {(error as Error)?.message ?? t('errors.generic')}
          </p>
        </div>
      </DashboardLayout>
    )
  }

  const s = {
    active_companies:      summary?.active_companies      ?? 0,
    pending_companies:     summary?.pending_companies     ?? 0,
    discs_in_field:        summary?.discs_in_field        ?? 0,
    open_sat_tickets:      summary?.open_sat_tickets      ?? 0,
    wear_alerts:           summary?.wear_alerts           ?? 0,
    new_this_week:         summary?.new_this_week         ?? 0,
    labels_generated:      summary?.labels_generated      ?? 0,
    activation_rate_pct:   summary?.activation_rate_pct  ?? 0,
    first_pending_company: summary?.first_pending_company ?? null,
    oldest_open_ticket:    summary?.oldest_open_ticket    ?? null,
  }

  const kpis: KpiCardProps[] = [
    { icon: '🏢', label: t('dashboard.kpi_active_companies'),  value: s.active_companies,              borderColor: 'border-green-500',  onClick: () => navigate('/companies?status=ACTIVE') },
    { icon: '⏳', label: t('dashboard.kpi_pending_approval'),  value: s.pending_companies,             borderColor: 'border-amber-500',  onClick: () => navigate('/companies?status=PENDING') },
    { icon: '💿', label: t('dashboard.kpi_discs_in_field'),    value: s.discs_in_field,                borderColor: 'border-blue-500',   onClick: () => navigate('/discs') },
    { icon: '🔧', label: t('dashboard.kpi_open_sat'),          value: s.open_sat_tickets,              borderColor: 'border-red-500',    onClick: () => navigate('/sat?status=OPEN') },
    { icon: '⚠️', label: t('dashboard.kpi_wear_alerts'),       value: s.wear_alerts,                  borderColor: 'border-orange-500', onClick: () => navigate('/discs?wear=critical') },
    { icon: '📅', label: t('dashboard.kpi_new_this_week'),     value: s.new_this_week,                borderColor: 'border-purple-500', onClick: () => navigate('/companies?filter=new') },
    { icon: '🏷️', label: t('dashboard.kpi_labels_generated'), value: s.labels_generated,             borderColor: 'border-cyan-500'  },
    { icon: '📈', label: t('dashboard.kpi_activation_rate'),   value: `${s.activation_rate_pct ?? 0}%`, borderColor: 'border-teal-500' },
  ]

  return (
    <DashboardLayout title="Home">
      <div className="space-y-6">

        {/* Pending alert banner */}
        {s.pending_companies > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {t('dashboard.pending_banner', { count: s.pending_companies })}
              </p>
            </div>
            <Button
              variant="warning"
              size="sm"
              onClick={() => navigate('/companies?status=PENDING')}
            >
              {t('dashboard.review_now')}
            </Button>
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Approve next pending */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {t('dashboard.next_pending_company')}
            </h2>
            {s.first_pending_company ? (
              <>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {s.first_pending_company.name}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    loading={approveMut.isPending}
                    onClick={() => approveMut.mutate(s.first_pending_company!.id)}
                  >
                    {t('dashboard.approve')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/companies/${s.first_pending_company!.id}`)}
                  >
                    {t('dashboard.view_details')}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('dashboard.no_pending')}</p>
            )}
          </div>

          {/* Oldest open SAT ticket */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {t('dashboard.oldest_open_ticket')}
            </h2>
            {s.oldest_open_ticket ? (
              <>
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">
                    {s.oldest_open_ticket.symptom_code}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {s.oldest_open_ticket.company_name} · {new Date(s.oldest_open_ticket.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/sat')}
                >
                  {t('dashboard.view_ticket')}
                </Button>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('dashboard.no_open_tickets')}</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
