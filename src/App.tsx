import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './app/Layout'
import Dashboard from './features/Dashboard'
import MealsPage from './features/meals/MealsPage'
import PlanPage from './features/plan/PlanPage'
import WorkoutsPage from './features/workouts/WorkoutsPage'
import ShoppingPage from './features/shopping/ShoppingPage'
import { initializeStorage } from './storage/dataService'
import './App.css'

function App() {
  useEffect(() => {
    // Initialize storage with seed data on first run
    initializeStorage();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="meals" element={<MealsPage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="workouts" element={<WorkoutsPage />} />
          <Route path="shopping" element={<ShoppingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
