// Background Machine Learning Personalization Engine for Khojo AI
const STORAGE_KEY = 'khojo_ml_profile';

const DEFAULT_PROFILE = {
  categories: { Footwear: 1, Beauty: 1, Electronics: 1, Apparel: 1, Accessories: 1 },
  brands: {},
  keywords: [],
  searchHistory: [],
  viewedProducts: [],
  totalInteractions: 0
};

export function getMLProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveMLProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  try {
    const rawUser = localStorage.getItem('khojo_user');
    if (rawUser) {
      const user = JSON.parse(rawUser);
      if (user?.email) {
        const apiBase =
          import.meta.env.VITE_API_URL || 'https://khogo-ai.onrender.com';
        fetch(`${apiBase}/api/auth/sync-ml`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, ml_profile: profile })
        }).catch(() => {});
      }
    }
  } catch {
    // Ignore background sync errors
  }
}

export function resetMLProfile() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROFILE));
  return DEFAULT_PROFILE;
}

// Train ML weights silently whenever the user searches, chats, or clicks a product
export function recordUserInteraction({ type, query = '', product = null, category = '' }) {
  const profile = getMLProfile();
  profile.totalInteractions = (profile.totalInteractions || 0) + 1;

  if (category && category !== 'All') {
    const cleanCat =
      category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    profile.categories[cleanCat] = (profile.categories[cleanCat] || 1) + 3;
  }

  if (product) {
    const prodCat = product.category || 'Accessories';
    profile.categories[prodCat] = (profile.categories[prodCat] || 1) + 4;

    if (product.brand) {
      profile.brands[product.brand] = (profile.brands[product.brand] || 0) + 5;
    }

    const filteredViews = (profile.viewedProducts || []).filter(
      (p) => p.id !== product.id
    );
    profile.viewedProducts = [
      {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price_inr: product.price_inr,
        timestamp: new Date().toISOString()
      },
      ...filteredViews
    ].slice(0, 15);
  }

  if (query && query.trim().length > 2) {
    const qClean = query.trim().toLowerCase();
    const stopWords = new Set([
      'find', 'me', 'a', 'good', 'best', 'show', 'under', 'on', 'in', 'for', 'the', 'what', 'is', 'your', 'policy', 'return', 'cod'
    ]);
    const words = qClean
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    profile.keywords = [...new Set([...words, ...(profile.keywords || [])])].slice(0, 25);

    if (type === 'search' || type === 'chat') {
      profile.searchHistory = [
        { query: query.trim(), timestamp: new Date().toISOString() },
        ...(profile.searchHistory || []).filter(
          (h) => h.query.toLowerCase() !== qClean
        )
      ].slice(0, 12);
    }

    if (/shoe|sneaker|boot|clog|footwear|running/.test(qClean)) {
      profile.categories.Footwear = (profile.categories.Footwear || 1) + 4;
    }
    if (/serum|skin|cleanser|face|lipstick|beauty|nykaa|sunscreen/.test(qClean)) {
      profile.categories.Beauty = (profile.categories.Beauty || 1) + 4;
    }
    if (/headphone|earbud|mouse|gaming|laptop|ssd|watch|speaker|electronics/.test(qClean)) {
      profile.categories.Electronics = (profile.categories.Electronics || 1) + 4;
    }
    if (/shirt|polo|hoodie|jeans|kurta|cargo|jacket|apparel/.test(qClean)) {
      profile.categories.Apparel = (profile.categories.Apparel || 1) + 4;
    }
  }

  saveMLProfile(profile);
  return profile;
}

// Compute personalized score for background product ranking
export function scoreProductForUser(product, profile) {
  if (!product || !profile) return 80;
  let score = 72;

  const catWeight = profile.categories?.[product.category] || 1;
  score += Math.min(14, catWeight * 2);

  const brandWeight = profile.brands?.[product.brand] || 0;
  score += Math.min(8, brandWeight * 2);

  const searchable = `${product.name || ''} ${product.brand || ''} ${
    Array.isArray(product.tags) ? product.tags.join(' ') : product.tags || ''
  }`.toLowerCase();

  let keywordHits = 0;
  for (const kw of profile.keywords || []) {
    if (searchable.includes(kw)) keywordHits += 1;
  }
  score += Math.min(7, keywordHits * 3);

  return Math.min(99, Math.round(score));
}

export function getTopUserInterests(profile) {
  const cats = Object.entries(profile?.categories || {})
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  const topBrands = Object.entries(profile?.brands || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);

  return {
    topCategory: cats[0] || 'Footwear',
    rankedCategories: cats,
    topBrands,
    recentKeywords: (profile?.keywords || []).slice(0, 8)
  };
}