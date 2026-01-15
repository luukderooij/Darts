from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload  # <--- Belangrijke import voor relaties

from app.db.session import get_session
from app.models.tournament import Tournament
from app.models.player import Player
from app.models.match import Match
from app.models.user import User
from app.models.dartboard import Dartboard
from app.api.users import get_current_user
from app.schemas.tournament import TournamentCreate, TournamentRead
# We verwijderen TournamentReadWithMatches hieronder in de response_model om filter-problemen te voorkomen

from app.services.tournament_gen import generate_round_robin, generate_knockout

router = APIRouter()

@router.post("/", response_model=TournamentRead)
def create_tournament(
    tourn_in: TournamentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify Players
    players_to_link = []
    for pid in tourn_in.player_ids:
        p = session.get(Player, pid)
        if not p:
            raise HTTPException(status_code=400, detail=f"Invalid player ID: {pid}")
        players_to_link.append(p)
        
    if len(players_to_link) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players")

    # 2. Verify Boards
    boards_to_link = []
    for bid in tourn_in.board_ids:
        b = session.get(Dartboard, bid)
        if b:
            boards_to_link.append(b)

    if len(boards_to_link) == 0:
        raise HTTPException(status_code=400, detail="Need at least 1 board")

    # 3. Create Tournament
    import uuid # Zorg dat we zeker een public UUID hebben
    tournament = Tournament(
        name=tourn_in.name,
        date=tourn_in.date,
        number_of_poules=tourn_in.number_of_poules,
        format=tourn_in.format,
        legs_per_match=tourn_in.legs_per_match,
        sets_per_match=tourn_in.sets_per_match,
        user_id=current_user.id,
        status="active",
        # Als je model geen auto-generate heeft, genereren we hem hier:
        public_uuid=str(uuid.uuid4()) 
    )
    
    tournament.players = players_to_link
    tournament.boards = boards_to_link

    session.add(tournament)
    session.commit()
    session.refresh(tournament)
    
    # 4. Generate Matches
    if tourn_in.format == "round_robin":
        generate_round_robin(tournament.id, players_to_link, session)
    elif tourn_in.format == "knockout":
        generate_knockout(tournament.id, players_to_link, session)
        
    return TournamentRead(
        id=tournament.id,
        name=tournament.name,
        date=tournament.date,
        number_of_poules=tournament.number_of_poules,
        status=tournament.status,
        format=tournament.format,
        created_at=tournament.created_at,
        public_uuid=tournament.public_uuid,
        scorer_uuid=tournament.scorer_uuid,
        player_count=len(tournament.players),
        board_count=len(tournament.boards)
    )

@router.get("/", response_model=List[TournamentRead])
def list_tournaments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Gebruik options(selectinload(...)) om de counts efficiënt op te halen
    statement = select(Tournament).where(Tournament.user_id == current_user.id).options(
        selectinload(Tournament.players), 
        selectinload(Tournament.boards)
    )
    tournaments = session.exec(statement).all()
    
    results = []
    for t in tournaments:
        results.append(TournamentRead(
            id=t.id,
            name=t.name,
            date=t.date,
            number_of_poules=t.number_of_poules,
            status=t.status,
            format=t.format,
            created_at=t.created_at,
            public_uuid=t.public_uuid,
            scorer_uuid=t.scorer_uuid,
            player_count=len(t.players),
            board_count=len(t.boards)
        ))
    return results

# BELANGRIJK: Ik heb response_model weggehaald (of veranderd naar Dict)
# Hierdoor filtert FastAPI de 'player1_name' velden er niet meer uit!
@router.get("/public/{public_uuid}", response_model=Dict[str, Any])
def get_public_tournament(public_uuid: str, session: Session = Depends(get_session)):
    
    # 1. Fetch Tournament (met eager loading van relaties om crashes te voorkomen)
    statement = select(Tournament).where(Tournament.public_uuid == public_uuid).options(
        selectinload(Tournament.players),
        selectinload(Tournament.boards)
    )
    tournament = session.exec(statement).first()
    
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # 2. Fetch Matches
    matches_statement = select(Match).where(Match.tournament_id == tournament.id).order_by(Match.id)
    matches = session.exec(matches_statement).all()
    
    # 3. Fetch Player Names for the matches
    player_ids = set()
    for m in matches:
        if m.player1_id: player_ids.add(m.player1_id)
        if m.player2_id: player_ids.add(m.player2_id)
        
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    player_map = {p.id: p.name for p in players}
    
    # 4. Construct response
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

    response_data = {
        "id": tournament.id,
        "name": tournament.name,
        "date": tournament.date,
        "number_of_poules": tournament.number_of_poules,
        "status": tournament.status,
        "format": tournament.format,
        "created_at": tournament.created_at,
        "public_uuid": tournament.public_uuid,
        "scorer_uuid": tournament.scorer_uuid,
        "matches": matches_data, # Nu bevat dit wél de namen!
        "player_count": len(tournament.players),
        "board_count": len(tournament.boards)
    }
    
    return response_data