import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import AppLayout from '../../layouts/AppLayout'
import Button from '../../components/Button'
import LoadingSpinner from '../../components/LoadingSpinner'
import WearGauge from '../../components/WearGauge'
import { getAllActivations, Activation } from '../../api/activations.api'
import { getUsageLogs } from '../../api/usage-logs.api'

type Tab = 'ACTIVE' | 'EXPIRED' | 'ALL'

const ACTIVE_STATUSES = new Set(['ACTIVE', 'ACTIVE_W2'])

const MATERIAL_LABELS: Record<string, string> = {
  granite: 'Granite',
  compact_quartz: 'Compact Quartz',
  porcelain: 'Porcelain',
  quartzite: 'Quartzite',
}

function borderColor(wearPct: number | null | undefined, status: string): string {
  if (!ACTIVE_STATUSES.has(status)) return 'border-l-gray-400 dark:border-l-gray-600'
  const p = wearPct ?? 0
  if (p >= 80) return 'border-l-red-500'
  if (p >= 50) return 'border-l-orange-500'
  return 'border-l-green-500'
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const isActive = ACTIVE_STATUSES.has(status)
  return (
    <span
      className={[
        'text-xs px-2 py-0.5 rounded-full font-medium',
        isActive
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      ].join(' ')}
    >
      {isActive ? t('discs.active') : t('discs.expired')}
    </span>
  )
}

function DiscHistoryRows({ activationId }: { activationId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['usage-logs', activationId],
    queryFn: () => getUsageLogs(activationId),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <LoadingSpinner size="sm" className="text-blue-600" />
      </div>
    )
  }
  if (logs.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">No usage logged yet</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-gray-600 dark:text-gray-400">
        <thead>
          <tr className="text-gray-400 dark:text-gray-500">
            <th className="text-left py-1 pr-3 font-medium">Date</th>
            <th className="text-right py-1 px-2 font-medium">Meters</th>
            <th className="text-right py-1 px-2 font-medium">Ø mm</th>
            <th className="text-right py-1 pl-2 font-medium">RPM</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {logs.slice(0, 10).map((log) => (
            <tr key={log.id}>
              <td className="py-1.5 pr-3">{new Date(log.logged_at).toLocaleDateString()}</td>
              <td className="py-1.5 px-2 text-right">{log.meters_cut}m</td>
              <td className="py-1.5 px-2 text-right">{log.current_diameter}mm</td>
              <td className="py-1.5 pl-2 text-right">{log.rpm_used ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DiscCard({ activation }: { activation: Activation }) {
  const { t } = useTranslation()
  const [showHistory, setShowHistory] = useState(false)

  const isActive = ACTIVE_STATUSES.has(activation.status)
  const wearPct = activation.wear_pct
  const hasWearRef = !!(activation.wear_reference?.measured_new && activation.wear_reference?.measured_worn)
  const currentDia = activation.current_diameter ?? activation.diameter_at_activation
  const mmRemaining = hasWearRef
    ? currentDia - activation.wear_reference!.measured_worn
    : null

  const expiresAt = new Date(activation.expires_at)
  const now = Date.now()
  const hoursLeft = (expiresAt.getTime() - now) / 3_600_000
  const expiresVerySoon = isActive && hoursLeft <= 24 && hoursLeft > 0

  const materialLabel =
    MATERIAL_LABELS[activation.material_group ?? ''] ?? activation.material_group ?? '—'

  return (
    <div
      className={[
        'bg-white dark:bg-gray-900 rounded-2xl shadow p-5 border-l-4 flex flex-col gap-3',
        borderColor(wearPct, activation.status),
      ].join(' ')}
    >
      {/* Window 2 banner */}
      {activation.activation_window === 2 && isActive && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400">
          ⚠️ {t('activation.window_2_notice')}
        </div>
      )}

      {/* Family + status */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900 dark:text-white leading-tight">
            {activation.label?.family?.name} — {activation.label?.nominal_diameter}mm
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
            {activation.label?.unique_code}
          </p>
        </div>
        <StatusBadge status={activation.status} />
      </div>

      {/* Lot & Full Code */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
        <div className="flex gap-3">
          <span>
            <span className="font-medium text-gray-600 dark:text-gray-300">{t('discs.lot')}:</span>{' '}
            {activation.label?.lot_number}
          </span>
          <span>
            <span className="font-medium text-gray-600 dark:text-gray-300">{t('discs.code')}:</span>{' '}
            <span className="font-mono">{activation.label?.unique_code}</span>
          </span>
        </div>
        <p className="font-mono text-[10px] text-gray-400 dark:text-gray-600 truncate">
          {activation.label?.full_code}
        </p>
      </div>

      {/* Machine */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <span>🏭</span>
        <span>{activation.machine?.name ?? '—'}</span>
      </div>

      {/* Material & Thickness */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {materialLabel} · {activation.thickness_cm}cm
      </div>

      {/* Wear gauge */}
      <div className="flex flex-col items-center py-1">
        {hasWearRef ? (
          <>
            <WearGauge
              currentDiameter={currentDia}
              newDiameter={activation.wear_reference!.measured_new}
              wornDiameter={activation.wear_reference!.measured_worn}
              size="md"
            />
            {mmRemaining !== null && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {mmRemaining.toFixed(1)}mm {t('discs.wear_gauge')}
              </p>
            )}
          </>
        ) : wearPct !== null && wearPct !== undefined ? (
          <div className="text-center">
            <p
              className="text-2xl font-bold"
              style={{ color: (wearPct >= 80) ? '#ef4444' : (wearPct >= 50) ? '#f97316' : '#22c55e' }}
            >
              {Math.round(wearPct)}%
            </p>
            <p className="text-xs text-gray-400">worn</p>
          </div>
        ) : null}

        {(wearPct ?? 0) >= 95 && isActive && (
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1">
            ⛔ {t('discs.wear_past')}
          </p>
        )}
        {(wearPct ?? 0) >= 80 && (wearPct ?? 0) < 95 && isActive && (
          <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mt-1">
            ⚠️ {t('discs.wear_critical')}
          </p>
        )}
      </div>

      {/* Expiry */}
      <div
        className={[
          'text-xs',
          expiresVerySoon
            ? 'text-amber-600 dark:text-amber-400 font-medium'
            : 'text-gray-400 dark:text-gray-500',
        ].join(' ')}
      >
        {isActive ? (
          <>{expiresVerySoon ? '⚠️ ' : ''}Expires: {expiresAt.toLocaleString()}</>
        ) : (
          <>Expired: {expiresAt.toLocaleDateString()}</>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
        {isActive && (
          <>
            <Link to={`/usage?activation_id=${activation.id}`} className="flex-1">
              <Button size="sm" fullWidth>
                {t('discs.log_usage')}
              </Button>
            </Link>
            <Link to={`/sat?activation_id=${activation.id}`} className="flex-1">
              <Button size="sm" variant="secondary" fullWidth>
                ⚠️ Issue
              </Button>
            </Link>
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? '▲' : '▼'} {t('discs.view_history')}
        </Button>
      </div>

      {/* Inline history */}
      {showHistory && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
          <DiscHistoryRows activationId={activation.id} />
        </div>
      )}
    </div>
  )
}

export default function MyDiscsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('ACTIVE')

  const { data: activations = [], isLoading } = useQuery({
    queryKey: ['activations', 'all'],
    queryFn: getAllActivations,
  })

  const filtered = activations.filter((a) => {
    if (tab === 'ACTIVE') return ACTIVE_STATUSES.has(a.status)
    if (tab === 'EXPIRED') return !ACTIVE_STATUSES.has(a.status)
    return true
  })

  const activeCount = activations.filter((a) => ACTIVE_STATUSES.has(a.status)).length

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ACTIVE', label: t('discs.active') },
    { key: 'EXPIRED', label: t('discs.expired') },
    { key: 'ALL', label: 'All' },
  ]

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('discs.title')}
          </h1>
          <Link to="/activate">
            <Button size="sm">{t('activation.title')}</Button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                tab === key
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" className="text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4">💿</div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {tab === 'ACTIVE' ? t('discs.no_discs') : 'No discs in this category'}
            </h2>
            {tab === 'ACTIVE' && (
              <>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {t('discs.activate_first')}
                </p>
                <Link to="/activate">
                  <Button>{t('discs.activate_cta')}</Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filtered.length} disc{filtered.length !== 1 ? 's' : ''}
              {tab === 'ACTIVE' && activeCount > 0 && ` · ${activeCount} active`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((a) => (
                <DiscCard key={a.id} activation={a} />
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
