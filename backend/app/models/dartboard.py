from typing import Optional
from sqlmodel import Field, SQLModel

class Dartboard(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str  # e.g., "Main Stage"
    number: int # e.g., 1