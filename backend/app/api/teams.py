import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.team import Team
from app.models.player import Player
from app.models.tournament import Tournament
from app.models.links import TournamentTeamLink # <--- Vergeet deze import niet!
from app.schemas.team import TeamCreateManual, TeamAutoGenerate, TeamRead, TeamLinkInput
from app.api.users import get_current_user 
from sqlalchemy.orm import selectinload

router = APIRouter()

# --- HELPER: Automatische Naam Genereren ---
def generate_team_name(players: List[Player]) -> str:
    names = []
    for p in players:
        name_part = p.last_name if p.last_name else p.first_name
        if p.nickname:
             name_part = p.nickname
        names.append(name_part)
    return " & ".join(names)

# --- ENDPOINT 1: Alle Teams Ophalen (Global) ---
@router.get("/", response_model=List[TeamRead])
def read_all_teams(
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    """Haal alle teams op die in de database staan (voor de 'Manage Teams' pagina)."""
    teams = session.exec(select(Team)).all()
    return teams

# --- ENDPOINT 2: Teams van een specifiek toernooi ophalen ---
@router.get("/by-tournament/{tournament_id}", response_model=List[TeamRead])
def read_teams_by_tournament(
    tournament_id: int,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    """Haal alleen de teams op die gelinkt zijn aan dit toernooi."""
    # We joinen Team met de koppeltabel
    statement = (
        select(Team)
        .join(TournamentTeamLink)
        .where(TournamentTeamLink.tournament_id == tournament_id)
    )
    teams = session.exec(statement).all()
    return teams

# --- ENDPOINT 3: Handmatig Team Aanmaken (En optioneel linken) ---
@router.post("/manual", response_model=TeamRead)
def create_manual_team(
    team_in: TeamCreateManual,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    # 1. Haal spelers op
    players = session.exec(select(Player).where(Player.id.in_(team_in.player_ids))).all()
    if len(players) != len(team_in.player_ids):
        raise HTTPException(status_code=400, detail="Eén of meer speler IDs bestaan niet.")
    
    if len(players) < 2:
        raise HTTPException(status_code=400, detail="Een team moet minimaal 2 spelers hebben.")

    # --- NIEUW: DUPLICATE CHECK ---
    # Haal alle teams op inclusief hun spelers
    existing_teams = session.exec(select(Team).options(selectinload(Team.players))).all()
    
    # Maak een 'set' van de nieuwe IDs (volgorde maakt niet uit: {1, 2} is hetzelfde als {2, 1})
    new_team_ids = set(p.id for p in players)

    for team in existing_teams:
        existing_team_ids = set(p.id for p in team.players)
        
        if existing_team_ids == new_team_ids:
            # We hebben een match!
            raise HTTPException(
                status_code=400, 
                detail=f"Dit team bestaat al onder de naam '{team.name}'."
            )
    # ------------------------------

    # 2. Bepaal de naam
    final_name = team_in.name
    if not final_name or final_name.strip() == "":
        final_name = generate_team_name(players)

    # 3. Maak het Team object (ZONDER tournament_id)
    team = Team(name=final_name)
    team.players = players
    session.add(team)
    session.commit()
    session.refresh(team)

    # 4. Linken als tournament_id is meegegeven
    if team_in.tournament_id:
        tournament = session.get(Tournament, team_in.tournament_id)
        if not tournament:
            raise HTTPException(status_code=404, detail="Toernooi niet gevonden")
            
        link = TournamentTeamLink(tournament_id=tournament.id, team_id=team.id)
        session.add(link)
        session.commit()
    
    return team

# --- ENDPOINT 4: Bestaande Teams Linken aan Toernooi ---
@router.post("/link", response_model=dict)
def link_teams(
    link_in: TeamLinkInput,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    tournament = session.get(Tournament, link_in.tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")

    count = 0
    for team_id in link_in.team_ids:
        # Check of link al bestaat om dubbelen te voorkomen
        existing = session.get(TournamentTeamLink, (link_in.tournament_id, team_id))
        if not existing:
            link = TournamentTeamLink(tournament_id=link_in.tournament_id, team_id=team_id)
            session.add(link)
            count += 1
    
    session.commit()
    return {"message": f"{count} teams succesvol gekoppeld."}

# --- ENDPOINT 5: Automatisch Random Teams (Blijft grotendeels gelijk, maar met links) ---
@router.post("/auto", response_model=List[TeamRead])
def create_auto_teams(
    auto_in: TeamAutoGenerate,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    # 1. Haal spelers op
    players = session.exec(select(Player).where(Player.id.in_(auto_in.player_ids))).all()
    if len(players) % 2 != 0:
        raise HTTPException(status_code=400, detail="Aantal spelers moet even zijn.")

    # 2. Husselen
    shuffled_players = list(players)
    random.shuffle(shuffled_players)

    new_teams = []
    
    # 3. Check Toernooi
    tournament = session.get(Tournament, auto_in.tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")

    for i in range(0, len(shuffled_players), 2):
        p1 = shuffled_players[i]
        p2 = shuffled_players[i+1]
        
        pair_players = [p1, p2]
        auto_name = generate_team_name(pair_players)
        
        # A. Maak Team
        team = Team(name=auto_name)
        team.players = pair_players
        session.add(team)
        session.commit() 
        session.refresh(team)
        
        # B. Maak Link
        link = TournamentTeamLink(tournament_id=tournament.id, team_id=team.id)
        session.add(link)
        
        new_teams.append(team)

    session.commit()
    
    # Refresh voor return
    for t in new_teams:
        session.refresh(t)
        
    return new_teams

@router.delete("/{team_id}")
def delete_team(
    team_id: int,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    team = session.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team niet gevonden")
    
    # Optioneel: Check of team al wedstrijden heeft gespeeld om integriteitsfouten te voorkomen
    # Voor nu verwijderen we hem gewoon hard (SQLAlchemy regelt vaak de link-tabellen)
    session.delete(team)
    session.commit()
    return {"ok": True}