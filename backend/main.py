import os
import json
import re
import time
import hashlib
import secrets
import random
import smtplib
import urllib.parse
import urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, Query, Request, HTTPException, Header, BackgroundTasks
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

# Real Production Email & SMS Credentials (Set in Render Environment Variables)
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "").strip()

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
    description="Real-World Multi-Channel Auth, Automated Mailer, ML Ranking, Live Scraper & AI Versus Engine",
    version="6.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. In-Memory Stores (Rate Limits, Sessions, OTPs, Users Fallback)
RATE_LIMIT_STORE: Dict[str, List[float]] = {}
ACTIVE_SESSIONS: Dict[str, Dict[str, Any]] = {}
FALLBACK_USERS_DB: Dict[str, Dict[str, Any]] = {}
OTP_STORE: Dict[str, Dict[str, Any]] = {}

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

# =====================================================================
# 5. REAL-TIME EMAIL DISPATCHERS (WELCOME EMAIL & OTP VERIFICATION EMAIL)
# =====================================================================
def send_welcome_email(to_email: str, user_name: str, auth_method: str = "Email") -> bool:
    """Sends a styled HTML confirmation email upon successful login or signup."""
    if not to_email or "@" not in to_email or not (SMTP_EMAIL and SMTP_PASSWORD):
        return False

    subject = "✨ Welcome to Khojo AI — Login Successful!"
    html_body = f"""
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #121215; color: #E2E8F0; border-radius: 20px; border: 1px solid #2E2E38; overflow: hidden;">
      <div style="background: linear-gradient(90deg, #18181F, #2B1216, #18181F); padding: 24px; border-bottom: 1px solid #2E2E38; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; color: #FFFFFF; letter-spacing: 1px;">KHOJO <span style="color: #FF2A2A; font-style: italic;">AI</span></h1>
        <p style="margin: 6px 0 0; font-size: 11px; color: #C0C0C8; letter-spacing: 2px; text-transform: uppercase;">Where Shopping Made Eazyyy</p>
      </div>
      <div style="padding: 28px 24px;">
        <h2 style="margin-top: 0; color: #FFFFFF; font-size: 20px;">Namaste, {user_name}! 👋</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #C0C0C8;">
          Your sign-in to <strong>Khojo AI</strong> via <strong>{auth_method}</strong> was successful. Your account is now active and synced with our real-time price intelligence vault.
        </p>
        <div style="background: #18181F; border-left: 3px solid #FF2A2A; padding: 14px 16px; border-radius: 10px; margin: 20px 0; font-size: 13px; color: #E2E8F0;">
          <strong>What you can do now:</strong>
          <ul style="margin: 8px 0 0; padding-left: 18px; color: #C0C0C8;">
            <li>Chat with the Khojo AI Concierge for live inventory & store policies</li>
            <li>Compare 6-month historical price graphs across Amazon India, Flipkart, Myntra & Nykaa</li>
            <li>Run AI Head-to-Head Versus battles on same-category products</li>
          </ul>
        </div>
        <p style="font-size: 12px; color: #8E8E9E; margin-top: 24px;">
          Timestamp: {time.strftime('%d %b %Y, %I:%M %p IST')} • Status: Verified Session
        </p>
      </div>
    </div>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Khojo AI Concierge <{SMTP_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        print(f"[EMAIL SENT] Welcome email delivered to {to_email}")
        return True
    except Exception as e:
        print(f"[SMTP ERROR] Could not send welcome email to {to_email}: {e}")
        return False

def send_otp_email(to_email: str, user_name: str, otp_code: str, phone: str) -> bool:
    """Emails the 6-digit OTP code directly to the user's inbox."""
    if not to_email or "@" not in to_email or not (SMTP_EMAIL and SMTP_PASSWORD):
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🔐 {otp_code} is your Khojo AI verification code"
        msg["From"] = f"Khojo AI Security <{SMTP_EMAIL}>"
        msg["To"] = to_email
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #121215; color: #FFFFFF; padding: 28px; border-radius: 18px; border: 1px solid #2E2E38;">
          <h2 style="margin-top:0; color:#FFFFFF;">Khojo <span style="color:#FF2A2A;">AI</span> Verification</h2>
          <p style="color:#C0C0C8; font-size:14px;">Hi {user_name or 'there'}, use the 6-digit OTP below to verify your login for mobile <strong>+91 {phone}</strong>:</p>
          <div style="background:#1A1A22; border:1px solid #FF2A2A; border-radius:12px; padding:18px; text-align:center; font-size:32px; font-weight:bold; letter-spacing:8px; color:#FFFFFF; margin:20px 0;">
            {otp_code}
          </div>
          <p style="color:#8E8E9E; font-size:12px;">This code expires in 5 minutes. Do not share it with anyone.</p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[OTP EMAIL ERROR] {e}")
        return False

# 6. Pydantic Schemas
class AuthSignupRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = ""
    ml_profile: Optional[Dict[str, Any]] = {}

class AuthLoginRequest(BaseModel):
    email: str
    password: str

class GoogleAuthRequest(BaseModel):
    name: str
    email: str
    google_id: Optional[str] = ""
    avatar_url: Optional[str] = ""
    ml_profile: Optional[Dict[str, Any]] = {}

class SendOTPRequest(BaseModel):
    phone: str
    email: Optional[str] = ""
    name: Optional[str] = ""

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    email: Optional[str] = ""
    name: Optional[str] = ""
    ml_profile: Optional[Dict[str, Any]] = {}

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

class VersusCompareRequest(BaseModel):
    product_a: Dict[str, Any]
    product_b: Dict[str, Any]

class IssueReportRequest(BaseModel):
    product_id: Optional[str] = ""
    product_name: str
    platform: Optional[str] = "General"
    issue_type: str
    correct_info: str
    user_contact: Optional[str] = ""
    website_hp: Optional[str] = ""

# =====================================================================
# 7. MULTI-CHANNEL AUTH ENDPOINTS (EMAIL / GOOGLE / PHONE OTP)
# =====================================================================

@app.post("/api/auth/signup")
def register_user(req: AuthSignupRequest, background_tasks: BackgroundTasks):
    email_clean = req.email.strip().lower()
    name_clean = req.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Please enter your full name.")
    if "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    pw_hash = hash_password(req.password)
    token = secrets.token_hex(24)

    user_record = {
        "name": name_clean,
        "email": email_clean,
        "password_hash": pw_hash,
        "tier": "Verified Member",
        "ml_profile": req.ml_profile or {}
    }

    try:
        existing = supabase.table("users").select("*").eq("email", email_clean).execute()
        if existing.data and len(existing.data) > 0:
            raise HTTPException(status_code=400, detail="An account with this email already exists. Please Sign In.")
        ins = supabase.table("users").insert(user_record).execute()
        saved_user = ins.data[0] if ins.data else user_record
    except HTTPException:
        raise
    except Exception:
        if email_clean in FALLBACK_USERS_DB:
            raise HTTPException(status_code=400, detail="An account with this email already exists. Please Sign In.")
        FALLBACK_USERS_DB[email_clean] = user_record
        saved_user = user_record

    email_configured = bool(SMTP_EMAIL and SMTP_PASSWORD)
    if email_configured:
        background_tasks.add_task(send_welcome_email, email_clean, name_clean, "Email Registration")

    public_user = {
        "name": saved_user.get("name", name_clean),
        "email": email_clean,
        "phone": req.phone or "",
        "authMethod": "Email",
        "tier": "Verified Member",
        "joinedAt": time.strftime("%b %Y"),
        "emailSent": email_configured
    }
    ACTIVE_SESSIONS[token] = public_user
    return {
        "status": "success",
        "token": token,
        "user": public_user,
        "email_sent": email_configured,
        "message": (
            f"Account created! A welcome confirmation email has been sent to {email_clean}."
            if email_configured
            else f"Account created for {email_clean}!"
        )
    }

@app.post("/api/auth/login")
def login_user(req: AuthLoginRequest, background_tasks: BackgroundTasks):
    email_clean = req.email.strip().lower()
    pw_hash = hash_password(req.password)
    token = secrets.token_hex(24)

    found_user = None
    try:
        res = supabase.table("users").select("*").eq("email", email_clean).execute()
        if res.data and len(res.data) > 0:
            found_user = res.data[0]
    except Exception:
        found_user = FALLBACK_USERS_DB.get(email_clean)

    if not found_user:
        raise HTTPException(
            status_code=404,
            detail="No account found with this email address. Please click 'Create one' below to register."
        )

    if found_user.get("password_hash") != pw_hash:
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    user_name = found_user.get("name", email_clean.split("@")[0].capitalize())
    email_configured = bool(SMTP_EMAIL and SMTP_PASSWORD)
    if email_configured:
        background_tasks.add_task(send_welcome_email, email_clean, user_name, "Email Login")

    public_user = {
        "name": user_name,
        "email": email_clean,
        "authMethod": "Email",
        "tier": found_user.get("tier", "Verified Member"),
        "joinedAt": time.strftime("%b %Y"),
        "emailSent": email_configured
    }
    ACTIVE_SESSIONS[token] = public_user
    return {
        "status": "success",
        "token": token,
        "user": public_user,
        "email_sent": email_configured,
        "message": (
            f"Login successful! Confirmation email sent to {email_clean}."
            if email_configured
            else f"Welcome back, {user_name}!"
        )
    }

@app.post("/api/auth/google")
def google_oauth_login(req: GoogleAuthRequest, background_tasks: BackgroundTasks):
    email_clean = req.email.strip().lower()
    name_clean = req.name.strip() or email_clean.split("@")[0].capitalize()
    token = secrets.token_hex(24)

    user_record = {
        "name": name_clean,
        "email": email_clean,
        "password_hash": hash_password(req.google_id or f"google_oauth_{email_clean}"),
        "tier": "Google Verified",
        "ml_profile": req.ml_profile or {}
    }

    try:
        existing = supabase.table("users").select("*").eq("email", email_clean).execute()
        if not existing.data:
            supabase.table("users").insert(user_record).execute()
    except Exception:
        FALLBACK_USERS_DB[email_clean] = user_record

    email_configured = bool(SMTP_EMAIL and SMTP_PASSWORD)
    if email_configured:
        background_tasks.add_task(send_welcome_email, email_clean, name_clean, "Google OAuth 2.0")

    public_user = {
        "name": name_clean,
        "email": email_clean,
        "avatar": req.avatar_url or "",
        "authMethod": "Google",
        "tier": "Google Verified",
        "joinedAt": time.strftime("%b %Y"),
        "emailSent": email_configured
    }
    ACTIVE_SESSIONS[token] = public_user
    return {
        "status": "success",
        "token": token,
        "user": public_user,
        "email_sent": email_configured,
        "message": (
            f"Signed in with Google! Welcome email sent to {email_clean}."
            if email_configured
            else f"Signed in with Google as {name_clean}!"
        )
    }

@app.post("/api/auth/send-otp")
def send_phone_otp(req: SendOTPRequest):
    digits = re.sub(r"\D", "", req.phone)
    if len(digits) < 10:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit Indian mobile number.")
    clean_phone = digits[-10:]

    otp_code = str(random.randint(100000, 999999))
    OTP_STORE[clean_phone] = {
        "otp": otp_code,
        "expires_at": time.time() + 300,
        "name": req.name.strip() if req.name else "",
        "email": req.email.strip().lower() if req.email else ""
    }

    sms_sent = False
    if FAST2SMS_API_KEY:
        try:
            sms_url = (
                f"https://www.fast2sms.com/dev/bulkV2?authorization={FAST2SMS_API_KEY}"
                f"&route=otp&variables_values={otp_code}&flash=0&numbers={clean_phone}"
            )
            req_sms = urllib.request.Request(sms_url, headers={"cache-control": "no-cache"})
            urllib.request.urlopen(req_sms, timeout=8)
            sms_sent = True
        except Exception as e:
            print(f"[FAST2SMS ERROR] {e}")

    email_sent = False
    if req.email and "@" in req.email:
        email_sent = send_otp_email(req.email.strip(), req.name or "", otp_code, clean_phone)

    if not sms_sent and not email_sent:
        raise HTTPException(
            status_code=500,
            detail="To send real OTPs in production, please add SMTP_EMAIL & SMTP_PASSWORD (or FAST2SMS_API_KEY) in your Render Environment Variables."
        )

    channels = []
    if sms_sent:
        channels.append(f"+91 {clean_phone}")
    if email_sent:
        channels.append(req.email.strip())

    return {
        "status": "sent",
        "phone": f"+91 {clean_phone}",
        "sms_sent": sms_sent,
        "email_sent": email_sent,
        "message": f"6-digit verification code sent to {' and '.join(channels)}!"
    }

@app.post("/api/auth/verify-otp")
def verify_phone_otp(req: VerifyOTPRequest, background_tasks: BackgroundTasks):
    digits = re.sub(r"\D", "", req.phone)
    clean_phone = digits[-10:]
    record = OTP_STORE.get(clean_phone)

    if not record or time.time() > record["expires_at"]:
        raise HTTPException(status_code=400, detail="OTP expired or not found. Please request a new OTP.")
    if record["otp"] != req.otp.strip():
        raise HTTPException(status_code=400, detail="Incorrect 6-digit OTP code. Please check your inbox/SMS.")

    user_email = (req.email or record.get("email") or "").strip().lower()
    user_name = (req.name or record.get("name") or "Verified User").strip()
    token = secrets.token_hex(24)

    OTP_STORE.pop(clean_phone, None)

    if user_email:
        user_record = {
            "name": user_name,
            "email": user_email,
            "password_hash": hash_password(f"otp_{clean_phone}"),
            "tier": "Mobile Verified",
            "ml_profile": req.ml_profile or {}
        }
        try:
            existing = supabase.table("users").select("*").eq("email", user_email).execute()
            if not existing.data:
                supabase.table("users").insert(user_record).execute()
        except Exception:
            FALLBACK_USERS_DB[user_email] = user_record

    email_dispatched = bool(SMTP_EMAIL and SMTP_PASSWORD and user_email)
    if email_dispatched:
        background_tasks.add_task(send_welcome_email, user_email, user_name, f"Mobile OTP (+91 {clean_phone})")

    public_user = {
        "name": user_name,
        "email": user_email,
        "phone": f"+91 {clean_phone}",
        "authMethod": "Mobile OTP",
        "tier": "Mobile Verified",
        "joinedAt": time.strftime("%b %Y"),
        "emailSent": email_dispatched
    }
    ACTIVE_SESSIONS[token] = public_user
    return {
        "status": "success",
        "token": token,
        "user": public_user,
        "email_sent": email_dispatched,
        "message": f"Mobile number +91 {clean_phone} verified! Welcome email sent to {user_email}."
    }

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
# 8. STORE POLICIES, INTENT ROUTER & ML INVENTORY RANKING
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
# 9. REAL-TIME SHOPPING SCRAPER & GROQ AI AUTO-CATEGORIZER
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
        except Exception:
            continue

    return []

# =====================================================================
# 10. CATALOG & CHATBOT ENDPOINTS
# =====================================================================

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Khojo AI Production Backend v6.2",
        "smtp_configured": bool(SMTP_EMAIL and SMTP_PASSWORD),
        "sms_configured": bool(FAST2SMS_API_KEY)
    }

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
            "Ask me about store policies (*\"What is your return policy?\"*, *\"Do you support COD?\"*), "
            "search live inventory across Amazon India, Flipkart, Myntra & Nykaa, or request tailored product recommendations."
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
        "You are Khojo AI, India's central conversational shopping concierge covering Amazon India, Flipkart, Myntra, and Nykaa. "
        "Keep your response friendly, concise (2-3 sentences max), and helpful. Use ₹ for prices. "
        f"{'Note: You just fetched and auto-categorized these items LIVE from Indian shopping sites! ' if scraped_live else ''}"
        "Highlight the best options from the matching products below, and remind the user they can click 'Price Graph' for the 6-month history, '+ Versus' to compare, or 'Buy Now'.\n\n"
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
            f"I found **{len(matched_products)} great options** for you under **{top.get('category')}**! "
            f"The top pick is the **{top.get('name')}** by {top.get('brand')} on **{top.get('platform')}** for **₹{top.get('price_inr')}**. "
            "Tap **Price Graph** to inspect the 6-month history or click **Buy Now**!"
        )
    else:
        reply_text = (
            f"I searched across Amazon India, Flipkart, Myntra & Nykaa for **\"{user_msg}\"**, "
            "but couldn't verify an in-stock listing right now. Try searching a specific brand or product name!"
        )

    return ChatResponse(reply=reply_text, products=matched_products, mode_used="ml_discovery")

# =====================================================================
# 11. AI HEAD-TO-HEAD VERSUS COMPARISON ENGINE (SAME CATEGORY ONLY)
# =====================================================================

@app.post("/api/versus-ai")
def generate_ai_versus_comparison(req: VersusCompareRequest):
    prod_a = req.product_a or {}
    prod_b = req.product_b or {}

    cat_a = str(prod_a.get("category", "")).strip()
    cat_b = str(prod_b.get("category", "")).strip()

    if cat_a.lower() != cat_b.lower():
        raise HTTPException(
            status_code=400,
            detail=f"Category Mismatch: You cannot compare '{cat_a}' with '{cat_b}'. Please add items from the same category!"
        )

    prompt = f"""
You are the Khojo AI Chief Product Analyst in India. Compare these two {cat_a} products head-to-head:

Product A:
- Name: {prod_a.get("name")}
- Brand: {prod_a.get("brand")}
- Price: ₹{prod_a.get("price_inr")} (MRP: ₹{prod_a.get("mrp_inr", prod_a.get("price_inr"))})
- Store: {prod_a.get("platform")}
- Rating: {prod_a.get("rating", 4.3)} / 5

Product B:
- Name: {prod_b.get("name")}
- Brand: {prod_b.get("brand")}
- Price: ₹{prod_b.get("price_inr")} (MRP: ₹{prod_b.get("mrp_inr", prod_b.get("price_inr"))})
- Store: {prod_b.get("platform")}
- Rating: {prod_b.get("rating", 4.3)} / 5

Return ONLY a valid raw JSON object (no markdown formatting, no backticks) with these exact keys:
{{
  "score_a": <integer 65-98 representing overall AI mark out of 100 for Product A>,
  "score_b": <integer 65-98 representing overall AI mark out of 100 for Product B>,
  "winner": "<'A' or 'B'>",
  "headline": "<Punchy 1-line summary of which wins and why>",
  "metrics": [
    {{"label": "Build & Quality", "score_a": <int 60-99>, "score_b": <int 60-99>}},
    {{"label": "Value for Money", "score_a": <int 60-99>, "score_b": <int 60-99>}},
    {{"label": "Brand & Reliability", "score_a": <int 60-99>, "score_b": <int 60-99>}},
    {{"label": "Daily Comfort / Performance", "score_a": <int 60-99>, "score_b": <int 60-99>}}
  ],
  "when_to_buy_a": [
    "<Specific condition/situation 1 where user should buy Product A>",
    "<Specific condition/situation 2 where user should buy Product A>",
    "<Specific condition/situation 3 where user should buy Product A>"
  ],
  "when_to_buy_b": [
    "<Specific condition/situation 1 where user should buy Product B>",
    "<Specific condition/situation 2 where user should buy Product B>",
    "<Specific condition/situation 3 where user should buy Product B>"
  ],
  "worth_money_verdict": {{
    "product_a_status": "<'100% Worth the Money' or 'Good Situational Buy' or 'Overpriced / Not Worth It'>",
    "product_a_reason": "<1-2 sentence explanation on whether Product A is worth ₹{prod_a.get('price_inr')}>",
    "product_b_status": "<'100% Worth the Money' or 'Good Situational Buy' or 'Overpriced / Not Worth It'>",
    "product_b_reason": "<1-2 sentence explanation on whether Product B is worth ₹{prod_b.get('price_inr')}>",
    "best_offer_summary": "<Clear advice on which store deal is the smarter financial pick right now>"
  }}
}}
"""

    if GROQ_API_KEY:
        for model_name in MODEL_CHAIN:
            try:
                completion = llm_client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=800
                )
                raw = completion.choices[0].message.content.strip()
                json_match = re.search(r"\{.*\}", raw, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    return {"status": "success", "analysis": parsed, "model": model_name}
            except Exception as e:
                print(f"Versus AI error on {model_name}: {e}")
                continue

    # Deterministic Intelligent Fallback if LLM is offline
    price_a = float(prod_a.get("price_inr") or 1999)
    price_b = float(prod_b.get("price_inr") or 1999)
    rate_a = float(prod_a.get("rating") or 4.3)
    rate_b = float(prod_b.get("rating") or 4.3)

    val_a = min(96, int(78 + (rate_a - 4.0) * 18 + (10 if price_a <= price_b else 0)))
    val_b = min(96, int(78 + (rate_b - 4.0) * 18 + (10 if price_b < price_a else 0)))
    winner = "A" if val_a >= val_b else "B"

    fallback_analysis = {
        "score_a": val_a,
        "score_b": val_b,
        "winner": winner,
        "headline": f"{prod_a.get('name') if winner == 'A' else prod_b.get('name')} wins on overall price-to-performance ratio in {cat_a}.",
        "metrics": [
            {"label": "Build & Quality", "score_a": min(98, int(rate_a * 20)), "score_b": min(98, int(rate_b * 20))},
            {"label": "Value for Money", "score_a": 92 if price_a <= price_b else 79, "score_b": 92 if price_b < price_a else 79},
            {"label": "Brand & Reliability", "score_a": 88, "score_b": 86},
            {"label": "Daily Performance", "score_a": val_a, "score_b": val_b}
        ],
        "when_to_buy_a": [
            f"Choose this if you prefer {prod_a.get('brand')}'s signature build quality in {cat_a}.",
            f"Best if you are shopping on {prod_a.get('platform')} and want verified customer satisfaction ({rate_a}★).",
            f"Ideal if your budget aligns with ₹{int(price_a):,} for long-term daily use."
        ],
        "when_to_buy_b": [
            f"Choose this if you specifically want {prod_b.get('brand')} styling and features.",
            f"Best if you have bank offers or loyalty points on {prod_b.get('platform')}.",
            f"Ideal if {'saving ₹' + str(int(abs(price_a - price_b))) + ' upfront matters most' if price_b < price_a else 'you are willing to pay for premium aesthetics'}."
        ],
        "worth_money_verdict": {
            "product_a_status": "100% Worth the Money" if val_a >= val_b else "Good Situational Buy",
            "product_a_reason": f"At ₹{int(price_a):,} on {prod_a.get('platform')}, it delivers strong {rate_a}★ reliability for its segment.",
            "product_b_status": "100% Worth the Money" if val_b > val_a else "Good Situational Buy",
            "product_b_reason": f"At ₹{int(price_b):,} on {prod_b.get('platform')}, it is a solid contender depending on your brand preference.",
            "best_offer_summary": f"{prod_a.get('name') if price_a <= price_b else prod_b.get('name')} offers the lowest out-of-pocket cost right now."
        }
    }
    return {"status": "success", "analysis": fallback_analysis, "model": "khojo_heuristic_engine"}

# =====================================================================
# 12. DATABASE FIX REPORTER & LINK RESOLVER
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