import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: summary, isLoading } = useQuery({
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

  const s = summary!

  const kpis: KpiCardProps[] = [
    { icon: '🏢', label: 'Active Companies',  value: s.active_companies,              borderColor: 'border-green-500',  onClick: () => navigate('/companies?status=ACTIVE') },
    { icon: '⏳', label: 'Pending Approval',  value: s.pending_companies,             borderColor: 'border-amber-500',  onClick: () => navigate('/companies?status=PENDING') },
    { icon: '💿', label: 'Discs In Field',    value: s.discs_in_field,                borderColor: 'border-blue-500',   onClick: () => navigate('/discs') },
    { icon: '🔧', label: 'Open SAT Tickets', value: s.open_sat_tickets,              borderColor: 'border-red-500',    onClick: () => navigate('/sat?status=OPEN') },
    { icon: '⚠️', label: 'Wear Alerts',       value: s.wear_alerts,                  borderColor: 'border-orange-500', onClick: () => navigate('/discs?wear=critical') },
    { icon: '📅', label: 'New This Week',     value: s.new_this_week,                borderColor: 'border-purple-500', onClick: () => navigate('/companies?filter=new') },
    { icon: '🏷️', label: 'Labels Generated', value: s.labels_generated,             borderColor: 'border-cyan-500'  },
    { icon: '📈', label: 'Activation Rate',   value: `${s.activation_rate_pct ?? 0}%`, borderColor: 'border-teal-500' },
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
                {s.pending_companies} {s.pending_companies === 1 ? 'company' : 'companies'} awaiting approval
              </p>
            </div>
            <Button
              variant="warning"
              size="sm"
              onClick={() => navigate('/companies?status=PENDING')}
            >
              Review Now
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
              Next Pending Company
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
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/companies/${s.first_pending_company!.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">No pending companies</p>
            )}
          </div>

          {/* Oldest open SAT ticket */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Oldest Open SAT Ticket
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
                  View Ticket
                </Button>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">No open tickets</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
