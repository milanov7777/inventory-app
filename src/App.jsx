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
import Forecasting from './views/Forecasting.jsx'
import { useOrders } from './hooks/useOrders.js'
import { useReceived } from './hooks/useReceived.js'
import { useTesting } from './hooks/useTesting.js'
import { useApproved } from './hooks/useApproved.js'
import { useOnWebsite } from './hooks/useOnWebsite.js'
import { useAuditLog } from './hooks/useAuditLog.js'

function loadSession() {
  try { return JSON.parse(localStorage.getItem('inv_session')) } catch { return null }
}

export default function App() {
  const [session, setSession] = useState(loadSession)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showSwitchUser, setShowSwitchUser] = useState(false)

  const user = session?.username || null

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

  function handleSelectUser(name, role) {
    const sess = { username: name, role }
    localStorage.setItem('inv_session', JSON.stringify(sess))
    setSession(sess)
    setShowSwitchUser(false)
  }

  function handleSwitchUser() {
    localStorage.removeItem('inv_session')
    setSession(null)
  }

  if (!session) {
    return <UserPicker onSelect={handleSelectUser} />
  }

  const views = {
    dashboard: <Dashboard user={user} session={session} />,
    orders: <Orders user={user} session={session} />,
    received: <Received user={user} session={session} />,
    testing: <Testing user={user} session={session} />,
    approved: <Approved user={user} session={session} />,
    on_website: <OnWebsite user={user} session={session} />,
    forecasting: <Forecasting user={user} />,
    audit_log: <AuditLog />,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100">
      <NavBar user={user} role={session.role} onSwitch={handleSwitchUser} />
      <TabBar activeKey={activeTab} onChange={setActiveTab} counts={counts} />
      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        {views[activeTab]}
      </main>
    </div>
  )
}
