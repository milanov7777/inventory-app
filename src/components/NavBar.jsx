const today = () => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  }).format(new Date())
}

export default function NavBar({ user, onSwitch }) {
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div>
          <span className="font-bold text-gray-900 text-lg">Inventory Tracker</span>
          <span className="hidden sm:inline text-xs text-gray-400 ml-3">{today()}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{user}</span>
        </span>
        <button
          onClick={onSwitch}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Switch
        </button>
      </div>
    </nav>
  )
}
