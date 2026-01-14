from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str
    
    # Relationships
    players: List["Player"] = Relationship(back_populates="user")
    tournaments: List["Tournament"] = Relationship(back_populates="user")