from typing import Optional
from sqlmodel import Field, SQLModel, Relationship
from app.models.tournament import Tournament

class ScorerAccessCode(SQLModel, table=True):
    code: str = Field(primary_key=True, index=True) # De 4-cijferige code (bijv. "4829")
    tournament_id: int = Field(foreign_key="tournament.id")
    board_number: int # Het fysieke nummer, bijv. 1, 2, of 3 (komt overeen met match.board_number)
    
    # Optioneel: Relatie voor makkelijke lookup
    tournament: Optional[Tournament] = Relationship()