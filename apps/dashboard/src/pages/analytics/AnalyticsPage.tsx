import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import DashboardLayout from '../../layouts/DashboardLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import Button from '../../components/Button'
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

const WEEK_LABELS: Record<WeekOption, string> = {
  7: '7 wks',
  12: '12 wks',
  26: '26 wks',
  52: '52 wks',
}

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

  const totalGeo = geography.reduce((s, g) => s + g.company_count, 0)

  const isAnyLoading = summaryQ.isLoading || weeklyQ.isLoading || matQ.isLoading

  return (
    <DashboardLayout title="Analytics">
      <style>{`:root { --grid-stroke: #e5e7eb } .dark { --grid-stroke: #374151 }`}</style>

      {isAnyLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" className="text-blue-500" /></div>
      ) : (
        <div className="space-y-6">

          {/* KPI row */}
          {s && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiPill label="Active Companies" value={s.active_companies} />
              <KpiPill label="Discs In Field" value={s.discs_in_field} />
              <KpiPill label="Open SAT" value={s.open_sat_tickets} />
              <KpiPill label="Wear Alerts" value={s.wear_alerts} />
              <KpiPill label="Labels Generated" value={s.labels_generated} />
              <KpiPill label="Activation Rate" value={`${s.activation_rate_pct}%`} />
            </div>
          )}

          {/* Week range selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Range:</span>
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
                {WEEK_LABELS[w]}
              </button>
            ))}
          </div>

          {/* Chart row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Activations bar chart */}
            <SectionCard title="Weekly Activations">
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
                    <Bar dataKey="activations" name="Activations" fill="#2563EB" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            {/* Material distribution pie */}
            <SectionCard title="Material Distribution">
              {matQ.isLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="md" className="text-blue-500" /></div>
              ) : materials.length === 0 ? (
                <p className="text-sm text-center text-gray-400 py-12">No data available</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="60%" height={200}>
                    <PieChart>
                      <Pie data={materials} dataKey="count" nameKey="material_group" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                        {materials.map((entry, i) => (
                          <Cell key={entry.material_group} fill={MATERIAL_COLORS[entry.material_group] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, n: string) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {materials.map((m, i) => (
                      <div key={m.material_group} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: MATERIAL_COLORS[m.material_group] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length] }}
                        />
                        <span className="text-gray-700 dark:text-gray-300 capitalize">{m.material_group.replace('_', ' ')}</span>
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
            {/* Usage logs trend line chart */}
            <SectionCard title="Usage Activity Trend">
              {weeklyQ.isLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="md" className="text-blue-500" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={lineChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="logs" name="Usage Logs" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            {/* Most common issues */}
            <SectionCard title="Most Common Issues">
              {perfQ.isLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="md" className="text-blue-500" /></div>
              ) : !perf || perf.top_symptoms.length === 0 ? (
                <p className="text-sm text-center text-gray-400 py-12">No SAT data available</p>
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
                    <Bar dataKey="count" name="Tickets" fill="#2563EB" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>

          {/* Geography table */}
          <SectionCard title="Companies by Country">
            {geoQ.isLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner size="md" className="text-blue-500" /></div>
            ) : geography.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No data available</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <tr>
                    <th className="text-left py-2">Country</th>
                    <th className="text-right py-2">Companies</th>
                    <th className="text-right py-2">% of Total</th>
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
          <SectionCard title="Discs Approaching End of Life">
            {wearQ.isLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner size="md" className="text-blue-500" /></div>
            ) : wearAlerts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No wear alerts — all discs within safe range</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="text-left py-2">Company</th>
                      <th className="text-left py-2">Machine</th>
                      <th className="text-left py-2">Disc</th>
                      <th className="text-right py-2">Wear %</th>
                      <th className="text-right py-2">Expires</th>
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
