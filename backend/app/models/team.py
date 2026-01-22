from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship

# Koppeltabel: Speler <-> Team
class TeamPlayerLink(SQLModel, table=True):
    team_id: Optional[int] = Field(default=None, foreign_key="team.id", primary_key=True)
    player_id: Optional[int] = Field(default=None, foreign_key="player.id", primary_key=True)

class Team(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    tournament_id: int = Field(foreign_key="tournament.id")
    
    # Relaties
    players: List["Player"] = Relationship(back_populates="teams", link_model=TeamPlayerLink)
    tournament: "Tournament" = Relationship(back_populates="teams")