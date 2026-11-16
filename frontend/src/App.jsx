import React, { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  Heart,
  Search,
  Sparkles,
  SlidersHorizontal,
  Wrench,
  Menu,
  X,
  Mic,
  Scale,
  Lock,
  Bot,
  User,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { API_BASE_URL } from './config';
import ProductCard from './components/ProductCard';
import ChatWidget from './components/ChatWidget';
import PriceAnalyticsModal from './components/PriceAnalyticsModal';
import FixReporterModal from './components/FixReporterModal';
import CookieConsentBanner from './components/CookieConsentBanner';
import Interactive3DBackground from './components/Interactive3DBackground';
import LoadingScreen3D from './components/LoadingScreen3D';
import { AuthPage, ProfileDashboard } from './components/AuthAndProfile';
import {
  PrivacyPolicyPage,
  TermsAndConditionsPage,
  Custom404Page
} from './components/LegalAndErrorPages';
import { VersusModal, AdminPanelModal } from './components/AdvancedFeatures';
import {
  getMLProfile,
  recordUserInteraction,
  scoreProductForUser
} from './utils/mlEngine';

const CATEGORIES = ['All', 'Footwear', 'Beauty', 'Electronics', 'Apparel', 'Accessories'];

export default function App() {
  const [booting, setBooting] = useState(true);
  const [activePage, setActivePage] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('khojo_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authToast, setAuthToast] = useState('');
  const [mlProfile, setMlProfile] = useState(() => getMLProfile());

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingLive, setFetchingLive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [heroAiQuery, setHeroAiQuery] = useState('');
  const [sortBy, setSortBy] = useState('recommended');
  const [isListening, setIsListening] = useState(false);

  const [themeMode] = useState('teal_sage');

  const [activeAnalyticsProduct, setActiveAnalyticsProduct] = useState(null);
  const [reporterTargetProduct, setReporterTargetProduct] = useState(null);
  const [isReporterOpen, setIsReporterOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const [isVersusOpen, setIsVersusOpen] = useState(false);
  const [versusProducts, setVersusProducts] = useState([]);
  const [versusMismatchAlert, setVersusMismatchAlert] = useState('');

  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem('khojo_wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  const [priceAlerts, setPriceAlerts] = useState(() => {
    const saved = localStorage.getItem('khojo_price_alerts');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/login') {
      setActivePage('login');
    } else if (path && path !== '/' && !['/index.html'].includes(path)) {
      setActivePage('404');
    }
  }, []);

  useEffect(() => {
    if (!booting) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activePage, booting]);

  useEffect(() => {
    localStorage.setItem('khojo_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('khojo_price_alerts', JSON.stringify(priceAlerts));
  }, [priceAlerts]);

  const handleRecordInteraction = (payload) => {
    const updated = recordUserInteraction(payload);
    setMlProfile({ ...updated });
  };

  const toggleWishlist = (product) => {
    handleRecordInteraction({ type: 'wishlist', product });
    setWishlist((prev) => {
      const exists = prev.find((item) => item.id === product.id);
      if (exists) return prev.filter((item) => item.id !== product.id);
      return [...prev, product];
    });
  };

  const handleToggleVersusProduct = (product) => {
    if (!product) return;
    handleRecordInteraction({ type: 'click', product });

    const alreadyIn = versusProducts.some((p) => p.id === product.id);
    if (alreadyIn) {
      setVersusProducts((prev) => prev.filter((p) => p.id !== product.id));
      return;
    }

    if (versusProducts.length === 0) {
      setVersusProducts([product]);
      return;
    }

    const firstItem = versusProducts[0];
    if (
      String(firstItem.category).toLowerCase() !==
      String(product.category).toLowerCase()
    ) {
      setVersusMismatchAlert(
        `Please add items of the SAME category! Your first item "${firstItem.name}" belongs to "${firstItem.category}", so you cannot compare it with "${product.name}" ("${product.category}"). Please select another ${firstItem.category} item!`
      );
      return;
    }

    if (versusProducts.length === 1) {
      const nextPair = [firstItem, product];
      setVersusProducts(nextPair);
      setIsVersusOpen(true);
      return;
    }

    const nextPair = [firstItem, product];
    setVersusProducts(nextPair);
    setIsVersusOpen(true);
  };

  const handleSavePriceAlert = (alertObj) => {
    setPriceAlerts((prev) => {
      const filtered = prev.filter((a) => a.id !== alertObj.id);
      return [alertObj, ...filtered];
    });
  };

  const openFixReporter = (product = null) => {
    setReporterTargetProduct(product);
    setIsReporterOpen(true);
    setMobileMenuOpen(false);
  };

  const openVersusBattle = () => {
    setIsVersusOpen(true);
  };

  const startVoiceSearch = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice search requires Chrome or Edge.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      handleRecordInteraction({ type: 'search', query: transcript });
      setIsListening(false);
    };
    recognition.start();
  };

  const handleLiveWebDiscovery = async () => {
    if (!searchQuery.trim() || fetchingLive) return;
    handleRecordInteraction({ type: 'search', query: searchQuery.trim() });
    setFetchingLive(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/live-ingest?query=${encodeURIComponent(
          searchQuery.trim()
        )}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.products && data.products.length > 0) {
        setProducts((prev) => [...data.products, ...prev]);
        setSelectedCategory('All');
      }
    } catch (err) {
      console.error('Live discovery failed:', err);
    } finally {
      setFetchingLive(false);
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const categoryParam =
          selectedCategory === 'All'
            ? ''
            : `?category=${selectedCategory.toLowerCase()}`;
        const res = await fetch(`${API_BASE_URL}/api/products${categoryParam}`);
        const data = await res.json();
        setProducts(data.products || []);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [selectedCategory]);

  const displayedProducts = useMemo(() => {
    const baseList = activePage === 'wishlist' ? wishlist : products;

    const normalizeText = (str = '') =>
      String(str)
        .toLowerCase()
        .replace(/\./g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const filtered = baseList.filter((item) => {
      if (!searchQuery.trim()) return true;
      const cleanQuery = normalizeText(searchQuery);
      const queryWords = cleanQuery.split(' ').filter(Boolean);
      if (queryWords.length === 0) return true;

      const tagsText = Array.isArray(item.tags)
        ? item.tags.join(' ')
        : String(item.tags || '');

      const searchablePool = normalizeText(
        `${item.name || ''} ${item.brand || ''} ${item.platform || ''} ${
          item.category || ''
        } ${tagsText}`
      );

      return queryWords.every((word) => {
        if (searchablePool.includes(word)) return true;
        if (
          word.endsWith('s') &&
          word.length > 3 &&
          searchablePool.includes(word.slice(0, -1))
        ) {
          return true;
        }
        return false;
      });
    });

    const sorted = [...filtered];
    if (sortBy === 'recommended') {
      sorted.sort(
        (a, b) =>
          scoreProductForUser(b, mlProfile) - scoreProductForUser(a, mlProfile)
      );
    } else if (sortBy === 'price_asc') {
      sorted.sort((a, b) => Number(a.price_inr) - Number(b.price_inr));
    } else if (sortBy === 'price_desc') {
      sorted.sort((a, b) => Number(b.price_inr) - Number(a.price_inr));
    } else if (sortBy === 'rating') {
      sorted.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }
    return sorted;
  }, [activePage, wishlist, products, searchQuery, sortBy, mlProfile]);

  if (booting) {
    return (
      <LoadingScreen3D
        onComplete={() => {
          setBooting(false);
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0E1719] text-[#E5EFC1]">
      {/* Category Mismatch Popup Modal */}
      {versusMismatchAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-[#162427] border-2 border-[#39AEA9] p-6 text-center space-y-4 shadow-2xl shadow-[#39AEA9]/30">
            <div className="w-14 h-14 rounded-2xl bg-[#39AEA9]/20 border border-[#39AEA9] text-[#E5EFC1] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="font-harmond text-3xl font-bold text-[#E5EFC1]">
              Put Items of the Same Category!
            </h3>
            <p className="text-xs sm:text-sm text-[#A2D5AB] leading-relaxed">
              {versusMismatchAlert}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setVersusProducts([]);
                  setVersusMismatchAlert('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-[#A2D5AB]/40 text-xs font-semibold text-[#A2D5AB] hover:text-[#E5EFC1] cursor-pointer"
              >
                Reset Versus
              </button>
              <button
                onClick={() => setVersusMismatchAlert('')}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#39AEA9] to-[#A2D5AB] text-[#0E1719] font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-[#39AEA9]/25"
              >
                OK, Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Email Confirmation Toast */}
      {authToast && (
        <div className="fixed top-16 right-4 z-50 bg-[#162427] border border-[#A2D5AB] text-[#E5EFC1] px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#39AEA9] shrink-0" />
          <span>{authToast}</span>
        </div>
      )}

      {/* Sticky Header (#0E1719 + #557B83 + #39AEA9 + #A2D5AB + #E5EFC1) */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0E1719]/90 border-b border-[#557B83]/40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-2.5 sm:gap-3.5 cursor-pointer group"
            onClick={() => {
              setActivePage('home');
              setMobileMenuOpen(false);
            }}
          >
            <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-2xl p-[1.5px] bg-gradient-to-tr from-[#39AEA9] via-[#A2D5AB] to-[#E5EFC1] shadow-lg shadow-[#39AEA9]/25 group-hover:scale-105 transition-transform shrink-0">
              <div className="w-full h-full rounded-[14px] overflow-hidden bg-[#0E1719]">
                <img
                  src="/favicon.ico"
                  alt="Khojo AI"
                  className="w-full h-full object-cover scale-105"
                />
              </div>
            </div>
            <div>
              <h1 className="font-harmond text-xl sm:text-3xl font-bold tracking-wide leading-none text-[#E5EFC1]">
                Khojo{' '}
                <span className="italic bg-gradient-to-r from-[#E5EFC1] via-[#A2D5AB] to-[#39AEA9] bg-clip-text text-transparent">
                  AI
                </span>
              </h1>
              <p className="text-[8px] sm:text-[10px] uppercase tracking-[0.18em] text-[#A2D5AB] mt-0.5">
                Developed by <span className="font-bold">Sephali Singh</span>
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <div className="hidden md:flex items-center p-1 rounded-2xl bg-[#162427] border border-[#557B83]/50">
            {[
              { id: 'home', label: 'AI Hub & Storefront', icon: Sparkles },
              { id: 'chat', label: 'Full-Screen Chatbot', icon: Bot },
              { id: 'profile', label: 'My Account', icon: User }
            ].map((nav) => {
              const Icon = nav.icon;
              const active = activePage === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActivePage(nav.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-[#39AEA9] to-[#A2D5AB] text-[#0E1719] shadow-md shadow-[#39AEA9]/25'
                      : 'text-[#A2D5AB] hover:text-[#E5EFC1]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{nav.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={openVersusBattle}
              className="relative hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#557B83]/60 bg-[#162427] hover:border-[#A2D5AB] text-[#E5EFC1] text-xs font-semibold cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5 text-[#39AEA9]" />
              <span>Versus ({versusProducts.length}/2)</span>
            </button>

            <button
              onClick={() => openFixReporter(null)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#39AEA9]/20 border border-[#39AEA9]/50 hover:bg-[#39AEA9] text-[#E5EFC1] hover:text-[#0E1719] text-xs font-bold transition-all cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Report Fix</span>
            </button>

            {user ? (
              <button
                onClick={() => setActivePage('profile')}
                className="px-2.5 sm:px-3 py-2 rounded-xl border border-[#A2D5AB]/40 bg-[#162427] hover:border-[#39AEA9] text-[#E5EFC1] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="w-5 h-5 rounded-full bg-[#39AEA9] text-[#0E1719] font-extrabold flex items-center justify-center text-[10px]">
                  {user.name[0]}
                </span>
                <span className="hidden sm:inline">{user.name}</span>
              </button>
            ) : (
              <button
                onClick={() => setActivePage('login')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer ${
                  activePage === 'login'
                    ? 'bg-[#E5EFC1] text-[#0E1719]'
                    : 'bg-gradient-to-r from-[#39AEA9] to-[#A2D5AB] text-[#0E1719] shadow-[#39AEA9]/25'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            <button
              onClick={() =>
                setActivePage(activePage === 'wishlist' ? 'home' : 'wishlist')
              }
              className="relative p-2 sm:p-2.5 rounded-xl border border-[#557B83]/60 bg-[#162427] text-[#E5EFC1] hover:border-[#39AEA9] cursor-pointer"
            >
              <Heart
                className={`w-4 h-4 ${
                  activePage === 'wishlist' ? 'fill-[#39AEA9] text-[#39AEA9]' : ''
                }`}
              />
              {wishlist.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#39AEA9] text-[#0E1719] text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border border-[#557B83]/60 bg-[#162427] text-[#E5EFC1] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#557B83]/40 bg-[#162427] px-4 py-3 space-y-2.5 animate-fadeIn">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'home', label: 'AI Hub' },
                { id: 'chat', label: 'Chatbot' },
                { id: 'profile', label: 'Account' },
                { id: 'login', label: 'Sign In' }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActivePage(t.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    activePage === t.id
                      ? 'bg-[#39AEA9] text-[#0E1719] border-[#E5EFC1]'
                      : 'bg-[#0E1719] text-[#A2D5AB] border-[#557B83]/40'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Router */}
      {activePage === 'login' ? (
        <AuthPage
          onBack={() => setActivePage('home')}
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setActivePage('home');
            setAuthToast(
              `Welcome ${loggedInUser.name}! Confirmation email sent to ${loggedInUser.email}.`
            );
            setTimeout(() => setAuthToast(''), 5000);
          }}
        />
      ) : activePage === 'privacy' ? (
        <PrivacyPolicyPage onBack={() => setActivePage('home')} themeMode={themeMode} />
      ) : activePage === 'terms' ? (
        <TermsAndConditionsPage onBack={() => setActivePage('home')} themeMode={themeMode} />
      ) : activePage === '404' ? (
        <Custom404Page
          onBack={() => setActivePage('home')}
          onOpenReporter={() => openFixReporter(null)}
        />
      ) : activePage === 'profile' ? (
        <ProfileDashboard
          user={user}
          mlProfile={mlProfile}
          onResetML={(fresh) => setMlProfile({ ...fresh })}
          onLogout={() => {
            localStorage.removeItem('khojo_user');
            setUser(null);
            setActivePage('login');
          }}
          wishlist={wishlist}
          priceAlerts={priceAlerts}
          onNavigate={(page) => setActivePage(page)}
        />
      ) : activePage === 'chat' ? (
        <div className="max-w-5xl mx-auto w-full px-3 sm:px-4 py-6 flex-1 animate-fadeIn">
          <ChatWidget
            embedded={true}
            user={user}
            mlProfile={mlProfile}
            catalogProducts={products}
            externalQuery={heroAiQuery}
            onClearExternalQuery={() => setHeroAiQuery('')}
            onRecordInteraction={handleRecordInteraction}
            wishlist={wishlist}
            versusProducts={versusProducts}
            toggleWishlist={toggleWishlist}
            onToggleVersus={handleToggleVersusProduct}
            onOpenAnalytics={(p) => setActiveAnalyticsProduct(p)}
            onOpenReporter={(p) => openFixReporter(p)}
          />
        </div>
      ) : (
        <>
          {activePage === 'home' && (
            <section className="relative overflow-hidden border-b border-[#557B83]/40 py-6 sm:py-10 px-3 sm:px-6 bg-gradient-to-b from-[#162427] via-[#111C1F] to-[#0E1719]">
              <Interactive3DBackground />

              <div className="relative z-10 max-w-7xl mx-auto space-y-5">
                {/* Top Heading & Interactive Vibe Switcher Pills */}
                <div className="text-center space-y-3 max-w-3xl mx-auto">
                  <div className="inline-flex items-center gap-2 bg-[#162427]/90 border border-[#39AEA9]/60 text-[#E5EFC1] text-[10px] sm:text-xs font-bold px-4 py-1.5 rounded-full tracking-widest uppercase shadow-lg shadow-[#39AEA9]/20">
                    <span className="w-2 h-2 rounded-full bg-[#39AEA9] animate-ping" />
                    <span>3D Interactive AI Shopping Concierge • Live Price Radar</span>
                  </div>

                  <h2 className="font-harmond text-4xl sm:text-6xl font-bold tracking-tight leading-none text-[#E5EFC1]">
                    Ask Khojo AI.{' '}
                    <span className="italic bg-gradient-to-r from-[#E5EFC1] via-[#A2D5AB] to-[#39AEA9] bg-clip-text text-transparent">
                      Shop Smarter.
                    </span>
                  </h2>

                  {/* 1-Click Interactive Shopping Vibe Starters */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    {[
                      { label: '🔥 Sneaker Drops < ₹5k', q: 'Sneakers under ₹5000' },
                      { label: '✨ Glass Skin Serums', q: 'Find me a good face serum' },
                      { label: '🎧 ANC Audio & Gaming', q: 'Noise cancelling headphones' },
                      { label: '👕 Streetwear & Polos', q: 'Show me U.S. Polo shirts' }
                    ].map((vibe) => (
                      <button
                        key={vibe.label}
                        onClick={() => setHeroAiQuery(vibe.q)}
                        className="px-3.5 py-1.5 rounded-full text-[11px] font-bold bg-[#162427]/90 hover:bg-[#39AEA9] text-[#E5EFC1] hover:text-[#0E1719] border border-[#A2D5AB]/35 hover:border-[#E5EFC1] transition-all cursor-pointer shadow-md hover:scale-105"
                      >
                        {vibe.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3-Column 3D Interactive Arena */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  {/* Left 3D Floating Shopping Vibe Cards */}
                  <div className="hidden lg:flex lg:col-span-3 flex-col gap-4">
                    <div
                      onClick={() => setHeroAiQuery('Sneakers under ₹5000')}
                      className="float-3d-left p-4 rounded-2xl bg-gradient-to-br from-[#1B2E32]/95 to-[#0E1719]/95 border border-[#39AEA9]/50 hover:border-[#E5EFC1] shadow-2xl cursor-pointer group transition-all"
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#39AEA9] mb-1.5">
                        <span>⚡ Live AI Vibe</span>
                        <span>Tap to Ask →</span>
                      </div>
                      <h4 className="font-harmond text-2xl font-bold text-[#E5EFC1] group-hover:text-[#A2D5AB] transition-colors">
                        Sneakerhead Radar
                      </h4>
                      <p className="text-xs text-[#A2D5AB] mt-1">
                        "Find me top-rated running & casual sneakers under ₹5,000"
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-[#E5EFC1] font-semibold">
                        <span>★ 4.7 Avg Rating</span>
                        <span>•</span>
                        <span>Up to 45% Off</span>
                      </div>
                    </div>

                    <div
                      onClick={() => setHeroAiQuery('Find me a good face serum')}
                      className="float-3d-left p-4 rounded-2xl bg-gradient-to-br from-[#162427]/95 to-[#0E1719]/95 border border-[#A2D5AB]/40 hover:border-[#E5EFC1] shadow-2xl cursor-pointer group transition-all"
                      style={{ animationDelay: '1.2s' }}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#A2D5AB] mb-1.5">
                        <span>✨ Beauty Concierge</span>
                        <span>Tap to Ask →</span>
                      </div>
                      <h4 className="font-harmond text-2xl font-bold text-[#E5EFC1] group-hover:text-[#A2D5AB] transition-colors">
                        Skincare & Glow Vault
                      </h4>
                      <p className="text-xs text-[#A2D5AB] mt-1">
                        "Compare Nykaa & Amazon prices on niacinamide & vitamin C serums"
                      </p>
                    </div>
                  </div>

                  {/* Center: Main Conversational AI Hub */}
                  <div className="lg:col-span-6">
                    <ChatWidget
                      embedded={true}
                      user={user}
                      mlProfile={mlProfile}
                      catalogProducts={products}
                      externalQuery={heroAiQuery}
                      onClearExternalQuery={() => setHeroAiQuery('')}
                      onRecordInteraction={handleRecordInteraction}
                      wishlist={wishlist}
                      versusProducts={versusProducts}
                      toggleWishlist={toggleWishlist}
                      onToggleVersus={handleToggleVersusProduct}
                      onOpenAnalytics={(p) => setActiveAnalyticsProduct(p)}
                      onOpenReporter={(p) => openFixReporter(p)}
                    />
                  </div>

                  {/* Right 3D Floating Live Deal Radar Cards */}
                  <div className="hidden lg:flex lg:col-span-3 flex-col gap-4">
                    <div
                      onClick={() => setHeroAiQuery('Noise cancelling headphones')}
                      className="float-3d-right p-4 rounded-2xl bg-gradient-to-bl from-[#1B2E32]/95 to-[#0E1719]/95 border border-[#A2D5AB]/40 hover:border-[#E5EFC1] shadow-2xl cursor-pointer group transition-all"
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#A2D5AB] mb-1.5">
                        <span>🎧 Audio & Gaming</span>
                        <span>Tap to Ask →</span>
                      </div>
                      <h4 className="font-harmond text-2xl font-bold text-[#E5EFC1] group-hover:text-[#39AEA9] transition-colors">
                        Pro Tech & ANC Gear
                      </h4>
                      <p className="text-xs text-[#A2D5AB] mt-1">
                        "Show me noise cancelling headphones & gaming gear deals"
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-[#E5EFC1] font-bold">
                        <span>🔥 Lowest 6-Month Price</span>
                      </div>
                    </div>

                    <div
                      onClick={openVersusBattle}
                      className="float-3d-right p-4 rounded-2xl bg-gradient-to-bl from-[#223B40]/95 to-[#0E1719]/95 border border-[#39AEA9]/60 hover:border-[#E5EFC1] shadow-2xl cursor-pointer group transition-all"
                      style={{ animationDelay: '1.5s' }}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#E5EFC1] mb-1.5">
                        <span>⚔️ Same-Category Battle</span>
                        <span>Launch →</span>
                      </div>
                      <h4 className="font-harmond text-2xl font-bold text-[#E5EFC1]">
                        AI Versus Arena ({versusProducts.length}/2)
                      </h4>
                      <p className="text-xs text-[#A2D5AB] mt-1">
                        Pick any 2 items of the same category to see AI Marks out of 100 & Worth-the-Money verdicts!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Product Catalog Grid */}
          <main className="max-w-7xl mx-auto w-full px-3.5 sm:px-6 py-7 flex-1 space-y-5 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-[#162427] border border-[#557B83]/50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-harmond text-2xl font-bold text-[#E5EFC1]">
                  {activePage === 'wishlist'
                    ? 'My Saved Wishlist'
                    : user
                    ? `Curated Deals for ${user.name}`
                    : 'Live Marketplace Catalog'}
                </h3>
                <p className="text-xs text-[#A2D5AB]">
                  Tap <strong>"+ Versus"</strong> on any two items of the same category to run an AI Head-to-Head Battle
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center flex-1 sm:w-72 px-3 py-2 rounded-xl bg-[#0E1719] border border-[#557B83]/60">
                  <Search className="w-4 h-4 text-[#A2D5AB] mr-2 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value.length > 3) {
                        handleRecordInteraction({
                          type: 'search',
                          query: e.target.value
                        });
                      }
                    }}
                    placeholder={
                      isListening ? 'Listening...' : 'Filter products or brands...'
                    }
                    className="w-full bg-transparent text-xs text-[#E5EFC1] placeholder-[#557B83] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={startVoiceSearch}
                    className="text-[#39AEA9] hover:scale-110 cursor-pointer ml-1"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={openVersusBattle}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#39AEA9] to-[#A2D5AB] text-[#0E1719] text-xs font-extrabold uppercase tracking-wider cursor-pointer shrink-0 shadow-md shadow-[#39AEA9]/25 flex items-center gap-1.5"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Versus ({versusProducts.length}/2)</span>
                </button>
              </div>
            </div>

            {/* Category & Sort Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      handleRecordInteraction({ type: 'category', category: cat });
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-gradient-to-r from-[#39AEA9] to-[#A2D5AB] text-[#0E1719] shadow-md shadow-[#39AEA9]/25'
                        : 'bg-[#162427] text-[#A2D5AB] border border-[#557B83]/50 hover:border-[#E5EFC1] hover:text-[#E5EFC1]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 text-xs">
                <SlidersHorizontal className="w-4 h-4 text-[#39AEA9]" />
                <span className="text-[#A2D5AB]">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#557B83]/60 bg-[#162427] text-[#E5EFC1] text-xs font-semibold focus:outline-none focus:border-[#39AEA9]"
                >
                  <option value="recommended">Recommended for You</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Top Customer Rated</option>
                </select>
              </div>
            </div>

            {/* Product Cards */}
            {loading && activePage !== 'wishlist' ? (
              <div className="py-24 flex flex-col items-center justify-center text-[#39AEA9] gap-3">
                <Loader2 className="w-9 h-9 animate-spin" />
                <p className="text-xs uppercase tracking-widest text-[#A2D5AB]">
                  Loading Live Inventory...
                </p>
              </div>
            ) : displayedProducts.length === 0 ? (
              <div className="py-20 text-center text-[#A2D5AB] text-sm space-y-4">
                <p className="max-w-md mx-auto">
                  No local items matched "{searchQuery}". Want Khojo AI to fetch it live from Amazon, Flipkart, Myntra & Nykaa?
                </p>
                {searchQuery && (
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleLiveWebDiscovery}
                      disabled={fetchingLive}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#39AEA9] to-[#A2D5AB] text-[#0E1719] text-xs font-extrabold uppercase tracking-wider cursor-pointer flex items-center gap-2"
                    >
                      {fetchingLive ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Fetching Live...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" /> Fetch "{searchQuery}" Live
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-4 py-2.5 rounded-xl border border-[#A2D5AB]/40 text-[#A2D5AB] text-xs font-bold uppercase cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
                {displayedProducts.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    isWishlisted={wishlist.some((w) => w.id === prod.id)}
                    isInVersus={versusProducts.some((v) => v.id === prod.id)}
                    onToggleWishlist={() => toggleWishlist(prod)}
                    onToggleVersus={(p) => handleToggleVersusProduct(p)}
                    onOpenAnalytics={(p) => setActiveAnalyticsProduct(p)}
                    onOpenReporter={(p) => openFixReporter(p)}
                    onProductInteract={(p) =>
                      handleRecordInteraction({ type: 'click', product: p })
                    }
                  />
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {/* Floating User-Controlled Versus Dock */}
      {versusProducts.length > 0 && !isVersusOpen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-xl rounded-2xl bg-[#162427]/95 backdrop-blur-xl border border-[#39AEA9] p-3 shadow-2xl shadow-black flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-[#39AEA9]/20 text-[#E5EFC1] shrink-0">
              <Scale className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A2D5AB] block">
                Versus Arena ({versusProducts[0].category}) • {versusProducts.length}/2 Selected
              </span>
              <p className="text-xs text-[#E5EFC1] truncate">
                {versusProducts.map((p) => p.name).join(' vs. ')}
                {versusProducts.length === 1 &&
                  ` — Pick 1 more ${versusProducts[0].category} item!`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setVersusProducts([])}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] text-[#A2D5AB] cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={() => setIsVersusOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#39AEA9] to-[#A2D5AB] text-[#0E1719] font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-[#39AEA9]/30"
            >
              {versusProducts.length === 2 ? 'Compare Now ⚡' : 'Pick 2nd Item'}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#557B83]/40 py-8 px-4 text-xs bg-[#0A1113] text-[#A2D5AB]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.ico" alt="Logo" className="w-5 h-5 rounded-md" />
            <span className="font-harmond text-lg text-[#E5EFC1] font-bold">
              Khojo AI
            </span>
            <span>© 2026 • Conversational AI & Price Intelligence Hub</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
            <button onClick={() => setActivePage('home')} className="hover:text-[#E5EFC1] cursor-pointer">
              AI Hub
            </button>
            <button onClick={() => setActivePage('login')} className="hover:text-[#E5EFC1] cursor-pointer">
              Sign In Page
            </button>
            <button onClick={() => setActivePage('profile')} className="hover:text-[#E5EFC1] cursor-pointer">
              My Account
            </button>
            <button onClick={() => setActivePage('privacy')} className="hover:text-[#E5EFC1] cursor-pointer">
              Privacy Policy
            </button>
            <button onClick={() => setActivePage('terms')} className="hover:text-[#E5EFC1] cursor-pointer">
              Terms
            </button>
            <button
              onClick={() => openFixReporter(null)}
              className="text-[#39AEA9] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" /> Report Fix
            </button>
            <button
              onClick={() => setIsAdminOpen(true)}
              className="text-[#A2D5AB] hover:text-[#E5EFC1] flex items-center gap-1 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" /> Secret Admin
            </button>
          </div>
        </div>
      </footer>

      {activeAnalyticsProduct && (
        <PriceAnalyticsModal
          product={activeAnalyticsProduct}
          onClose={() => setActiveAnalyticsProduct(null)}
          themeMode={themeMode}
          priceAlerts={priceAlerts}
          onSaveAlert={handleSavePriceAlert}
        />
      )}

      {isReporterOpen && (
        <FixReporterModal
          product={reporterTargetProduct}
          onClose={() => setIsReporterOpen(false)}
          themeMode={themeMode}
        />
      )}

      {isVersusOpen && (
        <VersusModal
          selectedProducts={versusProducts}
          catalogProducts={products}
          onUpdateVersus={(updatedList) => setVersusProducts(updatedList)}
          onClose={() => setIsVersusOpen(false)}
        />
      )}

      {isAdminOpen && (
        <AdminPanelModal
          onClose={() => setIsAdminOpen(false)}
          themeMode={themeMode}
        />
      )}

      <CookieConsentBanner onOpenPrivacy={() => setActivePage('privacy')} />
    </div>
  );
}