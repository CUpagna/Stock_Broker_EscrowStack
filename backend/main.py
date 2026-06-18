import asyncio
import hashlib
import secrets
import time
import random
import sqlite3
import json
from typing import Dict, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Supported stocks & Base Prices
# ------------------------------------------------------------------
SUPPORTED_STOCKS = ["GOOG", "TSLA", "AMZN", "META", "NVDA"]

BASE_PRICES: Dict[str, float] = {
    "GOOG": 175.00,
    "TSLA": 250.00,
    "AMZN": 190.00,
    "META": 520.00,
    "NVDA": 950.00,
}

current_prices: Dict[str, float] = dict(BASE_PRICES)
reset_tokens: Dict[str, dict] = {}
STARTING_BALANCE = 100_000.0  # $100,000 virtual cash

# ------------------------------------------------------------------
# 🗄️ SQLite REAL DATABASE SETUP
# ------------------------------------------------------------------
DB_FILE = "tradeview.db"

def init_db():
    """Creates the database file and user table if it doesn't exist."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            name TEXT,
            password_hash TEXT,
            cash_balance REAL,
            subscriptions TEXT,
            portfolio TEXT,
            transactions TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db() # Run setup when server starts

def get_user(email: str):
    """Fetches a user from the SQLite database."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    
    if not row: 
        return None
        
    return {
        "email": row[0],
        "name": row[1],
        "password_hash": row[2],
        "cash_balance": row[3],
        "subscriptions": set(json.loads(row[4])),
        "portfolio": json.loads(row[5]),
        "transactions": json.loads(row[6])
    }

def save_user(user: dict):
    """Saves or updates a user in the SQLite database."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO users 
        (email, name, password_hash, cash_balance, subscriptions, portfolio, transactions)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        user["email"], 
        user["name"], 
        user["password_hash"], 
        user["cash_balance"],
        json.dumps(list(user["subscriptions"])), # Convert sets/dicts to JSON strings
        json.dumps(user["portfolio"]),
        json.dumps(user["transactions"])
    ))
    conn.commit()
    conn.close()


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def verify_password(pw: str, hashed: str) -> bool:
    return hash_password(pw) == hashed

# ------------------------------------------------------------------
# WebSocket connection manager
# ------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, WebSocket] = {}

    async def connect(self, email: str, ws: WebSocket):
        await ws.accept()
        self.active[email] = ws

    def disconnect(self, email: str):
        self.active.pop(email, None)

    async def broadcast_prices(self):
        for email, ws in list(self.active.items()):
            user = get_user(email)
            if not user:
                continue
            subs = user.get("subscriptions", set())
            if not subs:
                continue
            payload = {
                "type": "prices",
                "data": {ticker: round(current_prices[ticker], 2) for ticker in subs},
            }
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(email)

manager = ConnectionManager()

# ------------------------------------------------------------------
# Background price updater (DUMMY SIMULATOR)
# ------------------------------------------------------------------
async def price_updater():
    while True:
        await asyncio.sleep(1) # Updates every 1 second for a lively dashboard
        for ticker in SUPPORTED_STOCKS:
            # Random walk: ±0.5 % per second
            change_pct = random.uniform(-0.005, 0.005)
            current_prices[ticker] = max(1.0, current_prices[ticker] * (1 + change_pct))
        await manager.broadcast_prices()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(price_updater())

# ------------------------------------------------------------------
# Pydantic models
# ------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class SubscribeRequest(BaseModel):
    email: str
    ticker: str

class UnsubscribeRequest(BaseModel):
    email: str
    ticker: str

class TradeRequest(BaseModel):
    email: str
    ticker: str
    units: int
    action: str  

# ------------------------------------------------------------------
# Auth endpoints
# ------------------------------------------------------------------
@app.post("/register")
def register(req: RegisterRequest):
    email = req.email.strip().lower()
    if not email or not req.name.strip() or not req.password:
        raise HTTPException(status_code=400, detail="All fields are required.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    
    if get_user(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    
    new_user = {
        "email": email,
        "name": req.name.strip(),
        "password_hash": hash_password(req.password),
        "subscriptions": set(),
        "portfolio": {},
        "cash_balance": STARTING_BALANCE,
        "transactions": [],
    }
    save_user(new_user)
    
    return {"message": "Account created successfully.", "email": email, "name": req.name.strip()}

@app.post("/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    user = get_user(email)
    
    if not user:
        raise HTTPException(status_code=401, detail="No account found with this email.")
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password.")
        
    return {
        "email": email,
        "name": user["name"],
        "subscriptions": list(user["subscriptions"]),
        "portfolio": user["portfolio"],
        "cash_balance": round(user["cash_balance"], 2),
    }

@app.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    if not get_user(email):
        return {"message": "If this email is registered, a reset token has been sent."}
    token = secrets.token_urlsafe(32)
    reset_tokens[token] = {"email": email, "expires": time.time() + 3600}
    return {
        "message": "Reset token generated. Use this token to reset your password.",
        "reset_token": token,
        "demo_note": "In production this token would be emailed. Copy it to reset your password."
    }

@app.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    entry = reset_tokens.get(req.token)
    if not entry:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    if time.time() > entry["expires"]:
        del reset_tokens[req.token]
        raise HTTPException(status_code=400, detail="Reset token has expired.")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
        
    email = entry["email"]
    user = get_user(email)
    user["password_hash"] = hash_password(req.new_password)
    save_user(user)
    del reset_tokens[req.token]
    
    return {"message": "Password reset successfully. You may now log in."}

# ------------------------------------------------------------------
# Stock & Trade endpoints
# ------------------------------------------------------------------
@app.get("/stocks")
def get_supported_stocks():
    return {"stocks": SUPPORTED_STOCKS}

@app.post("/subscribe")
def subscribe(req: SubscribeRequest):
    email = req.email.strip().lower()
    ticker = req.ticker.upper()
    user = get_user(email)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please login first.")
        
    user["subscriptions"].add(ticker)
    save_user(user)
    return {"email": email, "subscriptions": list(user["subscriptions"])}

@app.post("/unsubscribe")
def unsubscribe(req: UnsubscribeRequest):
    email = req.email.strip().lower()
    ticker = req.ticker.upper()
    user = get_user(email)
    
    if user:
        user["subscriptions"].discard(ticker)
        save_user(user)
        return {"email": email, "subscriptions": list(user["subscriptions"])}
        
    raise HTTPException(status_code=404, detail="User not found.")

@app.post("/trade")
def trade(req: TradeRequest):
    email = req.email.strip().lower()
    ticker = req.ticker.upper()
    action = req.action.lower()

    user = get_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if req.units <= 0:
        raise HTTPException(status_code=400, detail="Units must be a positive number.")

    price = current_prices.get(ticker, BASE_PRICES[ticker])
    total_cost = round(price * req.units, 2)
    portfolio = user["portfolio"]

    if action == "buy":
        if user["cash_balance"] < total_cost:
            raise HTTPException(status_code=400, detail=f"Insufficient funds. You need ${total_cost:.2f} but have ${user['cash_balance']:.2f}.")
        user["cash_balance"] -= total_cost
        if ticker in portfolio:
            old_units = portfolio[ticker]["units"]
            old_avg = portfolio[ticker]["avg_price"]
            new_units = old_units + req.units
            new_avg = (old_units * old_avg + req.units * price) / new_units
            portfolio[ticker] = {"units": new_units, "avg_price": round(new_avg, 4)}
        else:
            portfolio[ticker] = {"units": req.units, "avg_price": round(price, 4)}
        user["subscriptions"].add(ticker)

    elif action == "sell":
        held = portfolio.get(ticker, {}).get("units", 0)
        if held < req.units:
            raise HTTPException(status_code=400, detail=f"You only hold {held} unit(s) of {ticker}.")
        user["cash_balance"] += total_cost
        new_units = held - req.units
        if new_units == 0:
            del portfolio[ticker]
        else:
            portfolio[ticker]["units"] = new_units

    user["transactions"].append({
        "action": action,
        "ticker": ticker,
        "units": req.units,
        "price": round(price, 2),
        "total": total_cost,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    })

    # Save the updated portfolio and balance to the SQLite database
    save_user(user) 

    return {
        "message": f"{'Bought' if action == 'buy' else 'Sold'} {req.units} unit(s) of {ticker} at ${price:.2f}.",
        "cash_balance": round(user["cash_balance"], 2),
        "portfolio": user["portfolio"],
        "subscriptions": list(user["subscriptions"]),
    }

@app.get("/portfolio/{email}")
def get_portfolio(email: str):
    email = email.strip().lower()
    user = get_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {
        "portfolio": user["portfolio"],
        "cash_balance": round(user["cash_balance"], 2),
        "transactions": user["transactions"][-20:],
    }

@app.websocket("/ws/{email}")
async def websocket_endpoint(ws: WebSocket, email: str):
    email = email.strip().lower()
    if not get_user(email):
        await ws.close(code=4001)
        return
    await manager.connect(email, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(email)