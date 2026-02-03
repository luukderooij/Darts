from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator

class PlayerBase(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    nickname: Optional[str] = None
    email: Optional[EmailStr] = None

class PlayerCreate(PlayerBase):
    # This magic function converts empty strings "" into None (null)
    # automatically, preventing validation errors.
    @field_validator('email', 'nickname', 'last_name', mode='before')
    @classmethod
    def empty_to_none(cls, v):
        if v == "":
            return None
        return v

class PlayerRead(PlayerBase):
    id: int
    name: str

class PlayerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    nickname: Optional[str] = None
    email: Optional[EmailStr] = None

    # We hergebruiken de validator om lege strings om te zetten naar None
    @field_validator('email', 'nickname', 'last_name', mode='before')
    @classmethod
    def empty_to_none(cls, v):
        if v == "":
            return None
        return v