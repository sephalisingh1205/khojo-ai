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
  CheckCircle2
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
  // Pages: 'home' | 'login' | 'chat' | 'profile' | 'wishlist' | 'privacy' | 'terms' | '404'
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
  const [sortBy, setSortBy] = useState('recommended');
  const [isListening, setIsListening] = useState(false);

  const [themeMode] = useState('charcoal');

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
    <div className="min-h-screen flex flex-col bg-[#121215] text-[#E2E8F0]">
      {/* Top Email Confirmation Toast */}
      {authToast && (
        <div className="fixed top-16 right-4 z-50 bg-[#141419] border border-emerald-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{authToast}</span>
        </div>
      )}

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#121215]/90 border-b border-[#C0C0C8]/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-2.5 sm:gap-3.5 cursor-pointer group"
            onClick={() => {
              setActivePage('home');
              setMobileMenuOpen(false);
            }}
          >
            <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-2xl p-[1.5px] bg-gradient-to-tr from-[#FF2A2A] via-[#C0C0C8] to-[#FF2A2A] shadow-lg shadow-[#FF2A2A]/20 group-hover:scale-105 transition-transform shrink-0">
              <div className="w-full h-full rounded-[14px] overflow-hidden bg-[#121215]">
                <img
                  src="/favicon.ico"
                  alt="Khojo AI"
                  className="w-full h-full object-cover scale-105"
                />
              </div>
            </div>
            <div>
              <h1 className="font-harmond text-xl sm:text-3xl font-bold tracking-wide leading-none text-white">
                Khojo{' '}
                <span className="italic bg-gradient-to-r from-[#C0C0C8] via-white to-[#FF2A2A] bg-clip-text text-transparent">
                  AI
                </span>
              </h1>
              <p className="text-[8px] sm:text-[10px] uppercase tracking-[0.18em] text-[#C0C0C8] mt-0.5">
                Charcoal • Moonlit Silver • Signal Red
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <div className="hidden md:flex items-center p-1 rounded-2xl bg-[#1A1A20] border border-[#C0C0C8]/20">
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

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
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

            {user ? (
              <button
                onClick={() => setActivePage('profile')}
                className="px-2.5 sm:px-3 py-2 rounded-xl border border-[#C0C0C8]/30 bg-[#1A1A22] hover:border-[#FF2A2A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="w-5 h-5 rounded-full bg-[#FF2A2A] text-white flex items-center justify-center text-[10px]">
                  {user.name[0]}
                </span>
                <span className="hidden sm:inline">{user.name}</span>
              </button>
            ) : (
              <button
                onClick={() => setActivePage('login')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer ${
                  activePage === 'login'
                    ? 'bg-white text-black'
                    : 'bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] text-white shadow-[#FF2A2A]/20'
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
              className="relative p-2 sm:p-2.5 rounded-xl border border-[#C0C0C8]/25 bg-[#1A1A20] text-[#E2E8F0] hover:border-[#FF2A2A] cursor-pointer"
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
              className="md:hidden p-2 rounded-xl border border-[#C0C0C8]/25 bg-[#1A1A20] text-white cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#C0C0C8]/20 bg-[#141418] px-4 py-3 space-y-2.5 animate-fadeIn">
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
            onRecordInteraction={handleRecordInteraction}
            wishlist={wishlist}
            toggleWishlist={toggleWishlist}
            onOpenAnalytics={(p) => setActiveAnalyticsProduct(p)}
            onOpenReporter={(p) => openFixReporter(p)}
          />
        </div>
      ) : (
        <>
          {activePage === 'home' && (
            <section className="relative overflow-hidden border-b border-[#C0C0C8]/20 py-5 sm:py-8 px-3 sm:px-4 bg-gradient-to-b from-[#17171D] via-[#121216] to-[#0E0E12]">
              <Interactive3DBackground />

              <div className="relative z-10 max-w-4xl mx-auto space-y-4 sm:space-y-5">
                <div className="text-center space-y-2">
                  <span className="inline-flex items-center gap-1.5 bg-[#1C1C24]/90 border border-[#C0C0C8]/30 text-[#E2E8F0] text-[9px] sm:text-xs font-semibold px-3 py-1 rounded-full tracking-widest uppercase">
                    <Sparkles className="w-3 h-3 text-[#FF2A2A]" />
                    Conversational Shopping • 6-Month Price Graph • Versus Mode
                  </span>

                  <h2 className="font-harmond text-3xl sm:text-5xl font-bold tracking-tight leading-none text-white">
                    Ask Khojo AI.{' '}
                    <span className="italic bg-gradient-to-r from-[#C0C0C8] via-white to-[#FF2A2A] bg-clip-text text-transparent">
                      Shop Smarter.
                    </span>
                  </h2>

                  <p className="text-[#C0C0C8] text-xs sm:text-sm max-w-xl mx-auto">
                    Instant answers for store policies, live inventory search across Amazon, Flipkart, Myntra & Nykaa, and tailored deal discovery.
                  </p>
                </div>

                {/* Central Conversational Hub */}
                <ChatWidget
                  embedded={true}
                  user={user}
                  mlProfile={mlProfile}
                  catalogProducts={products}
                  onRecordInteraction={handleRecordInteraction}
                  wishlist={wishlist}
                  toggleWishlist={toggleWishlist}
                  onOpenAnalytics={(p) => setActiveAnalyticsProduct(p)}
                  onOpenReporter={(p) => openFixReporter(p)}
                />
              </div>
            </section>
          )}

          {/* Product Catalog Grid */}
          <main className="max-w-7xl mx-auto w-full px-3.5 sm:px-6 py-7 flex-1 space-y-5 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-[#18181E] border border-[#C0C0C8]/20 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-harmond text-2xl font-bold text-white">
                  {activePage === 'wishlist'
                    ? 'My Saved Wishlist'
                    : user
                    ? `Curated Deals for ${user.name}`
                    : 'Live Marketplace Catalog'}
                </h3>
                <p className="text-xs text-[#C0C0C8]">
                  Compare real-time prices across Amazon India, Flipkart, Myntra & Nykaa
                </p>
              </div>

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
                    placeholder={
                      isListening ? 'Listening...' : 'Filter products or brands...'
                    }
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
                  Versus
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
                <span className="text-[#C0C0C8]">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#C0C0C8]/25 bg-[#1A1A20] text-white text-xs font-semibold focus:outline-none focus:border-[#FF2A2A]"
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
              <div className="py-24 flex flex-col items-center justify-center text-[#FF2A2A] gap-3">
                <Loader2 className="w-9 h-9 animate-spin" />
                <p className="text-xs uppercase tracking-widest text-[#C0C0C8]">
                  Loading Live Inventory...
                </p>
              </div>
            ) : displayedProducts.length === 0 ? (
              <div className="py-20 text-center text-[#C0C0C8] text-sm space-y-4">
                <p className="max-w-md mx-auto">
                  No local items matched "{searchQuery}". Want Khojo AI to fetch it live from Amazon, Flipkart, Myntra & Nykaa?
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
            <span>© 2026 • Conversational AI & Price Intelligence Hub</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
            <button onClick={() => setActivePage('home')} className="hover:text-white cursor-pointer">
              AI Hub
            </button>
            <button onClick={() => setActivePage('login')} className="hover:text-white cursor-pointer">
              Sign In Page
            </button>
            <button onClick={() => setActivePage('profile')} className="hover:text-white cursor-pointer">
              My Account
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
          onClose={() => setIsVersusOpen(false)}
          themeMode={themeMode}
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