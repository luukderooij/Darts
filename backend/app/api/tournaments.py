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
from app.models.team import Team


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
            
            # --- AANGEPAST BLOK ---
            # Bepaal hoeveel 'entiteiten' (spelers of teams) er in de poule komen
            entity_count = len(players_to_link)
            
            # Als het koppels zijn, delen we het aantal spelers door 2
            if tourn_in.mode == "doubles":
                entity_count = math.ceil(entity_count / 2)

            avg_entities = math.ceil(entity_count / tourn_in.number_of_poules)
            
            if avg_entities > 7:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Te veel deelnames per poule! Je probeert {avg_entities} teams/spelers per poule te stoppen. Het maximum is 7."
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
    if tournament.mode == "singles":
            
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


@router.delete("/{tournament_id}")
def delete_tournament(
    tournament_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # --- Manual Cascade Delete ---
    # We must delete children first to avoid Foreign Key errors
    
    # 1. Delete Matches
    matches = session.exec(select(Match).where(Match.tournament_id == tournament_id)).all()
    for m in matches:
        session.delete(m)
        
    # 2. Delete Teams
    teams = session.exec(select(Team).where(Team.tournament_id == tournament_id)).all()
    for t in teams:
        session.delete(t)
        
    # 3. Delete Tournament (Links will be handled automatically by SQLModel)
    session.delete(tournament)
    session.commit()
    
    return {"ok": True}


@router.post("/{tournament_id}/finalize")
def finalize_tournament_setup(
    tournament_id: int, 
    session: Session = Depends(get_session)
):
    """
    Trigger de generatie van wedstrijden nadat teams zijn aangemaakt.
    Specifiek voor Doubles/Teams toernooien.
    """
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")

    # Als het singles is, zijn matches al gemaakt bij aanmaken.
    if tournament.mode == "singles":
        return {"message": "Already generated (singles)"}

    # Haal alle teams op
    teams = session.exec(select(Team).where(Team.tournament_id == tournament_id)).all()
    
    if len(teams) < 2:
        raise HTTPException(status_code=400, detail="Te weinig teams om wedstrijden te genereren.")

    # Verwijder eventuele oude matches (voor de zekerheid)
    existing_matches = session.exec(select(Match).where(Match.tournament_id == tournament_id)).all()
    for m in existing_matches:
        session.delete(m)
    
    # --- Generatie Logica voor Teams (Poule Fase) ---
    # We verdelen de teams over de poules
    num_poules = tournament.number_of_poules
    
    # Maak lege lijsten voor elke poule
    poules = [[] for _ in range(num_poules)]
    
    # Verdeel teams snake-wise of random (hier simpel: op volgorde verdelen)
    for i, team in enumerate(teams):
        poule_index = i % num_poules
        poules[poule_index].append(team)

    matches_created = []

    # Voor elke poule, maak Round Robin schema
    for poule_idx, poule_teams in enumerate(poules):
        poule_number = poule_idx + 1
        n = len(poule_teams)
        
        # Round Robin algoritme
        for i in range(n):
            for j in range(i + 1, n):
                t1 = poule_teams[i]
                t2 = poule_teams[j]
                
                # Maak de match
                match = Match(
                    tournament_id=tournament.id,
                    poule_number=poule_number,
                    
                    team1_id=t1.id,
                    team2_id=t2.id,

                    round_number=1,

                    best_of_legs=tournament.starting_legs_group,
                    best_of_sets=tournament.sets_per_match,

                    is_completed=False,
                    score_p1=0,
                    score_p2=0
                )
                session.add(match)
                matches_created.append(match)

    session.commit()
    return {"message": f"Setup finalized. {len(matches_created)} matches generated for {len(teams)} teams."}