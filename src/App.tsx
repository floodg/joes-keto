import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Layout from './app/Layout'
import Dashboard from './features/Dashboard'
import MealsPage from './features/meals/MealsPage'
import PlanPage from './features/plan/PlanPage'
import WorkoutsPage from './features/workouts/WorkoutsPage'
import ShoppingPage from './features/shopping/ShoppingPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import { AuthProvider, useAuth } from './context/AuthProvider'
import { initializeStorage } from './storage/dataService'
import './App.css'

function ProtectedRoute() {
  const { session, loading } = useAuth()
  if (loading) return <div className="auth-loading">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

function App() {
  useEffect(() => {
    // Initialize storage with seed data on first run
    initializeStorage();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route element={<ProtectedRoute />}>
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
