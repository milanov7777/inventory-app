const today = () => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  }).format(new Date())
}

export default function NavBar({ user, role, onSwitch }) {
  return (
    <nav className="bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 flex items-center justify-between shadow-lg shadow-brand-500/10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div>
          <span className="font-bold text-white text-lg">Inventory Tracker</span>
          <span className="hidden sm:inline text-xs text-brand-200 ml-3">{today()}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-brand-100 flex items-center gap-2">
          <span className="font-semibold text-white">{user}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${role === 'admin' ? 'bg-white/20 text-white' : 'bg-white/10 text-brand-200'}`}>
            {role === 'admin' ? 'Admin' : 'Viewer'}
          </span>
        </span>
        <button
          onClick={onSwitch}
          className="text-sm text-white/80 hover:text-white font-medium px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          Log Out
        </button>
      </div>
    </nav>
  )
}
