interface WearBadgeProps {
  pct?: number | null
  expired?: boolean
}

export default function WearBadge({ pct, expired }: WearBadgeProps) {
  if (expired) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        Expired
      </span>
    )
  }

  if (pct == null) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        —
      </span>
    )
  }

  let cls: string
  if (pct > 80) {
    cls = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  } else if (pct >= 50) {
    cls = 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
  } else {
    cls = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {Math.round(pct)}%
    </span>
  )
}
