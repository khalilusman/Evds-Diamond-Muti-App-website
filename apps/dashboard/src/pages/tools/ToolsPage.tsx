import toast from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../stores/auth.store'
import {
  getDiscFamilies, createDiscFamily, updateDiscFamily, deleteDiscFamily,
  getCatalog, createCatalogEntry, updateCatalogEntry, deleteCatalogEntry,
  getWearReference, updateWearReference, createWearReference,
  getSatConfig, updateSatRule,
} from '../../api/tools.api'
import type { DiscFamily, CatalogEntry, WearRef, SatDiagnosisRule } from '../../api/tools.api'

type Tab = 'families' | 'catalog' | 'wear' | 'sat'

// ─── Catalog tab form ─────────────────────────────────────────────────────────

interface CatalogForm {
  family_id: string; material_type: string; nominal_diameter: string; rpm: string
  diamond_height: string; thickness_t1: string; feed_t1: string; life_t1: string
  thickness_t2: string; feed_t2: string; life_t2: string; miter_feed: string
}

// ─── Wizard types & constants ─────────────────────────────────────────────────

interface CatalogRowValues {
  rpm: string; feed_t1: string; life_t1: string
  feed_t2: string; life_t2: string
  diamond_height: string; miter_feed: string
  thickness_t1: string; thickness_t2: string
}

interface WearRowValues {
  measured_new: string; measured_worn: string
}

const MATERIAL_LABELS: Record<string, string> = {
  quartzite_es:   'Quartzite (Cuarcita)',
  porcelain:      'Porcelain / Dekton',
  quartzite:      'Quartzite (International)',
  granite:        'Granite',
  compact_quartz: 'Compact Quartz',
}
const ALL_MATERIALS = ['quartzite_es', 'porcelain', 'quartzite', 'granite', 'compact_quartz']
const ALL_DIAMETERS = [350, 400, 450, 500]

const FIXED_SYMPTOMS = [
  { code: 'polishing',      label: 'Polishing / Glazing' },
  { code: 'chipping',       label: 'Chipping / Edge Damage' },
  { code: 'overheating',    label: 'Overheating' },
  { code: 'oval_disc',      label: 'Oval Disc' },
  { code: 'not_cutting',    label: 'Not Cutting' },
  { code: 'undercutting',   label: 'Undercutting' },
  { code: 'excessive_wear', label: 'Excessive Wear' },
]

function defaultCatalogRow(material: string): CatalogRowValues {
  return {
    rpm: '', feed_t1: '', life_t1: '', feed_t2: '', life_t2: '',
    diamond_height: '0', miter_feed: '0',
    thickness_t1: '2.0', thickness_t2: material === 'porcelain' ? '1.2' : '3.0',
  }
}

// ─── Family Wizard ────────────────────────────────────────────────────────────

function FamilyWizard({ editingFamily, onClose, onDone }: {
  editingFamily: DiscFamily | null
  onClose: () => void
  onDone: () => void
}) {
  const [step, setStep] = useState(1)

  // Step 1
  const [name, setName] = useState(editingFamily?.name ?? '')
  const [wearRuleMm, setWearRuleMm] = useState(editingFamily ? String(editingFamily.wear_rule_mm) : '')
  const [description, setDescription] = useState(editingFamily?.description ?? '')
  const [diameters, setDiameters] = useState<number[]>([])

  // Step 2
  const [materials, setMaterials] = useState<string[]>([])

  // Step 3 — keyed by `${diameter}-${material}`
  const [catalogRows, setCatalogRows] = useState<Record<string, CatalogRowValues>>({})

  // Step 4 — keyed by `${diameter}`
  const [wearRows, setWearRows] = useState<Record<string, WearRowValues>>({})

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  // Load existing data for edit mode
  const existingCatalogQ = useQuery({
    queryKey: ['catalog-for-family', editingFamily?.id],
    queryFn: () => getCatalog(editingFamily!.id),
    enabled: !!editingFamily,
  })
  const existingWearQ = useQuery({
    queryKey: ['wear-for-family', editingFamily?.id],
    queryFn: async () => {
      const all = await getWearReference()
      return all.filter(w => w.family_id === editingFamily!.id)
    },
    enabled: !!editingFamily,
  })

  const [initialized, setInitialized] = useState(!editingFamily)

  // Populate form from existing data (edit mode only)
  useEffect(() => {
    if (!editingFamily || initialized) return
    if (existingCatalogQ.isLoading || existingWearQ.isLoading) return

    const catalog = existingCatalogQ.data ?? []
    const wear    = existingWearQ.data    ?? []

    const existingDiameters = [...new Set([
      ...catalog.map(c => c.nominal_diameter),
      ...wear.map(w => w.nominal_diameter),
    ])].sort((a, b) => a - b)
    const existingMaterials = [...new Set(catalog.map(c => c.material_type))]

    const initCatalog: Record<string, CatalogRowValues> = {}
    for (const c of catalog) {
      initCatalog[`${c.nominal_diameter}-${c.material_type}`] = {
        rpm: String(c.rpm), feed_t1: String(c.feed_t1), life_t1: String(c.life_t1),
        feed_t2: String(c.feed_t2), life_t2: String(c.life_t2),
        diamond_height: String(c.diamond_height), miter_feed: String(c.miter_feed),
        thickness_t1: String(c.thickness_t1), thickness_t2: String(c.thickness_t2),
      }
    }
    const initWear: Record<string, WearRowValues> = {}
    for (const w of wear) {
      initWear[String(w.nominal_diameter)] = {
        measured_new: String(w.measured_new),
        measured_worn: String(w.measured_worn),
      }
    }

    setDiameters(existingDiameters)
    setMaterials(existingMaterials)
    setCatalogRows(initCatalog)
    setWearRows(initWear)
    setInitialized(true)
  }, [editingFamily, initialized, existingCatalogQ.isLoading, existingCatalogQ.data, existingWearQ.isLoading, existingWearQ.data])

  function validateStep3(): boolean {
    const required: (keyof CatalogRowValues)[] = ['rpm', 'feed_t1', 'life_t1', 'feed_t2', 'life_t2']
    for (const d of diameters) {
      for (const m of materials) {
        const key = `${d}-${m}`
        const row = catalogRows[key]
        for (const field of required) {
          const val = Number(row?.[field] ?? 0)
          if (!val || val <= 0) return false
        }
      }
    }
    return true
  }

  function handleNext() {
    if (step === 2) {
      advanceToStep3()
    } else if (step === 3) {
      if (diameters.length > 0 && materials.length > 0 && !validateStep3()) {
        setCatalogError('All cutting parameters are required')
        return
      }
      setCatalogError(null)
      advanceToStep4()
    } else {
      setStep(s => s + 1)
    }
  }

  function advanceToStep3() {
    setCatalogError(null)
    setCatalogRows(prev => {
      const next = { ...prev }
      for (const d of diameters) {
        for (const m of materials) {
          const key = `${d}-${m}`
          if (!next[key]) next[key] = defaultCatalogRow(m)
        }
      }
      return next
    })
    setStep(3)
  }

  function advanceToStep4() {
    setWearRows(prev => {
      const next = { ...prev }
      for (const d of diameters) {
        if (!next[String(d)]) next[String(d)] = { measured_new: '', measured_worn: '' }
      }
      return next
    })
    setStep(4)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      if (diameters.length > 0 && materials.length > 0 && !validateStep3()) {
        toast.error('Cutting parameters cannot be empty. Please go back and fill in all values.')
        setSaving(false)
        return
      }
      let familyId: string
      if (editingFamily) {
        await updateDiscFamily(editingFamily.id, {
          name: name.trim(), wear_rule_mm: Number(wearRuleMm),
          description: description.trim() || undefined,
        })
        familyId = editingFamily.id
      } else {
        const created = await createDiscFamily({
          name: name.trim(), wear_rule_mm: Number(wearRuleMm),
          description: description.trim() || undefined,
        })
        familyId = created.id
      }

      const existingCatalog = existingCatalogQ.data ?? []
      const existingWear    = existingWearQ.data    ?? []

      for (const d of diameters) {
        for (const m of materials) {
          const key = `${d}-${m}`
          const row = catalogRows[key]
          if (!row) continue
          const payload = {
            family_id: familyId, material_type: m, nominal_diameter: d,
            rpm: Number(row.rpm), diamond_height: Number(row.diamond_height),
            thickness_t1: Number(row.thickness_t1), feed_t1: Number(row.feed_t1), life_t1: Number(row.life_t1),
            thickness_t2: Number(row.thickness_t2), feed_t2: Number(row.feed_t2), life_t2: Number(row.life_t2),
            miter_feed: Number(row.miter_feed),
          }
          const existing = existingCatalog.find(e => e.nominal_diameter === d && e.material_type === m)
          if (existing) {
            await updateCatalogEntry(existing.id, payload)
          } else {
            await createCatalogEntry(payload)
          }
        }
      }

      for (const d of diameters) {
        const row = wearRows[String(d)]
        if (!row) continue
        const existing = existingWear.find(w => w.nominal_diameter === d)
        if (existing) {
          await updateWearReference(existing.id, {
            measured_new: Number(row.measured_new), measured_worn: Number(row.measured_worn),
          })
        } else {
          await createWearReference({
            family_id: familyId, nominal_diameter: d,
            measured_new: Number(row.measured_new), measured_worn: Number(row.measured_worn),
          })
        }
      }

      onDone()
    } catch {
      setSaveError('Failed to save. Check all values and try again.')
    } finally {
      setSaving(false)
    }
  }

  const stepLabel = ['', 'Family Details', 'Materials', 'Cutting Parameters', 'Wear Reference'][step]

  if (editingFamily && (!initialized || existingCatalogQ.isLoading || existingWearQ.isLoading)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md mx-4 p-8 text-center">
          <p className="text-sm text-gray-400">Loading family data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 my-auto">

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-1">
              <div className={[
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                s === step ? 'bg-blue-600 text-white' :
                s <  step  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' :
                             'bg-gray-100 dark:bg-gray-800 text-gray-400',
              ].join(' ')}>
                {s}
              </div>
              {s < 4 && <div className={['h-px w-8', s < step ? 'bg-blue-300' : 'bg-gray-200 dark:bg-gray-700'].join(' ')} />}
            </div>
          ))}
          <span className="ml-3 text-sm font-medium text-gray-600 dark:text-gray-400">{stepLabel}</span>
        </div>

        {/* ── STEP 1: Family Details ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingFamily ? 'Edit Family' : 'New Family'} — Details
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Family Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Wear Rule (mm) *</label>
              <input type="number" value={wearRuleMm} onChange={e => setWearRuleMm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
              <textarea value={description} rows={2} onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Available Diameters</label>
              <div className="flex flex-wrap gap-5">
                {ALL_DIAMETERS.map(d => (
                  <label key={d} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={diameters.includes(d)}
                      onChange={() => setDiameters(prev =>
                        prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b)
                      )}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{d} mm</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Materials ── */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Materials</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select which materials this family supports.
            </p>
            <div className="space-y-1">
              {ALL_MATERIALS.map(m => (
                <label key={m} className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 select-none">
                  <input type="checkbox" checked={materials.includes(m)}
                    onChange={() => setMaterials(prev =>
                      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                    )}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{MATERIAL_LABELS[m]}</span>
                  <span className="text-xs text-gray-400 font-mono">{m}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Cutting Parameters ── */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Cutting Parameters</h2>
            <p className="text-xs text-gray-400 mb-4">
              T1 thickness: 2.0 mm · T2 thickness: 3.0 mm (1.2 mm for porcelain) — applied automatically.
            </p>
            {diameters.length === 0 || materials.length === 0 ? (
              <p className="text-sm text-gray-400">No diameter/material combinations selected. Go back and select at least one of each.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs min-w-[640px]">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Ø</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Material</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">RPM</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">T1 Feed</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">T1 Life</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">T2 Feed</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">T2 Life</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">◇ Height</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Miter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {diameters.flatMap(d => materials.map(m => {
                      const key = `${d}-${m}`
                      const row = catalogRows[key] ?? defaultCatalogRow(m)
                      const upd = (field: keyof CatalogRowValues, val: string) =>
                        setCatalogRows(prev => ({
                          ...prev, [key]: { ...(prev[key] ?? defaultCatalogRow(m)), [field]: val },
                        }))
                      return (
                        <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-2 py-1.5 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{d} mm</td>
                          <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400 max-w-[110px] truncate whitespace-nowrap"
                              title={MATERIAL_LABELS[m]}>
                            {MATERIAL_LABELS[m]}
                          </td>
                          {(['rpm','feed_t1','life_t1','feed_t2','life_t2','diamond_height','miter_feed'] as (keyof CatalogRowValues)[]).map(field => (
                            <td key={field} className="px-1 py-1.5">
                              <input type="number" value={row[field]}
                                onChange={e => upd(field, e.target.value)}
                                className="w-16 px-1.5 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs" />
                            </td>
                          ))}
                        </tr>
                      )
                    }))}
                  </tbody>
                </table>
              </div>
            )}
            {catalogError && (
              <p className="mt-3 text-sm text-red-500 dark:text-red-400">{catalogError}</p>
            )}
          </div>
        )}

        {/* ── STEP 4: Wear Reference ── */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Wear Reference</h2>
            {diameters.length === 0 ? (
              <p className="text-sm text-gray-400">No diameters selected.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Diameter</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Measured New (mm)</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Measured Worn (mm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {diameters.map(d => {
                    const row = wearRows[String(d)] ?? { measured_new: '', measured_worn: '' }
                    const upd = (field: keyof WearRowValues, val: string) =>
                      setWearRows(prev => ({
                        ...prev, [String(d)]: { ...(prev[String(d)] ?? { measured_new: '', measured_worn: '' }), [field]: val },
                      }))
                    return (
                      <tr key={d} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300">{d} mm</td>
                        <td className="px-4 py-2.5">
                          <input type="number" value={row.measured_new}
                            onChange={e => upd('measured_new', e.target.value)}
                            className="w-28 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                        </td>
                        <td className="px-4 py-2.5">
                          <input type="number" value={row.measured_worn}
                            onChange={e => upd('measured_worn', e.target.value)}
                            className="w-28 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {saveError && <p className="mt-4 text-sm text-red-500 dark:text-red-400">{saveError}</p>}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:underline">
            Cancel
          </button>
          <div className="flex gap-3">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                ← Back
              </button>
            )}
            {step < 4 && (
              <button
                onClick={handleNext}
                disabled={step === 1 && (!name.trim() || !wearRuleMm)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50">
                Next →
              </button>
            )}
            {step === 4 && (
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Family'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Catalog Modal ────────────────────────────────────────────────────────────

function CatalogModal({ initial, families, onClose, onSave, saving }: {
  initial: CatalogForm
  families: DiscFamily[]
  onClose: () => void
  onSave: (f: CatalogForm) => void
  saving: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<CatalogForm>(initial)
  const isEdit = !!initial.material_type

  function inp(label: string, fk: keyof CatalogForm, type = 'number') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
        <input
          type={type}
          value={form[fk]}
          onChange={(e) => setForm(p => ({ ...p, [fk]: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 my-auto">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
          {isEdit ? t('tools.edit_catalog') : t('tools.add_catalog')}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('tools.col_family')} *
            </label>
            <select
              value={form.family_id}
              disabled={isEdit}
              onChange={(e) => setForm(p => ({ ...p, family_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="">—</option>
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          {inp(`${t('tools.col_material')} *`, 'material_type', 'text')}
          {inp(`${t('tools.col_diameter')} (mm) *`, 'nominal_diameter')}
          {inp(`${t('tools.col_rpm')} *`, 'rpm')}
          <div className="grid grid-cols-3 gap-3">
            {inp('T1 Thickness', 'thickness_t1')}
            {inp(t('tools.col_t1_feed'), 'feed_t1')}
            {inp(t('tools.col_t1_life'), 'life_t1')}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {inp('T2 Thickness', 'thickness_t2')}
            {inp(t('tools.col_t2_feed'), 'feed_t2')}
            {inp(t('tools.col_t2_life'), 'life_t2')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {inp('Diamond Height', 'diamond_height')}
            {inp('Miter Feed', 'miter_feed')}
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.family_id || !form.material_type.trim() || !form.nominal_diameter || !form.rpm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Wear Modal ───────────────────────────────────────────────────────────────

function WearModal({ entry, onClose, onSave, saving }: {
  entry: WearRef
  onClose: () => void
  onSave: (measured_new: number, measured_worn: number) => void
  saving: boolean
}) {
  const { t } = useTranslation()
  const [measNew, setMeasNew] = useState(String(entry.measured_new))
  const [measWorn, setMeasWorn] = useState(String(entry.measured_worn))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t('tools.edit_wear')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {entry.family.name} — {entry.nominal_diameter} mm
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('tools.col_measured_new')} (mm)
            </label>
            <input type="number" value={measNew} onChange={(e) => setMeasNew(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('tools.col_measured_worn')} (mm)
            </label>
            <input type="number" value={measWorn} onChange={(e) => setMeasWorn(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline">
            {t('common.cancel')}
          </button>
          <button onClick={() => onSave(Number(measNew), Number(measWorn))} disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50">
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SAT Rule Modal ───────────────────────────────────────────────────────────

function SatRuleModal({ symptomCode, defaultLabel, initial, onClose, onSave, saving }: {
  symptomCode: string
  defaultLabel: string
  initial: SatDiagnosisRule | null
  onClose: () => void
  onSave: (vals: { symptom_label: string; probable_cause: string; recommended_fix: string; prevention: string }) => void
  saving: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    symptom_label:   initial?.symptom_label   ?? defaultLabel,
    probable_cause:  initial?.probable_cause  ?? '',
    recommended_fix: initial?.recommended_fix ?? '',
    prevention:      initial?.prevention      ?? '',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 my-auto">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {initial ? t('tools.sat_edit_rule') : t('tools.sat_add_rule')}
        </h2>
        <p className="text-xs text-gray-400 font-mono mb-5">{symptomCode}</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('tools.sat_symptom_label')}
            </label>
            <input type="text" value={form.symptom_label}
              onChange={e => setForm(p => ({ ...p, symptom_label: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          </div>
          {(['probable_cause', 'recommended_fix', 'prevention'] as const).map(field => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t(`tools.sat_${field}`)}
              </label>
              <textarea value={form[field]} rows={3}
                onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline">
            {t('common.cancel')}
          </button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50">
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'EVDS_ADMIN'

  const [activeTab, setActiveTab] = useState<Tab>('families')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [familyFilter, setFamilyFilter] = useState('')
  const [familyModal, setFamilyModal] = useState<{ open: boolean; editing: DiscFamily | null }>({ open: false, editing: null })
  const [catalogModal, setCatalogModal] = useState<{ open: boolean; editing: CatalogEntry | null }>({ open: false, editing: null })
  const [wearModal, setWearModal] = useState<WearRef | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteFamilyTarget, setDeleteFamilyTarget] = useState<{ id: string; name: string } | null>(null)
  const [satRuleModal, setSatRuleModal] = useState<{ symptomCode: string; defaultLabel: string; existing: SatDiagnosisRule | null } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const satConfigQ = useQuery({ queryKey: ['sat-config-tools'], queryFn: getSatConfig })

  const saveSatRuleMut = useMutation({
    mutationFn: (p: { code: string; vals: Parameters<typeof updateSatRule>[1] }) =>
      updateSatRule(p.code, p.vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sat-config-tools'] })
      setSatRuleModal(null)
      showToast(t('tools.sat_rule_saved'))
    },
    onError: () => showToast(t('tools.sat_rule_save_error'), false),
  })

  const familiesQ = useQuery({ queryKey: ['disc-families-tools'], queryFn: getDiscFamilies })
  const catalogQ  = useQuery({
    queryKey: ['disc-catalog-tools', familyFilter],
    queryFn: () => getCatalog(familyFilter || undefined),
  })
  const wearQ = useQuery({ queryKey: ['wear-reference-tools'], queryFn: getWearReference })

  const families = familiesQ.data ?? []

  const saveCatalogMut = useMutation({
    mutationFn: (p: { id?: string; payload: Omit<CatalogEntry, 'id' | 'family'> }) =>
      p.id ? updateCatalogEntry(p.id, p.payload) : createCatalogEntry(p.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disc-catalog-tools'] })
      setCatalogModal({ open: false, editing: null })
      showToast(t('tools.catalog_saved'))
    },
    onError: () => showToast(t('tools.catalog_save_error'), false),
  })

  const deleteCatalogMut = useMutation({
    mutationFn: deleteCatalogEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disc-catalog-tools'] })
      setDeleteId(null)
      showToast(t('tools.catalog_deleted'))
    },
    onError: () => showToast(t('tools.catalog_delete_error'), false),
  })

  const deleteFamilyMut = useMutation({
    mutationFn: (id: string) => deleteDiscFamily(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disc-families-tools'] })
      qc.invalidateQueries({ queryKey: ['disc-catalog-tools'] })
      qc.invalidateQueries({ queryKey: ['wear-reference-tools'] })
      setDeleteFamilyTarget(null)
      showToast(t('tools.family_deleted'))
    },
    onError: () => showToast(t('tools.family_delete_error'), false),
  })

  const saveWearMut = useMutation({
    mutationFn: (p: { id: string; measured_new: number; measured_worn: number }) =>
      updateWearReference(p.id, { measured_new: p.measured_new, measured_worn: p.measured_worn }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wear-reference-tools'] })
      setWearModal(null)
      showToast(t('tools.wear_saved'))
    },
    onError: () => showToast(t('tools.wear_save_error'), false),
  })

  function handleSaveCatalog(form: CatalogForm) {
    const payload: Omit<CatalogEntry, 'id' | 'family'> = {
      family_id: form.family_id,
      material_type: form.material_type.trim(),
      nominal_diameter: Number(form.nominal_diameter),
      rpm: Number(form.rpm),
      diamond_height: Number(form.diamond_height),
      thickness_t1: Number(form.thickness_t1),
      feed_t1: Number(form.feed_t1),
      life_t1: Number(form.life_t1),
      thickness_t2: Number(form.thickness_t2),
      feed_t2: Number(form.feed_t2),
      life_t2: Number(form.life_t2),
      miter_feed: Number(form.miter_feed),
    }
    saveCatalogMut.mutate({ id: catalogModal.editing?.id, payload })
  }

  const tabCls = (active: boolean) =>
    [
      'px-4 py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer border',
      active
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700',
    ].join(' ')

  const TH = 'text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300 text-sm'
  const TD = 'px-4 py-3 text-gray-600 dark:text-gray-300 text-sm'

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('tools.title')}</h1>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button className={tabCls(activeTab === 'families')} onClick={() => setActiveTab('families')}>
          {t('tools.tab_families')}
        </button>
        <button className={tabCls(activeTab === 'catalog')} onClick={() => setActiveTab('catalog')}>
          {t('tools.tab_catalog')}
        </button>
        <button className={tabCls(activeTab === 'wear')} onClick={() => setActiveTab('wear')}>
          {t('tools.tab_wear')}
        </button>
        <button className={tabCls(activeTab === 'sat')} onClick={() => setActiveTab('sat')}>
          {t('tools.tab_sat')}
        </button>
      </div>

      {/* ── TAB 1: Disc Families ── */}
      {activeTab === 'families' && (
        <div>
          {isAdmin && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setFamilyModal({ open: true, editing: null })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
              >
                + {t('tools.add_family')}
              </button>
            </div>
          )}
          {familiesQ.isLoading ? (
            <p className="text-sm text-gray-400">{t('common.loading')}</p>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className={TH}>{t('tools.col_name')}</th>
                    <th className={TH}>{t('tools.col_wear_rule')}</th>
                    <th className={TH}>{t('tools.col_description')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {families.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                        {t('tools.no_families')}
                      </td>
                    </tr>
                  ) : families.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{f.name}</td>
                      <td className={TD}>{f.wear_rule_mm} mm</td>
                      <td className={TD}>{f.description ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {isAdmin && (
                          <div className="flex gap-3 justify-end">
                            <button
                              onClick={() => setFamilyModal({ open: true, editing: f })}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              onClick={() => setDeleteFamilyTarget({ id: f.id, name: f.name })}
                              className="text-red-500 hover:text-red-700 text-sm font-medium"
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Cutting Parameters ── */}
      {activeTab === 'catalog' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="">{t('tools.all_families')}</option>
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {isAdmin && (
              <button
                onClick={() => setCatalogModal({ open: true, editing: null })}
                className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
              >
                + {t('tools.add_catalog')}
              </button>
            )}
          </div>
          {catalogQ.isLoading ? (
            <p className="text-sm text-gray-400">{t('common.loading')}</p>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className={TH}>{t('tools.col_material')}</th>
                    <th className={TH}>{t('tools.col_diameter')}</th>
                    <th className={TH}>{t('tools.col_rpm')}</th>
                    <th className={TH}>{t('tools.col_t1_feed')}</th>
                    <th className={TH}>{t('tools.col_t1_life')}</th>
                    <th className={TH}>{t('tools.col_t2_feed')}</th>
                    <th className={TH}>{t('tools.col_t2_life')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(catalogQ.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                        {t('tools.no_catalog')}
                      </td>
                    </tr>
                  ) : (catalogQ.data ?? []).map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{c.material_type}</td>
                      <td className={TD}>{c.nominal_diameter} mm</td>
                      <td className={TD}>{c.rpm}</td>
                      <td className={TD}>{c.feed_t1}</td>
                      <td className={TD}>{c.life_t1} m</td>
                      <td className={TD}>{c.feed_t2}</td>
                      <td className={TD}>{c.life_t2} m</td>
                      <td className="px-4 py-3">
                        {isAdmin && (
                          <div className="flex gap-3 justify-end">
                            <button
                              onClick={() => setCatalogModal({ open: true, editing: c })}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              onClick={() => setDeleteId(c.id)}
                              className="text-red-500 hover:text-red-700 text-sm font-medium"
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Wear Reference ── */}
      {activeTab === 'wear' && (
        <div>
          {wearQ.isLoading ? (
            <p className="text-sm text-gray-400">{t('common.loading')}</p>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className={TH}>{t('tools.col_family')}</th>
                    <th className={TH}>{t('tools.col_diameter')}</th>
                    <th className={TH}>{t('tools.col_measured_new')}</th>
                    <th className={TH}>{t('tools.col_measured_worn')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(wearQ.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                        {t('tools.no_wear_refs')}
                      </td>
                    </tr>
                  ) : (wearQ.data ?? []).map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{w.family.name}</td>
                      <td className={TD}>{w.nominal_diameter} mm</td>
                      <td className={TD}>{w.measured_new} mm</td>
                      <td className={TD}>{w.measured_worn} mm</td>
                      <td className="px-4 py-3 text-right">
                        {isAdmin && (
                          <button
                            onClick={() => setWearModal(w)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {t('common.edit')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: SAT Diagnosis Rules ── */}
      {activeTab === 'sat' && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            These texts appear automatically when a customer submits a SAT ticket.
            DB rules override the built-in defaults.
          </p>
          {satConfigQ.isLoading ? (
            <p className="text-sm text-gray-400">{t('common.loading')}</p>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className={TH}>{t('tools.sat_col_symptom')}</th>
                    <th className={TH}>{t('tools.sat_col_cause')}</th>
                    <th className={TH}>{t('tools.sat_col_status')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {FIXED_SYMPTOMS.map(({ code, label }) => {
                    const rule = (satConfigQ.data ?? []).find(r => r.symptom_code === code)
                    return (
                      <tr key={code} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{code}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                          <span className="line-clamp-2">{rule?.probable_cause || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          {rule ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                              {t('tools.sat_configured')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                              {t('tools.sat_not_configured')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && (
                            <button
                              onClick={() => setSatRuleModal({ symptomCode: code, defaultLabel: label, existing: rule ?? null })}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              {rule ? t('tools.sat_edit_rule') : t('tools.sat_add_rule')}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={[
          'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm text-white',
          toast.ok ? 'bg-green-600' : 'bg-red-600',
        ].join(' ')}>
          {toast.msg}
        </div>
      )}

      {/* Family Wizard */}
      {familyModal.open && (
        <FamilyWizard
          editingFamily={familyModal.editing}
          onClose={() => setFamilyModal({ open: false, editing: null })}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['disc-families-tools'] })
            qc.invalidateQueries({ queryKey: ['disc-catalog-tools'] })
            qc.invalidateQueries({ queryKey: ['wear-reference-tools'] })
            setFamilyModal({ open: false, editing: null })
            showToast(t('tools.family_saved'))
          }}
        />
      )}

      {/* SAT Rule Modal */}
      {satRuleModal && (
        <SatRuleModal
          symptomCode={satRuleModal.symptomCode}
          defaultLabel={satRuleModal.defaultLabel}
          initial={satRuleModal.existing}
          onClose={() => setSatRuleModal(null)}
          onSave={(vals) => saveSatRuleMut.mutate({ code: satRuleModal.symptomCode, vals })}
          saving={saveSatRuleMut.isPending}
        />
      )}

      {/* Delete Family Confirm */}
      {deleteFamilyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('tools.delete_confirm')} "{deleteFamilyTarget.name}"?
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('tools.delete_warning')}
            </p>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3 mb-5">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                ⚠ {t('tools.delete_cannot_undo')}
              </p>
            </div>
            {deleteFamilyMut.isError && (
              <p className="text-sm text-red-500 dark:text-red-400 mb-4">
                {(deleteFamilyMut.error as any)?.response?.data?.error === 'HAS_LABELS'
                  ? t('tools.delete_labels_warning')
                  : t('tools.family_delete_error')}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteFamilyTarget(null); deleteFamilyMut.reset() }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline"
              >
                {t('tools.cancel')}
              </button>
              <button
                onClick={() => deleteFamilyMut.mutate(deleteFamilyTarget.id)}
                disabled={deleteFamilyMut.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {deleteFamilyMut.isPending ? t('common.loading') : t('tools.confirm_delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Modal */}
      {catalogModal.open && (
        <CatalogModal
          initial={
            catalogModal.editing
              ? {
                  family_id: catalogModal.editing.family_id,
                  material_type: catalogModal.editing.material_type,
                  nominal_diameter: String(catalogModal.editing.nominal_diameter),
                  rpm: String(catalogModal.editing.rpm),
                  diamond_height: String(catalogModal.editing.diamond_height),
                  thickness_t1: String(catalogModal.editing.thickness_t1),
                  feed_t1: String(catalogModal.editing.feed_t1),
                  life_t1: String(catalogModal.editing.life_t1),
                  thickness_t2: String(catalogModal.editing.thickness_t2),
                  feed_t2: String(catalogModal.editing.feed_t2),
                  life_t2: String(catalogModal.editing.life_t2),
                  miter_feed: String(catalogModal.editing.miter_feed),
                }
              : {
                  family_id: familyFilter, material_type: '', nominal_diameter: '', rpm: '',
                  diamond_height: '0', thickness_t1: '', feed_t1: '', life_t1: '',
                  thickness_t2: '', feed_t2: '', life_t2: '', miter_feed: '0',
                }
          }
          families={families}
          onClose={() => setCatalogModal({ open: false, editing: null })}
          onSave={handleSaveCatalog}
          saving={saveCatalogMut.isPending}
        />
      )}

      {/* Wear Modal */}
      {wearModal && (
        <WearModal
          entry={wearModal}
          onClose={() => setWearModal(null)}
          onSave={(n, w) => saveWearMut.mutate({ id: wearModal.id, measured_new: n, measured_worn: w })}
          saving={saveWearMut.isPending}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('tools.delete_confirm_title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('tools.delete_confirm_desc')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteCatalogMut.mutate(deleteId)}
                disabled={deleteCatalogMut.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg disabled:opacity-50"
              >
                {deleteCatalogMut.isPending ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
