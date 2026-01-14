from typing import Optional
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str  # No username here

class UserRead(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str 
    # No username here

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None