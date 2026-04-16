import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../shared/hooks/useAuth'
import './LoginPage.css'

const ROLE_CONFIG = {
  user: {
    label: 'Customer',
    gradient: 'gradient-customer',
    accent: '#F97316',
    icon: (
      <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
        <rect x="9" y="11" width="14" height="10" rx="2"/>
        <circle cx="12" cy="16" r="1"/>
      </svg>
    ),
    features: [
      { icon: '📍', text: 'Real-time driver tracking' },
      { icon: '⚡', text: 'Instant delivery alerts' },
      { icon: '🛡️', text: 'Secure & reliable' },
    ],
  },
  driver: {
    label: 'Driver',
    gradient: 'gradient-driver',
    accent: '#3B82F6',
    icon: (
      <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13"/>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
    features: [
      { icon: '📊', text: 'Earnings dashboard' },
      { icon: '🗺️', text: 'Optimized route guidance' },
      { icon: '📱', text: 'One-tap status updates' },
    ],
  },
  admin: {
    label: 'Administrator',
    gradient: 'gradient-admin',
    accent: '#6366F1',
    icon: (
      <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
    features: [
      { icon: '📡', text: 'Live fleet monitoring' },
      { icon: '🔔', text: 'Alert management' },
      { icon: '📈', text: 'Analytics & reports' },
    ],
  },
} as const

type Role = keyof typeof ROLE_CONFIG

export default function LoginPage() {
  const { role } = useParams<{ role: string }>()
  const { login, isLoading, error } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')

  const validRoles: Role[] = ['user', 'driver', 'admin']
  const currentRole: Role = validRoles.includes(role as Role) ? (role as Role) : 'user'
  const config = ROLE_CONFIG[currentRole]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    try {
      await login(email, password, currentRole)
      if (currentRole === 'admin') navigate('/admin/dashboard')
      else if (currentRole === 'driver') navigate('/driver/dashboard')
      else navigate('/user/dashboard')
    } catch (err: any) {
      setLocalError(err.message)
    }
  }

  return (
    <div className="login-root">
      {/* ── Left Panel (brand) ──────────────────────────────────────── */}
      <div className={`login-brand ${config.gradient}`}>
        <div className="login-brand-inner">
          {/* Logo */}
          <div className="login-logo">
            <div className="login-logo-icon">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                <rect x="9" y="11" width="14" height="10" rx="2"/>
                <circle cx="12" cy="16" r="1"/>
              </svg>
            </div>
            <span className="font-headline text-xl font-bold text-white tracking-tight">Deshipping</span>
          </div>

          {/* Tagline */}
          <div className="login-tagline">
            <h2 className="text-3xl font-bold text-white font-headline leading-tight">
              {currentRole === 'user' && 'Track every delivery,\nfrom pickup to door.'}
              {currentRole === 'driver' && 'Deliver smarter,\nearn faster.'}
              {currentRole === 'admin' && 'Command your fleet,\nin real-time.'}
            </h2>
            <p className="text-white/70 text-sm mt-3 leading-relaxed">
              {currentRole === 'user' && 'Real-time visibility into your driver\'s location, powered by Deshipping\'s live tracking infrastructure.'}
              {currentRole === 'driver' && 'Accept orders, navigate routes, and manage deliveries — all from one intuitive dashboard.'}
              {currentRole === 'admin' && 'Monitor your entire delivery network with live alerts, playback, and performance analytics.'}
            </p>
          </div>

          {/* Features */}
          <ul className="login-features">
            {config.features.map((f, i) => (
              <li key={i} className="login-feature-item" style={{animationDelay: `${i * 80 + 200}ms`}}>
                <span className="text-lg">{f.icon}</span>
                <span className="text-white text-sm font-medium">{f.text}</span>
              </li>
            ))}
          </ul>

          {/* Ambient orbs */}
          <div className="login-orb login-orb-1" />
          <div className="login-orb login-orb-2" />
        </div>
      </div>

      {/* ── Right Panel (form) ─────────────────────────────────────── */}
      <div className="login-form-panel">
        <div className="login-form-inner">

          {/* Role tabs */}
          <div className="login-role-tabs">
            {(['user', 'driver', 'admin'] as Role[]).map(r => (
              <button
                key={r}
                onClick={() => {
                  if (r !== currentRole) {
                    navigate(`/login/${r}`)
                  }
                }}
                className={`login-role-tab ${r === currentRole ? 'active' : ''}`}
                style={{ '--tab-accent': ROLE_CONFIG[r].accent } as React.CSSProperties}
              >
                {r === 'user' && (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                    <rect x="9" y="11" width="14" height="10" rx="2"/>
                    <circle cx="12" cy="16" r="1"/>
                  </svg>
                )}
                {r === 'driver' && (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13"/>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                )}
                {r === 'admin' && (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                )}
                <span>{ROLE_CONFIG[r].label}</span>
              </button>
            ))}
          </div>

          {/* Form header */}
          <div className="login-form-header">
            <h1 className="font-headline text-2xl font-bold text-surface-900">Welcome back</h1>
            <p className="text-sm text-surface-500 mt-1.5">Sign in to your {config.label.toLowerCase()} account</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="form-input"
                />
              </div>
            </div>

            {(localError || error) && (
              <div className="form-error">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {localError || error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="login-submit-btn"
              style={{ background: config.accent }}
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="login-demo">
            <div className="login-demo-title">
              <svg className="w-3.5 h-3.5 text-surface-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Demo Accounts
            </div>
            <div className="login-accounts">
              <div className="login-account">
                <span className="login-account-dot" style={{ background: '#F97316' }}/>
                <span className="text-xs text-surface-600">user1@demo.com — Customer</span>
              </div>
              <div className="login-account">
                <span className="login-account-dot" style={{ background: '#3B82F6' }}/>
                <span className="text-xs text-surface-600">driver1@demo.com — Driver</span>
              </div>
              <div className="login-account">
                <span className="login-account-dot" style={{ background: '#6366F1' }}/>
                <span className="text-xs text-surface-600">admin@demo.com — Admin</span>
              </div>
            </div>
            <p className="text-xs text-surface-400 mt-2 text-center">Password for all: <code className="bg-surface-100 px-1.5 py-0.5 rounded text-surface-600 font-mono">demo123</code></p>
          </div>
        </div>
      </div>
    </div>
  )
}
