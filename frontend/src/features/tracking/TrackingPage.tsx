import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TrackingMap } from './TrackingMap'
import { useTrackingStore } from './trackingStore'
import { useAlertStore } from './alertStore'
import { useWebSocket } from '../../shared/hooks/useWebSocket'
import { useAuth } from '../../shared/hooks/useAuth'
import { Badge } from '../../components/ui/Badge'
import type { WebSocketMessage } from '../../shared/types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const WS_URL   = import.meta.env.VITE_WS_URL  || 'ws://localhost:8080/ws/tracking'

function formatETA(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function TrackingPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const id = orderId ?? ''

  const { accessToken, isLoading: authLoading } = useAuth()
  const { setRoutePoints } = useTrackingStore()
  const [, setOrderStatus] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const { setPosition, update, addPathPoint, etaSeconds, distanceKm, speed, driverPosition, driverId, setDriverId } = useTrackingStore()
  const { alerts } = useAlertStore()

  // ── Fetch order details (route_points) on mount ────────────────────────
  useEffect(() => {
    if (!id || !accessToken || authLoading) return

    const fetchOrder = async () => {
      setFetchError(null)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

      try {
        const res = await fetch(`${API_BASE}/api/orders/${id}`, { headers })
        if (res.ok) {
          const data = await res.json()
          setOrderStatus(data.status ?? null)
          if (data.route_points) {
            setRoutePoints(data.route_points as [number, number][])
          }
        } else if (res.status === 401) {
          setFetchError('Authentication required. Please refresh the page.')
        } else {
          setFetchError('Failed to load order details.')
        }
      } catch {
        // non-fatal – WS will still work
      }
    }

    fetchOrder()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, accessToken, authLoading])

  // ── WebSocket auth + subscribe ─────────────────────────────────────────
  const handleMessage = useCallback((data: WebSocketMessage) => {
    // Detect delivered status from location_update payload
    if (data.type === 'location_update') {
      const { latitude, longitude, speed: spd, eta_seconds, distance_km, driver_id } = data.payload
      setPosition(latitude, longitude)
      update({ speed: spd, etaSeconds: eta_seconds, distanceKm: distance_km })
      addPathPoint(latitude, longitude)
      if (driver_id && !driverId) setDriverId(driver_id)
      // If no more distance, treat as delivered
      if (distance_km === 0) setOrderStatus('DELIVERED')
    } else if (data.type === 'alert') {
      useAlertStore.getState().addAlert(data.payload)
    }
  }, [setPosition, update, addPathPoint, driverId, setDriverId])

  useWebSocket({
    url: WS_URL,
    onMessage: handleMessage,
    authToken: accessToken ?? undefined,
    orderId: id || undefined,
    enabled: !!accessToken && !authLoading,
  })

  const isActive = !!driverPosition

  return (
    <div className="page-container max-w-2xl mx-auto">

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <div className="mb-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">
              {isActive ? 'Your Order is On the Way' : 'Waiting for Driver…'}
            </h1>
            <p className="text-sm text-surface-500 mt-1">
              {isActive
                ? 'Real-time tracking powered by Deshipping'
                : 'Your driver will begin the delivery shortly'}
            </p>
          </div>
          <Badge variant={isActive ? 'success' : 'neutral'} dot>
            {isActive ? 'Live' : 'Standby'}
          </Badge>
        </div>
      </div>

      {/* ── Metric Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-5 animate-slide-up">
        {/* ETA */}
        <div className="card-body text-center border border-surface-100 rounded-xl">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-50 mx-auto mb-2">
            <svg className="w-4.5 h-4.5 text-brand-500" style={{width:18,height:18}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="text-xl font-bold text-surface-900">{formatETA(etaSeconds)}</div>
          <div className="text-xs font-medium text-surface-500 mt-0.5">ETA</div>
        </div>

        {/* Distance */}
        <div className="card-body text-center border border-surface-100 rounded-xl">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 mx-auto mb-2">
            <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div className="text-xl font-bold text-surface-900">{distanceKm.toFixed(1)} km</div>
          <div className="text-xs font-medium text-surface-500 mt-0.5">Distance</div>
        </div>

        {/* Speed */}
        <div className="card-body text-center border border-surface-100 rounded-xl">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 mx-auto mb-2">
            <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 0 20"/>
              <path d="M12 12l4-8"/>
              <path d="M12 2v4"/>
            </svg>
          </div>
          <div className="text-xl font-bold text-surface-900">{speed.toFixed(0)} km/h</div>
          <div className="text-xs font-medium text-surface-500 mt-0.5">Speed</div>
        </div>
      </div>

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden shadow-card border border-surface-100 mb-5 animate-slide-up" style={{animationDelay:'80ms'}}>
        <div className="h-1 bg-gradient-to-r from-brand-400 to-brand-600"/>
        <TrackingMap />
        <div className="px-4 py-2.5 bg-surface-50 border-t border-surface-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-surface-300'}`}/>
            <span className="text-xs font-medium text-surface-600">
              {isActive ? 'Driver location updated live' : 'Awaiting driver position'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-surface-400">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
              Live
            </span>
            <span>Deshipping</span>
          </div>
        </div>
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="space-y-3 animate-fade-in" style={{animationDelay:'160ms'}}>
          <h2 className="section-title flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Recent Alerts
            <span className="ml-auto text-xs font-semibold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{alerts.length}</span>
          </h2>
          {alerts.map((alert, idx) => (
            <div key={alert.alert_id ?? idx} className={`alert-${alert.severity?.toLowerCase() ?? 'low'} rounded-xl p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    alert.severity === 'HIGH' ? 'bg-red-100 text-red-600'
                    : alert.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-600'
                    : 'bg-blue-100 text-blue-600'
                  }`}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold capitalize">{alert.alert_type?.replace('_', ' ')}</p>
                    <p className="text-sm mt-0.5 opacity-90">{alert.message}</p>
                  </div>
                </div>
                <span className="text-2xs font-medium opacity-60 whitespace-nowrap mt-1">
                  {alert.driver_id}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!isActive && alerts.length === 0 && (
        <div className="text-center py-16 animate-fade-in">
          {authLoading ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <svg className="w-8 h-8 text-surface-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-surface-700 mb-1">Loading...</h3>
              <p className="text-sm text-surface-500">Please wait while we connect.</p>
            </>
          ) : fetchError ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4m0 4h.01"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-surface-700 mb-1">Unable to Load Order</h3>
              <p className="text-sm text-surface-500 max-w-xs mx-auto">{fetchError}</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-surface-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                  <rect x="9" y="11" width="14" height="10" rx="2"/>
                  <circle cx="12" cy="16" r="1"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-surface-700 mb-1">Delivery Starting Soon</h3>
              <p className="text-sm text-surface-500 max-w-xs mx-auto">
                Your order details will appear here once the driver begins the delivery.
              </p>
            </>
          )}
        </div>
      )}

      {/* Bottom padding for mobile safe area */}
      <div className="h-8"/>
    </div>
  )
}
