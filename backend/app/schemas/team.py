# FILE: backend/app/schemas/team.py
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.player import PlayerRead

# --- INPUT SCHEMAS ---

# Voor handmatig 1 team maken
class TeamCreateManual(BaseModel):
    tournament_id: int
    player_ids: List[int]       # De IDs van de spelers in dit team
    name: Optional[str] = None  # Optioneel (wordt automatisch gegenereerd indien leeg)

# Voor automatisch teams genereren (random)
class TeamAutoGenerate(BaseModel):
    tournament_id: int
    player_ids: List[int]       # De pool van spelers die verdeeld moeten worden

# --- OUTPUT SCHEMA ---

# Wat sturen we terug naar de frontend?
class TeamRead(BaseModel):
    id: int
    name: str
    tournament_id: int
    players: List[PlayerRead] = [] # We willen de speler details zien in het team

    class Config:
        from_attributes = True