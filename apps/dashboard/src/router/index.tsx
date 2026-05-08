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
import SatPage from '../pages/sat/SatPage'
import AnalyticsPage from '../pages/analytics/AnalyticsPage'
import SecurityPage from '../pages/security/SecurityPage'
import StaffPage from '../pages/staff/StaffPage'
import QrPage from '../pages/qr/QrPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user && !ALLOWED_ROLES.has(user.role)) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  if (user?.role !== 'EVDS_ADMIN') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
      <Route path="/companies" element={<RequireAuth><CompaniesPage /></RequireAuth>} />
      <Route path="/companies/:id" element={<RequireAuth><CompanyDetailPage /></RequireAuth>} />
      <Route path="/discs" element={<RequireAuth><DiscsPage /></RequireAuth>} />
      <Route path="/labels" element={<RequireAuth><LabelsPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/sat" element={<RequireAuth><SatPage /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth><AnalyticsPage /></RequireAuth>} />
      <Route path="/security" element={<RequireAuth><SecurityPage /></RequireAuth>} />
      <Route path="/staff" element={<RequireAuth><AdminOnly><StaffPage /></AdminOnly></RequireAuth>} />
      <Route path="/qr" element={<RequireAuth><AdminOnly><QrPage /></AdminOnly></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
