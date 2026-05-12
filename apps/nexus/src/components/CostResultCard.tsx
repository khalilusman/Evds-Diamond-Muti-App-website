import { useTranslation } from 'react-i18next'
import Button from './Button'
import { CostResult } from '../api/cost.api'

interface CostResultCardProps {
  result: CostResult
  discLabel?: string
  onReset: () => void
}

function fmt(n: number): string {
  return n.toFixed(2)
}

function pct(part: number, total: number): string {
  if (total === 0) return '—'
  return `${Math.round((part / total) * 100)}%`
}

function handlePrint() {
  const style = document.createElement('style')
  style.id = '__cost-print'
  style.textContent = `
    @media print {
      body > * { visibility: hidden !important; }
      #cost-print-section, #cost-print-section * { visibility: visible !important; }
      #cost-print-section {
        position: absolute !important;
        left: 0 !important; top: 0 !important;
        width: 100% !important;
        padding: 24px !important;
        background: white !important;
        color: black !important;
      }
      .no-print { display: none !important; }
    }
  `
  document.head.appendChild(style)
  window.print()
  window.addEventListener('afterprint', () => {
    document.getElementById('__cost-print')?.remove()
  }, { once: true })
}

export default function CostResultCard({ result, discLabel, onReset }: CostResultCardProps) {
  const { t } = useTranslation()
  const now = new Date()

  return (
    <div id="cost-print-section" className="space-y-5">
      {/* Print header */}
      <div className="hidden print:block mb-4">
        <img src="/logo_evds_nexus.png" alt="EVDS" className="h-10 mb-2" />
        <h1 className="text-xl font-bold">{t('cost.results_title')}</h1>
        <p className="text-sm text-gray-500">{now.toLocaleString()}</p>
        {discLabel && <p className="text-sm text-gray-600">Disc: {discLabel}</p>}
      </div>

      {/* Screen header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('cost.results_title')}
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {now.toLocaleDateString()}
            {discLabel && ` · ${discLabel}`}
          </p>
        </div>
      </div>

      {/* Big 2-card summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-5 text-center bg-blue-600 text-white">
          <p className="text-2xl font-bold leading-tight">€{fmt(result.total)}</p>
          <p className="text-xs mt-1 text-blue-100">{t('cost.total')}</p>
        </div>
        <div className="rounded-2xl p-5 text-center bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white">
          <p className="text-2xl font-bold leading-tight">€{result.cost_per_lm.toFixed(4)}</p>
          <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">{t('cost.cost_per_meter')}</p>
        </div>
      </div>

      {/* Breakdown table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Cost component</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-right px-4 py-3 font-medium">% of total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            <tr>
              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{t('cost.disc_wear')}</td>
              <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">€{fmt(result.disc_cost)}</td>
              <td className="px-4 py-2.5 text-right text-gray-400">{pct(result.disc_cost, result.total)}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{t('cost.machine_cost')}</td>
              <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">€{fmt(result.machine_cost)}</td>
              <td className="px-4 py-2.5 text-right text-gray-400">{pct(result.machine_cost, result.total)}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Labor</td>
              <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">€{fmt(result.labor_cost)}</td>
              <td className="px-4 py-2.5 text-right text-gray-400">{pct(result.labor_cost, result.total)}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Energy</td>
              <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">€{fmt(result.energy_cost)}</td>
              <td className="px-4 py-2.5 text-right text-gray-400">{pct(result.energy_cost, result.total)}</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Material</td>
              <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">€{fmt(result.material_cost)}</td>
              <td className="px-4 py-2.5 text-right text-gray-400">{pct(result.material_cost, result.total)}</td>
            </tr>
            <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold text-blue-700 dark:text-blue-300">
              <td className="px-4 py-3">{t('cost.total')}</td>
              <td className="px-4 py-3 text-right">€{fmt(result.total)}</td>
              <td className="px-4 py-3 text-right">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Operating parameters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Operating Parameters
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Linear meters</span>
            <span className="font-medium text-gray-900 dark:text-white">{result.metres_to_cut.toFixed(3)} m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Cutting time</span>
            <span className="font-medium text-gray-900 dark:text-white">{result.time_minutes.toFixed(1)} min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Feed rate</span>
            <span className="font-medium text-gray-900 dark:text-white">{result.feed_used} mm/min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Disc life reference</span>
            <span className="font-medium text-gray-900 dark:text-white">{result.life_used} m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Disc consumed</span>
            <span className="font-medium text-gray-900 dark:text-white">{(result.disc_fraction * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Machine rate</span>
            <span className="font-medium text-gray-900 dark:text-white">€{fmt(result.machine_cost_hour)}/h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Labor rate</span>
            <span className="font-medium text-gray-900 dark:text-white">€{fmt(result.labor_cost_hour)}/h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Energy rate</span>
            <span className="font-medium text-gray-900 dark:text-white">€{result.energy_cost_kwh.toFixed(4)}/kWh</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Downtime</span>
            <span className="font-medium text-gray-900 dark:text-white">{result.downtime_pct}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Waste</span>
            <span className="font-medium text-gray-900 dark:text-white">{result.waste_pct}%</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 no-print">
        <Button variant="secondary" onClick={handlePrint}>
          🖨️ {t('cost.print')}
        </Button>
        <Button variant="ghost" onClick={onReset}>
          {t('common.close')} ×
        </Button>
      </div>
    </div>
  )
}
