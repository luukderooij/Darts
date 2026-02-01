from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from app.models.links import TournamentAdminLink

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    first_name: str
    last_name: str
    email: str = Field(unique=True, index=True)
    
    hashed_password: str

    players: list["Player"] = Relationship(back_populates="user")
    tournaments: list["Tournament"] = Relationship(back_populates="user")
    shared_tournaments: List["Tournament"] = Relationship(back_populates="admins", link_model=TournamentAdminLink)