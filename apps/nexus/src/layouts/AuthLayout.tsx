import { ReactNode } from 'react'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../components/LanguageSwitcher'

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Top bar */}
      <div className="flex justify-end items-center gap-2 p-4">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <Logo size="lg" className="mb-8" />

        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
            {children}
          </div>
        </div>

        <p className="mt-8 text-xs text-gray-400 dark:text-gray-600">
          © {new Date().getFullYear()} EVDS Diamond. All rights reserved.
        </p>
      </div>
    </div>
  )
}
