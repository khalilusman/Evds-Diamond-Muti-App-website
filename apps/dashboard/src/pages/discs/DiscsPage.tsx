import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../../layouts/DashboardLayout'
import Input from '../../components/Input'
import WearBadge from '../../components/WearBadge'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { getAllActivations, AdminActivation } from '../../api/activations.api'

type WearFilter = 'All' | 'OK' | 'Warning' | 'Critical' | 'Expired'

const WEAR_TABS: WearFilter[] = ['All', 'OK', 'Warning', 'Critical', 'Expired']

const EXPIRED_STATUSES = new Set(['EXPIRED_W1', 'PERMANENTLY_DEACTIVATED', 'REPLACED'])

function wearCategory(pct: number | null | undefined, status: string): WearFilter {
  if (EXPIRED_STATUSES.has(status)) return 'Expired'
  if (pct == null) return 'OK'
  if (pct > 80) return 'Critical'
  if (pct >= 50) return 'Warning'
  return 'OK'
}

function isExpiringSoon(expiresAt: string): boolean {
  const diff = new Date(expiresAt).getTime() - Date.now()
  return diff > 0 && diff < 24 * 60 * 60 * 1000
}

export default function DiscsPage() {
  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')
  const [wearFilter, setWearFilter] = useState<WearFilter>('All')
  const [expiringSoon, setExpiringSoon] = useState(false)

  const { data: activations = [], isLoading } = useQuery({
    queryKey: ['all-activations'],
    queryFn: getAllActivations,
    staleTime: 60_000,
  })

  // Derive filter options
  const families = useMemo(() => {
    const names = new Set(activations.map((a) => a.label?.family?.name).filter(Boolean))
    return Array.from(names).sort() as string[]
  }, [activations])

  const materials = useMemo(() => {
    const mats = new Set(activations.map((a) => a.material_group).filter(Boolean))
    return Array.from(mats).sort() as string[]
  }, [activations])

  const filtered = useMemo(() => {
    let list = [...activations]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (a) =>
          a.company?.name?.toLowerCase().includes(q) ||
          a.label?.full_code?.toLowerCase().includes(q) ||
          a.label?.unique_code?.toLowerCase().includes(q),
      )
    }

    if (familyFilter) {
      list = list.filter((a) => a.label?.family?.name === familyFilter)
    }

    if (materialFilter) {
      list = list.filter((a) => a.material_group === materialFilter)
    }

    if (wearFilter !== 'All') {
      list = list.filter((a) => wearCategory(a.wear_pct, a.status) === wearFilter)
    }

    if (expiringSoon) {
      list = list.filter((a) => isExpiringSoon(a.expires_at))
    }

    // Sort: soonest expiring first
    list.sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())

    return list
  }, [activations, search, familyFilter, materialFilter, wearFilter, expiringSoon])

  function rowStyle(a: AdminActivation): string {
    const cat = wearCategory(a.wear_pct, a.status)
    if (cat === 'Critical') return 'border-l-4 border-red-500'
    if (cat === 'Warning')  return 'border-l-4 border-orange-500'
    if (isExpiringSoon(a.expires_at)) return 'bg-amber-50 dark:bg-amber-900/10'
    if (cat === 'Expired')  return 'opacity-50'
    return ''
  }

  return (
    <DashboardLayout title="Disc Monitoring">
      <div className="space-y-5">
        {/* Filter bar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search company or disc code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {families.length > 0 && (
              <select
                title="Filter by family"
                value={familyFilter}
                onChange={(e) => setFamilyFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-full sm:w-44"
              >
                <option value="">All Families</option>
                {families.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            )}

            {materials.length > 0 && (
              <select
                title="Filter by material"
                value={materialFilter}
                onChange={(e) => setMaterialFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-full sm:w-44"
              >
                <option value="">All Materials</option>
                {materials.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>

          {/* Wear filter tabs */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1">
              {WEAR_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setWearFilter(t)}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    wearFilter === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={expiringSoon}
                onChange={(e) => setExpiringSoon(e.target.checked)}
                className="rounded"
              />
              Expiring in 24h
            </label>

            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
              {filtered.length} disc{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" className="text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
              No discs match the current filters
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3">Company</th>
                      <th className="text-left px-5 py-3">Machine</th>
                      <th className="text-left px-5 py-3">Disc Code</th>
                      <th className="text-left px-5 py-3">Family / Ø</th>
                      <th className="text-left px-5 py-3">Material</th>
                      <th className="text-left px-5 py-3">Wear</th>
                      <th className="text-left px-5 py-3">Activated</th>
                      <th className="text-left px-5 py-3">Expires</th>
                      <th className="text-left px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((a) => (
                      <tr key={a.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${rowStyle(a)}`}>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{a.company?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{a.machine?.name ?? '—'}</td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{a.label?.full_code}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                          {a.label?.family?.name} {a.label?.nominal_diameter}mm
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{a.material_group ?? '—'}</td>
                        <td className="px-5 py-3">
                          <WearBadge pct={a.wear_pct} expired={EXPIRED_STATUSES.has(a.status)} />
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {new Date(a.activated_at).toLocaleDateString()}
                        </td>
                        <td className={[
                          'px-5 py-3 text-xs',
                          isExpiringSoon(a.expires_at)
                            ? 'text-amber-600 dark:text-amber-400 font-medium'
                            : 'text-gray-500 dark:text-gray-400',
                        ].join(' ')}>
                          {new Date(a.expires_at).toLocaleDateString()}
                          {isExpiringSoon(a.expires_at) && ' ⚠️'}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((a) => (
                  <div key={a.id} className={`p-4 space-y-2 ${rowStyle(a)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{a.company?.name}</p>
                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{a.label?.full_code}</p>
                      </div>
                      <WearBadge pct={a.wear_pct} expired={EXPIRED_STATUSES.has(a.status)} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {a.label?.family?.name} {a.label?.nominal_diameter}mm · {a.machine?.name ?? '—'} · Expires {new Date(a.expires_at).toLocaleDateString()}
                      {isExpiringSoon(a.expires_at) && ' ⚠️'}
                    </p>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
