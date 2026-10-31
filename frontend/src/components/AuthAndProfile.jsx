import React, { useState } from 'react';
import {
  User,
  Lock,
  Mail,
  Heart,
  Bell,
  Clock,
  LogOut,
  X,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { getMLProfile, resetMLProfile } from '../utils/mlEngine';

export function LoginModal({ onClose, onLoginSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
    const payload = isSignUp
      ? { name, email, password, ml_profile: getMLProfile() }
      : { email, password };

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      localStorage.setItem('khojo_auth_token', data.token);
      localStorage.setItem('khojo_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      if (err.message.includes('Failed to fetch')) {
        const cleanName =
          name.trim() || (email.includes('@') ? email.split('@')[0] : 'Nikhil');
        const fallbackUser = {
          name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
          email: email.trim(),
          joinedAt: 'Nov 2026',
          tier: 'Verified Member'
        };
        localStorage.setItem('khojo_user', JSON.stringify(fallbackUser));
        onLoginSuccess(fallbackUser);
      } else {
        setErrorMsg(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nikhil@khojo.ai', password: 'demo1234' })
      });
      const data = await res.json();
      if (res.ok && data.user) {
        localStorage.setItem('khojo_auth_token', data.token);
        localStorage.setItem('khojo_user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
        return;
      }
    } catch {
      // Fallback
    } finally {
      setSubmitting(false);
    }

    const demoUser = {
      name: 'Nikhil',
      email: 'nikhil@khojo.ai',
      joinedAt: 'Nov 2026',
      tier: 'Verified Member'
    };
    localStorage.setItem('khojo_user', JSON.stringify(demoUser));
    onLoginSuccess(demoUser);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="card-3d-shell relative w-full max-w-md rounded-3xl bg-[#141418] border border-[#C0C0C8]/30 shadow-2xl overflow-hidden text-[#E2E8F0]">
        <div className="bg-gradient-to-r from-[#18181D] via-[#261215] to-[#18181D] border-b border-[#C0C0C8]/20 px-6 py-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-[0.22em] text-[#FF2A2A] font-bold block">
              Khojo AI Account
            </span>
            <h3 className="font-harmond text-3xl font-bold text-white">
              {isSignUp ? 'Create Your Account' : 'Sign In to Khojo AI'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-[#C0C0C8] leading-relaxed">
            Sign in to save your wishlist, manage active price drop alerts, and access personalized shopping deals across devices.
          </p>

          {isSignUp && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#C0C0C8] block mb-1">
                Your Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#C0C0C8] absolute left-3.5 top-3" />
                <input
                  type="text"
                  required={isSignUp}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nikhil"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0D0D10] border border-[#C0C0C8]/25 text-sm text-white focus:outline-none focus:border-[#FF2A2A]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#C0C0C8] block mb-1">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#C0C0C8] absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0D0D10] border border-[#C0C0C8]/25 text-sm text-white focus:outline-none focus:border-[#FF2A2A]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#C0C0C8] block mb-1">
              Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#C0C0C8] absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0D0D10] border border-[#C0C0C8]/25 text-sm text-white focus:outline-none focus:border-[#FF2A2A]"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FF2A2A]/15 border border-[#FF2A2A]/40 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#FF2A2A]/30 hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleQuickDemoLogin}
            className="w-full py-2.5 rounded-xl border border-[#C0C0C8]/30 bg-white/5 hover:bg-white/10 text-[#E2E8F0] font-semibold text-xs transition-all cursor-pointer"
          >
            ⚡ Instant 1-Click Demo Login (Nikhil)
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg('');
              }}
              className="text-xs text-[#C0C0C8] hover:text-[#FF2A2A] underline cursor-pointer"
            >
              {isSignUp
                ? 'Already have an account? Sign In'
                : 'New to Khojo AI? Create an Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ProfileDashboard({
  user,
  mlProfile,
  onResetML,
  onLogout,
  wishlist = [],
  priceAlerts = [],
  onNavigate
}) {
  const handleBackendLogout = async () => {
    const token = localStorage.getItem('khojo_auth_token');
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    } catch {
      // Ignore network error on logout
    }
    localStorage.removeItem('khojo_auth_token');
    localStorage.removeItem('khojo_user');
    onLogout();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8 animate-fadeIn">
      {/* User Account Banner */}
      <div className="card-3d-shell p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#16161B] via-[#211316] to-[#16161B] border border-[#C0C0C8]/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF2A2A] to-[#991B1B] flex items-center justify-center text-white font-harmond text-3xl font-bold shadow-lg shadow-[#FF2A2A]/30">
            {(user?.name || 'G')[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#FF2A2A]/20 text-[#FF2A2A] border border-[#FF2A2A]/40">
                {user ? 'Verified Member' : 'Guest Session'}
              </span>
              {user?.joinedAt && (
                <span className="text-xs text-[#C0C0C8]">
                  Member since {user.joinedAt}
                </span>
              )}
            </div>
            <h2 className="font-harmond text-3xl sm:text-4xl font-bold text-white mt-1">
              {user ? `${user.name}'s Account` : 'Guest Profile'}
            </h2>
            <p className="text-xs text-[#C0C0C8]">
              {user?.email || 'Sign in to sync your saved wishlist and price drop alerts across devices.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('chat')}
            className="px-4 py-2.5 rounded-xl bg-[#FF2A2A] text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg shadow-[#FF2A2A]/25"
          >
            Open AI Concierge
          </button>
          {user && (
            <button
              onClick={handleBackendLogout}
              className="px-4 py-2.5 rounded-xl border border-[#C0C0C8]/30 bg-zinc-900 hover:border-[#FF2A2A] text-xs font-semibold text-[#C0C0C8] hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          )}
        </div>
      </div>

      {/* Saved Alerts, Wishlist Summary & Recent Searches */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="card-3d-shell lg:col-span-7 p-6 rounded-3xl bg-[#141418] border border-[#C0C0C8]/25 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-[#FF2A2A]" />
              <div>
                <h3 className="font-harmond text-2xl font-bold text-white">
                  Active Price Drop Alerts ({priceAlerts.length})
                </h3>
                <p className="text-xs text-[#C0C0C8]">
                  Products you are tracking for instant price drops across Indian stores.
                </p>
              </div>
            </div>
          </div>

          {priceAlerts.length === 0 ? (
            <div className="py-10 text-center text-xs text-zinc-400">
              No active price alerts yet. Click "Compare" on any product card to set a target ₹ alert!
            </div>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {priceAlerts.map((alertItem, idx) => (
                <div
                  key={alertItem.id || idx}
                  className="p-3.5 rounded-2xl bg-[#0D0D10] border border-white/10 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#FF2A2A] font-bold block">
                      {alertItem.brand} • {alertItem.platform}
                    </span>
                    <h5 className="text-sm font-semibold text-white line-clamp-1">
                      {alertItem.name}
                    </h5>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-[#C0C0C8] block">
                      Target: <strong className="text-emerald-400">₹{alertItem.targetPrice}</strong>
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Current: ₹{alertItem.currentPrice}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div
              onClick={() => onNavigate('wishlist')}
              className="card-3d-shell p-5 rounded-3xl bg-[#141418] border border-[#C0C0C8]/25 hover:border-[#FF2A2A] transition-all cursor-pointer"
            >
              <Heart className="w-6 h-6 text-[#FF2A2A] mb-2" />
              <span className="text-2xl font-bold text-white block">{wishlist.length}</span>
              <span className="text-xs text-[#C0C0C8] flex items-center gap-1">
                Saved Wishlist <ExternalLink className="w-3 h-3" />
              </span>
            </div>

            <div
              onClick={() => onNavigate('home')}
              className="card-3d-shell p-5 rounded-3xl bg-[#141418] border border-[#C0C0C8]/25 hover:border-[#FF2A2A] transition-all cursor-pointer"
            >
              <Bell className="w-6 h-6 text-[#C0C0C8] mb-2" />
              <span className="text-2xl font-bold text-white block">{priceAlerts.length}</span>
              <span className="text-xs text-[#C0C0C8]">Tracked Deals</span>
            </div>
          </div>

          <div className="card-3d-shell p-6 rounded-3xl bg-[#141418] border border-[#C0C0C8]/25 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-harmond text-xl font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FF2A2A]" /> Recent Search History
              </h4>
              {(mlProfile?.searchHistory || []).length > 0 && (
                <button
                  onClick={() => {
                    const fresh = resetMLProfile();
                    onResetML(fresh);
                  }}
                  className="text-[11px] text-[#C0C0C8] hover:text-[#FF2A2A] flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {(mlProfile?.searchHistory || []).length === 0 ? (
              <p className="text-xs text-zinc-500">
                Your recent product searches and concierge questions will appear here.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {mlProfile.searchHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="px-3.5 py-2 rounded-xl bg-[#0D0D10] border border-white/5 flex items-center justify-between text-xs"
                  >
                    <span className="text-zinc-200 font-medium truncate">
                      "{item.query}"
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}