import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import Layout from './app/Layout'
import Dashboard from './features/Dashboard'
import MealsPage from './features/meals/MealsPage'
import PlanPage from './features/plan/PlanPage'
import WorkoutsPage from './features/workouts/WorkoutsPage'
import ShoppingPage from './features/shopping/ShoppingPage'
import StarterMealsPage from './features/onboarding/StarterMealsPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import MagicLinkLogin from './pages/MagicLinkLogin'
import AdminDashboard from './pages/AdminDashboard'
import { AuthProvider, useAuth } from './context/AuthProvider'
import './App.css'

function ProtectedRoute() {
  const { session, loading, profile, profileLoading } = useAuth()
  const location = useLocation()

  if (loading || profileLoading) return <div className="auth-loading">Loading…</div>
  if (!session) return <Navigate to="/login" replace />

  // Redirect new / un-onboarded users to the starter-meals selection screen
  if (
    profile !== null &&
    !profile.has_completed_onboarding &&
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}

function AdminRoute() {
  const { session, loading, profile, profileLoading } = useAuth()

  if (loading || profileLoading) return <div className="auth-loading">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />

  return <Outlet />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/magic-link" element={<MagicLinkLogin />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<StarterMealsPage />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="meals" element={<MealsPage />} />
              <Route path="plan" element={<PlanPage />} />
              <Route path="workouts" element={<WorkoutsPage />} />
              <Route path="shopping" element={<ShoppingPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
