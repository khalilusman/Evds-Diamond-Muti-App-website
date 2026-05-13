import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  getAnalyticsSummary,
  getWeekly,
  getMaterials,
  getGeography,
  getWearAlerts,
  getPerformance,
} from '../../api/analytics.api'

const MATERIAL_COLORS: Record<string, string> = {
  granite:        '#6366f1',
  quartzite:      '#8b5cf6',
  porcelain:      '#06b6d4',
  compact_quartz: '#10b981',
}
const FALLBACK_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

const WEEK_OPTIONS = [7, 12, 26, 52] as const
type WeekOption = typeof WEEK_OPTIONS[number]

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  )
}

function KpiPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-center">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

const gridStroke = 'var(--grid-stroke)'

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const [weeks, setWeeks] = useState<WeekOption>(12)

  const summaryQ = useQuery({ queryKey: ['analytics-summary'], queryFn: getAnalyticsSummary, staleTime: 30_000 })
  const weeklyQ  = useQuery({ queryKey: ['analytics-weekly', weeks], queryFn: () => getWeekly(weeks), staleTime: 60_000 })
  const matQ     = useQuery({ queryKey: ['analytics-materials'], queryFn: getMaterials, staleTime: 60_000 })
  const geoQ     = useQuery({ queryKey: ['analytics-geography'], queryFn: getGeography, staleTime: 60_000 })
  const wearQ    = useQuery({ queryKey: ['analytics-wear-alerts'], queryFn: getWearAlerts, staleTime: 60_000 })
  const perfQ    = useQuery({ queryKey: ['analytics-performance'], queryFn: getPerformance, staleTime: 60_000 })

  const s = summaryQ.data
  const weekly = weeklyQ.data ?? []
  const materials = matQ.data ?? []
  const geography = geoQ.data ?? []
  const wearAlerts = wearQ.data ?? []
  const perf = perfQ.data

  const weeklyChartData = weekly.map((w, i) => ({
    name: `W${i + 1}`,
    activations: w.new_activations,
    companies: w.new_companies,
  }))

  const lineChartData = weekly.map((w, i) => ({
    name: `W${i + 1}`,
    logs: w.usage_logs_count,
  }))

  const totalGeo = geography.reduce((sum, g) => sum + g.company_count, 0)

  const isAnyLoading = summaryQ.isLoading || weeklyQ.isLoading || matQ.isLoading

  return (
    <DashboardLayout title={t('analytics.title')}>
      <style>{`:root { --grid-stroke: #e5e7eb } .dark { --grid-stroke: #374151 }`}</style>

      {isAnyLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" className="text-blue-500" /></div>
      ) : (
        <div className="space-y-6">

          {/* KPI row */}
          {s && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiPill label={t('analytics.kpi_active_companies')} value={s.active_companies} />
              <KpiPill label={t('analytics.kpi_discs_in_field')} value={s.discs_in_field} />
              <KpiPill label={t('analytics.kpi_open_sat')} value={s.open_sat_tickets} />
              <KpiPill label={t('analytics.kpi_wear_alerts')} value={s.wear_alerts} />
              <KpiPill label={t('analytics.kpi_labels_generated')} value={s.labels_generated} />
              <KpiPill label={t('analytics.kpi_activation_rate')} value={`${s.activation_rate_pct}%`} />
            </div>
          )}

          {/* Week range selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('analytics.range')}:</span>
            {WEEK_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeeks(w)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  weeks === w
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                ].join(' ')}
              >
                {w} {t('analytics.weeks_abbr')}
              </button>
            ))}
          </div>

          {/* Chart row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title={t('analytics.weekly_activations')}>
              {weeklyQ.isLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="md" className="text-blue-500" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weeklyChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="activations" name={t('analytics.series_activations')} fill="#2563EB" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard title={t('analytics.material_distribution')}>
              {matQ.isLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="md" className="text-blue-500" /></div>
              ) : materials.length === 0 ? (
                <p className="text-sm text-center text-gray-400 py-12">{t('analytics.no_data')}</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="60%" height={200}>
                    <PieChart>
                      <Pie data={materials} dataKey="count" nameKey="material_type" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                        {materials.map((entry, i) => (
                          <Cell key={entry.material_type} fill={MATERIAL_COLORS[entry.material_type] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, n: string) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {materials.map((m, i) => (
                      <div key={m.material_type} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: MATERIAL_COLORS[m.material_type] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length] }}
                        />
                        <span className="text-gray-700 dark:text-gray-300 capitalize">{m.material_type.replace('_', ' ')}</span>
                        <span className="ml-auto text-gray-500 dark:text-gray-400 font-medium">{m.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Chart row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title={t('analytics.usage_activity_trend')}>
              {weeklyQ.isLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="md" className="text-blue-500" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={lineChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="logs" name={t('analytics.series_usage_logs')} stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard title={t('analytics.most_common_issues')}>
              {perfQ.isLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="md" className="text-blue-500" /></div>
              ) : !perf || perf.top_symptoms.length === 0 ? (
                <p className="text-sm text-center text-gray-400 py-12">{t('analytics.no_sat_data')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={perf.top_symptoms}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 80, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="symptom_code" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" name={t('analytics.series_tickets')} fill="#2563EB" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>

          {/* Geography table */}
          <SectionCard title={t('analytics.companies_by_country')}>
            {geoQ.isLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner size="md" className="text-blue-500" /></div>
            ) : geography.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t('analytics.no_data')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <tr>
                    <th className="text-left py-2">{t('analytics.col_country')}</th>
                    <th className="text-right py-2">{t('analytics.col_companies')}</th>
                    <th className="text-right py-2">{t('analytics.col_pct_total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {geography.map((g) => (
                    <tr key={g.country}>
                      <td className="py-2 font-medium text-gray-800 dark:text-gray-200">{g.country ?? '—'}</td>
                      <td className="py-2 text-right text-gray-600 dark:text-gray-400">{g.company_count}</td>
                      <td className="py-2 text-right text-gray-500 dark:text-gray-500">
                        {totalGeo > 0 ? Math.round((g.company_count / totalGeo) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          {/* Wear alerts */}
          <SectionCard title={t('analytics.discs_end_of_life')}>
            {wearQ.isLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner size="md" className="text-blue-500" /></div>
            ) : wearAlerts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t('analytics.no_wear_alerts')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="text-left py-2">{t('analytics.col_company')}</th>
                      <th className="text-left py-2">{t('analytics.col_machine')}</th>
                      <th className="text-left py-2">{t('analytics.col_disc')}</th>
                      <th className="text-right py-2">{t('analytics.col_wear_pct')}</th>
                      <th className="text-right py-2">{t('analytics.col_expires')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {wearAlerts.map((a) => (
                      <tr
                        key={a.activation_id}
                        className={a.level === 'critical' ? 'bg-red-50 dark:bg-red-900/10' : ''}
                      >
                        <td className="py-2 font-medium text-gray-800 dark:text-gray-200">{a.company.name}</td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">{a.machine_name ?? '—'}</td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">{a.family} {a.nominal_diameter}mm</td>
                        <td className={`py-2 text-right font-semibold ${a.level === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {a.wear_pct}%
                        </td>
                        <td className="py-2 text-right text-xs text-gray-500 dark:text-gray-400">
                          {new Date(a.expires_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

        </div>
      )}
    </DashboardLayout>
  )
}
