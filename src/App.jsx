import { useState, useEffect } from 'react'
import UserPicker from './components/UserPicker.jsx'
import NavBar from './components/NavBar.jsx'
import TabBar from './components/TabBar.jsx'
import Dashboard from './views/Dashboard.jsx'
import Orders from './views/Orders.jsx'
import Received from './views/Received.jsx'
import Testing from './views/Testing.jsx'
import Approved from './views/Approved.jsx'
import OnWebsite from './views/OnWebsite.jsx'
import AuditLog from './views/AuditLog.jsx'
import { useOrders } from './hooks/useOrders.js'
import { useReceived } from './hooks/useReceived.js'
import { useTesting } from './hooks/useTesting.js'
import { useApproved } from './hooks/useApproved.js'
import { useOnWebsite } from './hooks/useOnWebsite.js'
import { useAuditLog } from './hooks/useAuditLog.js'

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('inv_user'))
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showSwitchUser, setShowSwitchUser] = useState(false)

  // Load counts for tab badges
  const { orders } = useOrders()
  const { received } = useReceived()
  const { testing } = useTesting()
  const { approved } = useApproved()
  const { onWebsite } = useOnWebsite()
  const { entries: auditEntries } = useAuditLog()

  // Count only items currently at each stage (based on orders.status)
  const statusCounts = {}
  orders.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1 })

  const counts = {
    orders: statusCounts['ordered'] || 0,
    received: statusCounts['received'] || 0,
    testing: statusCounts['in_testing'] || 0,
    approved: statusCounts['approved'] || 0,
    on_website: statusCounts['live'] || 0,
    audit_log: auditEntries.length,
  }

  // Escape key closes modals
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setShowSwitchUser(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleSelectUser(name) {
    localStorage.setItem('inv_user', name)
    setUser(name)
    setShowSwitchUser(false)
  }

  function handleSwitchUser() {
    setShowSwitchUser(true)
  }

  if (!user) {
    return <UserPicker onSelect={handleSelectUser} />
  }

  const views = {
    dashboard: <Dashboard user={user} />,
    orders: <Orders user={user} />,
    received: <Received user={user} />,
    testing: <Testing user={user} />,
    approved: <Approved user={user} />,
    on_website: <OnWebsite user={user} />,
    audit_log: <AuditLog />,
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <NavBar user={user} onSwitch={handleSwitchUser} />
      <TabBar activeKey={activeTab} onChange={setActiveTab} counts={counts} />
      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        {views[activeTab]}
      </main>

      {/* Switch User Modal */}
      {showSwitchUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSwitchUser(false)} />
          <div className="relative">
            <UserPicker onSelect={handleSelectUser} />
          </div>
        </div>
      )}
    </div>
  )
}
