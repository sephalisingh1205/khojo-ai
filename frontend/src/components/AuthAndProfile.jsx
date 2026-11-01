import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Lock,
  Mail,
  Phone,
  Heart,
  Bell,
  Clock,
  LogOut,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  KeyRound
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { supabase } from '../supabaseClient';
import { getMLProfile, resetMLProfile } from '../utils/mlEngine';
import Interactive3DBackground from './Interactive3DBackground';

export function AuthPage({ onBack, onLoginSuccess }) {
  // 'email' | 'phone' | 'google'
  const [authTab, setAuthTab] = useState('email');
  const [isSignUp, setIsSignUp] = useState(false);

  // Real User Inputs (No hardcoded demo names)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone + Email OTP Inputs
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [deliveryChannelMsg, setDeliveryChannelMsg] = useState('');
  const otpRefs = useRef([]);

  // Status States
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [emailReceipt, setEmailReceipt] = useState(null);

  // Check if user just returned from a Real Google OAuth Redirect
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const gUser = session.user;
        const displayName =
          gUser.user_metadata?.full_name ||
          gUser.email?.split('@')[0] ||
          'Verified User';

        // Trigger backend welcome email for Google OAuth user
        fetch(`${API_BASE_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: displayName,
            email: gUser.email,
            google_id: gUser.id,
            avatar_url: gUser.user_metadata?.avatar_url || '',
            ml_profile: getMLProfile()
          })
        })
          .then((r) => r.json())
          .then((data) => {
            if (data?.user) {
              localStorage.setItem('khojo_auth_token', session.access_token);
              localStorage.setItem('khojo_user', JSON.stringify(data.user));
              onLoginSuccess(data.user);
            }
          })
          .catch(() => {});
      }
    });
  }, [onLoginSuccess]);

  const finalizeLogin = (data) => {
    localStorage.setItem('khojo_auth_token', data.token);
    localStorage.setItem('khojo_user', JSON.stringify(data.user));
    setEmailReceipt({
      user: data.user,
      emailDelivered: data.email_sent,
      message: data.message
    });
    setTimeout(() => {
      onLoginSuccess(data.user);
    }, 2400);
  };

  // 1. REAL EMAIL & PASSWORD SIGNUP / LOGIN
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
    const payload = isSignUp
      ? {
          name: name.trim(),
          email: email.trim(),
          password,
          ml_profile: getMLProfile()
        }
      : { email: email.trim(), password };

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed. Please check your credentials.');
      }
      finalizeLogin(data);
    } catch (err) {
      setErrorMsg(
        err.message || 'Unable to connect to authentication server. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 2. REAL GOOGLE OAUTH 2.0 LOGIN
  const handleRealGoogleOAuth = async () => {
    setErrorMsg('');
    setSubmitting(true);

    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin
          }
        });
        if (error) throw error;
        return;
      } else {
        throw new Error(
          'To enable 1-click Google OAuth redirect, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, or use Email / Phone OTP login.'
        );
      }
    } catch (err) {
      setErrorMsg(err.message);
      setSubmitting(false);
    }
  };

  // 3. REAL PHONE / EMAIL OTP DISPATCH
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter your email address so we can send your OTP & login receipt.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digits,
          email: email.trim(),
          name: name.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not send OTP.');

      setDeliveryChannelMsg(
        data.message || `A 6-digit verification code has been sent to +91 ${digits} and ${email.trim()}.`
      );
      setOtpSent(true);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to dispatch OTP. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. REAL OTP VERIFICATION
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const code = otpDigits.join('');
    if (code.length < 6) {
      setErrorMsg('Please enter the complete 6-digit OTP code.');
      return;
    }

    const digits = phone.replace(/\D/g, '').slice(-10);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digits,
          otp: code,
          email: email.trim(),
          name: name.trim(),
          ml_profile: getMLProfile()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid or expired OTP.');
      finalizeLogin(data);
    } catch (err) {
      setErrorMsg(err.message || 'Invalid OTP code. Please check your inbox/SMS and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpInputChange = (index, val) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = clean;
    setOtpDigits(next);
    if (clean && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-70px)] flex items-center justify-center px-4 py-10 overflow-hidden bg-[#0E0E12]">
      <Interactive3DBackground />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-[#C0C0C8]/25 bg-[#141419]/95 backdrop-blur-2xl shadow-2xl card-3d-shell">
        {/* Left Branding Column */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#1A1A22] via-[#221216] to-[#111115] p-7 sm:p-10 border-b lg:border-b-0 lg:border-r border-[#C0C0C8]/20 flex flex-col justify-between">
          <div className="space-y-6">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C0C0C8] hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#FF2A2A]" /> Back to Storefront
            </button>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#FF2A2A]/20 text-[#FF2A2A] border border-[#FF2A2A]/40">
                <Sparkles className="w-3 h-3" /> Real-Time Account Vault
              </span>
              <h1 className="font-harmond text-4xl sm:text-5xl font-bold text-white mt-3 leading-none">
                Khojo <span className="italic text-[#FF2A2A]">AI</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#C0C0C8] mt-2 leading-relaxed">
                Where shopping made eazyyy. Sign in with your Google Account, Mobile OTP, or Email to sync your wishlist, price alerts, and receive instant login email confirmations.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  title: 'Google OAuth 2.0 & Mobile OTP',
                  desc: 'Secure authentication for every user across India.'
                },
                {
                  title: 'Real-Time Welcome Email',
                  desc: 'Instant confirmation email sent directly to your inbox on login.'
                },
                {
                  title: 'Personal Deal & Wishlist Sync',
                  desc: 'Access your saved items and price drop alerts from any device.'
                }
              ].map((feat, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-black/35 border border-white/10 flex items-start gap-3"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#FF2A2A] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white">{feat.title}</h4>
                    <p className="text-[11px] text-[#C0C0C8]">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-[#C0C0C8]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> 256-Bit Encrypted Auth
            </span>
            <span>Khojo AI Production</span>
          </div>
        </div>

        {/* Right Interactive Auth Panel */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          {emailReceipt ? (
            <div className="py-10 text-center space-y-5 animate-fadeIn">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <Mail className="w-10 h-10 animate-bounce" />
              </div>
              <span className="inline-block px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ✓ Authentication Verified
              </span>
              <h3 className="font-harmond text-4xl font-bold text-white">
                Welcome, {emailReceipt.user.name}!
              </h3>
              <p className="text-xs sm:text-sm text-[#C0C0C8] max-w-md mx-auto leading-relaxed">
                {emailReceipt.message}
              </p>
              <div className="p-4 rounded-2xl bg-[#0D0D10] border border-[#C0C0C8]/20 max-w-md mx-auto text-left text-xs space-y-1.5">
                <div className="flex justify-between text-[#C0C0C8]">
                  <span>Registered Email:</span>
                  <strong className="text-white">{emailReceipt.user.email}</strong>
                </div>
                <div className="flex justify-between text-[#C0C0C8]">
                  <span>Verification Method:</span>
                  <strong className="text-[#FF2A2A]">{emailReceipt.user.authMethod}</strong>
                </div>
                <div className="flex justify-between text-[#C0C0C8]">
                  <span>Email Confirmation:</span>
                  <strong className="text-emerald-400">
                    {emailReceipt.emailDelivered
                      ? 'Sent to Inbox ✓'
                      : 'Logged (Configure SMTP_EMAIL on Render)'}
                  </strong>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400">
                Redirecting you to Khojo AI...
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="font-harmond text-3xl sm:text-4xl font-bold text-white">
                  {authTab === 'google'
                    ? 'Sign In with Google'
                    : authTab === 'phone'
                    ? 'Mobile & Email OTP Login'
                    : isSignUp
                    ? 'Create Your Khojo AI Account'
                    : 'Sign In to Your Account'}
                </h2>
                <p className="text-xs text-[#C0C0C8] mt-1">
                  Select your preferred verification method below.
                </p>
              </div>

              {/* 3-Method Switcher Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-[#0D0D10] border border-[#C0C0C8]/20">
                {[
                  { id: 'email', label: 'Email & Password', icon: Mail },
                  { id: 'phone', label: 'Mobile OTP', icon: Phone },
                  { id: 'google', label: 'Google Auth', icon: Sparkles }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = authTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setAuthTab(tab.id);
                        setErrorMsg('');
                      }}
                      className={`py-2.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        active
                          ? 'bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] text-white shadow-md shadow-[#FF2A2A]/25'
                          : 'text-[#C0C0C8] hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: REAL EMAIL & PASSWORD FORM */}
              {authTab === 'email' && (
                <form onSubmit={handleEmailSubmit} className="space-y-4 animate-fadeIn">
                  {isSignUp && (
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#C0C0C8] block mb-1">
                        Full Name *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#C0C0C8] absolute left-3.5 top-3" />
                        <input
                          type="text"
                          required={isSignUp}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter your full name"
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
                        placeholder="name@example.com"
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
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
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

                  <div className="flex items-center justify-between pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setErrorMsg('');
                      }}
                      className="text-[#C0C0C8] hover:text-[#FF2A2A] underline cursor-pointer"
                    >
                      {isSignUp
                        ? 'Already registered? Sign In'
                        : 'Don’t have an account? Create one'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: REAL PHONE + EMAIL OTP FORM */}
              {authTab === 'phone' && (
                <div className="space-y-4 animate-fadeIn">
                  {!otpSent ? (
                    <form onSubmit={handleSendOTP} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[#C0C0C8] block mb-1">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your name"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0D10] border border-[#C0C0C8]/25 text-sm text-white focus:outline-none focus:border-[#FF2A2A]"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[#C0C0C8] block mb-1">
                            Email Address (For OTP & Receipt) *
                          </label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0D10] border border-[#C0C0C8]/25 text-sm text-white focus:outline-none focus:border-[#FF2A2A]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#C0C0C8] block mb-1">
                          Indian Mobile Number *
                        </label>
                        <div className="flex items-center rounded-xl bg-[#0D0D10] border border-[#C0C0C8]/25 overflow-hidden focus-within:border-[#FF2A2A]">
                          <span className="px-3.5 py-2.5 bg-white/5 text-xs font-bold text-[#C0C0C8] border-r border-[#C0C0C8]/20">
                            🇮🇳 +91
                          </span>
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="10-digit mobile number"
                            className="w-full px-3.5 py-2.5 bg-transparent text-sm text-white focus:outline-none tracking-wider"
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
                            <KeyRound className="w-4 h-4" />
                            <span>Send 6-Digit Verification OTP</span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOTP} className="space-y-4">
                      <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 leading-relaxed">
                        {deliveryChannelMsg}
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#C0C0C8] block mb-2">
                          Enter 6-Digit Verification Code
                        </label>
                        <div className="grid grid-cols-6 gap-2">
                          {otpDigits.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => (otpRefs.current[idx] = el)}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleOtpInputChange(idx, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                              className="w-full h-12 text-center text-lg font-bold rounded-xl bg-[#0D0D10] border border-[#C0C0C8]/30 text-white focus:outline-none focus:border-[#FF2A2A]"
                            />
                          ))}
                        </div>
                      </div>

                      {errorMsg && (
                        <div className="p-3 rounded-xl bg-[#FF2A2A]/15 border border-[#FF2A2A]/40 text-xs text-rose-300">
                          {errorMsg}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setOtpSent(false);
                            setOtpDigits(['', '', '', '', '', '']);
                            setErrorMsg('');
                          }}
                          className="px-4 py-3 rounded-xl border border-[#C0C0C8]/25 text-xs font-semibold text-[#C0C0C8] hover:text-white cursor-pointer"
                        >
                          Edit Details
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#FF2A2A]/30 cursor-pointer flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <span>Verify & Sign In</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 3: REAL GOOGLE OAUTH 2.0 */}
              {authTab === 'google' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-6 rounded-2xl bg-[#0D0D10] border border-[#C0C0C8]/20 text-center space-y-4">
                    <p className="text-xs text-[#C0C0C8] leading-relaxed">
                      Sign in securely using your Google account via OAuth 2.0. We will automatically send a login confirmation email to your Gmail address.
                    </p>

                    {errorMsg && (
                      <div className="p-3 rounded-xl bg-[#FF2A2A]/15 border border-[#FF2A2A]/40 text-xs text-rose-300 text-left">
                        {errorMsg}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleRealGoogleOAuth}
                      className="w-full py-3.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-lg transition-all cursor-pointer"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#EA4335"
                            d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 20.9 7.4 24 12 24z"
                          />
                        </svg>
                      )}
                      <span>Continue with Google</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const LoginModal = AuthPage;

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
      if (supabase) {
        await supabase.auth.signOut();
      }
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
      <div className="card-3d-shell p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#16161B] via-[#211316] to-[#16161B] border border-[#C0C0C8]/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF2A2A] to-[#991B1B] flex items-center justify-center text-white font-harmond text-3xl font-bold shadow-lg shadow-[#FF2A2A]/30">
            {(user?.name || 'U')[0].toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#FF2A2A]/20 text-[#FF2A2A] border border-[#FF2A2A]/40">
                {user ? user.tier || 'Verified Member' : 'Guest Session'}
              </span>
              {user?.authMethod && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ✓ {user.authMethod}
                </span>
              )}
            </div>
            <h2 className="font-harmond text-3xl sm:text-4xl font-bold text-white mt-1.5">
              {user ? `${user.name}'s Account` : 'Guest Profile'}
            </h2>
            <p className="text-xs text-[#C0C0C8]">
              {user?.email || 'Sign in to sync your saved wishlist and price drop alerts across devices.'}
              {user?.phone ? ` • ${user.phone}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!user ? (
            <button
              onClick={() => onNavigate('login')}
              className="px-5 py-2.5 rounded-xl bg-[#FF2A2A] text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg shadow-[#FF2A2A]/25"
            >
              Sign In / Register
            </button>
          ) : (
            <>
              <button
                onClick={() => onNavigate('chat')}
                className="px-4 py-2.5 rounded-xl bg-[#FF2A2A] text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg shadow-[#FF2A2A]/25"
              >
                Open AI Concierge
              </button>
              <button
                onClick={handleBackendLogout}
                className="px-4 py-2.5 rounded-xl border border-[#C0C0C8]/30 bg-zinc-900 hover:border-[#FF2A2A] text-xs font-semibold text-[#C0C0C8] hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </>
          )}
        </div>
      </div>

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