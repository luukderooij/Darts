# FILE: backend/app/api/matches.py
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload 
from pydantic import BaseModel

from app.db.session import get_session
from app.models.match import Match, MatchDetail
from app.models.player import Player
from app.models.team import Team 
from app.models.tournament import Tournament
from app.models.user import User
from app.schemas.match import MatchRead, MatchScoreUpdate, MatchSwapRequest
from app.api.users import get_current_user
from app.services.tournament_gen import check_and_advance_knockout

logger = logging.getLogger("dart_app")

router = APIRouter()

# --- Helpers ---

def get_match_or_404(match_id: int, session: Session) -> Match:
    match = session.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match

# --- Endpoints ---

@router.put("/{match_id}/score", response_model=MatchRead)
def update_match_score(
    match_id: int,
    match_in: MatchScoreUpdate,
    session: Session = Depends(get_session)
    # VERWIJDERD: current_user: User = Depends(get_current_user) 
    # Dit zorgt ervoor dat tablets scores kunnen opslaan zonder admin login.
):
    match = session.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # --- VALIDATION LOGIC --- 
    if match.best_of_legs:
        limit = match.best_of_legs
        winning_threshold = (limit // 2) + 1
        
        # 1. Validate Total Legs
        if match_in.score_p1 + match_in.score_p2 > limit:
            raise HTTPException(
                status_code=400, 
                detail=f"Impossible score: Total legs ({match_in.score_p1 + match_in.score_p2}) cannot exceed Best of {limit}."
            )

        # 2. Validate Individual Score
        if match_in.score_p1 > winning_threshold or match_in.score_p2 > winning_threshold:
            raise HTTPException(
                status_code=400, 
                detail=f"Impossible score: A player cannot win more than {winning_threshold} legs in a Best of {limit} match."
            )

        # 3. Auto-Complete Logic
        if match_in.score_p1 == winning_threshold or match_in.score_p2 == winning_threshold:
            match.is_completed = True
        else:
            match.is_completed = False

    # Apply updates
    match.score_p1 = match_in.score_p1
    match.score_p2 = match_in.score_p2
    
    # Gebruik model_dump(exclude_unset=True) om alleen meegestuurde velden te updaten
    update_data = match_in.model_dump(exclude_unset=True)

    if "referee_id" in update_data:
        match.referee_id = update_data["referee_id"]
    
    if "referee_team_id" in update_data:
        match.referee_team_id = update_data["referee_team_id"]

    if "custom_referee_name" in update_data:
        match.custom_referee_name = update_data["custom_referee_name"]

    if not match.best_of_legs:
        match.is_completed = match_in.is_completed

    session.add(match)
    session.commit()
    session.refresh(match)
    
    # Trigger knockout progressie als de wedstrijd voltooid is
    if match.is_completed and match.poule_number is None:
        check_and_advance_knockout(match.tournament_id, match.round_number, session)

    return match

@router.get("/by-tournament/{public_uuid}", response_model=List[MatchRead])
def get_matches_public(
    public_uuid: str,
    session: Session = Depends(get_session)
):
    # 1. Resolve Tournament
    statement = select(Tournament).where(Tournament.public_uuid == public_uuid)
    tournament = session.exec(statement).first()
    
    if not tournament:
        statement_scorer = select(Tournament).where(Tournament.scorer_uuid == public_uuid)
        tournament = session.exec(statement_scorer).first()
        
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
        
    # 2. Get Matches met relaties
    statement_matches = (
        select(Match)
        .where(Match.tournament_id == tournament.id)
        .options(
            selectinload(Match.player1),
            selectinload(Match.player2),
            selectinload(Match.team1), 
            selectinload(Match.team2),
            selectinload(Match.referee),
            selectinload(Match.referee_team)
        )
        .order_by(Match.id)
    )
    matches = session.exec(statement_matches).all()
    
    # 3. Construct Response met de juiste namen
    results = []
    for m in matches:
        m_data = m.model_dump()
        
        # Naam 1
        if m.player1:
            m_data['player1_name'] = m.player1.name
        elif m.team1:
            m_data['player1_name'] = m.team1.name 
        else:
             m_data['player1_name'] = "Bye"

        # Naam 2
        if m.player2:
             m_data['player2_name'] = m.player2.name
        elif m.team2:
             m_data['player2_name'] = m.team2.name
        else:
             m_data['player2_name'] = "Bye"

        # Referee Naam Logica
        if m.referee:
            m_data['referee_name'] = m.referee.name
        elif m.referee_team:
            m_data['referee_name'] = m.referee_team.name
        elif getattr(m, 'custom_referee_name', None):
            m_data['referee_name'] = m.custom_referee_name
        else:
            m_data['referee_name'] = "-" 
    
        results.append(m_data)
        
    return results

class MatchBoardUpdate(BaseModel):
    board_number: int

@router.patch("/{match_id}/assign-board", response_model=MatchRead)
def assign_board(
    match_id: int,
    update_data: MatchBoardUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Handmatige override: Verplaats een wedstrijd naar een specifiek bord.
    """
    match = session.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found") 
    
    match.board_number = update_data.board_number
    session.add(match)
    session.commit()
    session.refresh(match)
    return match


@router.get("/{match_id}", response_model=MatchDetail)
def get_single_match(
    match_id: int,
    session: Session = Depends(get_session)
):
    """Haal details van één specifieke wedstrijd op."""
    statement = (
        select(Match)
        .where(Match.id == match_id)
        .options(
            selectinload(Match.player1),
            selectinload(Match.player2),
            selectinload(Match.team1), 
            selectinload(Match.team2),
            selectinload(Match.referee),
            selectinload(Match.referee_team)
        )
    )
    match = session.exec(statement).first()
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Construct Response
    m_data = match.model_dump()
    
    if match.player1: m_data['player1_name'] = match.player1.name
    elif match.team1: m_data['player1_name'] = match.team1.name 
    else: m_data['player1_name'] = "Bye"

    if match.player2: m_data['player2_name'] = match.player2.name
    elif match.team2: m_data['player2_name'] = match.team2.name
    else: m_data['player2_name'] = "Bye"

    if match.referee: m_data['referee_name'] = match.referee.name
    elif match.referee_team: m_data['referee_name'] = match.referee_team.name
    elif getattr(match, 'custom_referee_name', None): m_data['referee_name'] = match.custom_referee_name
    else: m_data['referee_name'] = "-" 

    return m_data




@router.post("/{tournament_id}/swap-matches")
def swap_matches(
    tournament_id: int,
    swap_data: MatchSwapRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Wisselt twee wedstrijden van plek (door de spelers/teams te swappen).
    Dit past de speelvolgorde aan zonder ID's te veranderen.
    """
    m1 = session.get(Match, swap_data.match_id_1)
    m2 = session.get(Match, swap_data.match_id_2)

    if not m1 or not m2:
        raise HTTPException(status_code=404, detail="Match niet gevonden")

    if m1.tournament_id != tournament_id or m2.tournament_id != tournament_id:
        raise HTTPException(status_code=400, detail="Matches horen niet bij dit toernooi")

    # Veiligheidscheck: Niet wisselen als er al gescoord is
    if (m1.is_completed or m1.score_p1 > 0 or m1.score_p2 > 0 or 
        m2.is_completed or m2.score_p1 > 0 or m2.score_p2 > 0):
        raise HTTPException(status_code=400, detail="Kan geen wedstrijden wisselen die al gestart zijn.")

    # --- DE SWAP ---
    # We wisselen de 'inhoud' van de match records, zodat de ID's (en dus de volgorde in de lijst) gelijk blijven.
    
    # 1. Tijdelijke opslag van M1 data
    temp_p1 = m1.player1_id
    temp_p2 = m1.player2_id
    temp_t1 = m1.team1_id
    temp_t2 = m1.team2_id
    # Eventueel ook round_number wisselen als je op rondes sorteert, 
    # maar voor poule-volgorde is ID-behoud vaak genoeg.

    # 2. M1 krijgt data van M2
    m1.player1_id = m2.player1_id
    m1.player2_id = m2.player2_id
    m1.team1_id = m2.team1_id
    m1.team2_id = m2.team2_id

    # 3. M2 krijgt data van M1 (uit temp)
    m2.player1_id = temp_p1
    m2.player2_id = temp_p2
    m2.team1_id = temp_t1
    m2.team2_id = temp_t2

    session.add(m1)
    session.add(m2)
    session.commit()

    return {"status": "success", "message": "Matches gewisseld"}