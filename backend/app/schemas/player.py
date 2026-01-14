from typing import Optional
from pydantic import BaseModel

# What the user sends to create a player
class PlayerCreate(BaseModel):
    name: str

# What the API returns to the user
class PlayerRead(BaseModel):
    id: int
    name: str
    
    class Config:
        # Tells Pydantic to read data even if it's not a dict, but an ORM model
        from_attributes = True