# FILE: backend/app/api/tournaments.py
import uuid
import math 
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, EmailStr

from app.db.session import get_session
from app.models.tournament import Tournament
from app.models.user import User
from app.models.player import Player
from app.models.match import Match
from app.models.dartboard import Dartboard 
from app.models.team import Team
from app.api.users import get_current_user
from app.models.links import TournamentTeamLink

from app.schemas.tournament import (
    TournamentCreate, 
    TournamentRead, 
    TournamentUpdate, 
    TournamentReadWithMatches
)

from app.services.tournament_gen import (
    generate_poule_phase, 
    generate_round_robin_global,
    generate_knockout,
    generate_knockout_bracket,
    assign_referees,
    calculate_poule_standings 
)

router = APIRouter()

# --- HELPER: TOEGANGSCONTROLE ---
def verify_tournament_access(tournament: Tournament, user: User):
    """
    Controleert of de gebruiker de eigenaar OF een co-admin is.
    Gooit een 403 error als toegang geweigerd wordt.
    """
    is_owner = tournament.user_id == user.id
    # We gebruiken getattr om veilig te checken, mocht de relatie nog leeg zijn
    admins = getattr(tournament, 'admins', [])
    is_co_admin = any(u.id == user.id for u in admins)

    if not (is_owner or is_co_admin):
         raise HTTPException(status_code=403, detail="Access denied: You are not the owner or admin.")

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
    
    if len(players_to_link) < 2:
        raise HTTPException(status_code=400, detail="Selecteer minimaal 2 spelers.")

    # 2. Validatie Poulegrootte
    if tourn_in.format == "hybrid" and tourn_in.number_of_poules > 0:
            entity_count = len(players_to_link)
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
    
    # 6. Generate Matches (Singles)
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
    # AANGEPAST: We halen de admins en players op
    # We filteren NIET direct op user_id in de SQL, dat doen we in de check daarna
    statement = (
        select(Tournament)
        .where(Tournament.id == tournament_id)
        .options(
            selectinload(Tournament.players), 
            selectinload(Tournament.admins) # Zorg dat admins geladen zijn!
        )
    )
    tournament = session.exec(statement).first()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # --- SECURITY CHECK ---
    verify_tournament_access(tournament, current_user)
    # ---------------------------------
        
    return tournament

@router.get("/{tournament_id}/standings")
def get_tournament_standings(
    tournament_id: int,
    session: Session = Depends(get_session),
    # Deze endpoint wordt gebruikt in het dashboard, dus beveiligen we hem ook
    current_user: User = Depends(get_current_user) 
):
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # --- SECURITY CHECK ---
    # We laden admins even handmatig bij omdat session.get dat niet altijd doet
    session.refresh(tournament, ["admins"])
    verify_tournament_access(tournament, current_user)
    # ----------------------

    return calculate_poule_standings(session, tournament)

@router.get("/", response_model=List[TournamentRead])
def read_tournaments(
    offset: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # TODO: Voor volledigheid zou je hier ook toernooien moeten ophalen 
    # waar de user 'admin' van is, niet alleen eigenaar.
    # Voor nu laten we dit op eigenaar staan voor de standaard lijst.
    tournaments = session.exec(
        select(Tournament)
        .where(Tournament.user_id == current_user.id)
        .options(selectinload(Tournament.players), selectinload(Tournament.boards))
        .order_by(Tournament.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    
    results = []
    for t in tournaments:
        t_data = t.model_dump()
        t_data['player_count'] = len(t.players)
        t_data['board_count'] = len(t.boards)
        results.append(t_data)
        
    return results

@router.get("/public/{public_uuid}", response_model=TournamentReadWithMatches)
def read_public_tournament(public_uuid: str, session: Session = Depends(get_session)):
    # Publieke endpoints hebben GEEN user check nodig
    t = session.exec(
        select(Tournament)
        .where(Tournament.public_uuid == public_uuid)
        .options(
            selectinload(Tournament.matches).options(
                selectinload(Match.referee),
                selectinload(Match.referee_team)
            ), 
            selectinload(Tournament.players)
        )
    ).first()
    
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    player_map = {p.id: p.name for p in t.players}
    
    teams = session.exec(
        select(Team)
        .join(TournamentTeamLink)
        .where(TournamentTeamLink.tournament_id == t.id)
    ).all()
    team_map = {team.id: team.name for team in teams}

    matches_data = []
    sorted_matches = sorted(t.matches, key=lambda m: m.id)
    
    for m in sorted_matches:
        m_dict = m.model_dump()
        
        if m.player1_id:
            m_dict['player1_name'] = player_map.get(m.player1_id, "Bye")
        elif m.team1_id:
             m_dict['player1_name'] = team_map.get(m.team1_id, "Bye")
        else:
             m_dict['player1_name'] = "Bye"

        if m.player2_id:
            m_dict['player2_name'] = player_map.get(m.player2_id, "Bye")
        elif m.team2_id:
             m_dict['player2_name'] = team_map.get(m.team2_id, "Bye")
        else:
             m_dict['player2_name'] = "Bye"
             
        if m.referee:
            m_dict['referee_name'] = m.referee.name
        elif m.referee_team:
            m_dict['referee_name'] = m.referee_team.name
        else:
            m_dict['referee_name'] = "-" 

        matches_data.append(m_dict)

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
    
    # --- SECURITY CHECK ---
    session.refresh(t, ["admins"])
    verify_tournament_access(t, current_user)
    # ----------------------
        
    generate_knockout_bracket(session, t)
    
    return {"message": "Knockout phase generated"}

@router.patch("/{tournament_id}", response_model=TournamentRead)
def update_tournament_settings(
    tournament_id: int,
    tourn_update: TournamentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Laad tournament inclusief admins voor de check
    statement = select(Tournament).where(Tournament.id == tournament_id).options(selectinload(Tournament.admins))
    tournament = session.exec(statement).first()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # --- SECURITY CHECK ---
    verify_tournament_access(tournament, current_user)
    # ----------------------
    
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
    # Eerst toernooi checken voor security
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")
    
    # --- SECURITY CHECK ---
    session.refresh(tournament, ["admins"])
    verify_tournament_access(tournament, current_user)
    # ----------------------

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
    
    # --- SECURITY CHECK ---
    session.refresh(tournament, ["admins"])
    verify_tournament_access(tournament, current_user)
    # ----------------------
    
    # 1. Delete Matches
    matches = session.exec(select(Match).where(Match.tournament_id == tournament_id)).all()
    for m in matches:
        session.delete(m)
        
    # 2. Delete Teams
    teams = session.exec(
        select(Team)
        .join(TournamentTeamLink)
        .where(TournamentTeamLink.tournament_id == tournament_id)
    ).all()
    
    for t in teams:
        session.delete(t)
        
    # 3. Delete Tournament
    session.delete(tournament)
    session.commit()
    
    return {"ok": True}

@router.post("/{tournament_id}/finalize")
def finalize_tournament_setup(
    tournament_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user) # Toegevoegd voor security
):
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")

    # --- SECURITY CHECK ---
    session.refresh(tournament, ["admins"])
    verify_tournament_access(tournament, current_user)
    # ----------------------

    if tournament.mode == "singles":
        return {"message": "Already generated (singles)"}

    teams = session.exec(select(Team).where(Team.tournament_id == tournament_id)).all()
    
    if len(teams) < 2:
        raise HTTPException(status_code=400, detail="Te weinig teams om wedstrijden te genereren.")

    existing_matches = session.exec(select(Match).where(Match.tournament_id == tournament_id)).all()
    for m in existing_matches:
        session.delete(m)
    
    num_poules = tournament.number_of_poules
    poules = [[] for _ in range(num_poules)]
    
    for i, team in enumerate(teams):
        poule_index = i % num_poules
        poules[poule_index].append(team)

    matches_created = []
    
    for poule_idx, poule_teams in enumerate(poules):
        poule_number = poule_idx + 1
        n = len(poule_teams)
        poule_matches = [] 

        for i in range(n):
            for j in range(i + 1, n):
                t1 = poule_teams[i]
                t2 = poule_teams[j]
                
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
                poule_matches.append(match)

        assign_referees(poule_matches, poule_teams, is_doubles=True)
        matches_created.extend(poule_matches)
        session.add_all(poule_matches)

    session.commit()
    return {"message": f"Setup finalized. {len(matches_created)} matches generated for {len(teams)} teams."}


class AddAdminRequest(BaseModel):
    email: EmailStr

@router.post("/{tournament_id}/admins", response_model=TournamentRead)
def add_admin_to_tournament(
    tournament_id: int,
    admin_req: AddAdminRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Voeg een andere gebruiker toe als co-admin op basis van email.
    Alleen de EIGENAAR mag dit doen.
    """
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")
    
    # Security Check: Alleen de EIGENAAR mag admins toevoegen (niet de co-admins)
    if tournament.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Alleen de eigenaar mag beheerders toevoegen.")

    # Zoek de nieuwe admin
    new_admin = session.exec(select(User).where(User.email == admin_req.email)).first()
    if not new_admin:
        raise HTTPException(status_code=404, detail="Gebruiker met dit e-mailadres niet gevonden.")
    
    if new_admin.id == current_user.id:
         raise HTTPException(status_code=400, detail="Je bent al de eigenaar.")

    # Check of hij al admin is
    if new_admin in tournament.admins:
        raise HTTPException(status_code=400, detail="Deze gebruiker is al beheerder.")

    # Toevoegen
    tournament.admins.append(new_admin)
    session.add(tournament)
    session.commit()
    session.refresh(tournament)
    
    return tournament