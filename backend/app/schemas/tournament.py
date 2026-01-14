from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.schemas.player import PlayerRead

# What the user sends to create a tournament
class TournamentCreate(BaseModel):
    name: str
    format: str = "round_robin"  # or "knockout"
    player_ids: List[int]  # List of player IDs to include
    legs_per_match: int = 5
    sets_per_match: int = 1

# What the API returns (includes the magic links)
class TournamentRead(BaseModel):
    id: int
    name: str
    status: str
    format: str
    created_at: datetime
    public_uuid: str
    scorer_uuid: str
    
    class Config:
        from_attributes = True

# Detailed view including matches (for the Public View)
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