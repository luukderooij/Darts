import uuid
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from app.models.links import TournamentPlayerLink, TournamentBoardLink

class Tournament(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # Default name logic wordt hieronder in de frontend afgevangen, maar backend fallback blijft handig
    name: str = Field(default_factory=lambda: f"Toernooi {datetime.now().strftime('%Y-%m-%d')}")
    date: str 
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="draft") # draft, active, knockout_ready, finished
    
    # --- Format Settings ---
    # We maken 'hybrid' de standaard.
    format: str = Field(default="hybrid") 
    
    number_of_poules: int = Field(default=1)
    
    # NIEUW: Hoeveel spelers gaan er per poule door naar de KO?
    qualifiers_per_poule: int = Field(default=2) 

    allow_byes: bool = Field(default=True)
    
    # --- Game Settings (Best of X) ---
    # We splitsen de lengte op voor poule en knockout. 
    # Dit zijn de 'default' waarden voor die fase. 
    # (Specifieke finales kunnen we later in de 'Match' tabel overschrijven).
    starting_legs_group: int = Field(default=3) # Bijv. Best of 3
    starting_legs_ko: int = Field(default=3)    # Bijv. Best of 3
    
    # Sets laten we voor nu even generiek, tenzij je ook sets per fase wilt?
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