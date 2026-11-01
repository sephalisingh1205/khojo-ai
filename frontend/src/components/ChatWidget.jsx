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
  Zap
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import ProductCard from './ProductCard';
import { scoreProductForUser } from '../utils/mlEngine';

const QUICK_PROMPTS = [
  { label: '🧴 Face serum', query: 'Find me a good face serum' },
  { label: '📦 Return policy?', query: 'What is your return policy?' },
  { label: '💵 COD available?', query: 'Do you support COD?' },
  { label: '👟 Sneakers < ₹5000', query: 'Sneakers under ₹5000' },
  { label: '👕 U.S. Polo shirts', query: 'Show me U.S. Polo shirts' },
  { label: '🎧 Headphones', query: 'Noise cancelling headphones' }
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

// Cleanly renders **bold** and *italic* text without raw asterisks
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
  onRecordInteraction,
  wishlist = [],
  toggleWishlist,
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
      content: `Namaste${userName}! ✨ Welcome to the **Khojo AI Concierge Hub**.\n\nAsk me about store policies (*"What is your return policy?"*, *"Do you support COD?"*), search live inventory across Amazon India, Flipkart, Myntra & Nykaa, or get tailored product recommendations.`,
      products: []
    }
  ]);

  // Use internal container scrollTop instead of window scrollIntoView so the page NEVER jumps down on load!
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
        content: `Conversation reset${userName}! Ask a store policy question or tell me what product you want me to scan across our inventory.`,
        products: []
      }
    ]);
  };

  // Instant Local Fallback Search if Backend takes > 4.5 seconds
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
    if (now - lastSentTime < 800) return;
    setLastSentTime(now);

    if (onRecordInteraction) {
      onRecordInteraction({ type: 'chat', query });
    }

    const userMsg = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    const qClean = query.toLowerCase().trim();

    // 1. ZERO-LATENCY AUTO RESPONSE FOR REPETITIVE POLICY / COD / SHIPPING QUESTIONS
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

    // 2. ZERO-LATENCY AUTO RESPONSE FOR GREETINGS
    if (/^(hi|hello|hey|namaste|hola|yo|good morning|good evening)$/.test(qClean)) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Hello${userName}! ✨ Tell me what you're shopping for today—try *"Find me a good face serum"*, *"Sneakers under ₹5000"*, or *"U.S. Polo shirts"*.`,
          products: []
        }
      ]);
      return;
    }

    // 3. INVENTORY SEARCH WITH 5-SECOND AUTO-TIMEOUT FALLBACK
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
      // Instant auto-fallback using loaded catalog so mobile users never wait on cold starts
      const localMatches = searchLocalCatalogFallback(query);
      if (localMatches.length > 0) {
        const top = localMatches[0];
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `I found **${localMatches.length} matching options** for you! The top recommendation is **${top.name}** by ${top.brand} on **${top.platform}** for **₹${top.price_inr}**. Tap **Graph** to inspect the 6-month price trajectory or **Buy Now**!`,
            products: localMatches
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `I scanned our catalog for **"${query}"**. Try browsing our Footwear, Beauty, Electronics, or Apparel categories below, or tap one of the quick search pills!`,
            products: (catalogProducts || []).slice(0, 4)
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!embedded && windowState === 'closed') {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setWindowState('normal')}
          className="bg-gradient-to-r from-[#FF2A2A] to-[#B91C1C] text-white px-4 sm:px-5 py-3 rounded-full shadow-2xl shadow-[#FF2A2A]/40 flex items-center gap-2 font-bold text-xs sm:text-sm transition-transform hover:scale-105 cursor-pointer border border-[#C0C0C8]/40"
        >
          <Sparkles className="w-4 h-4" />
          <span>Khojo AI Concierge</span>
        </button>
      </div>
    );
  }

  if (!embedded && windowState === 'minimized') {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <div className="bg-[#141418]/95 backdrop-blur-xl border border-[#C0C0C8]/40 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3">
          <div
            onClick={() => setWindowState('normal')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF2A2A] animate-ping" />
            <span className="font-harmond text-lg font-bold text-white">
              Khojo AI Concierge
            </span>
          </div>
          <button
            onClick={() => setWindowState('normal')}
            className="p-1.5 hover:bg-white/10 rounded-lg text-[#C0C0C8] cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWindowState('closed')}
            className="p-1.5 hover:bg-white/10 rounded-lg text-[#C0C0C8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const isMax = !embedded && windowState === 'maximized';

  // Mobile-friendly adaptive height so the hero section + chat fit on one screen without scrolling
  const containerClasses = embedded
    ? 'w-full max-w-4xl mx-auto rounded-2xl sm:rounded-3xl bg-[#141419]/95 border border-[#C0C0C8]/25 shadow-2xl shadow-black/80 overflow-hidden flex flex-col h-[430px] sm:h-[500px]'
    : `fixed z-40 transition-all duration-300 ${
        isMax
          ? 'inset-2 sm:inset-6'
          : 'bottom-2 right-2 left-2 sm:left-auto sm:bottom-5 sm:right-5 sm:w-[430px] h-[75vh] sm:h-[560px]'
      }`;

  return (
    <div className={containerClasses}>
      <div className="w-full h-full bg-[#121216]/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-[#C0C0C8]/25 flex flex-col overflow-hidden text-[#E2E8F0]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#16161C] via-[#241316] to-[#16161C] border-b border-[#C0C0C8]/20 px-3.5 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden border border-[#FF2A2A]/60 shrink-0 shadow-md shadow-[#FF2A2A]/20">
              <img src="/favicon.ico" alt="Khojo AI" className="w-full h-full object-cover" />
            </div>
            <div>
              <h4 className="font-harmond text-lg sm:text-2xl font-bold tracking-wide text-white leading-none">
                Khojo AI Concierge
              </h4>
              <div className="flex items-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] text-[#C0C0C8] mt-1">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <Zap className="w-3 h-3 fill-emerald-400" />
                  Auto-Response
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3 text-[#FF2A2A]" /> Live Inventory
                </span>
                <span className="hidden xs:inline">•</span>
                <span className="hidden xs:flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#C0C0C8]" /> Smart Picks
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              title="Reset Conversation"
              className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl text-[#C0C0C8] hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            {!embedded && (
              <>
                <button
                  onClick={() => setWindowState('minimized')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl text-[#C0C0C8] cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setWindowState(isMax ? 'normal' : 'maximized')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl text-[#C0C0C8] cursor-pointer"
                >
                  {isMax ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setWindowState('closed')}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl text-[#C0C0C8] hover:text-[#FF2A2A] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Message Stream (Internal Scroll Only!) */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 bg-[#0D0D11]"
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#FF2A2A]/15 border border-[#FF2A2A]/40 text-[#FF2A2A] flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className="max-w-[88%] sm:max-w-[85%] space-y-2.5">
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] text-white font-semibold rounded-br-none shadow-md shadow-[#FF2A2A]/20'
                      : 'bg-[#18181F] text-[#E2E8F0] border border-[#C0C0C8]/20 rounded-bl-none'
                  }`}
                >
                  {formatMessageText(msg.content)}
                </div>

                {msg.products && msg.products.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#C0C0C8] px-1">
                      <span className="flex items-center gap-1 font-semibold text-white">
                        <Sparkles className="w-3 h-3 text-[#FF2A2A]" />
                        Recommended Matches ({msg.products.length})
                      </span>
                      <span className="hidden sm:inline">Tap Graph for 6-Month History</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 pt-0.5 no-scrollbar">
                      {msg.products.map((prod) => (
                        <ProductCard
                          key={prod.id}
                          product={prod}
                          compact={true}
                          isWishlisted={wishlist.some((w) => w.id === prod.id)}
                          onToggleWishlist={() =>
                            toggleWishlist && toggleWishlist(prod)
                          }
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
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#1C1C24] border border-[#C0C0C8]/30 text-[#C0C0C8] flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#FF2A2A] pl-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Scanning live inventory...</span>
            </div>
          )}
        </div>

        {/* Mobile-Friendly Quick Prompt Pills */}
        <div className="px-3 py-2 bg-[#14141A] border-t border-[#C0C0C8]/15 flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              onClick={() => sendMessage(item.query)}
              className="text-[11px] sm:text-xs bg-[#1C1C24] hover:bg-[#FF2A2A]/20 border border-[#C0C0C8]/20 hover:border-[#FF2A2A] text-[#E2E8F0] px-3 py-1 rounded-full whitespace-nowrap transition-all shrink-0 cursor-pointer"
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
          className="p-2.5 sm:p-3 bg-[#121216] border-t border-[#C0C0C8]/20 flex items-center gap-1.5 sm:gap-2 shrink-0"
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
                ? 'Listening... Speak now!'
                : 'Ask policy ("COD?") or search ("face serum")...'
            }
            className="flex-1 text-xs sm:text-sm bg-[#1A1A22] border border-[#C0C0C8]/25 px-3 sm:px-4 py-2.5 rounded-xl focus:outline-none focus:border-[#FF2A2A] text-white placeholder-zinc-400 min-w-0"
          />
          <button
            type="button"
            onClick={startVoiceInput}
            title="Voice Input"
            className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
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
            className="bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] hover:brightness-110 disabled:opacity-40 text-white px-3.5 sm:px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-[#FF2A2A]/25 shrink-0"
          >
            <span className="hidden sm:inline">Ask AI</span>
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}