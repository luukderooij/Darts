import uuid
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime

class Tournament(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="draft")  # draft, active, completed
    
    # Settings
    format: str = Field(default="round_robin") # round_robin, knockout
    legs_per_match: int = 5 # Best of 5
    sets_per_match: int = 1
    
    # Access Control UUIDs (Auto-generated)
    public_uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), index=True, unique=True)
    scorer_uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), index=True, unique=True)
    
    # Ownership
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="tournaments")
    
    # Relationships
    matches: List["Match"] = Relationship(back_populates="tournament")