import os
import json
import re
import time
import hashlib
import secrets
import urllib.parse
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, Query, Request, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI
from duckduckgo_search import DDGS

# 1. Load Environment Variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY in .env file!")

# 2. Initialize Clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

llm_client = OpenAI(
    api_key=GROQ_API_KEY or "missing_key",
    base_url="https://api.groq.com/openai/v1"
)

MODEL_CHAIN = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768"
]

# 3. Initialize FastAPI App
app = FastAPI(
    title="Khojo AI Backend API",
    description="Auth, ML Personalization Engine, Live Scraper & Conversational Hub",
    version="5.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. In-Memory Rate Limit & Auth Session Stores
RATE_LIMIT_STORE: Dict[str, List[float]] = {}
ACTIVE_SESSIONS: Dict[str, Dict[str, Any]] = {}
FALLBACK_USERS_DB: Dict[str, Dict[str, Any]] = {}

def check_rate_limit(client_ip: str, max_requests: int = 15, window_sec: int = 60) -> bool:
    now = time.time()
    timestamps = RATE_LIMIT_STORE.get(client_ip, [])
    timestamps = [t for t in timestamps if now - t < window_sec]
    if len(timestamps) >= max_requests:
        RATE_LIMIT_STORE[client_ip] = timestamps
        return False
    timestamps.append(now)
    RATE_LIMIT_STORE[client_ip] = timestamps
    return True

def hash_password(password: str) -> str:
    return hashlib.sha256(f"khojo_salt_{password}".encode("utf-8")).hexdigest()

# 5. Pydantic Schemas
class AuthSignupRequest(BaseModel):
    name: str
    email: str
    password: str
    ml_profile: Optional[Dict[str, Any]] = {}

class AuthLoginRequest(BaseModel):
    email: str
    password: str

class MLSyncRequest(BaseModel):
    email: str
    ml_profile: Dict[str, Any]

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    user_profile: Optional[Dict[str, Any]] = None
    website_hp: Optional[str] = ""

class ChatResponse(BaseModel):
    reply: str
    products: List[Dict[str, Any]] = []
    mode_used: str = "ai_agent"

class IssueReportRequest(BaseModel):
    product_id: Optional[str] = ""
    product_name: str
    platform: Optional[str] = "General"
    issue_type: str
    correct_info: str
    user_contact: Optional[str] = ""
    website_hp: Optional[str] = ""

# =====================================================================
# 6. AUTHENTICATION ENDPOINTS (SIGNUP / LOGIN / LOGOUT / ML SYNC)
# =====================================================================

@app.post("/api/auth/signup")
def register_user(req: AuthSignupRequest):
    email_clean = req.email.strip().lower()
    name_clean = req.name.strip() or email_clean.split("@")[0].capitalize()
    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    pw_hash = hash_password(req.password)
    token = secrets.token_hex(24)

    user_record = {
        "name": name_clean,
        "email": email_clean,
        "password_hash": pw_hash,
        "tier": "Signal Red VIP",
        "ml_profile": req.ml_profile or {}
    }

    # Try saving to Supabase `users` table first, fallback to in-memory store
    try:
        existing = supabase.table("users").select("*").eq("email", email_clean).execute()
        if existing.data and len(existing.data) > 0:
            raise HTTPException(status_code=400, detail="Account already exists. Please Sign In.")
        ins = supabase.table("users").insert(user_record).execute()
        saved_user = ins.data[0] if ins.data else user_record
    except HTTPException:
        raise
    except Exception:
        if email_clean in FALLBACK_USERS_DB:
            raise HTTPException(status_code=400, detail="Account already exists. Please Sign In.")
        FALLBACK_USERS_DB[email_clean] = user_record
        saved_user = user_record

    public_user = {
        "name": saved_user.get("name", name_clean),
        "email": email_clean,
        "tier": saved_user.get("tier", "Signal Red VIP"),
        "joinedAt": time.strftime("%b %Y"),
        "ml_profile": saved_user.get("ml_profile") or {}
    }
    ACTIVE_SESSIONS[token] = public_user
    return {"status": "success", "token": token, "user": public_user}

@app.post("/api/auth/login")
def login_user(req: AuthLoginRequest):
    email_clean = req.email.strip().lower()
    pw_hash = hash_password(req.password)
    token = secrets.token_hex(24)

    # Demo 1-Click Login support
    if email_clean == "nikhil@khojo.ai" and req.password == "demo1234":
        demo_user = {
            "name": "Nikhil",
            "email": "nikhil@khojo.ai",
            "tier": "Signal Red VIP",
            "joinedAt": "Nov 2026",
            "ml_profile": {}
        }
        ACTIVE_SESSIONS[token] = demo_user
        return {"status": "success", "token": token, "user": demo_user}

    found_user = None
    try:
        res = supabase.table("users").select("*").eq("email", email_clean).execute()
        if res.data and len(res.data) > 0:
            found_user = res.data[0]
    except Exception:
        found_user = FALLBACK_USERS_DB.get(email_clean)

    if not found_user:
        # Auto-provision account on first login for frictionless UX
        auto_name = email_clean.split("@")[0].capitalize()
        found_user = {
            "name": auto_name,
            "email": email_clean,
            "password_hash": pw_hash,
            "tier": "Signal Red VIP",
            "ml_profile": {}
        }
        FALLBACK_USERS_DB[email_clean] = found_user
        try:
            supabase.table("users").insert(found_user).execute()
        except Exception:
            pass
    elif found_user.get("password_hash") != pw_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    public_user = {
        "name": found_user.get("name", "Member"),
        "email": email_clean,
        "tier": found_user.get("tier", "Signal Red VIP"),
        "joinedAt": time.strftime("%b %Y"),
        "ml_profile": found_user.get("ml_profile") or {}
    }
    ACTIVE_SESSIONS[token] = public_user
    return {"status": "success", "token": token, "user": public_user}

@app.post("/api/auth/logout")
def logout_user(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
        ACTIVE_SESSIONS.pop(token, None)
    return {"status": "success", "message": "Logged out and session token revoked."}

@app.post("/api/auth/sync-ml")
def sync_user_ml_profile(req: MLSyncRequest):
    email_clean = req.email.strip().lower()
    if email_clean in FALLBACK_USERS_DB:
        FALLBACK_USERS_DB[email_clean]["ml_profile"] = req.ml_profile
    try:
        supabase.table("users").update({"ml_profile": req.ml_profile}).eq("email", email_clean).execute()
    except Exception:
        pass
    return {"status": "synced"}

# =====================================================================
# 7. STORE POLICIES, INTENT ROUTER & ML INVENTORY RANKING
# =====================================================================
STORE_POLICIES = {
    "return": "All items across Amazon India, Flipkart, Myntra, and Nykaa via Khojo AI support a 7-Day Easy Return & Exchange policy for unused items with original tags.",
    "shipping": "Free standard delivery across India on orders above ₹499. Express delivery takes 1-3 business days in metro cities.",
    "payment": "We support UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and Cash on Delivery (COD) on eligible pin codes.",
    "authenticity": "100% Verified Original Brands. All electronics come with standard manufacturer warranty across India."
}

GREETING_PATTERNS = {
    "hi", "hello", "hey", "namaste", "hola", "yo", "sup", "good morning",
    "good evening", "good afternoon", "who are you", "what can you do",
    "help", "how are you", "thanks", "thank you", "ok", "okay", "bye"
}

def detect_user_intent(message: str) -> str:
    clean = re.sub(r"[^\w\s]", "", message.lower()).strip()
    if not clean:
        return "greeting"
    if clean in GREETING_PATTERNS or (len(clean.split()) <= 2 and any(w in GREETING_PATTERNS for w in clean.split())):
        return "greeting"
    if any(k in clean for k in ["return", "refund", "exchange", "policy", "shipping", "delivery", "cod", "payment", "warranty"]):
        return "policy"
    return "product_search"

def normalize_tags(raw_tags: Any) -> str:
    if isinstance(raw_tags, list):
        return " ".join(str(t) for t in raw_tags)
    if isinstance(raw_tags, str):
        return raw_tags.replace("{", "").replace("}", "").replace('"', "").replace(",", " ")
    return ""

def score_products_by_keywords(
    items: List[Dict[str, Any]],
    query: str,
    user_profile: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    if not query or not query.strip():
        return items

    query_clean = re.sub(r"\.", "", query.lower())
    query_clean = re.sub(r"[^\w\s]", " ", query_clean)
    stop_words = {
        "find", "me", "a", "an", "the", "under", "below", "on", "in", "for",
        "with", "and", "or", "show", "some", "best", "good", "buy", "want",
        "need", "looking", "search", "rs", "inr", "rupees", "from", "to",
        "compare", "price", "of", "please", "dikhao", "chahiye"
    }
    keywords = [
        w for w in query_clean.split()
        if w not in stop_words and not w.isdigit() and len(w) >= 2
    ]

    if not keywords:
        return []

    cat_affinities = (user_profile or {}).get("categories", {})
    brand_affinities = (user_profile or {}).get("brands", {})

    scored_items = []
    for item in items:
        tags_str = normalize_tags(item.get("tags"))
        searchable_text = " ".join([
            str(item.get("name", "")),
            str(item.get("brand", "")),
            str(item.get("category", "")),
            str(item.get("platform", "")),
            tags_str
        ]).lower().replace(".", "")

        score = 0.0
        for kw in keywords:
            if kw in searchable_text:
                score += 4.0
            elif kw.endswith("s") and len(kw) > 3 and kw[:-1] in searchable_text:
                score += 4.0

        cat_name = str(item.get("category", ""))
        cat_lower = cat_name.lower()
        if any(k in ["shoe", "shoes", "sneaker", "sneakers", "running", "footwear", "clogs", "boots"] for k in keywords) and cat_lower == "footwear":
            score += 3.0
        if any(k in ["hoodie", "shirt", "shirts", "tshirt", "kurta", "jeans", "cargo", "cargos", "jacket", "blazer", "apparel", "polo"] for k in keywords) and cat_lower == "apparel":
            score += 3.0
        if any(k in ["skin", "skincare", "cleanser", "serum", "face", "lipstick", "makeup", "sunscreen", "moisturizer", "beauty", "nykaa"] for k in keywords) and cat_lower == "beauty":
            score += 3.0
        if any(k in ["mouse", "headphone", "headphones", "earphone", "earbuds", "speaker", "keyboard", "ssd", "powerbank", "noise", "cancelling", "tech", "gaming", "electronics"] for k in keywords) and cat_lower == "electronics":
            score += 3.0
        if any(k in ["watch", "watches", "sunglasses", "bag", "backpack", "wallet", "trolley", "tumbler", "accessories"] for k in keywords) and cat_lower == "accessories":
            score += 3.0

        if score > 0:
            # Boost by user's Machine Learning profile weights
            score += min(3.5, float(cat_affinities.get(cat_name, 0)) * 0.25)
            score += min(3.0, float(brand_affinities.get(item.get("brand", ""), 0)) * 0.4)
            scored_items.append((score, item))

    scored_items.sort(key=lambda x: (x[0], float(x[1].get("rating") or 0)), reverse=True)
    return [item for _, item in scored_items]

def search_supabase_products(
    query: str = "",
    category: Optional[str] = None,
    platform: Optional[str] = None,
    max_price: Optional[float] = None,
    strict_match: bool = False,
    user_profile: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    try:
        req = supabase.table("products").select("*")

        if category and category.lower() != "all":
            req = req.ilike("category", f"%{category.strip()}%")

        if platform and platform.lower() != "all":
            req = req.ilike("platform", f"%{platform.strip()}%")

        if max_price is not None and max_price > 0:
            req = req.lte("price_inr", max_price)

        response = req.execute()
        items = response.data or []

        if query and query.strip():
            ranked = score_products_by_keywords(items, query, user_profile=user_profile)
            if ranked:
                return ranked[:8]
            return [] if strict_match else items[:8]

        return items[:200]

    except Exception as e:
        print(f"Supabase Search Error: {e}")
        return []

def extract_filters_from_text(text: str) -> Dict[str, Any]:
    text_lower = text.lower()
    max_price = None
    price_match = re.search(r"(?:under|below|less than|budget|max|₹|rs\.?\s*)\s*(\d{3,6})", text_lower)
    if price_match:
        max_price = float(price_match.group(1))

    platform = None
    for plat in ["myntra", "flipkart", "nykaa", "amazon"]:
        if plat in text_lower:
            platform = "Amazon India" if plat == "amazon" else plat.capitalize()
            break

    category = None
    if any(w in text_lower for w in ["shoe", "shoes", "sneaker", "sneakers", "footwear", "boot", "boots", "clog", "clogs"]):
        category = "Footwear"
    elif any(w in text_lower for w in ["hoodie", "shirt", "shirts", "tshirt", "kurta", "saree", "apparel", "jeans", "cargo", "cargos", "jacket", "blazer"]):
        category = "Apparel"
    elif any(w in text_lower for w in ["skin", "skincare", "serum", "cleanser", "face wash", "sunscreen", "moisturizer", "lipstick", "foundation", "makeup", "beauty"]):
        category = "Beauty"
    elif any(w in text_lower for w in ["mouse", "headphone", "headphones", "earbud", "earbuds", "speaker", "keyboard", "ssd", "power bank", "powerbank", "electronics", "gaming", "noise cancelling"]):
        category = "Electronics"
    elif any(w in text_lower for w in ["bag", "backpack", "tote", "trolley", "wallet", "watch", "watches", "sunglass", "sunglasses", "tumbler", "accessories"]):
        category = "Accessories"

    return {"max_price": max_price, "platform": platform, "category": category}

# =====================================================================
# 8. REAL-TIME SHOPPING SCRAPER & GROQ AI AUTO-CATEGORIZER
# =====================================================================
CATEGORY_FALLBACK_IMAGES = {
    "Footwear": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600",
    "Beauty": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600",
    "Electronics": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600",
    "Apparel": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600",
    "Accessories": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"
}

def fetch_live_ecommerce_products(query: str, max_price: Optional[float] = None) -> List[Dict[str, Any]]:
    raw_snippets = []
    image_map: List[str] = []

    try:
        with DDGS() as ddgs:
            search_q = f"{query} price in India (site:amazon.in OR site:flipkart.com OR site:myntra.com OR site:nykaa.com)"
            web_results = list(ddgs.text(search_q, region="in-en", max_results=6))
            for r in web_results:
                raw_snippets.append({
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "url": r.get("href", "")
                })
            try:
                img_results = list(ddgs.images(f"{query} product india ecommerce", region="in-en", max_results=6))
                image_map = [img.get("image") for img in img_results if img.get("image", "").startswith("http")]
            except Exception:
                pass
    except Exception as e:
        print(f"Live DDGS scrape warning: {e}")

    if not raw_snippets or not GROQ_API_KEY:
        return []

    ai_extraction_prompt = f"""
You are an expert Indian E-Commerce Data Extractor & Categorizer for Khojo AI.
Convert the following live search snippets for the user query "{query}" into a valid JSON array of up to 4 real products.

Each product object MUST have these exact keys:
- "name": Clean, specific product title (string)
- "brand": Brand name (string)
- "category": MUST be strictly one of: ["Footwear", "Beauty", "Electronics", "Apparel", "Accessories"]
- "platform": MUST be strictly one of: ["Amazon India", "Flipkart", "Myntra", "Nykaa"]
- "price_inr": Realistic current Indian price in INR (integer). {f"Must be <= {int(max_price)}" if max_price else ""}
- "mrp_inr": Original MRP integer (~25% higher than price_inr)
- "rating": Float between 4.1 and 4.8
- "in_stock": true
- "tags": Array of 4 lowercase searchable keywords

Return ONLY a raw JSON array `[...]` with no markdown backticks.

Live Snippets:
{json.dumps(raw_snippets, indent=2)}
"""

    for model_name in MODEL_CHAIN:
        try:
            completion = llm_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": ai_extraction_prompt}],
                temperature=0.2,
                max_tokens=700
            )
            raw_output = completion.choices[0].message.content.strip()
            json_match = re.search(r"\[.*\]", raw_output, re.DOTALL)
            if not json_match:
                continue

            parsed_items = json.loads(json_match.group(0))
            saved_products = []

            for idx, item in enumerate(parsed_items):
                cat = item.get("category", "Accessories")
                if cat not in CATEGORY_FALLBACK_IMAGES:
                    cat = "Accessories"

                img_url = image_map[idx] if idx < len(image_map) else CATEGORY_FALLBACK_IMAGES[cat]

                clean_row = {
                    "name": str(item.get("name", query.title()))[:180],
                    "brand": str(item.get("brand", "Verified Brand"))[:80],
                    "category": cat,
                    "platform": item.get("platform") if item.get("platform") in ["Amazon India", "Flipkart", "Myntra", "Nykaa"] else "Amazon India",
                    "price_inr": int(item.get("price_inr") or 1999),
                    "mrp_inr": int(item.get("mrp_inr") or 2799),
                    "rating": float(item.get("rating") or 4.4),
                    "in_stock": True,
                    "image_url": img_url,
                    "tags": item.get("tags") if isinstance(item.get("tags"), list) else [query.lower(), cat.lower()]
                }

                try:
                    ins = supabase.table("products").insert(clean_row).execute()
                    if ins.data and len(ins.data) > 0:
                        saved_products.append(ins.data[0])
                    else:
                        clean_row["id"] = f"live-{int(time.time())}-{idx}"
                        saved_products.append(clean_row)
                except Exception:
                    clean_row["id"] = f"live-{int(time.time())}-{idx}"
                    saved_products.append(clean_row)

            return saved_products
        except Exception as e:
            print(f"AI Live Categorizer error on {model_name}: {e}")
            continue

    return []

# =====================================================================
# 9. CATALOG & CHATBOT ENDPOINTS
# =====================================================================

@app.get("/")
def health_check():
    return {"status": "online", "service": "Khojo AI Backend v5.0 (Auth + ML + Live Scraper)"}

@app.get("/api/products")
def get_catalog_products(
    category: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    max_price: Optional[float] = Query(None),
    q: Optional[str] = Query(None)
):
    products = search_supabase_products(
        query=q or "",
        category=category,
        platform=platform,
        max_price=max_price,
        strict_match=bool(q and q.strip())
    )
    if q and q.strip() and len(products) == 0:
        products = fetch_live_ecommerce_products(q.strip(), max_price=max_price)

    return {"products": products, "count": len(products)}

@app.post("/api/live-ingest")
def trigger_live_product_discovery(query: str = Query(...)):
    discovered = fetch_live_ecommerce_products(query)
    return {"status": "success", "discovered_count": len(discovered), "products": discovered}

@app.post("/api/chat", response_model=ChatResponse)
def chat_with_assistant(req: ChatRequest, request: Request):
    if req.website_hp and req.website_hp.strip() != "":
        return ChatResponse(reply="Spam detected.", products=[], mode_used="spam_shield")

    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(f"chat:{client_ip}", max_requests=15, window_sec=60):
        return ChatResponse(
            reply="⏳ You are sending messages too quickly! Please wait a few seconds.",
            products=[],
            mode_used="rate_limiter"
        )

    user_msg = req.message.strip()[:500]
    intent = detect_user_intent(user_msg)

    if intent == "greeting":
        greeting_reply = (
            "Namaste! ✨ Welcome to **Khojo AI**, your central conversational commerce hub.\n\n"
            "I am trained to:\n"
            "1. **Answer repetitive questions** (*\"What is your return policy?\"*, *\"Do you support COD?\"*)\n"
            "2. **Search live inventory data** across Amazon India, Flipkart, Myntra & Nykaa\n"
            "3. **Make personalized ML product recommendations** tailored to your search history.\n\n"
            "What would you like to find or compare today?"
        )
        return ChatResponse(reply=greeting_reply, products=[], mode_used="intent_greeting")

    if intent == "policy":
        policy_info = "\n".join([f"• **{k.capitalize()}**: {v}" for k, v in STORE_POLICIES.items()])
        return ChatResponse(
            reply=f"Here are our official **Khojo AI** customer support policies:\n\n{policy_info}\n\nWhat product can I help you find today?",
            products=[],
            mode_used="policy_engine"
        )

    filters = extract_filters_from_text(user_msg)

    matched_products = search_supabase_products(
        query=user_msg,
        category=filters["category"],
        platform=filters["platform"],
        max_price=filters["max_price"],
        strict_match=True,
        user_profile=req.user_profile
    )

    if not matched_products and filters["category"]:
        matched_products = search_supabase_products(
            query=user_msg,
            category=filters["category"],
            max_price=filters["max_price"],
            strict_match=True,
            user_profile=req.user_profile
        )

    if not matched_products:
        matched_products = search_supabase_products(
            query=user_msg,
            strict_match=True,
            user_profile=req.user_profile
        )

    scraped_live = False
    if not matched_products:
        matched_products = fetch_live_ecommerce_products(user_msg, max_price=filters["max_price"])
        if matched_products:
            scraped_live = True

    product_context = json.dumps([
        {
            "name": p.get("name"),
            "brand": p.get("brand"),
            "category": p.get("category"),
            "platform": p.get("platform"),
            "price_inr": p.get("price_inr"),
            "rating": p.get("rating")
        }
        for p in matched_products
    ], indent=2)

    system_prompt = (
        "You are Khojo AI, India's central conversational shopping & ML recommendation system covering Amazon India, Flipkart, Myntra, and Nykaa. "
        "Keep your response friendly, concise (2-3 sentences max), and helpful. Use ₹ for prices. "
        f"{'Note: You just fetched and auto-categorized these items LIVE from Indian shopping sites! ' if scraped_live else ''}"
        "Highlight the best options from the matching products below, and remind the user they can click 'Compare' for the 6-month price graph or 'Buy Now'.\n\n"
        f"Matching Catalog Products:\n{product_context}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for h in (req.history or [])[-4:]:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": user_msg})

    if GROQ_API_KEY and matched_products:
        for model_name in MODEL_CHAIN:
            try:
                completion = llm_client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=0.4,
                    max_tokens=250
                )
                ai_reply = completion.choices[0].message.content
                return ChatResponse(
                    reply=ai_reply,
                    products=matched_products,
                    mode_used=f"{model_name}{'_live_scraped' if scraped_live else ''}"
                )
            except Exception:
                continue

    if matched_products:
        top = matched_products[0]
        reply_text = (
            f"I found **{len(matched_products)} personalized options** for you under **{top.get('category')}**! "
            f"The top pick is the **{top.get('name')}** by {top.get('brand')} on **{top.get('platform')}** for **₹{top.get('price_inr')}**. "
            "Tap **Compare** to inspect the 6-month price history or click **Buy Now**!"
        )
    else:
        reply_text = (
            f"I searched across Amazon India, Flipkart, Myntra & Nykaa for **\"{user_msg}\"**, "
            "but couldn't verify an in-stock listing right now. Try searching a specific brand or product name!"
        )

    return ChatResponse(reply=reply_text, products=matched_products, mode_used="ml_discovery")

# =====================================================================
# 10. DATABASE FIX REPORTER & LINK RESOLVER
# =====================================================================
FALLBACK_REPORTS_LOG: List[Dict[str, Any]] = []

@app.post("/api/report")
def submit_product_fix_report(report: IssueReportRequest, request: Request):
    if report.website_hp and report.website_hp.strip() != "":
        return {"status": "ignored", "message": "Bot spam blocked."}

    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(f"report:{client_ip}", max_requests=5, window_sec=60):
        raise HTTPException(status_code=429, detail="Too many reports submitted.")

    clean_info = report.correct_info.strip()
    if len(clean_info) < 4:
        raise HTTPException(status_code=400, detail="Please provide valid details.")

    payload = {
        "product_id": str(report.product_id or ""),
        "product_name": report.product_name.strip()[:200],
        "platform": (report.platform or "General").strip()[:60],
        "issue_type": report.issue_type.strip()[:60],
        "correct_info": clean_info[:1000],
        "user_contact": (report.user_contact or "").strip()[:120],
        "status": "pending"
    }

    try:
        res = supabase.table("issue_reports").insert(payload).execute()
        return {"status": "success", "message": "Report saved to Supabase database!", "data": res.data}
    except Exception:
        FALLBACK_REPORTS_LOG.append(payload)
        return {"status": "logged", "message": "Report logged successfully!"}

@app.get("/api/reports")
def list_submitted_reports():
    try:
        res = supabase.table("issue_reports").select("*").order("created_at", desc=True).limit(25).execute()
        return {"reports": res.data or []}
    except Exception:
        return {"reports": FALLBACK_REPORTS_LOG}

@app.post("/api/admin/resolve-report")
def resolve_issue_report(report_id: str, action: str = "approve"):
    try:
        if action == "approve":
            supabase.table("issue_reports").update({"status": "resolved"}).eq("id", report_id).execute()
            return {"status": "success", "message": "Report approved!"}
        else:
            supabase.table("issue_reports").delete().eq("id", report_id).execute()
            return {"status": "success", "message": "Report dismissed."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

PLATFORM_CONFIG = {
    "myntra": {
        "domain": "myntra.com",
        "is_product_page": lambda url: "/buy" in url,
        "fallback": lambda q: f"https://www.myntra.com/{urllib.parse.quote(re.sub(r'[^a-zA-Z0-9\s]', '', q).strip().replace(' ', '-').lower())}?rawQuery={urllib.parse.quote(q)}"
    },
    "flipkart": {
        "domain": "flipkart.com",
        "is_product_page": lambda url: "/p/" in url or "pid=" in url,
        "fallback": lambda q: f"https://www.flipkart.com/search?q={urllib.parse.quote_plus(q)}"
    },
    "amazon india": {
        "domain": "amazon.in",
        "is_product_page": lambda url: "/dp/" in url or "/gp/product/" in url,
        "fallback": lambda q: f"https://www.amazon.in/s?k={urllib.parse.quote_plus(q)}"
    },
    "nykaa": {
        "domain": "nykaa.com",
        "is_product_page": lambda url: "/p/" in url,
        "fallback": lambda q: f"https://www.nykaa.com/search/result/?q={urllib.parse.quote_plus(q)}"
    }
}

RESOLVED_LINK_CACHE: Dict[str, str] = {}

@app.get("/api/redirect")
def resolve_live_product_link(
    name: str = Query(...),
    brand: str = Query(""),
    platform: str = Query("Amazon India")
):
    plat_key = platform.lower().strip()
    if "amazon" in plat_key:
        plat_key = "amazon india"
    elif "flipkart" in plat_key:
        plat_key = "flipkart"
    elif "nykaa" in plat_key:
        plat_key = "nykaa"
    elif "myntra" in plat_key:
        plat_key = "myntra"

    config = PLATFORM_CONFIG.get(plat_key, PLATFORM_CONFIG["amazon india"])
    clean_name = re.sub(r"[^\w\s\-]", " ", name).strip()
    clean_brand = re.sub(r"[^\w\s\-]", " ", brand).strip()
    clean_query = f"{clean_brand} {clean_name}".strip() if clean_brand.lower() not in clean_name.lower() else clean_name

    cache_key = f"{plat_key}:{clean_query.lower()}"
    if cache_key in RESOLVED_LINK_CACHE:
        return RedirectResponse(url=RESOLVED_LINK_CACHE[cache_key], status_code=302)

    try:
        with DDGS() as ddgs:
            ddg_query = f"site:{config['domain']} {clean_query}"
            results = list(ddgs.text(ddg_query, region="in-en", max_results=5))
            for r in results:
                href = r.get("href", "")
                if href.startswith("http") and config["domain"] in href and config["is_product_page"](href):
                    RESOLVED_LINK_CACHE[cache_key] = href
                    return RedirectResponse(url=href, status_code=302)
    except Exception:
        pass

    fallback_url = config["fallback"](clean_query)
    RESOLVED_LINK_CACHE[cache_key] = fallback_url
    return RedirectResponse(url=fallback_url, status_code=302)