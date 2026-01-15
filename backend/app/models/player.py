from typing import Optional
from sqlmodel import Field, SQLModel, Relationship

class Player(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    first_name: str
    last_name: Optional[str] = None
    nickname: Optional[str] = None
    email: Optional[str] = None # We keep this loose as a string in the DB
    
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="players")

    @property
    def name(self) -> str:
        full_name = self.first_name
        if self.nickname:
            full_name += f' "{self.nickname}"'
        if self.last_name:
            full_name += f" {self.last_name}"
        return full_name