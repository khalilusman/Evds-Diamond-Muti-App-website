import { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import useAuthStore from '../stores/auth.store'

import LanguageSelectPage from '../pages/auth/LanguageSelectPage'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import PendingApprovalPage from '../pages/auth/PendingApprovalPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage'
import OnboardingPage from '../pages/onboarding/OnboardingPage'
import MyDiscsPage from '../pages/discs/MyDiscsPage'
import ActivatePage from '../pages/activation/ActivatePage'
import UsagePage from '../pages/usage/UsagePage'
import SatPage from '../pages/sat/SatPage'
import CostPage from '../pages/cost/CostPage'
import MachinesPage from '../pages/machines/MachinesPage'
import ProfilePage from '../pages/ProfilePage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (user?.company?.status === 'PENDING') return <Navigate to="/pending" replace />

  if (user?.role === 'CUSTOMER_ADMIN' && user?.company && !user.company.onboarding_complete) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (user?.role !== 'CUSTOMER_ADMIN') {
    return <Navigate to="/my-discs" replace />
  }
  return <>{children}</>
}

function RequireLanguage({ children }: { children: ReactNode }) {
  const hasLanguage = !!localStorage.getItem('evds_language')
  if (!hasLanguage) return <Navigate to="/language-select" replace />
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <Routes>
      {/* Language gate */}
      <Route path="/language-select" element={<LanguageSelectPage />} />

      {/* Public auth routes — require language first */}
      <Route
        path="/login"
        element={
          <RequireLanguage>
            <LoginPage />
          </RequireLanguage>
        }
      />
      <Route
        path="/register"
        element={
          <RequireLanguage>
            <RegisterPage />
          </RequireLanguage>
        }
      />
      <Route path="/pending" element={<PendingApprovalPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected onboarding */}
      <Route
        path="/onboarding"
        element={
          <RequireLanguage>
            <OnboardingPage />
          </RequireLanguage>
        }
      />

      {/* Protected app routes */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <Navigate to="/my-discs" replace />
          </RequireAuth>
        }
      />
      <Route
        path="/my-discs"
        element={
          <RequireAuth>
            <MyDiscsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/activate"
        element={
          <RequireAuth>
            <AdminRoute>
              <ActivatePage />
            </AdminRoute>
          </RequireAuth>
        }
      />
      <Route
        path="/usage"
        element={
          <RequireAuth>
            <UsagePage />
          </RequireAuth>
        }
      />
      <Route
        path="/sat"
        element={
          <RequireAuth>
            <SatPage />
          </RequireAuth>
        }
      />
      <Route
        path="/cost"
        element={
          <RequireAuth>
            <CostPage />
          </RequireAuth>
        }
      />
      <Route
        path="/machines"
        element={
          <RequireAuth>
            <AdminRoute>
              <MachinesPage />
            </AdminRoute>
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
