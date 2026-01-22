# FILE: backend/app/api/tournaments.py
import uuid
import math 
from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload

from app.db.session import get_session
from app.models.tournament import Tournament
from app.models.user import User
from app.models.player import Player
from app.models.match import Match
from app.models.dartboard import Dartboard 
from app.api.users import get_current_user 
from app.schemas.tournament import TournamentUpdate

from app.schemas.tournament import (
    TournamentCreate, 
    TournamentRead, 
    TournamentUpdate, 
    TournamentReadWithMatches # <--- Nieuwe import
)

from app.services.tournament_gen import (
    generate_poule_phase, 
    generate_knockout_from_poules,
    generate_round_robin_global,
    generate_knockout
)

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

    # 2. Validatie Poulegrootte
    if tourn_in.format == "hybrid" and tourn_in.number_of_poules > 0:
        avg_players = math.ceil(len(players_to_link) / tourn_in.number_of_poules)
        if avg_players > 7:
            raise HTTPException(
                status_code=400, 
                detail=f"Te veel spelers per poule! Je probeert {avg_players} spelers per poule te stoppen. Het maximum is 7."
            )

    # 3. Verify Boards
    boards_to_link = []
    for bid in tourn_in.board_ids:
        b = session.get(Dartboard, bid)
        if not b:
             raise HTTPException(status_code=400, detail=f"Invalid board ID: {bid}")
        boards_to_link.append(b)

    # 4. Create Tournament Object
    tourn_data = tourn_in.model_dump(exclude={"player_ids", "board_ids"})
    tournament = Tournament.model_validate(tourn_data)
    
    tournament.user_id = current_user.id
    tournament.status = "active"
    tournament.scorer_uuid = str(uuid.uuid4())
    tournament.public_uuid = str(uuid.uuid4())
    
    # 5. Link Relations
    tournament.players = players_to_link
    tournament.boards = boards_to_link 
    
    session.add(tournament)
    session.commit()
    session.refresh(tournament)
    
    # 6. Generate Matches based on Format
    if tournament.format == "hybrid":
        generate_poule_phase(
            tournament_id=tournament.id, 
            players=players_to_link, 
            num_poules=tournament.number_of_poules, 
            legs_best_of=tournament.starting_legs_group,
            sets_best_of=tournament.sets_per_match,
            session=session
        )
    elif tournament.format == "round_robin":
        generate_round_robin_global(
            tournament_id=tournament.id,
            players=players_to_link,
            legs_best_of=tournament.starting_legs_group,
            sets_best_of=tournament.sets_per_match,
            session=session
        )
    elif tournament.format == "knockout":
        generate_knockout(
            tournament_id=tournament.id,
            players=players_to_link,
            legs_best_of=tournament.starting_legs_ko,
            sets_best_of=tournament.sets_per_match,
            session=session
        )
    
    return tournament

@router.get("/{tournament_id}", response_model=TournamentRead)
def read_tournament_by_id(
    tournament_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament

@router.get("/", response_model=List[TournamentRead])
def read_tournaments(
    offset: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    tournaments = session.exec(
        select(Tournament)
        .options(selectinload(Tournament.players), selectinload(Tournament.boards))
        .offset(offset)
        .limit(limit)
    ).all()
    
    # We vullen de counts handmatig in, omdat SQLModel dit niet automatisch doet
    results = []
    for t in tournaments:
        # Zet om naar dict en voeg counts toe
        t_data = t.model_dump()
        t_data['player_count'] = len(t.players)
        t_data['board_count'] = len(t.boards)
        results.append(t_data)
        
    return results

@router.get("/public/{public_uuid}", response_model=TournamentReadWithMatches) # <--- Aangepast Model
def read_public_tournament(public_uuid: str, session: Session = Depends(get_session)):
    # 1. Haal toernooi op met matches en spelers
    t = session.exec(
        select(Tournament)
        .where(Tournament.public_uuid == public_uuid)
        .options(selectinload(Tournament.matches), selectinload(Tournament.players))
    ).first()
    
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # 2. Maak een map van ID -> Naam voor snelle lookup
    player_map = {p.id: p.name for p in t.players}

    # 3. Verrijk de matches met spelernamen
    matches_data = []
    sorted_matches = sorted(t.matches, key=lambda m: m.id)
    
    for m in sorted_matches:
        m_dict = m.model_dump()
        # Vul de namen in (of "Bye" als er geen speler is)
        m_dict['player1_name'] = player_map.get(m.player1_id, "Bye")
        m_dict['player2_name'] = player_map.get(m.player2_id, "Bye")
        matches_data.append(m_dict)

    # 4. Bouw het antwoord
    response = t.model_dump()
    response['matches'] = matches_data
    response['player_count'] = len(t.players)
    response['board_count'] = len(t.boards)

    return response

@router.post("/{tournament_id}/start-knockout")
def start_knockout(
    tournament_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    t = session.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
        
    generate_knockout_from_poules(t, session)
    return {"message": "Knockout phase generated"}


@router.patch("/{tournament_id}", response_model=TournamentRead)
def update_tournament_settings(
    tournament_id: int,
    tourn_update: TournamentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Update toernooi instellingen (bijv. allow_byes) on the fly.
    """
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Update alleen de velden die zijn meegegeven
    tourn_data = tourn_update.model_dump(exclude_unset=True)
    for key, value in tourn_data.items():
        setattr(tournament, key, value)
        
    session.add(tournament)
    session.commit()
    session.refresh(tournament)
    return tournament

@router.post("/{tournament_id}/rounds/{round_number}/update-format")
def update_round_format(
    tournament_id: int,
    round_number: int,
    best_of_legs: int = Query(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Batch update: Pas de 'Best of X' aan voor ALLE ongespeelde wedstrijden in een specifieke ronde.
    """
    # 1. Haal matches op
    statement = select(Match).where(
        Match.tournament_id == tournament_id,
        Match.round_number == round_number,
        Match.is_completed == False # Alleen ongespeelde aanpassen
    )
    matches = session.exec(statement).all()
    
    if not matches:
        return {"message": "Geen ongespeelde wedstrijden gevonden in deze ronde om aan te passen."}
        
    # 2. Update ze allemaal
    for match in matches:
        match.best_of_legs = best_of_legs
        session.add(match)
        
    session.commit()
    return {"message": f"{len(matches)} wedstrijden geüpdatet naar Best of {best_of_legs} legs."}