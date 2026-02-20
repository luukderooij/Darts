# FILE: backend/app/models/match.py
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from pydantic import BaseModel

from app.models.tournament import TournamentRound

class Match(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Structure
    round_number: int 
    poule_number: Optional[int] = None 
    board_number: Optional[int] = None 
    
    # Game Settings
    best_of_legs: int = Field(default=5) 
    best_of_sets: int = Field(default=1) 
    
    # Status
    is_completed: bool = False
    score_p1: int = 0
    score_p2: int = 0
    
    # --- RELATIONS ---
    tournament_id: int = Field(foreign_key="tournament.id")
    tournament: Optional["Tournament"] = Relationship(back_populates="matches")
    
    # Singles Players
    player1_id: Optional[int] = Field(default=None, foreign_key="player.id")
    player2_id: Optional[int] = Field(default=None, foreign_key="player.id")
    
    player1: Optional["Player"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Match.player1_id]"})
    player2: Optional["Player"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Match.player2_id]"})

    # Teams
    team1_id: Optional[int] = Field(default=None, foreign_key="team.id")
    team2_id: Optional[int] = Field(default=None, foreign_key="team.id")
    
    team1: Optional["Team"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Match.team1_id]"})
    team2: Optional["Team"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Match.team2_id]"})

    # --- SCHEIDSRECHTER / SCHRIJVER ---
    referee_id: Optional[int] = Field(default=None, foreign_key="player.id")     # Voor Singles
    referee_team_id: Optional[int] = Field(default=None, foreign_key="team.id") # Voor Teams (NIEUW)
    custom_referee_name: Optional[str] = None

    referee: Optional["Player"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Match.referee_id]"})
    referee_team: Optional["Team"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Match.referee_team_id]"})

    beer_fetcher_id: Optional[int] = Field(default=None, foreign_key="player.id")
    beer_fetcher_team_id: Optional[int] = Field(default=None, foreign_key="team.id")

    beer_fetcher: Optional["Player"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Match.beer_fetcher_id]"})
    beer_fetcher_team: Optional["Team"] = Relationship(sa_relationship_kwargs={"foreign_keys": "[Match.beer_fetcher_team_id]"})

    round_id: Optional[int] = Field(default=None, foreign_key="tournamentround.id")
    round_container: Optional["TournamentRound"] = Relationship(back_populates="matches")

    board_number: Optional[int] = Field(default=None) # Het fysieke nummer (1, 2, 3...)
    board_id: Optional[int] = Field(default=None, foreign_key="dartboard.id") # De link naar de tabel
    
    # --- DE FIX: COMPUTED PROPERTY ---
    @property
    def referee_name(self) -> str:
        # 1. Is het een Team?
        if self.referee_team:
            return self.referee_team.name
        # 2. Is het een Speler?
        if self.referee:
            return getattr(self.referee, "name", self.referee.first_name)
        # 3. Is het handmatig?
        if self.custom_referee_name:
            return self.custom_referee_name
        return ""
    
    @property
    def beer_fetcher_name(self) -> Optional[str]:
        if self.beer_fetcher_team:
            return self.beer_fetcher_team.name
        if self.beer_fetcher:
            # Check of het object een 'name' attribute heeft (SQLModel standaard)
            return getattr(self.beer_fetcher, "name", "Onbekend")
        return None

# --- Output Model voor API ---
class MatchDetail(BaseModel):
    id: int
    score_p1: int
    score_p2: int
    is_completed: bool
    
    # Deze velden worden door de frontend verwacht
    player1_name: str
    player2_name: str
    
    # Doordat de property in de class Match óók 'referee_name' heet,
    # zal Pydantic deze automatisch vullen met de waarde uit de property hierboven.
    referee_name: Optional[str] = None

    beer_fetcher_name: Optional[str] = None