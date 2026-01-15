from typing import Optional
from sqlmodel import Field, SQLModel

class TournamentPlayerLink(SQLModel, table=True):
    tournament_id: Optional[int] = Field(default=None, foreign_key="tournament.id", primary_key=True)
    player_id: Optional[int] = Field(default=None, foreign_key="player.id", primary_key=True)

class TournamentBoardLink(SQLModel, table=True):
    tournament_id: Optional[int] = Field(default=None, foreign_key="tournament.id", primary_key=True)
    board_id: Optional[int] = Field(default=None, foreign_key="dartboard.id", primary_key=True)