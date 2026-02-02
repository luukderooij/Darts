from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from pydantic import BaseModel

class Match(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # --- Structure info ---
    round_number: int 
    poule_number: Optional[int] = None # Als dit ingevuld is, is het een groepswedstrijd
    board_number: Optional[int] = None 
    
    # --- Game Settings ---
    best_of_legs: int = Field(default=5) # Bijv. "5" (betekent first to 3)
    best_of_sets: int = Field(default=1) 
    
    # --- Status ---
    is_completed: bool = False
    
    # --- Scores ---
    score_p1: int = 0
    score_p2: int = 0
    
    # --- Relationships: TOERNOOI ---
    tournament_id: int = Field(foreign_key="tournament.id")
    tournament: Optional["Tournament"] = Relationship(back_populates="matches")
    
    # --- Relationships: SPELERS (Singles) ---
    player1_id: Optional[int] = Field(default=None, foreign_key="player.id")
    player2_id: Optional[int] = Field(default=None, foreign_key="player.id")


    player1: Optional["Player"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[Match.player1_id]"}
    )
    player2: Optional["Player"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[Match.player2_id]"}
    )

    referee_id: Optional[int] = Field(default=None, foreign_key="player.id")
    referee_team_id: Optional[int] = Field(default=None, foreign_key="team.id")

    # --- RELATIONS (NEW) ---
    referee: Optional["Player"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[Match.referee_id]"}
    )
    referee_team: Optional["Team"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[Match.referee_team_id]"}
    )


    # --- Relationships: TEAMS (Koppels) ---
    team1_id: Optional[int] = Field(default=None, foreign_key="team.id")
    team2_id: Optional[int] = Field(default=None, foreign_key="team.id")

    # Idem voor de teams: relatie objecten toevoegen
    team1: Optional["Team"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[Match.team1_id]"}
    )
    team2: Optional["Team"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[Match.team2_id]"}
    )

    custom_referee_name: Optional[str] = None

class MatchDetail(BaseModel):
    id: int
    score_p1: int
    score_p2: int
    is_completed: bool
    
    player1_name: str
    player2_name: str
    referee_name: str