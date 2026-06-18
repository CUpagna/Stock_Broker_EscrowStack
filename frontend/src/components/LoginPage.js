import React, { useState } from 'react';
import './LoginPage.css';

const API = 'https://stock-broker-escrowstack.onrender.com';

export default function LoginPage({ onLogin }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot'
  const [form, setForm] = useState({ email: '', name: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showReset, setShowReset] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const clearMessages = () => { setError(''); setSuccess(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Login failed.'); return; }
      onLogin({ email: data.email, name: data.name, subscriptions: data.subscriptions, portfolio: data.portfolio, cash_balance: data.cash_balance });
    } catch {
      setError('Cannot connect to server. Make sure the backend is running.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!form.email || !form.name || !form.password || !form.confirmPassword) { setError('Please fill in all fields.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), name: form.name.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Registration failed.'); return; }
      setSuccess('Account created! You can now sign in.');
      setTab('login');
      setForm(f => ({ ...f, password: '', confirmPassword: '' }));
    } catch {
      setError('Cannot connect to server. Make sure the backend is running.');
    } finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!form.email) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.reset_token) {
        setResetToken(data.reset_token);
        setShowReset(true);
        setSuccess('Reset token generated! (Demo: token shown below. In production it would be emailed.)');
      } else {
        setSuccess(data.message);
      }
    } catch {
      setError('Cannot connect to server.');
    } finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!resetToken || !newPassword) { setError('Enter the reset token and new password.'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Reset failed.'); return; }
      setSuccess('Password reset! You can now sign in.');
      setTab('login');
      setShowReset(false);
      setResetToken('');
      setNewPassword('');
    } catch {
      setError('Cannot connect to server.');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-bg">
      <div className="grid-overlay" />
      <div className="login-card">
        <div className="login-logo">
          <div className="pulse-dot" />
          📈 TradeView
        </div>
        <div className="login-tagline">Real-time portfolio dashboard · $100,000 virtual cash to start</div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); clearMessages(); }}>Sign In</button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); clearMessages(); }}>Register</button>
          <button className={`auth-tab ${tab === 'forgot' ? 'active' : ''}`} onClick={() => { setTab('forgot'); clearMessages(); setShowReset(false); }}>Forgot Password</button>
        </div>

        {error && <div className="msg-error">{error}</div>}
        {success && <div className="msg-success">{success}</div>}

        {/* ── LOGIN TAB ── */}
        {tab === 'login' && (
          <form className="login-form" onSubmit={handleLogin}>
            <label className="field-label">Email address</label>
            <input className="field-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            <label className="field-label">Password</label>
            <input className="field-input" type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} required />
            <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign In →'}</button>
            <div className="login-hint">
              Demo: Register a new account, or use existing:<br />
              <span onClick={() => { set('email','alice@tradeview.com'); set('password','demo123'); }}>alice@tradeview.com</span>
              &nbsp;|&nbsp;
              <span onClick={() => { set('email','bob@tradeview.com'); set('password','demo123'); }}>bob@tradeview.com</span>
              <br/><small style={{color:'#666'}}>(password: demo123 — register first)</small>
            </div>
          </form>
        )}

        {/* ── REGISTER TAB ── */}
        {tab === 'register' && (
          <form className="login-form" onSubmit={handleRegister}>
            <label className="field-label">Full Name</label>
            <input className="field-input" type="text" placeholder="Your name" value={form.name} onChange={e => set('name', e.target.value)} required />
            <label className="field-label">Email address</label>
            <input className="field-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            <label className="field-label">Password</label>
            <input className="field-input" type="password" placeholder="Min. 6 characters" value={form.password} onChange={e => set('password', e.target.value)} required />
            <label className="field-label">Confirm Password</label>
            <input className="field-input" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} required />
            <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Creating account…' : 'Create Account →'}</button>
            <div className="login-hint">You'll receive $100,000 in virtual cash to start trading!</div>
          </form>
        )}

        {/* ── FORGOT PASSWORD TAB ── */}
        {tab === 'forgot' && !showReset && (
          <form className="login-form" onSubmit={handleForgot}>
            <label className="field-label">Email address</label>
            <input className="field-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send Reset Token →'}</button>
            <div className="login-hint">Enter your registered email to receive a password reset token.</div>
          </form>
        )}

        {tab === 'forgot' && showReset && (
          <form className="login-form" onSubmit={handleReset}>
            <label className="field-label">Reset Token</label>
            <input className="field-input" type="text" placeholder="Paste your token here" value={resetToken} onChange={e => setResetToken(e.target.value)} required />
            <label className="field-label">New Password</label>
            <input className="field-input" type="password" placeholder="Min. 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Resetting…' : 'Reset Password →'}</button>
          </form>
        )}
      </div>
    </div>
  );
}