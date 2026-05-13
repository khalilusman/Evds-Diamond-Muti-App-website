import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import AppLayout from '../../layouts/AppLayout'
import LoadingSpinner from '../../components/LoadingSpinner'
import { getUsageStats, StatsByMachineMaterial } from '../../api/stats.api'

const LINE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']
const PIE_COLORS  = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

type Range = '7d' | '30d' | '90d' | 'all'

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function SummaryCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5 flex items-start gap-4 border border-gray-100 dark:border-gray-800">
      <span className="text-3xl">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5 truncate">{value}</p>
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow border border-gray-100 dark:border-gray-800 p-5">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
        {title}
      </h2>
      {children}
    </div>
  )
}

function MachineRow({ machine, expanded, onToggle }: {
  machine: { machine_name: string; total_meters: number; sessions: number; most_used_material: string | null; last_activity: string | null; by_material: StatsByMachineMaterial[] }
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className="border-t border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="text-gray-400 text-xs">{expanded ? '▾' : '▸'}</span>
          {machine.machine_name}
        </td>
        <td className="px-4 py-3 text-sm text-right font-mono text-gray-900 dark:text-white">
          {fmt(machine.total_meters)} m
        </td>
        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
          {machine.sessions}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {machine.most_used_material ?? '—'}
        </td>
        <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
          {machine.last_activity ? new Date(machine.last_activity).toLocaleDateString() : '—'}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-800/40">
          <td colSpan={5} className="px-6 py-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  <th className="text-left pb-1 font-medium">Material</th>
                  <th className="text-right pb-1 font-medium">Meters</th>
                  <th className="text-right pb-1 font-medium">Sessions</th>
                  <th className="text-right pb-1 font-medium">Avg RPM</th>
                  <th className="text-right pb-1 font-medium">Avg Feed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {machine.by_material.map((m) => (
                  <tr key={m.material_type}>
                    <td className="py-1.5 text-gray-700 dark:text-gray-300">{m.material_type}</td>
                    <td className="py-1.5 text-right font-mono text-gray-900 dark:text-white">{fmt(m.meters)} m</td>
                    <td className="py-1.5 text-right text-gray-600 dark:text-gray-400">{m.sessions}</td>
                    <td className="py-1.5 text-right text-gray-500 dark:text-gray-400">{m.avg_rpm ?? '—'}</td>
                    <td className="py-1.5 text-right text-gray-500 dark:text-gray-400">{m.avg_feed ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}

export default function StatsPage() {
  const [range, setRange] = useState<Range>('all')
  const [expandedMachine, setExpandedMachine] = useState<string | null>(null)

  const queryParams = useMemo(() => {
    if (range === 'all') return {}
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    return { date_from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() }
  }, [range])

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['usage-stats', range],
    queryFn: () => getUsageStats(queryParams),
  })

  // Transform by_machine_date into recharts-friendly [{ date, MachineName: meters }]
  const { lineChartData, machineNames } = useMemo(() => {
    if (!stats) return { lineChartData: [], machineNames: [] }
    const names = [...new Set(stats.by_machine_date.map((e) => e.machine_name))]
    const dateMap = new Map<string, Record<string, string | number>>()
    for (const entry of stats.by_machine_date) {
      if (!dateMap.has(entry.date)) dateMap.set(entry.date, { date: entry.date })
      const day = dateMap.get(entry.date)!
      day[entry.machine_name] = ((day[entry.machine_name] as number) || 0) + entry.meters
    }
    const data = Array.from(dateMap.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    )
    return { lineChartData: data, machineNames: names }
  }, [stats])

  const pieData = useMemo(() =>
    (stats?.by_material ?? []).map((m) => ({
      name: m.material_type,
      value: m.total_meters,
    })),
    [stats]
  )

  const RANGE_LABELS: { key: Range; label: string }[] = [
    { key: '7d',  label: '7 days'  },
    { key: '30d', label: '30 days' },
    { key: '90d', label: '90 days' },
    { key: 'all', label: 'All time' },
  ]

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" className="text-blue-600" />
        </div>
      </AppLayout>
    )
  }

  if (isError || !stats) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center py-20 gap-3">
          <span className="text-4xl">⚠️</span>
          <p className="text-red-500 dark:text-red-400 font-medium">Failed to load stats.</p>
        </div>
      </AppLayout>
    )
  }

  const mostUsedMaterial = stats.by_material[0]?.material_type ?? '—'

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header + date filter */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cutting History</h1>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            {RANGE_LABELS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  range === key
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon="📏" label="Total Meters Cut" value={`${fmt(stats.total_meters)} m`} />
          <SummaryCard icon="📋" label="Total Sessions"   value={String(stats.total_sessions)} />
          <SummaryCard icon="💿" label="Active Discs"     value={String(stats.active_discs)} />
          <SummaryCard icon="🪨" label="Top Material"     value={mostUsedMaterial} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Line chart — meters over time */}
          <SectionCard title="Meters Cut Over Time">
            {lineChartData.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={lineChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 10 }} unit=" m" width={50} />
                  <Tooltip
                    formatter={(val) => val != null ? [`${fmt(Number(val))} m`] : ['']}
                    labelFormatter={(d) => new Date(d).toLocaleDateString()}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {machineNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          {/* Donut chart — material breakdown */}
          <SectionCard title="Material Breakdown">
            {pieData.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => val != null ? [`${fmt(Number(val))} m`] : ['']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>

        {/* By Machine table */}
        <SectionCard title="By Machine">
          {stats.by_machine.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No machine data</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Machine</th>
                    <th className="text-right px-4 py-3 font-medium">Total Meters</th>
                    <th className="text-right px-4 py-3 font-medium">Sessions</th>
                    <th className="text-left px-4 py-3 font-medium">Top Material</th>
                    <th className="text-left px-4 py-3 font-medium">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_machine.map((m) => (
                    <MachineRow
                      key={m.machine_id}
                      machine={m}
                      expanded={expandedMachine === m.machine_id}
                      onToggle={() =>
                        setExpandedMachine(expandedMachine === m.machine_id ? null : m.machine_id)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* By Material table */}
        <SectionCard title="By Material">
          {stats.by_material.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No material data</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Material</th>
                    <th className="text-right px-4 py-3 font-medium">Total Meters</th>
                    <th className="text-right px-4 py-3 font-medium">Sessions</th>
                    <th className="text-right px-4 py-3 font-medium">Avg RPM</th>
                    <th className="text-right px-4 py-3 font-medium">Avg Feed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {stats.by_material.map((m) => (
                    <tr key={m.material_type} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{m.material_type}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">{fmt(m.total_meters)} m</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{m.sessions}</td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{m.avg_rpm ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{m.avg_feed ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

      </div>
    </AppLayout>
  )
}
