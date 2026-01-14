from typing import Optional
from pydantic import BaseModel

class MatchScoreUpdate(BaseModel):
    score_p1: int
    score_p2: int
    is_completed: bool = False

class MatchRead(BaseModel):
    id: int
    tournament_id: int
    round_number: int
    player1_id: Optional[int]
    player2_id: Optional[int]
    player1_name: Optional[str] = "Bye"
    player2_name: Optional[str] = "Bye"
    
    score_p1: int
    score_p2: int
    is_completed: bool
    
    class Config:
        from_attributes = True