from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.tournament import Tournament
from app.models.player import Player
from app.models.match import Match
from app.models.user import User
from app.models.dartboard import Dartboard  # <--- NEW IMPORT
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
    # 1. Verify Players & Security Check
    # We collect them in a list to link them later
    players_to_link = []
    for pid in tourn_in.player_ids:
        p = session.get(Player, pid)
        # Optional: Security check to ensure you own the player
        # if not p or p.user_id != current_user.id:
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

    # 3. Create Tournament Record
    tournament = Tournament(
        name=tourn_in.name,
        date=tourn_in.date,                # <--- NEW
        number_of_poules=tourn_in.number_of_poules, # <--- NEW
        format=tourn_in.format,
        legs_per_match=tourn_in.legs_per_match,
        sets_per_match=tourn_in.sets_per_match,
        user_id=current_user.id,
        status="active"
    )
    
    # 4. Apply the Links (Many-to-Many Magic)
    tournament.players = players_to_link
    tournament.boards = boards_to_link

    session.add(tournament)
    session.commit()
    session.refresh(tournament)
    
    # 5. Generate Matches based on format
    # Note: Currently this generates one big group. 
    # We will upgrade this later to respect 'number_of_poules'.
    if tourn_in.format == "round_robin":
        generate_round_robin(tournament.id, players_to_link, session)
    elif tourn_in.format == "knockout":
        generate_knockout(tournament.id, players_to_link, session)
        
    # 6. Return response
    # We construct this manually to include the calculated counts
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
    # Filter by user so you only see your own tournaments
    statement = select(Tournament).where(Tournament.user_id == current_user.id)
    tournaments = session.exec(statement).all()
    
    # Map to schema with counts
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

@router.get("/public/{public_uuid}", response_model=TournamentReadWithMatches)
def get_public_tournament(public_uuid: str, session: Session = Depends(get_session)):
    # 1. Fetch Tournament
    statement = select(Tournament).where(Tournament.public_uuid == public_uuid)
    tournament = session.exec(statement).first()
    
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # 2. Fetch Matches manually
    matches_statement = select(Match).where(Match.tournament_id == tournament.id).order_by(Match.id)
    matches = session.exec(matches_statement).all()
    
    # 3. Fetch Player Names for the matches
    player_ids = set()
    for m in matches:
        if m.player1_id: player_ids.add(m.player1_id)
        if m.player2_id: player_ids.add(m.player2_id)
        
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    player_map = {p.id: p.name for p in players}
    
    # 4. Construct the response explicitly
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
        "date": tournament.date,                # <--- Include date
        "number_of_poules": tournament.number_of_poules, # <--- Include poules
        "status": tournament.status,
        "format": tournament.format,
        "created_at": tournament.created_at,
        "public_uuid": tournament.public_uuid,
        "scorer_uuid": tournament.scorer_uuid,
        "matches": matches_data,
        "player_count": len(tournament.players), # <--- Helper for UI
        "board_count": len(tournament.boards)
    }
    
    return response_data