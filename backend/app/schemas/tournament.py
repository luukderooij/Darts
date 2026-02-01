# FILE: backend/app/schemas/tournament.py
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.schemas.player import PlayerRead

# --- Input Schema (Create) ---
class TournamentCreate(BaseModel):
    name: str
    date: str  
    number_of_poules: int = 1  
    format: str = "hybrid"
    mode: str = "singles"
    allow_byes: bool = True
    
    # Settings
    qualifiers_per_poule: int = 2
    starting_legs_group: int = 3
    starting_legs_ko: int = 5
    sets_per_match: int = 1
    
    # IDs voor relaties
    player_ids: List[int]
    board_ids: List[int]  

# --- Input Schema (Update) ---
class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = None
    format: Optional[str] = None
    scorer_uuid: Optional[str] = None

# --- Output Schema (Read) ---
class TournamentRead(BaseModel):
    id: int
    name: str
    date: str 
    status: str
    format: str
    allow_byes: bool = True
    number_of_poules: int  
    created_at: datetime
    public_uuid: str
    scorer_uuid: str
    
    # Settings terugsturen
    qualifiers_per_poule: int = 2
    starting_legs_group: int = 3
    starting_legs_ko: int = 5
    
    # Counts
    player_count: int = 0
    board_count: int = 0

    players: List[PlayerRead] = []
    
    class Config:
        from_attributes = True

# --- Detailed View (Public Page) ---
class MatchReadSimple(BaseModel):
    id: int
    round_number: int
    poule_number: Optional[int] = None
    player1_name: Optional[str] = None
    player2_name: Optional[str] = None
    score_p1: int
    score_p2: int
    is_completed: bool
    referee_name: Optional[str] = None

class TournamentReadWithMatches(TournamentRead):
    matches: List[MatchReadSimple] = []