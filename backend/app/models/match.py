from typing import Optional
from sqlmodel import SQLModel, Field, Relationship

class Match(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # --- Structure info ---
    round_number: int 
    poule_number: Optional[int] = None # NIEUW: Als dit ingevuld is, is het een groepswedstrijd
    board_number: Optional[int] = None 
    
    # --- Game Settings (Per match opgeslagen voor flexibiliteit) ---
    best_of_legs: int = Field(default=5) # NIEUW: Bijv. "5" (betekent first to 3)
    best_of_sets: int = Field(default=1) # NIEUW
    
    # --- Status ---
    is_completed: bool = False
    
    # --- Scores ---
    score_p1: int = 0
    score_p2: int = 0
    
    # --- Relationships ---
    tournament_id: int = Field(foreign_key="tournament.id")
    tournament: Optional["Tournament"] = Relationship(back_populates="matches")
    
    player1_id: Optional[int] = Field(default=None, foreign_key="player.id")
    player2_id: Optional[int] = Field(default=None, foreign_key="player.id")

    team1_id: Optional[int] = Field(default=None, foreign_key="team.id")
    team2_id: Optional[int] = Field(default=None, foreign_key="team.id")