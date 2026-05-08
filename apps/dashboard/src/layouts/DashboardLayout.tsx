import { ReactNode, useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../components/LanguageSwitcher'
import useAuthStore from '../stores/auth.store'
import { getAnalyticsSummary } from '../api/analytics.api'

interface NavItem {
  icon: string
  label: string
  path: string
}

const NAV_ITEMS: NavItem[] = [
  { icon: '🏠', label: 'Home', path: '/' },
  { icon: '🏢', label: 'Companies', path: '/companies' },
  { icon: '💿', label: 'Disc Monitoring', path: '/discs' },
  { icon: '🏷️', label: 'Label Generator', path: '/labels' },
  { icon: '🔒', label: 'Security Alerts', path: '/security' },
  { icon: '🔧', label: 'SAT Tickets', path: '/sat' },
  { icon: '📊', label: 'Analytics', path: '/analytics' },
  { icon: '👤', label: 'EVDS Staff', path: '/staff' },
  { icon: '📱', label: 'QR Code', path: '/qr' },
]

const MOBILE_NAV: NavItem[] = NAV_ITEMS.slice(0, 5)

function SidebarNav({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const { data: summary } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: getAnalyticsSummary,
    staleTime: 60_000,
  })

  const notifCount = (summary?.pending_companies ?? 0) + (summary?.open_sat_tickets ?? 0)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Logo */}
      <div className="px-6 py-5 flex items-center gap-3 border-b border-gray-200 dark:border-gray-800">
        <Logo size="md" />
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 tracking-wide">Dashboard</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-r-2 border-blue-600 dark:border-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200',
              ].join(' ')
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
        {/* Notification hint */}
        {notifCount > 0 && (
          <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl text-xs text-amber-700 dark:text-amber-400">
            🔔 {notifCount} item{notifCount !== 1 ? 's' : ''} need attention
          </div>
        )}

        {/* User info */}
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{user?.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{user?.role?.replace(/_/g, ' ')}</p>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LanguageSwitcher />
          <NavLink
            to="/profile"
            onClick={onClose}
            className={({ isActive }) =>
              [
                'text-xs px-2 py-1.5 rounded-lg transition-colors',
                isActive
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
              ].join(' ')
            }
          >
            Profile
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

interface DashboardLayoutProps {
  children: ReactNode
  title?: string
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data: summary } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: getAnalyticsSummary,
    staleTime: 60_000,
  })

  const notifCount = (summary?.pending_companies ?? 0) + (summary?.open_sat_tickets ?? 0)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showNotifs) return
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotifs])

  function notifNavigate(path: string) {
    setShowNotifs(false)
    navigate(path)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col z-30">
        <SidebarNav />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile slide-out drawer */}
      <aside
        className={[
          'fixed left-0 top-0 h-full w-72 z-50 md:hidden transition-transform duration-200',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarNav onClose={() => setDrawerOpen(false)} />
      </aside>

      {/* Top bar */}
      <header className="md:ml-64 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3 sticky top-0 z-20">
        <button
          type="button"
          title="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ☰
        </button>

        <h1 className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-200 truncate">
          {title ?? 'EVDS Dashboard'}
        </h1>

        {/* Notification bell + dropdown */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            title={`${notifCount} notifications`}
            onClick={() => setShowNotifs((v) => !v)}
            className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            🔔
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 h-4 min-w-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {notifCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 w-80 z-50 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Notifications
                </p>
              </div>

              {notifCount === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  All clear — no items need attention
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(summary?.pending_companies ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => notifNavigate('/companies?status=PENDING')}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-xl shrink-0">⏳</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {summary!.pending_companies} {summary!.pending_companies === 1 ? 'company' : 'companies'} pending approval
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Click to review</p>
                      </div>
                    </button>
                  )}

                  {(summary?.open_sat_tickets ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => notifNavigate('/sat?status=OPEN')}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-xl shrink-0">🔧</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {summary!.open_sat_tickets} open SAT {summary!.open_sat_tickets === 1 ? 'ticket' : 'tickets'}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Click to review</p>
                      </div>
                    </button>
                  )}

                  {(summary?.wear_alerts ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => notifNavigate('/discs?wear=critical')}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-xl shrink-0">⚠️</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {summary!.wear_alerts} wear {summary!.wear_alerts === 1 ? 'alert' : 'alerts'}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Click to view critical discs</p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="md:ml-64 p-6 min-h-screen bg-gray-50 dark:bg-gray-950">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex z-30">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              [
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              ].join(' ')
            }
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span>{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
