import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  Minimize2,
  Maximize2,
  Minus,
  RotateCcw,
  Sparkles,
  Mic,
  ShieldCheck,
  Database,
  Zap,
  Flame,
  TrendingDown,
  ShoppingBag
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import ProductCard from './ProductCard';
import { scoreProductForUser } from '../utils/mlEngine';

const QUICK_PROMPTS = [
  { label: '🧴 Face serum', query: 'Find me a good face serum' },
  { label: '👟 Sneakers < ₹5000', query: 'Sneakers under ₹5000' },
  { label: '👕 U.S. Polo shirts', query: 'Show me U.S. Polo shirts' },
  { label: '🎧 Headphones', query: 'Noise cancelling headphones' },
  { label: '📦 Return policy?', query: 'What is your return policy?' },
  { label: '💵 COD available?', query: 'Do you support COD?' }
];

const SHOPPING_VIBE_CARDS = [
  {
    badge: 'TRENDING VIBE',
    title: '🔥 Streetwear & Sneakers',
    subtitle: 'Compare Puma, Nike & Campus kicks under ₹5,000',
    query: 'Sneakers under ₹5000',
    accent: 'from-[#FF2A2A]/25 to-[#181820]'
  },
  {
    badge: 'GLOW ROUTINE',
    title: '✨ Skincare & Serums',
    subtitle: 'Top-rated Nykaa & Amazon face serums & cleansers',
    query: 'Find me a good face serum',
    accent: 'from-rose-500/20 to-[#181820]'
  },
  {
    badge: 'TECH STEALS',
    title: '🎧 Pro Gaming & Audio',
    subtitle: 'ANC headphones, gaming mice & accessories',
    query: 'Noise cancelling headphones',
    accent: 'from-sky-500/20 to-[#181820]'
  },
  {
    badge: 'WARDROBE UPGRADE',
    title: '👕 Mens & Womens Fit',
    subtitle: 'U.S. Polo shirts, oversized hoodies & cargos',
    query: 'Show me U.S. Polo shirts',
    accent: 'from-emerald-500/20 to-[#181820]'
  }
];

const INSTANT_POLICIES = {
  return:
    'All items across Amazon India, Flipkart, Myntra, and Nykaa via Khojo AI support a 7-Day Easy Return & Exchange policy for unused items with original tags.',
  shipping:
    'Free standard delivery across India on orders above ₹499. Express delivery takes 1–3 business days in metro cities.',
  payment:
    'Yes! We support Cash on Delivery (COD) on eligible pin codes, plus UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, and NetBanking.',
  authenticity:
    '100% Verified Original Brands. All electronics and fashion items come with standard manufacturer warranty across India.'
};

function formatMessageText(text = '') {
  const parts = String(text).split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={index} className="italic text-[#C0C0C8]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

export default function ChatWidget({
  embedded = false,
  user = null,
  mlProfile = null,
  catalogProducts = [],
  externalQuery = null,
  onClearExternalQuery,
  onRecordInteraction,
  wishlist = [],
  versusProducts = [],
  toggleWishlist,
  onToggleVersus,
  onOpenAnalytics,
  onOpenReporter
}) {
  const [windowState, setWindowState] = useState('normal');
  const [input, setInput] = useState('');
  const [websiteHp, setWebsiteHp] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastSentTime, setLastSentTime] = useState(0);

  const userName = user?.name ? `, ${user.name}` : '';

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Namaste${userName}! ✨ Welcome to the **Khojo AI Concierge Hub**.\n\nTap any **Shopping Vibe** below, ask a store policy question (*"Do you support COD?"*), or tell me what product you want to compare across Amazon India, Flipkart, Myntra & Nykaa!`,
      products: []
    }
  ]);

  const messagesContainerRef = useRef(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, loading]);

  // Listen for clicks from the 3D floating hero cards
  useEffect(() => {
    if (externalQuery && externalQuery.trim()) {
      sendMessage(externalQuery);
      if (onClearExternalQuery) onClearExternalQuery();
    }
  }, [externalQuery]);

  const startVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition requires Chrome or Edge.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setInput(text);
      setIsListening(false);
    };
    recognition.start();
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Conversation reset${userName}! Pick a Shopping Vibe below or type any product you want me to scan across India.`,
        products: []
      }
    ]);
  };

  const searchLocalCatalogFallback = (queryText) => {
    const qLower = queryText.toLowerCase().replace(/\./g, '');
    const priceMatch = qLower.match(/(?:under|below|max|₹|rs\.?\s*)\s*(\d{3,6})/);
    const maxPrice = priceMatch ? Number(priceMatch[1]) : null;

    const words = qLower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          ![
            'find',
            'show',
            'good',
            'best',
            'under',
            'below',
            'for',
            'the',
            'and'
          ].includes(w)
      );

    const matched = (catalogProducts || []).filter((item) => {
      if (maxPrice && Number(item.price_inr) > maxPrice) return false;
      const pool = `${item.name} ${item.brand} ${item.category} ${item.platform} ${
        Array.isArray(item.tags) ? item.tags.join(' ') : item.tags || ''
      }`
        .toLowerCase()
        .replace(/\./g, '');
      return words.some(
        (w) =>
          pool.includes(w) ||
          (w.endsWith('s') && w.length > 3 && pool.includes(w.slice(0, -1)))
      );
    });

    return matched
      .sort(
        (a, b) =>
          scoreProductForUser(b, mlProfile) - scoreProductForUser(a, mlProfile)
      )
      .slice(0, 6);
  };

  const sendMessage = async (textToSend) => {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;

    const now = Date.now();
    if (now - lastSentTime < 600) return;
    setLastSentTime(now);

    if (onRecordInteraction) {
      onRecordInteraction({ type: 'chat', query });
    }

    const userMsg = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    const qClean = query.toLowerCase().trim();

    if (
      /\b(return|refund|exchange|policy|cod|cash on delivery|shipping|delivery|authentic|warranty)\b/.test(
        qClean
      )
    ) {
      const policyText = [
        `• **Returns & Exchanges**: ${INSTANT_POLICIES.return}`,
        `• **Cash on Delivery & UPI**: ${INSTANT_POLICIES.payment}`,
        `• **Express Shipping**: ${INSTANT_POLICIES.shipping}`,
        `• **Brand Warranty**: ${INSTANT_POLICIES.authenticity}`
      ].join('\n');

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Here are our official **Khojo AI** customer support policies:\n\n${policyText}\n\nWhat product can I help you compare today?`,
          products: []
        }
      ]);
      return;
    }

    if (/^(hi|hello|hey|namaste|hola|yo|good morning|good evening)$/.test(qClean)) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Hello${userName}! ✨ Tap one of the **Shopping Vibe** cards or tell me what you're looking for—like *"Sneakers under ₹5000"* or *"Find me a good face serum"*.`,
          products: []
        }
      ]);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5500);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          user_profile: mlProfile,
          website_hp: websiteHp
        })
      });

      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();

      const rawProducts = data.products || [];
      const rankedProducts = [...rawProducts].sort(
        (a, b) =>
          scoreProductForUser(b, mlProfile) - scoreProductForUser(a, mlProfile)
      );

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          products: rankedProducts
        }
      ]);
    } catch {
      clearTimeout(timeoutId);
      const localMatches = searchLocalCatalogFallback(query);
      if (localMatches.length > 0) {
        const top = localMatches[0];
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `I found **${localMatches.length} top deals** for you! Leading the pack is **${top.name}** by ${top.brand} on **${top.platform}** for **₹${top.price_inr}**. Tap **Graph** for the 6-month price trajectory or **+ Versus** to compare!`,
            products: localMatches
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Here are our top trending steals while I scan live stores for **"${query}"**:`,
            products: (catalogProducts || []).slice(0, 4)
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const containerClasses = embedded
    ? 'w-full rounded-2xl sm:rounded-3xl bg-[#131318]/90 backdrop-blur-2xl border border-[#C0C0C8]/30 shadow-[0_25px_70px_rgba(255,42,42,0.16)] overflow-hidden flex flex-col h-[470px] sm:h-[530px] card-3d-shell'
    : 'fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-5 sm:right-5 sm:w-[430px] h-[75vh] sm:h-[560px] z-40';

  return (
    <div className={containerClasses}>
      <div className="w-full h-full flex flex-col overflow-hidden text-[#E2E8F0]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#16161C] via-[#281216] to-[#16161C] border-b border-[#C0C0C8]/20 px-4 sm:px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-[#FF2A2A] shrink-0 shadow-md shadow-[#FF2A2A]/30">
              <img src="/favicon.ico" alt="Khojo AI" className="w-full h-full object-cover" />
              <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-harmond text-xl sm:text-2xl font-bold tracking-wide text-white leading-none">
                  Khojo AI Shopping Concierge
                </h4>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-[#FF2A2A]/20 text-[#FF2A2A] border border-[#FF2A2A]/40">
                  <Flame className="w-2.5 h-2.5" /> Live Vibe Engine
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-[10px] text-[#C0C0C8] mt-1">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <Zap className="w-3 h-3 fill-emerald-400" />
                  Instant Reply
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3 text-[#FF2A2A]" /> 4-Store Scanner
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#C0C0C8]" /> Smart Suggestions
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={clearChat}
            title="Reset Conversation"
            className="p-2 hover:bg-white/10 rounded-xl text-[#C0C0C8] hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Message Stream */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 bg-[#0D0D11]/90"
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-[#FF2A2A]/15 border border-[#FF2A2A]/40 text-[#FF2A2A] flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-[#FF2A2A]/10">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className="max-w-[90%] sm:max-w-[86%] space-y-3">
                <div
                  className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] text-white font-semibold rounded-br-none shadow-lg shadow-[#FF2A2A]/25'
                      : 'bg-[#181820] text-[#E2E8F0] border border-[#C0C0C8]/20 rounded-bl-none'
                  }`}
                >
                  {formatMessageText(msg.content)}
                </div>

                {/* Interactive "Shop by Vibe" Bento Cards on Initial Greeting */}
                {idx === 0 && messages.length === 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 animate-fadeIn">
                    {SHOPPING_VIBE_CARDS.map((card) => (
                      <div
                        key={card.title}
                        onClick={() => sendMessage(card.query)}
                        className={`p-3.5 rounded-2xl bg-gradient-to-br ${card.accent} border border-[#C0C0C8]/20 hover:border-[#FF2A2A] transition-all cursor-pointer group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#FF2A2A]/15`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#FF2A2A]">
                            {card.badge}
                          </span>
                          <Sparkles className="w-3.5 h-3.5 text-[#C0C0C8] group-hover:text-[#FF2A2A] group-hover:rotate-12 transition-transform" />
                        </div>
                        <h5 className="font-harmond text-lg font-bold text-white group-hover:text-[#FF2A2A] transition-colors">
                          {card.title}
                        </h5>
                        <p className="text-[11px] text-[#C0C0C8] line-clamp-1 mt-0.5">
                          {card.subtitle}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {msg.products && msg.products.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#C0C0C8] px-1">
                      <span className="flex items-center gap-1.5 font-semibold text-white">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF2A2A]" />
                        Curated AI Matches ({msg.products.length})
                      </span>
                      <span className="hidden sm:inline">
                        Tap + Versus to compare or Graph for 6-month trend
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 pt-0.5 no-scrollbar">
                      {msg.products.map((prod) => (
                        <ProductCard
                          key={prod.id}
                          product={prod}
                          compact={true}
                          isWishlisted={wishlist.some((w) => w.id === prod.id)}
                          isInVersus={versusProducts.some((v) => v.id === prod.id)}
                          onToggleWishlist={() =>
                            toggleWishlist && toggleWishlist(prod)
                          }
                          onToggleVersus={onToggleVersus}
                          onOpenAnalytics={onOpenAnalytics}
                          onOpenReporter={onOpenReporter}
                          onProductInteract={(p) =>
                            onRecordInteraction &&
                            onRecordInteraction({ type: 'click', product: p })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-[#1C1C24] border border-[#C0C0C8]/30 text-[#C0C0C8] flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#FF2A2A] pl-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Khojo AI is curating the best store deals for your vibe...</span>
            </div>
          )}
        </div>

        {/* Quick Prompt Pills */}
        <div className="px-3.5 py-2 bg-[#14141A] border-t border-[#C0C0C8]/15 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              onClick={() => sendMessage(item.query)}
              className="text-[11px] sm:text-xs bg-[#1C1C24] hover:bg-[#FF2A2A] border border-[#C0C0C8]/25 hover:border-[#FF2A2A] text-[#E2E8F0] hover:text-white px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all shrink-0 cursor-pointer font-medium"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="p-3 bg-[#121216] border-t border-[#C0C0C8]/20 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            name="website_hp"
            value={websiteHp}
            onChange={(e) => setWebsiteHp(e.target.value)}
            tabIndex="-1"
            autoComplete="off"
            className="hidden"
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isListening
                ? 'Listening... Speak your shopping vibe!'
                : 'Tell Khojo AI your vibe ("Sneakers under ₹5000", "Face serum", "COD?")...'
            }
            className="flex-1 text-xs sm:text-sm bg-[#1A1A22] border border-[#C0C0C8]/30 px-4 py-3 rounded-xl focus:outline-none focus:border-[#FF2A2A] text-white placeholder-zinc-400 min-w-0"
          />
          <button
            type="button"
            onClick={startVoiceInput}
            title="Voice Input"
            className={`p-3 rounded-xl border transition-all cursor-pointer shrink-0 ${
              isListening
                ? 'bg-[#FF2A2A] text-white border-[#FF2A2A] animate-pulse'
                : 'bg-[#1A1A22] border-[#C0C0C8]/25 text-[#C0C0C8] hover:text-white'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] hover:brightness-110 disabled:opacity-40 text-white px-4 sm:px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-[#FF2A2A]/30 shrink-0"
          >
            <span className="hidden sm:inline">Ask AI</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}