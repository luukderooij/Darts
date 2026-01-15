from pydantic import BaseModel

class DartboardBase(BaseModel):
    name: str
    number: int

class DartboardCreate(DartboardBase):
    pass

class DartboardRead(DartboardBase):
    id: int