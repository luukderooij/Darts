import uuid
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from app.models.links import TournamentPlayerLink, TournamentBoardLink, TournamentTeamLink, TournamentAdminLink

class Tournament(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    name: str = Field(default_factory=lambda: f"Toernooi {datetime.now().strftime('%Y-%m-%d')}")
    date: str 
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="draft") # draft, active, knockout_ready, finished
    
    # --- Format Settings ---
    mode: str = Field(default="singles") # "singles" of "doubles"
    format: str = Field(default="hybrid") 
    
    number_of_poules: int = Field(default=1)
    
    # Hoeveel spelers gaan er per poule door naar de KO?
    qualifiers_per_poule: int = Field(default=2) 

    allow_byes: bool = Field(default=True)
    
    # --- Game Settings (Best of X) ---
    starting_legs_group: int = Field(default=3) 
    starting_legs_ko: int = Field(default=3)    
    sets_per_match: int = Field(default=1)
    
    # --- Access Control ---
    public_uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), index=True, unique=True)
    scorer_uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), index=True, unique=True)
    
    # --- Ownership ---
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="tournaments")
    
    # --- Relationships ---
    players: List["Player"] = Relationship(back_populates=None, link_model=TournamentPlayerLink)
    boards: List["Dartboard"] = Relationship(back_populates=None, link_model=TournamentBoardLink)
    matches: List["Match"] = Relationship(back_populates="tournament")
    
    teams: List["Team"] = Relationship(back_populates="tournaments", link_model=TournamentTeamLink)

    admins: List["User"] = Relationship(back_populates="shared_tournaments", link_model=TournamentAdminLink)