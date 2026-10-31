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
  Database
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import ProductCard from './ProductCard';
import { scoreProductForUser } from '../utils/mlEngine';

const QUICK_PROMPTS = [
  { label: '🧴 "Find me a good face serum"', query: 'Find me a good face serum' },
  { label: '📦 "What is your return policy?"', query: 'What is your return policy?' },
  { label: '💵 "Do you support COD?"', query: 'Do you support COD?' },
  { label: '👟 "Sneakers under ₹5000"', query: 'Sneakers under ₹5000' },
  { label: '👕 "Show me U.S. Polo shirts"', query: 'Show me U.S. Polo shirts' },
  { label: '🎧 "Noise cancelling headphones"', query: 'Noise cancelling headphones' }
];

export default function ChatWidget({
  embedded = false,
  user = null,
  mlProfile = null,
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

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const sendMessage = async (textToSend) => {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;

    const now = Date.now();
    if (now - lastSentTime < 1500) return;
    setLastSentTime(now);

    if (onRecordInteraction) {
      onRecordInteraction({ type: 'chat', query });
    }

    const userMsg = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          user_profile: mlProfile,
          website_hp: websiteHp
        })
      });

      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();

      // Silently sort returned products using background personalization weights
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
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Our Render AI server is waking up from sleep mode. Please wait 10 seconds and send your message again!',
          products: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!embedded && windowState === 'closed') {
    return (
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setWindowState('normal')}
          className="bg-gradient-to-r from-[#FF2A2A] to-[#B91C1C] text-white px-5 py-3.5 rounded-full shadow-2xl shadow-[#FF2A2A]/40 flex items-center gap-2 font-bold text-xs sm:text-sm transition-transform hover:scale-105 cursor-pointer border border-[#C0C0C8]/40"
        >
          <Sparkles className="w-4 h-4" />
          <span>Khojo AI Concierge</span>
        </button>
      </div>
    );
  }

  if (!embedded && windowState === 'minimized') {
    return (
      <div className="fixed bottom-5 right-5 z-40">
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

  const containerClasses = embedded
    ? 'w-full max-w-5xl mx-auto rounded-3xl bg-[#141419]/95 border border-[#C0C0C8]/25 shadow-2xl shadow-black/80 overflow-hidden flex flex-col h-[620px]'
    : `fixed z-40 transition-all duration-300 ${
        isMax
          ? 'inset-3 sm:inset-6'
          : 'bottom-3 right-3 left-3 sm:left-auto sm:bottom-5 sm:right-5 sm:w-[440px] h-[78vh] sm:h-[600px]'
      }`;

  return (
    <div className={containerClasses}>
      <div className="w-full h-full bg-[#121216]/95 backdrop-blur-2xl rounded-3xl border border-[#C0C0C8]/25 flex flex-col overflow-hidden text-[#E2E8F0]">
        <div className="bg-gradient-to-r from-[#16161C] via-[#241316] to-[#16161C] border-b border-[#C0C0C8]/20 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#FF2A2A]/60 shrink-0 shadow-md shadow-[#FF2A2A]/20">
              <img src="/favicon.ico" alt="Khojo AI" className="w-full h-full object-cover" />
            </div>
            <div>
              <h4 className="font-harmond text-xl sm:text-2xl font-bold tracking-wide text-white leading-none">
                Khojo AI Concierge
              </h4>
              <div className="flex items-center gap-3 text-[10px] text-[#C0C0C8] mt-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Instant Support
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3 text-[#FF2A2A]" /> Live Inventory
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#C0C0C8]" /> Smart Picks
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              title="Reset Conversation"
              className="p-2 hover:bg-white/10 rounded-xl text-[#C0C0C8] hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            {!embedded && (
              <>
                <button
                  onClick={() => setWindowState('minimized')}
                  className="p-2 hover:bg-white/10 rounded-xl text-[#C0C0C8] cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setWindowState(isMax ? 'normal' : 'maximized')}
                  className="p-2 hover:bg-white/10 rounded-xl text-[#C0C0C8] cursor-pointer"
                >
                  {isMax ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setWindowState('closed')}
                  className="p-2 hover:bg-white/10 rounded-xl text-[#C0C0C8] hover:text-[#FF2A2A] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#0D0D11]">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-[#FF2A2A]/15 border border-[#FF2A2A]/40 text-[#FF2A2A] flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`${embedded || isMax ? 'max-w-[85%]' : 'max-w-[86%]'} space-y-3`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] text-white font-semibold rounded-br-none shadow-lg shadow-[#FF2A2A]/20'
                      : 'bg-[#18181F] text-[#E2E8F0] border border-[#C0C0C8]/20 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>

                {msg.products && msg.products.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#C0C0C8] px-1">
                      <span className="flex items-center gap-1.5 font-semibold text-white">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF2A2A]" />
                        Top Matching Products ({msg.products.length})
                      </span>
                      <span>Click Compare for 6-Month Graph</span>
                    </div>
                    <div className="flex gap-3.5 overflow-x-auto pb-2 pt-1">
                      {msg.products.map((prod) => (
                        <ProductCard
                          key={prod.id}
                          product={prod}
                          compact={true}
                          isWishlisted={wishlist.some((w) => w.id === prod.id)}
                          onToggleWishlist={() => toggleWishlist && toggleWishlist(prod)}
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
                <div className="w-8 h-8 rounded-xl bg-[#1C1C24] border border-[#C0C0C8]/30 text-[#C0C0C8] flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#FF2A2A] pl-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Khojo AI is scanning live inventory across India...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="px-4 py-2.5 bg-[#14141A] border-t border-[#C0C0C8]/15 flex gap-2 overflow-x-auto no-scrollbar">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              onClick={() => sendMessage(item.query)}
              className="text-xs bg-[#1C1C24] hover:bg-[#FF2A2A]/20 border border-[#C0C0C8]/20 hover:border-[#FF2A2A] text-[#E2E8F0] px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all shrink-0 cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="p-3 sm:p-4 bg-[#121216] border-t border-[#C0C0C8]/20 flex items-center gap-2"
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
                ? 'Listening... Speak your question or product request!'
                : 'Ask a policy question ("Do you support COD?") or search ("Find me a good face serum")...'
            }
            className="flex-1 text-xs sm:text-sm bg-[#1A1A22] border border-[#C0C0C8]/25 px-4 py-3 rounded-xl focus:outline-none focus:border-[#FF2A2A] text-white placeholder-zinc-400"
          />
          <button
            type="button"
            onClick={startVoiceInput}
            title="Voice Input"
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
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
            className="bg-gradient-to-r from-[#FF2A2A] to-[#C81E1E] hover:brightness-110 disabled:opacity-40 text-white px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-[#FF2A2A]/25"
          >
            <span className="hidden sm:inline">Ask AI</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}