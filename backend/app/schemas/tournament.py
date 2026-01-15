from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

# --- Input Schema (Create) ---
class TournamentCreate(BaseModel):
    name: str
    date: str  # <--- NEW
    number_of_poules: int = 1  # <--- NEW
    format: str = "round_robin"
    legs_per_match: int = 5
    sets_per_match: int = 1
    
    # Selection Lists
    player_ids: List[int]
    board_ids: List[int]  # <--- NEW

# --- Output Schema (Read) ---
class TournamentRead(BaseModel):
    id: int
    name: str
    date: str  # <--- NEW
    status: str
    format: str
    number_of_poules: int  # <--- NEW
    created_at: datetime
    public_uuid: str
    scorer_uuid: str
    
    # Helper counts for the dashboard
    player_count: int = 0
    board_count: int = 0
    
    class Config:
        from_attributes = True

# --- Detailed View (Public Page) ---
# We keep this exactly as you had it so the public page doesn't break
class MatchReadSimple(BaseModel):
    id: int
    round_number: int
    player1_name: Optional[str] = None
    player2_name: Optional[str] = None
    score_p1: int
    score_p2: int
    is_completed: bool

class TournamentReadWithMatches(TournamentRead):
    matches: List[MatchReadSimple] = []