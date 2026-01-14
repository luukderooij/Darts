from typing import Optional
from sqlmodel import Field, SQLModel, Relationship

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    first_name: str
    last_name: str
    email: str = Field(unique=True, index=True)
    
    hashed_password: str

    players: list["Player"] = Relationship(back_populates="user")
    tournaments: list["Tournament"] = Relationship(back_populates="user")