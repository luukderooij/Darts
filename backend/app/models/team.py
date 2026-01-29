from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from app.models.links import TeamPlayerLink, TournamentTeamLink

class Team(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    
    # Relaties
    players: List["Player"] = Relationship(back_populates="teams", link_model=TeamPlayerLink)
    
    
    #tournament: "Tournament" = Relationship(back_populates="teams")



    tournaments: List["Tournament"] = Relationship(back_populates="teams", link_model=TournamentTeamLink)