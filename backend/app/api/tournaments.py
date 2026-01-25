# FILE: backend/app/api/tournaments.py
import uuid
import math 
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload

from app.db.session import get_session
from app.models.tournament import Tournament
from app.models.user import User
from app.models.player import Player
from app.models.match import Match
from app.models.dartboard import Dartboard 
from app.models.team import Team
from app.api.users import get_current_user 

from app.schemas.tournament import (
    TournamentCreate, 
    TournamentRead, 
    TournamentUpdate, 
    TournamentReadWithMatches
)

# --- CORRECTED IMPORTS ---
from app.services.tournament_gen import (
    generate_poule_phase, 
    generate_round_robin_global,
    generate_knockout,
    generate_knockout_bracket  # Renamed function
)
# -------------------------

router = APIRouter()

@router.post("/", response_model=TournamentRead)
def create_tournament(
    tourn_in: TournamentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify Players
    players_to_link = []
    if tourn_in.player_ids:
        players_to_link = session.exec(select(Player).where(Player.id.in_(tourn_in.player_ids))).all()
    
    # Check minimum players (raw count)
    if len(players_to_link) < 2:
        raise HTTPException(status_code=400, detail="Selecteer minimaal 2 spelers.")

    # 2. Validatie Poulegrootte
    if tourn_in.format == "hybrid" and tourn_in.number_of_poules > 0:
            
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
    if tourn_in.board_ids:
        boards_to_link = session.exec(select(Dartboard).where(Dartboard.id.in_(tourn_in.board_ids))).all()
        if not boards_to_link:
             raise HTTPException(status_code=400, detail="Ongeldige borden geselecteerd.")

    # 4. Create Tournament Object
    # We exclude ids because we link them manually via relationships
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
    
    # 6. Generate Matches based on Format (ONLY FOR SINGLES)
    # For doubles, we wait for the /finalize endpoint because teams need to be created first
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
        .where(Tournament.user_id == current_user.id)
        .options(selectinload(Tournament.players), selectinload(Tournament.boards))
        .offset(offset)
        .limit(limit)
    ).all()
    
    # Fill counts manually
    results = []
    for t in tournaments:
        t_data = t.model_dump()
        t_data['player_count'] = len(t.players)
        t_data['board_count'] = len(t.boards)
        results.append(t_data)
        
    return results

@router.get("/public/{public_uuid}", response_model=TournamentReadWithMatches)
def read_public_tournament(public_uuid: str, session: Session = Depends(get_session)):
    # 1. Fetch tournament with matches and players
    t = session.exec(
        select(Tournament)
        .where(Tournament.public_uuid == public_uuid)
        .options(
            selectinload(Tournament.matches), 
            selectinload(Tournament.players)
        )
    ).first()
    
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # 2. Create map for players and teams for fast lookup
    player_map = {p.id: p.name for p in t.players}
    
    # We also need teams if it's a doubles tournament
    teams = session.exec(select(Team).where(Team.tournament_id == t.id)).all()
    team_map = {team.id: team.name for team in teams}

    # 3. Enrich matches with names
    matches_data = []
    sorted_matches = sorted(t.matches, key=lambda m: m.id)
    
    for m in sorted_matches:
        m_dict = m.model_dump()
        
        # Resolve Name 1 (Player > Team > Bye)
        if m.player1_id:
            m_dict['player1_name'] = player_map.get(m.player1_id, "Bye")
        elif m.team1_id:
             m_dict['player1_name'] = team_map.get(m.team1_id, "Bye")
        else:
             m_dict['player1_name'] = "Bye"

        # Resolve Name 2
        if m.player2_id:
            m_dict['player2_name'] = player_map.get(m.player2_id, "Bye")
        elif m.team2_id:
             m_dict['player2_name'] = team_map.get(m.team2_id, "Bye")
        else:
             m_dict['player2_name'] = "Bye"
             
        matches_data.append(m_dict)

    # 4. Build response
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
        
    # Call the NEW function from tournament_gen
    generate_knockout_bracket(session, t)
    
    return {"message": "Knockout phase generated"}


@router.patch("/{tournament_id}", response_model=TournamentRead)
def update_tournament_settings(
    tournament_id: int,
    tourn_update: TournamentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Update tournament settings (e.g. allow_byes) on the fly.
    """
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
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
    Batch update: Adjust 'Best of X' for ALL unplayed matches in a specific round.
    """
    statement = select(Match).where(
        Match.tournament_id == tournament_id,
        Match.round_number == round_number,
        Match.is_completed == False 
    )
    matches = session.exec(statement).all()
    
    if not matches:
        return {"message": "Geen ongespeelde wedstrijden gevonden in deze ronde om aan te passen."}
        
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
    
    # 1. Delete Matches
    matches = session.exec(select(Match).where(Match.tournament_id == tournament_id)).all()
    for m in matches:
        session.delete(m)
        
    # 2. Delete Teams
    teams = session.exec(select(Team).where(Team.tournament_id == tournament_id)).all()
    for t in teams:
        session.delete(t)
        
    # 3. Delete Tournament
    session.delete(tournament)
    session.commit()
    
    return {"ok": True}


@router.post("/{tournament_id}/finalize")
def finalize_tournament_setup(
    tournament_id: int, 
    session: Session = Depends(get_session)
):
    """
    Trigger match generation after teams are created.
    Specific for Doubles/Teams tournaments.
    """
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")

    if tournament.mode == "singles":
        return {"message": "Already generated (singles)"}

    # Fetch all teams
    teams = session.exec(select(Team).where(Team.tournament_id == tournament_id)).all()
    
    if len(teams) < 2:
        raise HTTPException(status_code=400, detail="Te weinig teams om wedstrijden te genereren.")

    # Remove old matches (safety)
    existing_matches = session.exec(select(Match).where(Match.tournament_id == tournament_id)).all()
    for m in existing_matches:
        session.delete(m)
    
    # --- Generation Logic for Teams (Poule Phase) ---
    num_poules = tournament.number_of_poules
    poules = [[] for _ in range(num_poules)]
    
    for i, team in enumerate(teams):
        poule_index = i % num_poules
        poules[poule_index].append(team)

    matches_created = []

    for poule_idx, poule_teams in enumerate(poules):
        poule_number = poule_idx + 1
        n = len(poule_teams)
        
        # Round Robin
        for i in range(n):
            for j in range(i + 1, n):
                t1 = poule_teams[i]
                t2 = poule_teams[j]
                
                match = Match(
                    tournament_id=tournament.id,
                    poule_number=poule_number,
                    
                    team1_id=t1.id,
                    team2_id=t2.id,

                    round_number=1, # Mandatory field
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