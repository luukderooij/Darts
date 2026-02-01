from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.player import Player
from app.schemas.player import PlayerCreate, PlayerRead
from app.services import csv_service

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
        user_id=current_user.id  
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
    current_user: User = Depends(get_current_user) # Zorg dat de user bekend is
):
    # Filter: Alleen spelers waar user_id gelijk is aan current_user.id
    statement = select(Player).where(Player.user_id == current_user.id).offset(skip).limit(limit)
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


@router.get("/export-template")
def export_template():
    """Download de CSV template via een GET verzoek."""
    return csv_service.generate_player_template()


@router.post("/import-csv")
async def import_players_csv(
    file: UploadFile = File(...), 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user) # Zorg dat type hint User is
):
    content = await file.read()
    # Geef current_user.id mee aan de functie
    count = csv_service.process_player_import(content, session, current_user.id) 
    return {"message": f"{count} spelers succesvol geïmporteerd.", "count": count}