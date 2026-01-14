from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.tournament import Tournament
from app.models.player import Player
from app.models.match import Match
from app.models.user import User
from app.api.users import get_current_user
from app.schemas.tournament import TournamentCreate, TournamentRead, TournamentReadWithMatches
from app.services.tournament_gen import generate_round_robin, generate_knockout

router = APIRouter()

@router.post("/", response_model=TournamentRead)
def create_tournament(
    tourn_in: TournamentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify all players exist and belong to user
    players = []
    for pid in tourn_in.player_ids:
        p = session.get(Player, pid)
        if not p or p.user_id != current_user.id:
            raise HTTPException(status_code=400, detail=f"Invalid player ID: {pid}")
        players.append(p)
        
    if len(players) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players")

    # 2. Create Tournament Record
    tournament = Tournament(
        name=tourn_in.name,
        format=tourn_in.format,
        legs_per_match=tourn_in.legs_per_match,
        sets_per_match=tourn_in.sets_per_match,
        user_id=current_user.id,
        status="active"
    )
    session.add(tournament)
    session.commit()
    session.refresh(tournament)
    
    # 3. Generate Matches based on format
    if tourn_in.format == "round_robin":
        generate_round_robin(tournament.id, players, session)
    elif tourn_in.format == "knockout":
        generate_knockout(tournament.id, players, session)
        
    return tournament

@router.get("/", response_model=List[TournamentRead])
def list_tournaments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(Tournament).where(Tournament.user_id == current_user.id)
    return session.exec(statement).all()

@router.get("/public/{public_uuid}", response_model=TournamentReadWithMatches)
def get_public_tournament(public_uuid: str, session: Session = Depends(get_session)):
    # 1. Fetch Tournament
    statement = select(Tournament).where(Tournament.public_uuid == public_uuid)
    tournament = session.exec(statement).first()
    
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # 2. Fetch Matches manually to ensure we get them
    # (SQLModel relationships can sometimes be lazy and tricky in async/sync mix)
    matches_statement = select(Match).where(Match.tournament_id == tournament.id).order_by(Match.id)
    matches = session.exec(matches_statement).all()
    
    # 3. Fetch Player Names for the matches
    # We create a map of {id: name} to quickly look them up
    player_ids = set()
    for m in matches:
        if m.player1_id: player_ids.add(m.player1_id)
        if m.player2_id: player_ids.add(m.player2_id)
        
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    player_map = {p.id: p.name for p in players}
    
    # 4. Construct the response explicitly
    # We convert the DB objects to a dictionary structure that matches our Schema
    matches_data = []
    for m in matches:
        matches_data.append({
            "id": m.id,
            "round_number": m.round_number,
            "player1_name": player_map.get(m.player1_id, "Bye"),
            "player2_name": player_map.get(m.player2_id, "Bye"),
            "score_p1": m.score_p1,
            "score_p2": m.score_p2,
            "is_completed": m.is_completed
        })

    # Combine tournament data with our enriched match list
    response_data = {
        "id": tournament.id,
        "name": tournament.name,
        "status": tournament.status,
        "format": tournament.format,
        "created_at": tournament.created_at,
        "public_uuid": tournament.public_uuid,
        "scorer_uuid": tournament.scorer_uuid,
        "matches": matches_data
    }
    
    return response_data