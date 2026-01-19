from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
import uuid

from app.db.session import get_session
from app.models.tournament import Tournament
from app.models.player import Player
from app.models.match import Match
from app.models.user import User
from app.models.dartboard import Dartboard
from app.api.users import get_current_user
from app.schemas.tournament import TournamentCreate, TournamentRead
from app.services.tournament_gen import generate_round_robin_global, generate_knockout, generate_poule_phase
from app.services.tournament_gen import generate_knockout_from_poules

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

    # 3. Create Tournament Record
    tournament = Tournament(
        name=tourn_in.name,
        date=tourn_in.date,
        number_of_poules=tourn_in.number_of_poules,
        qualifiers_per_poule=tourn_in.qualifiers_per_poule, # NIEUW
        format=tourn_in.format,
        starting_legs_group=tourn_in.starting_legs_group,   # NIEUW
        starting_legs_ko=tourn_in.starting_legs_ko,         # NIEUW
        sets_per_match=tourn_in.sets_per_match,
        user_id=current_user.id,
        status="active",
        public_uuid=str(uuid.uuid4()) 
    )
    
    tournament.players = players_to_link
    tournament.boards = boards_to_link

    session.add(tournament)
    session.commit()
    session.refresh(tournament)
    
    # 4. Generate Matches based on Format
    if tourn_in.format == "hybrid":
        # Dit is de nieuwe standaard: Eerst poules
        generate_poule_phase(
            tournament.id, 
            players_to_link, 
            tourn_in.number_of_poules,
            tourn_in.starting_legs_group, # Gebruik de Poule-settings
            tourn_in.sets_per_match,
            session
        )
        
    elif tourn_in.format == "round_robin":
        # Klassiek: alles in 1 groep
        generate_round_robin_global(
            tournament.id, 
            players_to_link, 
            tourn_in.starting_legs_group,
            tourn_in.sets_per_match,
            session
        )
        
    elif tourn_in.format == "knockout":
        # Direct naar KO
        generate_knockout(
            tournament.id, 
            players_to_link, 
            tourn_in.starting_legs_ko, # Gebruik de KO-settings
            tourn_in.sets_per_match,
            session
        )
        
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

@router.get("/public/{public_uuid}", response_model=Dict[str, Any])
def get_public_tournament(public_uuid: str, session: Session = Depends(get_session)):
    
    statement = select(Tournament).where(Tournament.public_uuid == public_uuid).options(
        selectinload(Tournament.players),
        selectinload(Tournament.boards)
    )
    tournament = session.exec(statement).first()
    
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    matches_statement = select(Match).where(Match.tournament_id == tournament.id).order_by(Match.id)
    matches = session.exec(matches_statement).all()
    
    player_ids = set()
    for m in matches:
        if m.player1_id: player_ids.add(m.player1_id)
        if m.player2_id: player_ids.add(m.player2_id)
        
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    player_map = {p.id: p.name for p in players}
    
    matches_data = []
    for m in matches:
        matches_data.append({
            "id": m.id,
            "round_number": m.round_number,
            "poule_number": m.poule_number, # NIEUW: Frontend heeft dit nodig om te groeperen
            "player1_name": player_map.get(m.player1_id, "Bye"),
            "player2_name": player_map.get(m.player2_id, "Bye"),
            "score_p1": m.score_p1,
            "score_p2": m.score_p2,
            "best_of_legs": m.best_of_legs, # NIEUW: Handig voor weergave (Bijv "First to 3")
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
        "matches": matches_data,
        "player_count": len(tournament.players),
        "board_count": len(tournament.boards)
    }
    
    return response_data

@router.post("/{tournament_id}/start-knockout", response_model=Dict[str, str])
def start_knockout_phase(
    tournament_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")
        
    if tournament.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Geen toegang")
        
    if tournament.format != "hybrid":
        raise HTTPException(status_code=400, detail="Dit is geen hybride toernooi")
        
    # Check of er al KO wedstrijden zijn (om dubbele te voorkomen)
    existing_ko = session.exec(select(Match).where(Match.tournament_id == tournament.id).where(Match.poule_number == None)).first()
    if existing_ko:
        raise HTTPException(status_code=400, detail="Knockout is al gestart!")

    # Genereer
    generate_knockout_from_poules(tournament, session)
    
    return {"message": "Knockout fase succesvol gestart!"}