import React, { useState } from 'react';
import { Star, ExternalLink, Heart, BarChart2, Sparkles, Wrench, Scale, Check } from 'lucide-react';
import { API_BASE_URL } from '../config';

const PLATFORM_BADGES = {
  'Amazon India': 'bg-[#0E1719]/90 text-[#E5EFC1] border border-[#A2D5AB]/50',
  'Flipkart': 'bg-[#0E1719]/90 text-[#A2D5AB] border border-[#39AEA9]/50',
  'Myntra': 'bg-[#0E1719]/90 text-[#E5EFC1] border border-[#557B83]/60',
  'Nykaa': 'bg-[#0E1719]/90 text-[#A2D5AB] border border-[#A2D5AB]/50'
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600';

export default function ProductCard({
  product,
  compact = false,
  isWishlisted = false,
  isInVersus = false,
  onToggleWishlist,
  onToggleVersus,
  onOpenAnalytics,
  onOpenReporter,
  onProductInteract
}) {
  const [tiltStyle, setTiltStyle] = useState({});

  if (!product) return null;

  const badgeStyle =
    PLATFORM_BADGES[product.platform] ||
    'bg-[#0E1719]/90 text-[#A2D5AB] border border-[#A2D5AB]/40';

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
      className={`rounded-2xl border overflow-hidden flex flex-col justify-between group bg-gradient-to-b from-[#162427] to-[#0E1719] text-[#E5EFC1] transition-all ${
        isInVersus
          ? 'border-[#39AEA9] ring-2 ring-[#39AEA9]/50 shadow-2xl shadow-[#39AEA9]/25'
          : 'border-[#557B83]/45 hover:border-[#A2D5AB] hover:shadow-2xl hover:shadow-[#39AEA9]/15'
      } ${compact ? 'w-64 shrink-0' : 'w-full'}`}
    >
      <div>
        <div className={`relative bg-[#0A1113] overflow-hidden ${compact ? 'h-36' : 'h-52 sm:h-56'}`}>
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
            className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-[#0E1719]/90 backdrop-blur-md border border-[#A2D5AB]/40 text-[#E5EFC1] text-[10px] font-bold flex items-center gap-1 hover:border-[#39AEA9] hover:text-[#A2D5AB] transition-all cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-[#39AEA9]" />
            Deal Score {dealScore}
          </button>

          {onToggleVersus && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onToggleVersus(product);
              }}
              title="Add to Head-to-Head Versus Battle (Same Category Only)"
              className={`absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer backdrop-blur-md border ${
                isInVersus
                  ? 'bg-[#39AEA9] text-[#0E1719] border-[#E5EFC1] shadow-lg shadow-[#39AEA9]/40'
                  : 'bg-[#0E1719]/90 text-[#E5EFC1] border-[#A2D5AB]/40 hover:border-[#39AEA9] hover:text-[#A2D5AB]'
              }`}
            >
              {isInVersus ? (
                <>
                  <Check className="w-3 h-3" /> In Versus
                </>
              ) : (
                <>
                  <Scale className="w-3 h-3 text-[#39AEA9]" /> + Versus
                </>
              )}
            </button>
          )}

          <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
            <button
              onClick={(e) => {
                e.preventDefault();
                if (onProductInteract) onProductInteract(product);
                if (onToggleWishlist) onToggleWishlist();
              }}
              title="Save to Wishlist"
              className="p-2 rounded-full bg-[#0E1719]/80 border border-[#A2D5AB]/30 backdrop-blur-md hover:border-[#39AEA9] hover:scale-110 transition-all cursor-pointer"
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  isWishlisted ? 'fill-[#39AEA9] text-[#39AEA9]' : 'text-[#E5EFC1]'
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
                className="p-2 rounded-full bg-[#0E1719]/80 border border-[#A2D5AB]/30 backdrop-blur-md text-[#A2D5AB] hover:text-[#E5EFC1] hover:border-[#39AEA9] transition-all cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className={compact ? 'p-3' : 'p-4'}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-[#A2D5AB] mb-1">
            <span className="truncate max-w-[70%]">{product.brand}</span>
            {product.rating && (
              <span className="flex items-center gap-1 text-[#E5EFC1] shrink-0">
                <Star className="w-3 h-3 fill-[#39AEA9] text-[#39AEA9]" />
                {product.rating}
              </span>
            )}
          </div>

          <h3
            className={`font-harmond font-semibold line-clamp-2 text-[#E5EFC1] ${
              compact ? 'text-base leading-snug' : 'text-lg sm:text-xl leading-snug'
            }`}
            title={product.name}
          >
            {product.name}
          </h3>

          {!compact && (
            <div className="text-[11px] text-[#A2D5AB]/80 mt-1.5 flex items-center justify-between">
              <span className="text-[#A2D5AB] font-medium">{product.category}</span>
              <button
                onClick={() => onOpenReporter && onOpenReporter(product)}
                className="text-[#A2D5AB] hover:text-[#E5EFC1] underline cursor-pointer"
              >
                Fix Info
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[#557B83]/30 px-3.5 sm:px-4 py-3 flex flex-col gap-2.5 bg-[#0B1214]/80">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base sm:text-lg text-[#E5EFC1]">
              ₹{Number(product.price_inr).toLocaleString('en-IN')}
            </span>
            {product.mrp_inr && product.mrp_inr > product.price_inr && (
              <span className="text-xs text-[#557B83] line-through">
                ₹{Number(product.mrp_inr).toLocaleString('en-IN')}
              </span>
            )}
          </div>
          {discount && (
            <span className="text-[10px] sm:text-[11px] font-bold text-[#0E1719] bg-[#A2D5AB] px-2 py-0.5 rounded-full">
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
            className="py-2 px-2 rounded-xl font-semibold text-xs border border-[#557B83]/60 bg-[#162427] text-[#E5EFC1] hover:border-[#A2D5AB] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <BarChart2 className="w-3.5 h-3.5 text-[#A2D5AB] shrink-0" />
            <span className="truncate">{compact ? 'Graph' : 'Price Graph'}</span>
          </button>

          <a
            href={liveRedirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onProductInteract && onProductInteract(product)}
            className="py-2 px-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[#39AEA9] to-[#A2D5AB] text-[#0E1719] hover:brightness-110 transition-all flex items-center justify-center gap-1 shadow-md shadow-[#39AEA9]/25"
          >
            <span className="truncate">Buy Now</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}