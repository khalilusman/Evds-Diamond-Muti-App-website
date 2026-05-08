type Status = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | string

const map: Record<string, string> = {
  PENDING:     'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  ACTIVE:      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  ACTIVE_W2:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  SUSPENDED:   'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  DEACTIVATED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  EXPIRED_W1:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  PERMANENTLY_DEACTIVATED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  REPLACED:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  OPEN:        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  RESOLVED:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  ESCALATED:   'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

interface StatusBadgeProps {
  status: Status
  label?: string
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const cls = map[status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label ?? status.replace(/_/g, ' ')}
    </span>
  )
}
