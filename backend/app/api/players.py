from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.player import Player
from app.schemas.player import PlayerCreate, PlayerRead

# --- THE FIX IS HERE ---
# We import from 'users', not 'auth'
from app.api.users import get_current_user 
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=PlayerRead)
def create_player(
    player_in: PlayerCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    player = Player(
        first_name=player_in.first_name,
        last_name=player_in.last_name,
        nickname=player_in.nickname,
        email=player_in.email,
        # user_id=current_user.id (Uncomment if you want to link players to the admin who created them)
    )
    
    session.add(player)
    session.commit()
    session.refresh(player)
    return player

@router.get("/", response_model=List[PlayerRead])
def read_players(
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(Player).offset(skip).limit(limit)
    players = session.exec(statement).all()
    return players

@router.delete("/{player_id}")
def delete_player(
    player_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    player = session.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    session.delete(player)
    session.commit()
    return {"ok": True}