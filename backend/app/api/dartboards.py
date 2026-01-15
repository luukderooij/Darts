from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.dartboard import Dartboard
from app.schemas.dartboard import DartboardCreate, DartboardRead
from app.api.users import get_current_user # Auth check

router = APIRouter()

@router.post("/", response_model=DartboardRead)
def create_board(
    board_in: DartboardCreate,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    board = Dartboard(name=board_in.name, number=board_in.number)
    session.add(board)
    session.commit()
    session.refresh(board)
    return board

@router.get("/", response_model=List[DartboardRead])
def read_boards(
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    # Sort by number automatically (1, 2, 3...)
    statement = select(Dartboard).order_by(Dartboard.number)
    boards = session.exec(statement).all()
    return boards

@router.delete("/{board_id}")
def delete_board(
    board_id: int,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    board = session.get(Dartboard, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    session.delete(board)
    session.commit()
    return {"ok": True}