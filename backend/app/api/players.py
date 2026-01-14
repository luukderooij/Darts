from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.player import Player
from app.schemas.player import PlayerCreate, PlayerRead
from app.models.user import User
from app.api.users import get_current_user

router = APIRouter()

@router.post("/", response_model=PlayerRead, status_code=status.HTTP_201_CREATED)
def create_player(
    player_in: PlayerCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new player assigned to the currently logged-in user.
    """
    # Create the DB model instance
    player = Player(
        name=player_in.name,
        user_id=current_user.id  # Automatically link to the logged-in user
    )
    
    session.add(player)
    session.commit()
    session.refresh(player)
    return player

@router.get("/", response_model=List[PlayerRead])
def read_players(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get all players belonging to the current user.
    """
    statement = select(Player).where(Player.user_id == current_user.id)
    results = session.exec(statement)
    return results.all()

@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(
    player_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a player. 
    Strictly checks that the player belongs to the current user before deleting.
    """
    statement = select(Player).where(Player.id == player_id)
    player = session.exec(statement).first()
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
        
    if player.user_id != current_user.id:
        raise HTTPException(
            status_code=403, 
            detail="Not authorized to delete this player"
        )
        
    session.delete(player)
    session.commit()
    return None