import { useState, useCallback } from 'react'
import { useAdminStore } from './adminStore'
import { TripPlayback } from './TripPlayback'
import { DriverAnalytics } from './DriverAnalytics'
import { ServiceHeatmap } from './ServiceHeatmap'
import { AlertFeed } from './AlertFeed'
import { useWebSocket } from '../../shared/hooks/useWebSocket'
import { useAuth } from '../../shared/hooks/useAuth'
import type { WebSocketMessage } from '../../shared/types'

type TabId = 'alerts' | 'playback' | 'analytics' | 'heatmap'

const NAV_ITEMS: { id: TabId; label: string; icon: React.ReactNode; badge?: string }[] = [
  {
    id: 'alerts',
    label: 'Live Alerts',
    badge: 'live',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
  {
    id: 'playback',
    label: 'Trip Playback',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Driver Analytics',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    id: 'heatmap',
    label: 'Service Heatmap',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
]

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws/tracking'

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('alerts')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { addAlert } = useAdminStore()
  const { accessToken, isLoading } = useAuth()

  const handleMessage = useCallback((data: WebSocketMessage) => {
    if (data.type === 'alert') {
      addAlert(data.payload as unknown as Parameters<typeof addAlert>[0])
    }
  }, [addAlert])

  useWebSocket({
    url: WS_URL,
    onMessage: handleMessage,
    authToken: accessToken ?? undefined,
    enabled: !isLoading && !!accessToken,
    onOpen: (ws: WebSocket) => {
      ws.send(JSON.stringify({ action: 'subscribe_alerts' }))
    },
  })

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">

      {/* ── Dark Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`flex flex-col bg-[#191b23] text-white transition-all duration-300 flex-shrink-0 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-admin-500 flex items-center justify-center flex-shrink-0 shadow-glow-indigo">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
              <rect x="9" y="11" width="14" height="10" rx="2"/>
              <circle cx="12" cy="16" r="1"/>
            </svg>
          </div>
          {!sidebarCollapsed && (
            <div>
              <span className="font-headline font-bold text-base tracking-tight">Deshipping</span>
              <p className="text-white/40 text-xs">Fleet Manager</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {NAV_ITEMS.map(item => {
              const isActive = activeTab === item.id
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                      isActive
                        ? 'bg-admin-500/20 text-admin-400 border border-admin-500/30'
                        : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <span className={`flex-shrink-0 ${isActive ? 'text-admin-400' : 'text-white/40 group-hover:text-white/70'}`}>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && (
                      <span className="flex-1 text-left">{item.label}</span>
                    )}
                    {!sidebarCollapsed && item.badge && (
                      <span className="flex items-center gap-1 text-2xs font-semibold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
                        {item.badge}
                      </span>
                    )}
                    {isActive && sidebarCollapsed && (
                      <span className="absolute left-0 w-0.5 h-8 bg-admin-500 rounded-r-full"/>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bottom: collapse toggle + status */}
        <div className="border-t border-white/10 p-3 space-y-2 flex-shrink-0">
          {/* Connection status */}
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse"/>
            {!sidebarCollapsed && (
              <span className="text-xs text-white/40">System Online</span>
            )}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors text-sm"
          >
            <svg className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-surface-100 flex items-center justify-between px-6 flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold text-surface-900 font-headline tracking-tight">
              {NAV_ITEMS.find(t => t.id === activeTab)?.label}
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              {activeTab === 'alerts' && 'Real-time safety & delivery alerts across the fleet'}
              {activeTab === 'playback' && 'Replay historical trip routes with live playback'}
              {activeTab === 'analytics' && 'Driver performance metrics and weekly breakdowns'}
              {activeTab === 'heatmap' && 'Delivery density across service zones'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Admin badge */}
            <div className="hidden sm:flex items-center gap-2 bg-admin-50 border border-admin-100 rounded-full px-3 py-1.5">
              <div className="w-6 h-6 rounded-full bg-admin-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
              </div>
              <span className="text-xs font-semibold text-admin-700">Fleet Admin</span>
            </div>

            {/* Timestamp */}
            <span className="text-xs text-surface-400 font-mono">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'alerts'    && <AlertFeed />}
          {activeTab === 'playback'  && <TripPlayback />}
          {activeTab === 'analytics' && <DriverAnalytics />}
          {activeTab === 'heatmap'   && <ServiceHeatmap />}
        </main>
      </div>
    </div>
  )
}
