from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

class Player(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    
    # Foreign Key: Which admin owns this player?
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    # Relationships
    user: Optional["User"] = Relationship(back_populates="players")
    
    # We define relationships to matches, but we usually query matches directly
    # matches_as_p1: List["Match"] = Relationship(...)