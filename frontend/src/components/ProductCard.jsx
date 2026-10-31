import React, { useState } from 'react';
import { Star, ExternalLink, Heart, BarChart2, Sparkles, Wrench } from 'lucide-react';
import { API_BASE_URL } from '../config';

const PLATFORM_BADGES = {
  'Amazon India': 'bg-[#121215]/90 text-[#E2E8F0] border border-[#C0C0C8]/50',
  'Flipkart': 'bg-[#121215]/90 text-sky-300 border border-sky-400/40',
  'Myntra': 'bg-[#121215]/90 text-pink-300 border border-pink-400/40',
  'Nykaa': 'bg-[#121215]/90 text-rose-300 border border-rose-400/40'
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600';

export default function ProductCard({
  product,
  compact = false,
  isWishlisted = false,
  onToggleWishlist,
  onOpenAnalytics,
  onOpenReporter,
  onProductInteract
}) {
  const [tiltStyle, setTiltStyle] = useState({});

  if (!product) return null;

  const badgeStyle =
    PLATFORM_BADGES[product.platform] ||
    'bg-[#121215]/90 text-[#C0C0C8] border border-[#C0C0C8]/40';

  const discount =
    product.mrp_inr && product.mrp_inr > product.price_inr
      ? Math.round(((product.mrp_inr - product.price_inr) / product.mrp_inr) * 100)
      : 18;

  const dealScore = Math.min(99, Math.max(82, 76 + Math.round(discount * 0.5)));

  const liveRedirectUrl = `${API_BASE_URL}/api/redirect?name=${encodeURIComponent(
    product.name || ''
  )}&brand=${encodeURIComponent(product.brand || '')}&platform=${encodeURIComponent(
    product.platform || 'Amazon India'
  )}`;

  const handleMouseMove = (e) => {
    if (compact) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateY = ((x / rect.width - 0.5) * 12).toFixed(2);
    const rotateX = ((0.5 - y / rect.height) * 12).toFixed(2);
    setTiltStyle({
      transform: `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.015, 1.015, 1.015)`,
      transition: 'transform 0.08s ease-out'
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({
      transform: 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    });
  };

  return (
    <div
      style={tiltStyle}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`rounded-2xl border overflow-hidden flex flex-col justify-between group bg-gradient-to-b from-[#1A1A20] to-[#111115] border-[#C0C0C8]/20 text-zinc-100 hover:border-[#FF2A2A]/70 hover:shadow-2xl hover:shadow-[#FF2A2A]/10 ${
        compact ? 'w-64 shrink-0' : 'w-full'
      }`}
    >
      <div>
        <div className={`relative bg-zinc-950 overflow-hidden ${compact ? 'h-36' : 'h-52 sm:h-56'}`}>
          <img
            src={product.image_url || FALLBACK_IMAGE}
            alt={product.name}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = FALLBACK_IMAGE;
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />

          <span
            className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md shadow-sm ${badgeStyle}`}
          >
            {product.platform}
          </span>

          <button
            onClick={() => {
              if (onProductInteract) onProductInteract(product);
              if (onOpenAnalytics) onOpenAnalytics(product);
            }}
            title="View Deal Score & 6-Month Price Graph"
            className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-[#C0C0C8]/40 text-[#E2E8F0] text-[10px] font-bold flex items-center gap-1 hover:border-[#FF2A2A] hover:text-[#FF2A2A] transition-all cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-[#FF2A2A]" />
            Deal Score {dealScore}
          </button>

          <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
            <button
              onClick={(e) => {
                e.preventDefault();
                if (onProductInteract) onProductInteract(product);
                if (onToggleWishlist) onToggleWishlist();
              }}
              title="Save to Wishlist"
              className="p-2 rounded-full bg-black/75 border border-white/15 backdrop-blur-md hover:border-[#FF2A2A] hover:scale-110 transition-all cursor-pointer"
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  isWishlisted ? 'fill-[#FF2A2A] text-[#FF2A2A]' : 'text-zinc-300'
                }`}
              />
            </button>

            {!compact && onOpenReporter && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onOpenReporter(product);
                }}
                title="Report Broken Link or Wrong Price"
                className="p-2 rounded-full bg-black/75 border border-white/15 backdrop-blur-md text-zinc-300 hover:text-[#FF2A2A] hover:border-[#FF2A2A] transition-all cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className={compact ? 'p-3' : 'p-4'}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-[#C0C0C8] mb-1">
            <span className="truncate max-w-[70%]">{product.brand}</span>
            {product.rating && (
              <span className="flex items-center gap-1 text-[#E2E8F0] shrink-0">
                <Star className="w-3 h-3 fill-[#FF2A2A] text-[#FF2A2A]" />
                {product.rating}
              </span>
            )}
          </div>

          <h3
            className={`font-harmond font-semibold line-clamp-2 text-white ${
              compact ? 'text-base leading-snug' : 'text-lg sm:text-xl leading-snug'
            }`}
            title={product.name}
          >
            {product.name}
          </h3>

          {!compact && (
            <div className="text-[11px] text-zinc-400 mt-1.5 flex items-center justify-between">
              <span>{product.category} • 4 Stores</span>
              <button
                onClick={() => onOpenReporter && onOpenReporter(product)}
                className="text-[#C0C0C8] hover:text-[#FF2A2A] underline cursor-pointer"
              >
                Fix Info
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 px-3.5 sm:px-4 py-3 flex flex-col gap-2.5 bg-[#0E0E12]/60">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base sm:text-lg text-white">
              ₹{Number(product.price_inr).toLocaleString('en-IN')}
            </span>
            {product.mrp_inr && product.mrp_inr > product.price_inr && (
              <span className="text-xs text-zinc-500 line-through">
                ₹{Number(product.mrp_inr).toLocaleString('en-IN')}
              </span>
            )}
          </div>
          {discount && (
            <span className="text-[10px] sm:text-[11px] font-bold text-[#FF2A2A] bg-[#FF2A2A]/15 border border-[#FF2A2A]/30 px-2 py-0.5 rounded-full">
              {discount}% OFF
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              if (onProductInteract) onProductInteract(product);
              if (onOpenAnalytics) onOpenAnalytics(product);
            }}
            className="py-2 px-2 rounded-xl font-semibold text-xs border border-[#C0C0C8]/30 bg-white/5 text-[#E2E8F0] hover:border-white hover:bg-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <BarChart2 className="w-3.5 h-3.5 text-[#C0C0C8] shrink-0" />
            <span className="truncate">{compact ? 'Graph' : 'Compare'}</span>
          </button>

          <a
            href={liveRedirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onProductInteract && onProductInteract(product)}
            className="py-2 px-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[#FF2A2A] to-[#D91B1B] text-white hover:brightness-110 transition-all flex items-center justify-center gap-1 shadow-md shadow-[#FF2A2A]/20"
          >
            <span className="truncate">Buy Now</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}