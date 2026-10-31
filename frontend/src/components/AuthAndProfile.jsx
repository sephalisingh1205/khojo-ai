import React, { useState } from 'react';
import {
  User,
  Lock,
  Mail,
  Sparkles,
  Brain,
  RotateCcw,
  Heart,
  Bell,
  Clock,
  LogOut,
  X,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { getTopUserInterests, resetMLProfile } from '../utils/mlEngine';

export function LoginModal({ onClose, onLoginSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanName =
      name.trim() ||
      (email.includes('@') ? email.split('@')[0] : 'Nikhil');
    const userObj = {
      name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
      email: email.trim() || 'member@khojo.ai',
      joinedAt: new Date().toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric'
      }),
      tier: 'Signal Red VIP'
    };
    localStorage.setItem('khojo_user', JSON.stringify(userObj));
    onLoginSuccess(userObj);
  };

  const handleQuickDemoLogin = () => {
    const demoUser = {
      name: 'Nikhil',
      email: 'nikhil@khojo.ai',
      joinedAt: 'Nov 2026',
      tier: 'Signal Red VIP'
    };
    localStorage.setItem('khojo_user', JSON.stringify(demoUser));
    onLoginSuccess(demoUser);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl bg-[#141418] border border-[#C0C0C8]/25 shadow-2xl overflow-hidden text-[#E2E8F0]">
        <div className="bg-gradient-to-r from-[#18181D] via-[#251215] to-[#18181D] border-b border-[#C0C0C8]/15 px-6 py-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-[0.22em] text-[#FF2A2A] font-bold block">
              Khojo AI Identity Vault
            </span>
            <h3 className="font-harmond text-3xl font-bold text-white">
              {isSignUp ? 'Create ML Profile' : 'Sign In to Khojo AI'}
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
            Sync your **Machine Learning Interest Vector**, conversational history, and cross-marketplace price drop alerts.
          </p>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#C0C0C8] block mb-1">
              Your Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#C0C0C8] absolute left-3.5 top-3" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nikhil"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0D0D10] border border-[#C0C0C8]/20 text-sm text-white focus:outline-none focus:border-[#FF2A2A]"
              />
            </div>
          </div>

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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0D0D10] border border-[#C0C0C8]/20 text-sm text-white focus:outline-none focus:border-[#FF2A2A]"
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0D0D10] border border-[#C0C0C8]/20 text-sm text-white focus:outline-none focus:border-[#FF2A2A]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF2A2A] to-[#D91B1B] text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#FF2A2A]/25 hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{isSignUp ? 'Initialize ML Account' : 'Sign In & Sync AI'}</span>
            <ArrowRight className="w-4 h-4" />
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
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-[#C0C0C8] hover:text-[#FF2A2A] underline cursor-pointer"
            >
              {isSignUp
                ? 'Already have an account? Sign In'
                : "New to Khojo AI? Create an ML Profile"}
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
  const interests = getTopUserInterests(mlProfile);
  const maxCatScore = Math.max(...Object.values(mlProfile?.categories || { a: 1 }), 1);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8 animate-fadeIn">
      {/* Top Profile Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#16161B] via-[#1F1518] to-[#16161B] border border-[#C0C0C8]/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF2A2A] to-[#991B1B] flex items-center justify-center text-white font-harmond text-3xl font-bold shadow-lg shadow-[#FF2A2A]/30">
            {(user?.name || 'G')[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#FF2A2A]/20 text-[#FF2A2A] border border-[#FF2A2A]/40">
                {user ? user.tier : 'Guest Session'}
              </span>
              <span className="text-xs text-[#C0C0C8]">
                {mlProfile?.totalInteractions || 0} ML Interactions Learned
              </span>
            </div>
            <h2 className="font-harmond text-3xl sm:text-4xl font-bold text-white mt-1">
              {user ? `${user.name}'s Personalization Vault` : 'Guest ML Profile'}
            </h2>
            <p className="text-xs text-[#C0C0C8]">
              {user?.email || 'Sign in to persist your ML recommendation weights across devices.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('chat')}
            className="px-4 py-2.5 rounded-xl bg-[#FF2A2A] text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg shadow-[#FF2A2A]/20"
          >
            Open AI Concierge
          </button>
          {user && (
            <button
              onClick={onLogout}
              className="px-4 py-2.5 rounded-xl border border-[#C0C0C8]/25 bg-zinc-900 hover:border-[#FF2A2A] text-xs font-semibold text-[#C0C0C8] hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          )}
        </div>
      </div>

      {/* ML Interest Weights & Search Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-6 rounded-3xl bg-[#141418] border border-[#C0C0C8]/20 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <Brain className="w-5 h-5 text-[#FF2A2A]" />
              <div>
                <h3 className="font-harmond text-2xl font-bold text-white">
                  Machine Learning Category Affinity
                </h3>
                <p className="text-xs text-[#C0C0C8]">
                  Khojo AI ranks inventory & chatbot suggestions using these real-time weights.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const fresh = resetMLProfile();
                onResetML(fresh);
              }}
              className="px-3 py-1.5 rounded-xl border border-white/15 bg-zinc-900 hover:border-[#FF2A2A] text-xs text-[#C0C0C8] flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset ML
            </button>
          </div>

          <div className="space-y-3">
            {Object.entries(mlProfile?.categories || {}).map(([cat, val]) => {
              const pct = Math.min(100, Math.round((val / maxCatScore) * 100));
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-white">{cat}</span>
                    <span className="text-[#C0C0C8]">{pct}% Affinity Weight</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-zinc-900 overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#C0C0C8] via-[#FF2A2A] to-[#FF6B6B] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#C0C0C8] block mb-2">
              Learned Search Keywords & Tags
            </span>
            <div className="flex flex-wrap gap-2">
              {interests.recentKeywords.length === 0 ? (
                <span className="text-xs text-zinc-500">
                  No keywords learned yet. Ask the AI Concierge for a product to train your profile!
                </span>
              ) : (
                interests.recentKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FF2A2A]/15 border border-[#FF2A2A]/40 text-white"
                  >
                    #{kw}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Saved Stats & Recent Queries */}
        <div className="lg:col-span-5 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div
              onClick={() => onNavigate('wishlist')}
              className="p-5 rounded-3xl bg-[#141418] border border-[#C0C0C8]/20 hover:border-[#FF2A2A] transition-all cursor-pointer"
            >
              <Heart className="w-6 h-6 text-[#FF2A2A] mb-2" />
              <span className="text-2xl font-bold text-white block">{wishlist.length}</span>
              <span className="text-xs text-[#C0C0C8]">Saved Wishlist Items</span>
            </div>

            <div className="p-5 rounded-3xl bg-[#141418] border border-[#C0C0C8]/20">
              <Bell className="w-6 h-6 text-[#C0C0C8] mb-2" />
              <span className="text-2xl font-bold text-white block">{priceAlerts.length}</span>
              <span className="text-xs text-[#C0C0C8]">Active Price Drop Alerts</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[#141418] border border-[#C0C0C8]/20 space-y-3">
            <h4 className="font-harmond text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FF2A2A]" /> Recent Conversational & Search Log
            </h4>
            {(mlProfile?.searchHistory || []).length === 0 ? (
              <p className="text-xs text-zinc-500">
                Your recent chatbot and inventory queries will appear here.
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