# FILE: backend/app/api/teams.py
import random
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.team import Team
from app.models.player import Player
from app.models.tournament import Tournament
from app.schemas.team import TeamCreateManual, TeamAutoGenerate, TeamRead
from app.api.users import get_current_user # Beveiliging

router = APIRouter()

# --- HELPER: Automatische Naam Genereren ---
def generate_team_name(players: List[Player]) -> str:
    """
    Genereert een naam zoals 'Van Gerwen & Van Barneveld' 
    of 'Michael & Raymond' als er geen achternaam is.
    """
    names = []
    for p in players:
        # Gebruik achternaam als die er is, anders voornaam
        name_part = p.last_name if p.last_name else p.first_name
        if p.nickname: # Optioneel: nickname gebruiken
             name_part = p.nickname
        names.append(name_part)
    
    return " & ".join(names)

# --- ENDPOINT 1: Handmatig Team Aanmaken ---
@router.post("/manual", response_model=TeamRead)
def create_manual_team(
    team_in: TeamCreateManual,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    # 1. Check of toernooi bestaat
    tournament = session.get(Tournament, team_in.tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")

    # 2. Haal spelers op
    players = session.exec(select(Player).where(Player.id.in_(team_in.player_ids))).all()
    if len(players) != len(team_in.player_ids):
        raise HTTPException(status_code=400, detail="Eén of meer speler IDs bestaan niet.")
    
    if len(players) < 2:
        raise HTTPException(status_code=400, detail="Een team moet minimaal 2 spelers hebben.")

    # 3. Bepaal de naam (Eis 3: Automatisch als leeg)
    final_name = team_in.name
    if not final_name or final_name.strip() == "":
        final_name = generate_team_name(players)

    # 4. Opslaan
    team = Team(name=final_name, tournament_id=team_in.tournament_id)
    team.players = players # SQLModel regelt de koppeltabel automatisch
    
    session.add(team)
    session.commit()
    session.refresh(team)
    
    return team

# --- ENDPOINT 2: Automatisch Random Teams Genereren ---
@router.post("/auto", response_model=List[TeamRead])
def create_auto_teams(
    auto_in: TeamAutoGenerate,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    # 1. Haal spelers op
    players = session.exec(select(Player).where(Player.id.in_(auto_in.player_ids))).all()
    
    # Check even aantal (voor koppels)
    if len(players) % 2 != 0:
        raise HTTPException(status_code=400, detail="Aantal spelers moet even zijn om koppels te maken.")

    # 2. Husselen (Eis 1: Random)
    # We maken een kopie van de lijst om te husselen
    shuffled_players = list(players)
    random.shuffle(shuffled_players)

    new_teams = []

    # 3. Loop door de lijst in stappen van 2
    for i in range(0, len(shuffled_players), 2):
        p1 = shuffled_players[i]
        p2 = shuffled_players[i+1]
        
        pair_players = [p1, p2]
        
        # Eis 3: Automatische naam
        auto_name = generate_team_name(pair_players)
        
        team = Team(name=auto_name, tournament_id=auto_in.tournament_id)
        team.players = pair_players
        
        session.add(team)
        new_teams.append(team)

    session.commit()
    
    # Refresh alle teams om ID's te krijgen
    for t in new_teams:
        session.refresh(t)
        
    return new_teams

# --- ENDPOINT 3: Teams ophalen van een toernooi ---
@router.get("/{tournament_id}", response_model=List[TeamRead])
def read_teams(
    tournament_id: int,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    teams = session.exec(select(Team).where(Team.tournament_id == tournament_id)).all()
    return teams