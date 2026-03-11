import { useState } from 'react'
import { Link } from 'react-router-dom'
import AdminUserList from '../components/AdminUserList'
import AdminUserApproval from '../components/AdminUserApproval'
import { useAuth } from '../context/AuthProvider'
import './AdminDashboard.css'

type AdminTab = 'users' | 'pending'

export default function AdminDashboard() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = () => setRefreshKey(k => k + 1)

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-left">
          <Link to="/dashboard" className="admin-back-link">
            ← Back to App
          </Link>
          <h1>🛡 Admin Dashboard</h1>
        </div>
        <div className="admin-header-right">
          <span className="admin-user-email">{user?.email}</span>
          <button className="admin-btn admin-btn-secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="admin-tabs">
        <button
          className={`admin-tab${activeTab === 'users' ? ' active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          All Users
        </button>
        <button
          className={`admin-tab${activeTab === 'pending' ? ' active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Approvals
        </button>
      </nav>

      <main className="admin-content">
        {activeTab === 'users' && <AdminUserList key={refreshKey} onRefresh={handleRefresh} />}
        {activeTab === 'pending' && <AdminUserApproval key={refreshKey} />}
      </main>
    </div>
  )
}
