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
    
    poule_number: Optional[int] = None 
    best_of_legs: Optional[int] = 5
    best_of_sets: Optional[int] = 1

    player1_id: Optional[int]
    player2_id: Optional[int]
    player1_name: Optional[str] = "Bye"
    player2_name: Optional[str] = "Bye"

    referee_id: Optional[int] = None
    referee_team_id: Optional[int] = None
    referee_name: Optional[str] = None
    
    score_p1: int
    score_p2: int
    is_completed: bool
    
    class Config:
        from_attributes = True