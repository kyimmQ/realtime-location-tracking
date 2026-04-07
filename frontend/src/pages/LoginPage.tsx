import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../shared/hooks/useAuth';
import './LoginPage.css';

const roleConfig = {
  user: { icon: '👤', label: 'Customer', gradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' },
  driver: { icon: '🚚', label: 'Driver', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  admin: { icon: '⚡', label: 'Administrator', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
};

export default function LoginPage() {
  const { role } = useParams<{ role: string }>();
  const { login, isLoading, error } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const validRoles = ['user', 'driver', 'admin'];
  const currentRole = validRoles.includes(role || '') ? role! : 'user';
  const config = roleConfig[currentRole as keyof typeof roleConfig];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    try {
      await login(email, password, currentRole);
      if (currentRole === 'admin') navigate('/admin/dashboard');
      else if (currentRole === 'driver') navigate('/driver/dashboard');
      else navigate('/user/dashboard');
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  return (
    <div className="login-page" data-role={currentRole}>
      <div className="login-card">
        <div className="logo">
          <div className="logo-icon">{config.icon}</div>
          <h1>Deshipping</h1>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span className="role-badge">
            <span className="dot"></span>
            {config.label} Portal
          </span>
        </div>

        <h2>Sign in to continue</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <span className="input-icon">✉️</span>
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <span className="input-icon">🔒</span>
          </div>

          {(localError || error) && (
            <div className="error-msg">
              <span>⚠️</span>
              {localError || error}
            </div>
          )}

          <button type="submit" disabled={isLoading}>
            {isLoading ? (
              <span>Signing in...</span>
            ) : (
              <span>Sign In {config.icon}</span>
            )}
          </button>
        </form>

        <div className="demo-hint">
          <div className="title">
            <span>📋</span> Demo Accounts
          </div>
          <div className="accounts">
            <div className="account">
              <span className="role-dot user"></span>
              <span>user1@demo.com — Customer</span>
            </div>
            <div className="account">
              <span className="role-dot driver"></span>
              <span>driver1@demo.com — Driver</span>
            </div>
            <div className="account">
              <span className="role-dot admin"></span>
              <span>admin@demo.com — Admin</span>
            </div>
          </div>
          <div className="password">
            Password for all accounts: <code>demo123</code>
          </div>
        </div>
      </div>
    </div>
  );
}
