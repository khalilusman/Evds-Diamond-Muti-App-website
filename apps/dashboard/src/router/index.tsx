import { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import useAuthStore from '../stores/auth.store'
import { ALLOWED_ROLES } from '../stores/auth.store'

import LoginPage from '../pages/auth/LoginPage'
import HomePage from '../pages/home/HomePage'
import CompaniesPage from '../pages/companies/CompaniesPage'
import CompanyDetailPage from '../pages/companies/CompanyDetailPage'
import DiscsPage from '../pages/discs/DiscsPage'
import LabelsPage from '../pages/labels/LabelsPage'
import ProfilePage from '../pages/profile/ProfilePage'
import DashboardLayout from '../layouts/DashboardLayout'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user && !ALLOWED_ROLES.has(user.role)) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Placeholder({ title }: { title: string }) {
  return (
    <DashboardLayout title={title}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h2>
        <p className="text-sm text-gray-400 dark:text-gray-500">Coming in Day 11</p>
      </div>
    </DashboardLayout>
  )
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
      <Route path="/companies" element={<RequireAuth><CompaniesPage /></RequireAuth>} />
      <Route path="/companies/:id" element={<RequireAuth><CompanyDetailPage /></RequireAuth>} />
      <Route path="/discs" element={<RequireAuth><DiscsPage /></RequireAuth>} />
      <Route path="/labels"   element={<RequireAuth><LabelsPage /></RequireAuth>} />
      <Route path="/profile"  element={<RequireAuth><ProfilePage /></RequireAuth>} />

      <Route path="/security"  element={<RequireAuth><Placeholder title="Security Alerts" /></RequireAuth>} />
      <Route path="/sat"       element={<RequireAuth><Placeholder title="SAT Tickets" /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth><Placeholder title="Analytics" /></RequireAuth>} />
      <Route path="/staff"     element={<RequireAuth><Placeholder title="EVDS Staff" /></RequireAuth>} />
      <Route path="/qr"        element={<RequireAuth><Placeholder title="QR Code" /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
