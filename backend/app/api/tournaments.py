# FILE: backend/app/api/tournaments.py
import uuid
import math 
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, EmailStr
from sqlalchemy import or_

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
    TournamentReadWithMatches,
    SwapRequest,
    SwapMatchRequest
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
    

def nuke_future_knockout_rounds(session: Session, tournament_id: int, current_round: int):
    """
    Verwijdert alle knockout-wedstrijden die ná 'current_round' komen.
    Dit is nodig als de basis van de bracket verandert.
    """
    future_matches = session.exec(
        select(Match)
        .where(Match.tournament_id == tournament_id)
        .where(Match.poule_number == None) # Alleen Knockout
        .where(Match.round_number > current_round)
    ).all()
    
    if future_matches:
        for fm in future_matches:
            session.delete(fm)
        print(f"DEBUG: {len(future_matches)} toekomstige wedstrijden verwijderd omdat de bracket is gewijzigd.")


@router.get("/public/list", response_model=List[TournamentRead])
def read_public_tournaments_list(
    limit: int = 5,
    session: Session = Depends(get_session)
):
    """
    Public endpoint to get the last 5 created tournaments.
    No authentication required.
    """
    tournaments = session.exec(
        select(Tournament)
        .order_by(Tournament.created_at.desc())
        .limit(limit)
    ).all()
    
    # We populate counts manually for the list view
    results = []
    for t in tournaments:
        # Ensure relationships are loaded if needed, or use counts
        # This is a lightweight version of the logic in read_tournaments
        t_data = t.model_dump()
        t_data['player_count'] = len(t.players)
        t_data['board_count'] = len(t.boards)
        results.append(t_data)
        
    return results


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

@router.get("/{tournament_id}/standings")
def get_tournament_standings(
    tournament_id: int,
    session: Session = Depends(get_session)
):
    """
    Geeft de stand in de poules terug.
    """
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
        
    return calculate_poule_standings(session, tournament)

@router.get("/public/{public_uuid}", response_model=TournamentReadWithMatches)
def read_public_tournament(public_uuid: str, session: Session = Depends(get_session)):
    # Publieke endpoints hebben GEEN user check nodig
    t = session.exec(
        select(Tournament)
        .where(Tournament.public_uuid == public_uuid)
        .options(
            selectinload(Tournament.matches).options(
                selectinload(Match.referee),
                selectinload(Match.referee_team),
                selectinload(Match.beer_fetcher),
                selectinload(Match.beer_fetcher_team)
            ), 
            selectinload(Tournament.players),
            selectinload(Tournament.boards)  # <--- 1. DEZE REGEL TOEGEVOEGD [cite: 2250]
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

    # Maak een map van Bord Nummer -> Bord ID zodat we de matches kunnen koppelen
    board_map = {b.number: b.id for b in t.boards}

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
             
        if m.referee_team_id:
             # Gebruik de team_map die je hierboven al hebt gemaakt (sneller & veiliger)
             m_dict['referee_name'] = team_map.get(m.referee_team_id, "-")
        elif m.referee:
            m_dict['referee_name'] = m.referee.name
        elif m.custom_referee_name:
            m_dict['referee_name'] = m.custom_referee_name
        else:
            m_dict['referee_name'] = "-"

        if m.beer_fetcher:
            m_dict['beer_fetcher_name'] = m.beer_fetcher.name
        elif m.beer_fetcher_team:
            m_dict['beer_fetcher_name'] = m.beer_fetcher_team.name
        else:
            m_dict['beer_fetcher_name'] = None

        # 2. BORD KOPPELEN: Zoek het ID bij het nummer
        if m.board_number:
            m_dict['board_id'] = board_map.get(m.board_number)
        else:
            m_dict['board_id'] = None

        matches_data.append(m_dict)

    response = t.model_dump()
    response['matches'] = matches_data
    response['player_count'] = len(t.players)
    response['board_count'] = len(t.boards)
    
    # 3. BORDEN MEEGEVEN IN RESPONSE
    response['boards'] = t.boards 

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

@router.post("/{tournament_id}/swap-participants")
def swap_poule_participants(
    tournament_id: int,
    swap_data: SwapRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")
    
    session.refresh(tournament, ["admins"])
    verify_tournament_access(tournament, current_user)

    matches = session.exec(
        select(Match)
        .where(Match.tournament_id == tournament_id)
        .where(or_(Match.poule_number != None, Match.round_number != None)) 
    ).all()

    is_doubles = tournament.mode == "doubles"
    id1, id2 = swap_data.entity_id_1, swap_data.entity_id_2
    has_started = False
    
    # Variabele om bij te houden wat de laagste KO ronde is die we aanraken
    affected_ko_round = None

    # Check op reeds gestarte wedstrijden
    for m in matches:
        p1 = m.team1_id if is_doubles else m.player1_id
        p2 = m.team2_id if is_doubles else m.player2_id
        
        # Check of spelers betrokken zijn
        if p1 in [id1, id2] or p2 in [id1, id2]:
            # Is dit een KO match?
            if m.poule_number is None:
                if affected_ko_round is None or m.round_number < affected_ko_round:
                    affected_ko_round = m.round_number

            # Check of er al scores zijn (voor de waarschuwing)
            # Byes (p2 is None) tellen niet mee als 'gestart'
            if p2 is not None and (m.score_p1 > 0 or m.score_p2 > 0 or m.is_completed):
                has_started = True

    # Als er toekomstige rondes bestaan die we gaan verwijderen, is dat ook een "destructieve actie"
    # Dus als affected_ko_round gevonden is, checken we of er rondes NA die ronde zijn
    if affected_ko_round is not None:
        future_check = session.exec(select(Match).where(Match.tournament_id==tournament_id).where(Match.poule_number==None).where(Match.round_number > affected_ko_round)).first()
        if future_check:
            has_started = True # Forceer bevestiging omdat we data gaan weggooien

    if has_started and not swap_data.confirmed:
        return {
            "require_confirmation": True, 
            "message": "Let op: Het toernooi is al gestart of er zijn vervolgrondes. Als je doorgaat worden scores gereset en latere knockout-rondes VERWIJDERD. Doorgaan?"
        }

    # Voer wissel uit
    for m in matches:
        curr_p1 = m.team1_id if is_doubles else m.player1_id
        curr_p2 = m.team2_id if is_doubles else m.player2_id
        updated = False

        if curr_p1 == id1:
            setattr(m, f"{'team' if is_doubles else 'player'}1_id", id2)
            updated = True
        elif curr_p1 == id2:
            setattr(m, f"{'team' if is_doubles else 'player'}1_id", id1)
            updated = True
            
        if curr_p2 == id1:
            setattr(m, f"{'team' if is_doubles else 'player'}2_id", id2)
            updated = True
        elif curr_p2 == id2:
            setattr(m, f"{'team' if is_doubles else 'player'}2_id", id1)
            updated = True

        if updated:
            new_p2 = m.team2_id if is_doubles else m.player2_id
            
            # Reset Logic
            if new_p2 is None:
                # Het is een Bye
                m.is_completed = True
                m.score_p1 = math.ceil(m.best_of_legs / 2) if m.best_of_legs else 1
                m.score_p2 = 0
            else:
                # Echte wedstrijd: resetten
                m.score_p1 = 0
                m.score_p2 = 0
                m.is_completed = False
            
            session.add(m)

    # NIEUW: Als we in de knockout fase zaten, verwijder alle rondes die hierna komen
    if affected_ko_round is not None:
        nuke_future_knockout_rounds(session, tournament_id, affected_ko_round)

    session.commit()
    return {"message": "Spelers gewisseld en schema bijgewerkt.", "require_confirmation": False}

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

# 1. SETUP FUNCTIE (Zet schrijvers in DB)
@router.post("/{tournament_id}/finalize")
def finalize_tournament_setup(
    tournament_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")

    session.refresh(tournament, ["admins"])
    verify_tournament_access(tournament, current_user)

    if tournament.mode == "singles":
        # Bij singles laten we de bestaande logica intact (of je roept hier je oude singles logica aan)
        # Als je hier ook een fix nodig hebt, laat het weten, maar je vroeg specifiek om teams.
        return {"message": "Already generated (singles)"}

    # --- TEAMS LOGICA ---
    teams = session.exec(
        select(Team)
        .join(TournamentTeamLink)
        .where(TournamentTeamLink.tournament_id == tournament_id)
    ).all()
    
    if len(teams) < 2:
        raise HTTPException(status_code=400, detail="Te weinig teams.")

    # Oude matches wissen
    existing_matches = session.exec(select(Match).where(Match.tournament_id == tournament_id)).all()
    for m in existing_matches:
        session.delete(m)
    
    boards = sorted(tournament.boards, key=lambda b: b.number) if tournament.boards else []
    num_poules = tournament.number_of_poules
    poules = [[] for _ in range(num_poules)]
    
    for i, team in enumerate(teams):
        poules[i % num_poules].append(team)

    matches_created = []
    
    for poule_idx, poule_teams in enumerate(poules):
        poule_number = poule_idx + 1
        
        # ROUND ROBIN GENERATIE (Zodat we rondes hebben voor de hussel)
        rotation = list(poule_teams)
        if len(rotation) % 2 != 0:
            rotation.append(None) # Bye
        
        num_rotation = len(rotation)
        num_rounds = num_rotation - 1
        half = num_rotation // 2
        
        for round_idx in range(num_rounds):
            round_num = round_idx + 1
            for i in range(half):
                t1 = rotation[i]
                t2 = rotation[num_rotation - 1 - i]
                
                if t1 and t2:
                    match = Match(
                        tournament_id=tournament.id,
                        poule_number=poule_number,
                        board_number=None, # Wordt hieronder toegewezen
                        team1_id=t1.id,
                        team2_id=t2.id,
                        round_number=round_num,
                        best_of_legs=tournament.starting_legs_group,
                        best_of_sets=tournament.sets_per_match
                    )
                    matches_created.append(match)
            
            rotation.insert(1, rotation.pop())

    # BORD TOEWIJZING (Hussel of Vast)
    if len(boards) > num_poules or tournament.shuffle_boards:
        matches_created.sort(key=lambda m: (m.round_number, m.poule_number))
        for i, match in enumerate(matches_created):
            offset = (match.round_number - 1) if tournament.shuffle_boards else 0
            board_idx = (i + offset) % len(boards)
            match.board_number = boards[board_idx].number
    else:
        for match in matches_created:
            if match.poule_number <= len(boards):
                match.board_number = boards[match.poule_number - 1].number

    # SCHRIJVERS TOEWIJZEN (Per poule)
    matches_by_poule = {i: [] for i in range(1, num_poules + 1)}
    for m in matches_created:
        matches_by_poule[m.poule_number].append(m)
        
    for poule_idx, poule_teams in enumerate(poules):
        p_num = poule_idx + 1
        pm = matches_by_poule[p_num]
        pm.sort(key=lambda m: m.round_number)
        assign_referees(pm, poule_teams, is_doubles=True)

    session.add_all(matches_created)

    session.commit()
    return {"message": f"Setup finalized. Matches generated."}


# 2. READ FUNCTIE (Stuurt de naam naar de Frontend)
@router.get("/{tournament_id}", response_model=TournamentRead)
def read_tournament_by_id(
    tournament_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # We moeten alle relaties laden om de namen te kunnen pakken
    statement = (
        select(Tournament)
        .where(Tournament.id == tournament_id)
        .options(
            selectinload(Tournament.players), 
            selectinload(Tournament.teams),
            selectinload(Tournament.admins),
            selectinload(Tournament.matches).options(
                selectinload(Match.referee_team), # Laad Team
                selectinload(Match.referee)       # Laad Player
            )
        )
    )
    tournament = session.exec(statement).first()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    verify_tournament_access(tournament, current_user)
    
    # --- DE TRUC ---
    # We converteren het model naar een dict en injecteren handmatig 'referee_name'
    # omdat computed properties niet standaard in de JSON output zitten.
    t_dict = tournament.model_dump()
    
    if tournament.matches:
        enriched_matches = []
        for m in tournament.matches:
            m_data = m.model_dump()
            # Hier roepen we de @property aan uit match.py
            m_data['referee_name'] = m.referee_name 
            enriched_matches.append(m_data)
        
        # Sorteer op ID zodat ze niet verspringen in beeld
        t_dict['matches'] = sorted(enriched_matches, key=lambda x: x['id'])

    return t_dict

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

@router.post("/{tournament_id}/swap-matches")
def swap_matches_content(
    tournament_id: int,
    swap_data: SwapMatchRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")
    
    session.refresh(tournament, ["admins"])
    verify_tournament_access(tournament, current_user)

    m1 = session.get(Match, swap_data.match_id_1)
    m2 = session.get(Match, swap_data.match_id_2)

    if not m1 or not m2:
        raise HTTPException(status_code=404, detail="Wedstrijd niet gevonden")

    # Tuple swap van content
    (
        m1.team1_id, m2.team1_id,
        m1.team2_id, m2.team2_id,
        m1.player1_id, m2.player1_id,
        m1.player2_id, m2.player2_id,
        m1.referee_id, m2.referee_id,
        m1.referee_team_id, m2.referee_team_id,  
        m1.custom_referee_name, m2.custom_referee_name
    ) = (
        m2.team1_id, m1.team1_id,
        m2.team2_id, m1.team2_id,
        m2.player1_id, m1.player1_id,
        m2.player2_id, m1.player2_id,
        m2.referee_id, m1.referee_id,
        m2.referee_team_id, m1.referee_team_id,
        m2.custom_referee_name, m1.custom_referee_name
    )

    # NIEUW: Resetten van scores bij een match swap (zoals gevraagd)
    # Tenzij het een Bye is (p2 is None), dan moet hij completed blijven/worden.
    for m in [m1, m2]:
        is_doubles = tournament.mode == 'doubles'
        p2 = m.team2_id if is_doubles else m.player2_id
        
        if p2 is None: # Bye
            m.is_completed = True
            m.score_p1 = math.ceil(m.best_of_legs / 2) if m.best_of_legs else 3
            m.score_p2 = 0
        else:
            m.score_p1 = 0
            m.score_p2 = 0
            m.is_completed = False

    session.add(m1)
    session.add(m2)

    # NIEUW: Verwijder volgende rondes als dit KO-wedstrijden zijn
    if m1.poule_number is None:
        # We pakken de laagste ronde (meestal zijn m1 en m2 dezelfde ronde bij een swap, maar voor de zekerheid)
        lowest_round = min(m1.round_number, m2.round_number)
        nuke_future_knockout_rounds(session, tournament_id, lowest_round)

    session.commit()
    return {"message": "Wedstrijden gewisseld, scores gereset en vervolgrondes verwijderd."}