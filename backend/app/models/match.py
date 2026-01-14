from typing import Optional
from sqlmodel import SQLModel, Field, Relationship

class Match(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Formatting
    round_number: int # Round 1, Round 2...
    board_number: Optional[int] = None # Which board is this match assigned to?
    is_completed: bool = False
    
    # Scores
    score_p1: int = 0
    score_p2: int = 0
    
    # Relationships
    tournament_id: int = Field(foreign_key="tournament.id")
    tournament: Optional["Tournament"] = Relationship(back_populates="matches")
    
    # Players (We use IDs because a player object might change, but the ID persists)
    player1_id: Optional[int] = Field(foreign_key="player.id")
    player2_id: Optional[int] = Field(foreign_key="player.id")