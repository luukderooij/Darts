from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import core settings and database logic
from app.core.config import settings
from app.db.session import init_db

# Import API route modules
from app.api import auth, users, players, tournaments, matches, websockets, dartboards

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for handling startup and shutdown events.
    """
    # --- Startup ---
    print("Starting up Dart Tournament Manager...")
    # Initialize database tables (creates them if they don't exist)
    # Note: In a strict production env, you might rely solely on Alembic migrations.
    init_db()
    
    yield
    
    # --- Shutdown ---
    print("Shutting down...")

app = FastAPI(
    title="Dart Tournament Manager API",
    description="Backend for managing dart tournaments, players, and real-time scores.",
    version="1.0.0",
    lifespan=lifespan
)

# --- CORS Configuration ---
# This allows your React frontend (usually on port 5173) to communicate with this backend.
origins = [
    "http://localhost:5173",  # Vite default
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "*"  # Open to all for development ease; restrict in production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Register Routers ---
# We group routes by functionality for cleaner code
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(players.router, prefix="/api/players", tags=["Players"])
app.include_router(tournaments.router, prefix="/api/tournaments", tags=["Tournaments"])
app.include_router(matches.router, prefix="/api/matches", tags=["Matches"])
app.include_router(dartboards.router, prefix="/api/dartboards", tags=["Dartboards"])

# WebSocket router for real-time logs
# Note: The frontend will connect via ws://localhost:8000/ws/logs
app.include_router(websockets.router, prefix="/ws", tags=["WebSockets"])

# --- Root Endpoint (Health Check) ---
@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Dart Tournament Manager API is running",
        "docs_url": "/docs"  # Hint for the developer
    }