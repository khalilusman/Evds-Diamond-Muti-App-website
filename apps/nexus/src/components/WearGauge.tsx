interface WearGaugeProps {
  currentDiameter: number
  newDiameter: number
  wornDiameter: number
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { box: 64, r: 26, stroke: 5, fontSize: 10, labelSize: 7 },
  md: { box: 96, r: 38, stroke: 7, fontSize: 14, labelSize: 9 },
  lg: { box: 128, r: 52, stroke: 9, fontSize: 18, labelSize: 11 },
}

function getColor(pct: number): string {
  if (pct <= 50) return '#22c55e'
  if (pct <= 80) return '#f97316'
  return '#ef4444'
}

export default function WearGauge({
  currentDiameter,
  newDiameter,
  wornDiameter,
  size = 'md',
}: WearGaugeProps) {
  const range = newDiameter - wornDiameter
  const rawPct = range > 0 ? ((newDiameter - currentDiameter) / range) * 100 : 0
  const wearPct = Math.min(100, Math.max(0, rawPct))

  const { box, r, stroke, fontSize, labelSize } = sizeMap[size]
  const cx = box / 2
  const cy = box * 0.6

  // Arc from 180° to 0° (left to right, half circle)
  const circumference = Math.PI * r
  const fillLength = (wearPct / 100) * circumference

  // SVG arc helper — half circle path from left to right
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  return (
    <svg width={box} height={box * 0.65} viewBox={`0 0 ${box} ${box * 0.65}`}>
      {/* Background arc */}
      <path
        d={arcPath}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        className="text-gray-200 dark:text-gray-700"
      />
      {/* Fill arc */}
      <path
        d={arcPath}
        fill="none"
        stroke={getColor(wearPct)}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${fillLength} ${circumference}`}
      />
      {/* Percentage */}
      <text
        x={cx}
        y={cy - stroke / 2}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={fontSize}
        fontWeight="bold"
        fill={getColor(wearPct)}
      >
        {Math.round(wearPct)}%
      </text>
      {/* Label */}
      <text
        x={cx}
        y={cy + labelSize}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={labelSize}
        fill="currentColor"
        className="text-gray-400"
      >
        worn
      </text>
    </svg>
  )
}
