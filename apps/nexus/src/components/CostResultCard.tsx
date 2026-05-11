import { useTranslation } from 'react-i18next'
import Button from './Button'
import { CostResult } from '../api/cost.api'

interface CostResultCardProps {
  result: CostResult
  discLabel?: string
  materialGroup?: string
  thickness: 2 | 3
  inputMethod: 'DXF' | 'MANUAL'
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

export default function CostResultCard({
  result,
  discLabel,
  materialGroup,
  thickness,
  inputMethod,
  onReset,
}: CostResultCardProps) {
  const { t } = useTranslation()
  const now = new Date()

  const breakdownRows = [
    { label: t('cost.machine_cost'), value: result.machine_cost, colored: true },
    { label: t('cost.labor_cost'), value: result.labor_cost, colored: true },
    { label: t('cost.disc_wear'), value: result.disc_wear_cost, colored: true },
    { label: t('cost.energy_cost'), value: result.energy_cost, colored: true },
    { label: t('cost.material_cost'), value: result.material_cost, colored: true },
  ]

  return (
    <div id="cost-print-section" className="space-y-5">
      {/* Print header — hidden on screen */}
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
            {now.toLocaleDateString()} · {inputMethod} input
            {discLabel && ` · ${discLabel}`}
          </p>
        </div>
      </div>

      {/* Big 3 summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('cost.total'), value: `€${fmt(result.total)}`, highlight: true },
          { label: t('cost.cost_per_meter'), value: `€${result.cost_per_meter.toFixed(4)}/m` },
          { label: t('cost.cost_per_piece'), value: `€${fmt(result.cost_per_piece)}` },
        ].map(({ label, value, highlight }) => (
          <div
            key={label}
            className={[
              'rounded-2xl p-4 text-center',
              highlight
                ? 'bg-blue-600 text-white'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white',
            ].join(' ')}
          >
            <p className={`text-lg font-bold leading-tight ${highlight ? 'text-white' : ''}`}>
              {value}
            </p>
            <p className={`text-xs mt-0.5 ${highlight ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Breakdown table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Item</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-right px-4 py-3 font-medium">% of total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            <tr className="bg-gray-50/50 dark:bg-gray-800/50">
              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                {t('cost.cutting_time')}
              </td>
              <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">
                {result.cutting_time_min.toFixed(1)} min
              </td>
              <td className="px-4 py-2.5 text-right text-gray-400">—</td>
            </tr>
            {breakdownRows.map(({ label, value }) => (
              <tr key={label}>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{label}</td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">
                  €{fmt(value)}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-400">
                  {pct(value, result.subtotal)}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">Subtotal</td>
              <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">
                €{fmt(result.subtotal)}
              </td>
              <td className="px-4 py-2.5 text-right text-gray-400">—</td>
            </tr>
            {result.copies > 1 && (
              <tr className="text-gray-500 dark:text-gray-400 text-xs">
                <td colSpan={3} className="px-4 py-1.5 text-center">
                  × {result.copies} copies
                </td>
              </tr>
            )}
            <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold text-blue-700 dark:text-blue-300">
              <td className="px-4 py-3">{t('cost.total')}</td>
              <td className="px-4 py-3 text-right">€{fmt(result.total)}</td>
              <td className="px-4 py-3 text-right">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Input summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
        <span>Linear Meters: <strong className="text-gray-700 dark:text-gray-300">{result.total_linear_meters.toFixed(3)} m</strong></span>
        <span>Thickness: <strong className="text-gray-700 dark:text-gray-300">{thickness}cm</strong></span>
        {materialGroup && (
          <span>Material: <strong className="text-gray-700 dark:text-gray-300">{materialGroup}</strong></span>
        )}
        {result.copies > 1 && (
          <span>Copies: <strong className="text-gray-700 dark:text-gray-300">{result.copies}</strong></span>
        )}
        {discLabel && (
          <span>Disc: <strong className="text-gray-700 dark:text-gray-300">{discLabel}</strong></span>
        )}
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
