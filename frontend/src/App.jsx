import React, { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  Heart,
  Search,
  Sparkles,
  TrendingDown,
  Bell,
  Layers,
  SlidersHorizontal,
  Wrench,
  Menu,
  X,
  Shield,
  Mic,
  Scale,
  Lock,
  Bot,
  User,
  Brain,
  ShoppingBag
} from 'lucide-react';
import { API_BASE_URL } from './config';
import ProductCard from './components/ProductCard';
import ChatWidget from './components/ChatWidget';
import PriceAnalyticsModal from './components/PriceAnalyticsModal';
import FixReporterModal from './components/FixReporterModal';
import CookieConsentBanner from './components/CookieConsentBanner';
import Interactive3DBackground from './components/Interactive3DBackground';
import { LoginModal, ProfileDashboard } from './components/AuthAndProfile';
import {
  PrivacyPolicyPage,
  TermsAndConditionsPage,
  Custom404Page
} from './components/LegalAndErrorPages';
import { VersusModal, AdminPanelModal } from './components/AdvancedFeatures';
import {
  getMLProfile,
  recordUserInteraction,
  scoreProductForUser,
  getTopUserInterests
} from './utils/mlEngine';

const CATEGORIES = ['All', 'Footwear', 'Beauty', 'Electronics', 'Apparel', 'Accessories'];

const PALETTE_MODES = [
  { id: 'charcoal', label: 'Charcoal Red' },
  { id: 'silver', label: 'Moonlit Silver' },
  { id: 'ivory', label: 'Editorial Light' }
];

export default function App() {
  const [booting, setBooting] = useState(true);

  // Navigation Views: 'home' (Central Chatbot + ML Feed) | 'chat' (Full AI Hub) | 'profile' | 'wishlist' | 'privacy' | 'terms' | '404'
  const [activePage, setActivePage] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // User Auth & ML Personalization State
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('khojo_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [mlProfile, setMlProfile] = useState(() => getMLProfile());

  // Catalog & Search States
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingLive, setFetchingLive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('ml_recommended');
  const [isListening, setIsListening] = useState(false);

  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('khojo_theme') || 'charcoal';
  });

  // Modals
  const [activeAnalyticsProduct, setActiveAnalyticsProduct] = useState(null);
  const [reporterTargetProduct, setReporterTargetProduct] = useState(null);
  const [isReporterOpen, setIsReporterOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isVersusOpen, setIsVersusOpen] = useState(false);
  const [versusProducts, setVersusProducts] = useState([]);

  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem('khojo_wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  const [priceAlerts, setPriceAlerts] = useState(() => {
    const saved = localStorage.getItem('khojo_price_alerts');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 950);
    const path = window.location.pathname;
    if (path && path !== '/' && !['/index.html'].includes(path)) {
      setActivePage('404');
    }
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('khojo_theme', themeMode);
  }, [themeMode]);

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
    if (displayedProducts.length >= 2) {
      setVersusProducts([displayedProducts[0], displayedProducts[1]]);
      setIsVersusOpen(true);
    } else if (products.length >= 2) {
      setVersusProducts([products[0], products[1]]);
      setIsVersusOpen(true);
    }
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

  // Filter & ML-Rank Inventory
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
    if (sortBy === 'ml_recommended') {
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

  const userInterests = useMemo(() => getTopUserInterests(mlProfile), [mlProfile]);

  const isLight = themeMode === 'ivory';
  const isSilver = themeMode === 'silver';

  const rootBg = isLight
    ? 'bg-[#F5F5F7] text-zinc-900'
    : isSilver
    ? 'bg-[#1C1D22] text-[#E2E8F0]'
    : 'bg-[#121215] text-[#E2E8F0]';

  // 3D Charcoal + Moonlit Silver + Signal Red Splash Loader
  if (booting) {
    return (
      <div className="fixed inset-0 z-50 bg-[#121215] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative w-20 h-20 rounded-3xl p-[2px] bg-gradient-to-tr from-[#FF2A2A] via-[#C0C0C8] to-[#FF2A2A] shadow-2xl shadow-[#FF2A2A]/30 animate-bounce">
          <div className="w-full h-full rounded-[22px] overflow-hidden bg-[#121215]">
            <img src="/favicon.ico" alt="Khojo AI" className="w-full h-full object-cover" />
          </div>
        </div>
        <h1 className="font-harmond text-4xl sm:text-5xl font-bold text-white mt-5 tracking-wide">
          Khojo{' '}
          <span className="italic bg-gradient-to-r from-[#C0C0C8] via-white to-[#FF2A2A] bg-clip-text text-transparent">
            AI
          </span>
        </h1>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#C0C0C8] mt-2">
          Loading Conversational AI & ML Inventory Engine...
        </p>
        <div className="w-48 h-1 rounded-full bg-zinc-800 overflow-hidden mt-5">
          <div className="h-full w-full bg-gradient-to-r from-[#C0C0C8] via-[#FF2A2A] to-[#C0C0C8] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${rootBg}`}>
      {/* Sticky Header: Charcoal Grey + Moonlit Silver + Signal Red */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#121215]/90 border-b border-[#C0C0C8]/20">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          {/* Logo */}
          <div
            className="flex items-center gap-3 sm:gap-4 cursor-pointer group"
            onClick={() => {
              setActivePage('home');
              setMobileMenuOpen(false);
            }}
          >
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-2xl p-[1.5px] bg-gradient-to-tr from-[#FF2A2A] via-[#C0C0C8] to-[#FF2A2A] shadow-lg shadow-[#FF2A2A]/20 group-hover:scale-105 transition-transform shrink-0">
              <div className="w-full h-full rounded-[14px] overflow-hidden bg-[#121215]">
                <img
                  src="/favicon.ico"
                  alt="Khojo AI"
                  className="w-full h-full object-cover scale-105"
                />
              </div>
            </div>
            <div>
              <h1 className="font-harmond text-2xl sm:text-4xl font-bold tracking-wide leading-none text-white">
                Khojo{' '}
                <span className="italic bg-gradient-to-r from-[#C0C0C8] via-white to-[#FF2A2A] bg-clip-text text-transparent">
                  AI
                </span>
              </h1>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-[#C0C0C8] mt-0.5">
                Charcoal • Moonlit Silver • Signal Red AI
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs (Chatbot Hub Priority) */}
          <div className="hidden md:flex items-center p-1 rounded-2xl bg-[#1A1A20] border border-[#C0C0C8]/20">
            {[
              { id: 'home', label: 'AI Hub & Storefront', icon: Sparkles },
              { id: 'chat', label: 'Full-Screen Chatbot', icon: Bot },
              { id: 'profile', label: 'ML Profile', icon: Brain }
            ].map((nav) => {
              const Icon = nav.icon;
              const active = activePage === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActivePage(nav.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] text-white shadow-md shadow-[#FF2A2A]/25'
                      : 'text-[#C0C0C8] hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{nav.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Controls: Login / Profile + Versus + Report + Wishlist */}
          <div className="flex items-center gap-2">
            <button
              onClick={openVersusBattle}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#C0C0C8]/30 bg-white/5 hover:border-white text-[#E2E8F0] text-xs font-semibold cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5 text-[#FF2A2A]" />
              <span>Versus</span>
            </button>

            <button
              onClick={() => openFixReporter(null)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF2A2A]/15 border border-[#FF2A2A]/40 hover:bg-[#FF2A2A] text-white text-xs font-bold transition-all cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Report Fix</span>
            </button>

            {/* User Login / Profile Trigger */}
            {user ? (
              <button
                onClick={() => setActivePage('profile')}
                className="px-3 py-2 rounded-xl border border-[#C0C0C8]/30 bg-[#1A1A22] hover:border-[#FF2A2A] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <span className="w-5 h-5 rounded-full bg-[#FF2A2A] text-white flex items-center justify-center text-[10px]">
                  {user.name[0]}
                </span>
                <span className="hidden sm:inline">{user.name}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-[#FF2A2A]/20 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            <button
              onClick={() =>
                setActivePage(activePage === 'wishlist' ? 'home' : 'wishlist')
              }
              className="relative p-2.5 rounded-xl border border-[#C0C0C8]/25 bg-[#1A1A20] text-[#E2E8F0] hover:border-[#FF2A2A] cursor-pointer"
            >
              <Heart
                className={`w-4 h-4 ${
                  activePage === 'wishlist' ? 'fill-[#FF2A2A] text-[#FF2A2A]' : ''
                }`}
              />
              {wishlist.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#FF2A2A] text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl border border-[#C0C0C8]/25 bg-[#1A1A20] text-white cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#C0C0C8]/20 bg-[#141418] px-4 py-4 space-y-3 animate-fadeIn">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'home', label: 'AI Hub' },
                { id: 'chat', label: 'Full Chat' },
                { id: 'profile', label: 'ML Profile' }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActivePage(t.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    activePage === t.id
                      ? 'bg-[#FF2A2A] text-white border-[#FF2A2A]'
                      : 'bg-zinc-900 text-[#C0C0C8] border-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Route Views */}
      {activePage === 'privacy' ? (
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
          }}
          wishlist={wishlist}
          priceAlerts={priceAlerts}
          onNavigate={(page) => setActivePage(page)}
        />
      ) : activePage === 'chat' ? (
        <div className="max-w-6xl mx-auto w-full px-4 py-8 flex-1 animate-fadeIn">
          <ChatWidget
            embedded={true}
            user={user}
            mlProfile={mlProfile}
            onRecordInteraction={handleRecordInteraction}
            wishlist={wishlist}
            toggleWishlist={toggleWishlist}
            onOpenAnalytics={(p) => setActiveAnalyticsProduct(p)}
            onOpenReporter={(p) => openFixReporter(p)}
          />
        </div>
      ) : (
        <>
          {/* HERO SECTION WITH 3D WEBGL-STYLE CANVAS & CENTRAL CONVERSATIONAL HUB */}
          {activePage === 'home' && (
            <section className="relative overflow-hidden border-b border-[#C0C0C8]/20 py-10 sm:py-14 px-4 bg-gradient-to-b from-[#17171D] via-[#121216] to-[#0E0E12]">
              <Interactive3DBackground />

              <div className="relative z-10 max-w-5xl mx-auto space-y-8">
                <div className="text-center space-y-4">
                  <span className="inline-flex items-center gap-2 bg-[#1C1C24]/90 border border-[#C0C0C8]/30 text-[#E2E8F0] text-[10px] sm:text-xs font-semibold px-4 py-1.5 rounded-full tracking-widest uppercase">
                    <Sparkles className="w-3.5 h-3.5 text-[#FF2A2A]" />
                    Chatbot-First Commerce • Instant Policy Engine • ML Product Ranking
                  </span>

                  <h2 className="font-harmond text-4xl sm:text-6xl font-bold tracking-tight leading-none text-white">
                    Ask Khojo AI.{' '}
                    <span className="italic bg-gradient-to-r from-[#C0C0C8] via-white to-[#FF2A2A] bg-clip-text text-transparent">
                      Shop Smarter.
                    </span>
                  </h2>

                  <p className="text-[#C0C0C8] text-xs sm:text-base max-w-2xl mx-auto">
                    This system answers repetitive support questions, searches through live inventory data, and makes personalized Machine Learning product recommendations.
                  </p>
                </div>

                {/* CENTRAL FOCUS: EMBEDDED CONVERSATIONAL AI COMMAND CENTER */}
                <ChatWidget
                  embedded={true}
                  user={user}
                  mlProfile={mlProfile}
                  onRecordInteraction={handleRecordInteraction}
                  wishlist={wishlist}
                  toggleWishlist={toggleWishlist}
                  onOpenAnalytics={(p) => setActiveAnalyticsProduct(p)}
                  onOpenReporter={(p) => openFixReporter(p)}
                />
              </div>
            </section>
          )}

          {/* PERSONALIZED ML INVENTORY & INTERACTIVE COMPARISON GRID */}
          <main className="max-w-7xl mx-auto w-full px-3.5 sm:px-6 py-8 flex-1 space-y-6 animate-fadeIn">
            {/* ML Personalization Status Bar */}
            <div className="p-4 rounded-2xl bg-[#18181E] border border-[#C0C0C8]/20 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#FF2A2A]/15 border border-[#FF2A2A]/40 text-[#FF2A2A]">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-harmond text-xl font-bold text-white">
                    {user ? `Recommended for ${user.name}` : 'ML Personalized Inventory Feed'}
                  </h3>
                  <p className="text-xs text-[#C0C0C8]">
                    Prioritizing <strong>{userInterests.topCategory}</strong>
                    {userInterests.recentKeywords.length > 0 &&
                      ` & recent searches (${userInterests.recentKeywords
                        .slice(0, 3)
                        .map((k) => `"${k}"`)
                        .join(', ')})`}
                  </p>
                </div>
              </div>

              {/* Instant Inventory Search & Voice Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center flex-1 sm:w-72 px-3 py-2 rounded-xl bg-[#101014] border border-[#C0C0C8]/25">
                  <Search className="w-4 h-4 text-[#C0C0C8] mr-2 shrink-0" />
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
                    placeholder="Filter inventory or speak..."
                    className="w-full bg-transparent text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={startVoiceSearch}
                    className="text-[#FF2A2A] hover:scale-110 cursor-pointer ml-1"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={openVersusBattle}
                  className="px-3.5 py-2 rounded-xl bg-[#FF2A2A] text-white text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0 shadow-md shadow-[#FF2A2A]/20"
                >
                  Versus Battle
                </button>
              </div>
            </div>

            {/* Category & ML Sort Bar */}
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
                        ? 'bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] text-white shadow-md shadow-[#FF2A2A]/25'
                        : 'bg-[#1A1A20] text-[#C0C0C8] border border-[#C0C0C8]/20 hover:border-white hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 text-xs">
                <SlidersHorizontal className="w-4 h-4 text-[#FF2A2A]" />
                <span className="text-[#C0C0C8]">Rank By:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#C0C0C8]/25 bg-[#1A1A20] text-white text-xs font-semibold focus:outline-none focus:border-[#FF2A2A]"
                >
                  <option value="ml_recommended">🧠 ML Personal Match</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Top Customer Rated</option>
                </select>
              </div>
            </div>

            {/* Product Grid */}
            {loading && activePage !== 'wishlist' ? (
              <div className="py-24 flex flex-col items-center justify-center text-[#FF2A2A] gap-3">
                <Loader2 className="w-9 h-9 animate-spin" />
                <p className="text-xs uppercase tracking-widest text-[#C0C0C8]">
                  Scanning Live Inventory...
                </p>
              </div>
            ) : displayedProducts.length === 0 ? (
              <div className="py-20 text-center text-[#C0C0C8] text-sm space-y-4">
                <p className="max-w-md mx-auto">
                  No local vault items matched "{searchQuery}". Want Khojo AI to scrape it live from Amazon, Flipkart, Myntra & Nykaa?
                </p>
                {searchQuery && (
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleLiveWebDiscovery}
                      disabled={fetchingLive}
                      className="px-5 py-2.5 rounded-xl bg-[#FF2A2A] text-white text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center gap-2"
                    >
                      {fetchingLive ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Scraping Stores...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" /> Fetch "{searchQuery}" Live
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-4 py-2.5 rounded-xl border border-[#C0C0C8]/30 text-[#C0C0C8] text-xs font-bold uppercase cursor-pointer"
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
                    mlMatchScore={scoreProductForUser(prod, mlProfile)}
                    isWishlisted={wishlist.some((w) => w.id === prod.id)}
                    onToggleWishlist={() => toggleWishlist(prod)}
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

      {/* Footer */}
      <footer className="border-t border-[#C0C0C8]/20 py-8 px-4 text-xs bg-[#0B0B0E] text-[#C0C0C8]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.ico" alt="Logo" className="w-5 h-5 rounded-md" />
            <span className="font-harmond text-lg text-white font-bold">
              Khojo AI
            </span>
            <span>© 2026 • Conversational AI & ML Price Intelligence Hub</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
            <button onClick={() => setActivePage('home')} className="hover:text-white cursor-pointer">
              AI Hub
            </button>
            <button onClick={() => setActivePage('profile')} className="hover:text-white cursor-pointer">
              ML Profile
            </button>
            <button onClick={() => setActivePage('privacy')} className="hover:text-white cursor-pointer">
              Privacy Policy
            </button>
            <button onClick={() => setActivePage('terms')} className="hover:text-white cursor-pointer">
              Terms
            </button>
            <button
              onClick={() => openFixReporter(null)}
              className="text-[#FF2A2A] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" /> Report Fix
            </button>
            <button
              onClick={() => setIsAdminOpen(true)}
              className="text-[#C0C0C8] hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" /> Secret Admin
            </button>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {isLoginOpen && (
        <LoginModal
          onClose={() => setIsLoginOpen(false)}
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setIsLoginOpen(false);
          }}
        />
      )}

      {/* BuyHatke 6-Month Price Graph & 4-Store Comparison Modal */}
      {activeAnalyticsProduct && (
        <PriceAnalyticsModal
          product={activeAnalyticsProduct}
          onClose={() => setActiveAnalyticsProduct(null)}
          themeMode={themeMode}
          priceAlerts={priceAlerts}
          onSaveAlert={handleSavePriceAlert}
        />
      )}

      {/* Database Issue & Broken Link Fix Reporter Modal */}
      {isReporterOpen && (
        <FixReporterModal
          product={reporterTargetProduct}
          onClose={() => setIsReporterOpen(false)}
          themeMode={themeMode}
        />
      )}

      {/* Side-by-Side Versus Battle Modal */}
      {isVersusOpen && (
        <VersusModal
          selectedProducts={versusProducts}
          onClose={() => setIsVersusOpen(false)}
          themeMode={themeMode}
        />
      )}

      {/* Secret Admin Vault Modal */}
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