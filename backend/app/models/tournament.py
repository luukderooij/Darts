import uuid
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from app.models.links import TournamentPlayerLink, TournamentBoardLink

# Note: We use string forward references like "Player" to avoid circular imports
class Tournament(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default_factory=lambda: f"Toernooi {datetime.now().strftime('%Y-%m-%d')}")
    date: str # <--- Added (Matches UI Date Picker)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="draft")
    
    # --- New Setting ---
    number_of_poules: int = Field(default=1)

    # --- Existing Settings (Preserved) ---
    format: str = Field(default="round_robin") 
    legs_per_match: int = Field(default=5)
    sets_per_match: int = Field(default=1)
    
    # --- Access Control UUIDs ---
    public_uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), index=True, unique=True)
    scorer_uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), index=True, unique=True)
    
    # --- Ownership ---
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="tournaments")
    
    # --- Relationships ---
    # We use the Link models defined in Step 1
    players: List["Player"] = Relationship(back_populates=None, link_model=TournamentPlayerLink)
    boards: List["Dartboard"] = Relationship(back_populates=None, link_model=TournamentBoardLink)
    matches: List["Match"] = Relationship(back_populates="tournament")