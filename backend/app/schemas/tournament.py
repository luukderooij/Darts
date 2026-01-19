from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

# --- Input Schema (Create) ---
class TournamentCreate(BaseModel):
    name: str
    date: str  
    number_of_poules: int = 1  
    format: str = "hybrid"
    
    # --- NIEUWE VELDEN ---
    # Deze misten, waardoor de backend ze niet ontving
    qualifiers_per_poule: int = 2
    starting_legs_group: int = 3
    starting_legs_ko: int = 5
    
    sets_per_match: int = 1
    
    # Selection Lists
    player_ids: List[int]
    board_ids: List[int]  

# --- Output Schema (Read) ---
class TournamentRead(BaseModel):
    id: int
    name: str
    date: str 
    status: str
    format: str
    number_of_poules: int  
    created_at: datetime
    public_uuid: str
    scorer_uuid: str
    
    # Nieuwe velden ook terugsturen (handig voor frontend)
    qualifiers_per_poule: int = 2
    starting_legs_group: int = 3
    starting_legs_ko: int = 5
    
    # Helper counts for the dashboard
    player_count: int = 0
    board_count: int = 0
    
    class Config:
        from_attributes = True

# --- Detailed View (Public Page) ---
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