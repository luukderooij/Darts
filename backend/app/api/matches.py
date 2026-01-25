import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload # <--- BELANGRIJK: Nodig om teams op te halen

from app.db.session import get_session
from app.models.match import Match
from app.models.player import Player
from app.models.team import Team # <--- BELANGRIJK: Team import toegevoegd
from app.models.tournament import Tournament
from app.models.user import User
from app.schemas.match import MatchRead, MatchScoreUpdate
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
    score_in: MatchScoreUpdate,
    current_user: Optional[User] = Depends(get_current_user), 
    x_scorer_token: Optional[str] = Header(None, alias="X-Scorer-Token"),
    session: Session = Depends(get_session)
):
    match = get_match_or_404(match_id, session)
    tournament = session.get(Tournament, match.tournament_id)
    
    # Auth checks
    is_authorized = False
    if current_user and tournament.user_id == current_user.id:
        is_authorized = True
    if not is_authorized and x_scorer_token:
        if x_scorer_token == tournament.scorer_uuid:
            is_authorized = True
            
    if not is_authorized:
         raise HTTPException(status_code=403, detail="Not authorized.")

    # Update
    match.score_p1 = score_in.score_p1
    match.score_p2 = score_in.score_p2
    match.is_completed = score_in.is_completed
    
    session.add(match)
    session.commit()
    session.refresh(match)
    
    # Check knockout advance
    if match.is_completed and match.poule_number is None:
        check_and_advance_knockout(match.tournament_id, match.round_number, session)
    
    # Logging
    logger.info(f"MATCH {match.id}: {match.score_p1} - {match.score_p2}")
    
    # --- DATA VERRIJKING VOOR RESPONSE ---
    # We herladen de match met relaties zodat we namen kunnen teruggeven
    session.refresh(match, ["player1", "player2", "team1", "team2"])
    
    match_dict = match.model_dump()
    
    # Resolutie Naam 1
    if match.player1:
        match_dict['player1_name'] = match.player1.name 
    elif match.team1:
        match_dict['player1_name'] = match.team1.name
    else:
        match_dict['player1_name'] = "Bye"

    # Resolutie Naam 2
    if match.player2:
        match_dict['player2_name'] = match.player2.name 
    elif match.team2:
        match_dict['player2_name'] = match.team2.name
    else:
        match_dict['player2_name'] = "Bye"

    return match_dict

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
        
    # 2. Get Matches (MET RELATIES VOOR TEAMS EN SPELERS)
    statement_matches = (
        select(Match)
        .where(Match.tournament_id == tournament.id)
        .options(
            selectinload(Match.player1),
            selectinload(Match.player2),
            selectinload(Match.team1), # <--- Zorg dat Teams worden opgehaald
            selectinload(Match.team2)
        )
        .order_by(Match.id)
    )
    matches = session.exec(statement_matches).all()
    
    # 3. Construct Response met de juiste namen
    results = []
    for m in matches:
        m_data = m.model_dump()
        
        # --- LOGICA: KIES NAAM (SPELER > TEAM > BYE) ---
        
        # Naam 1
        if m.player1:
            m_data['player1_name'] = m.player1.name
        elif m.team1:
            m_data['player1_name'] = m.team1.name # Hier pakken we de Team naam!
        else:
             m_data['player1_name'] = "Bye"

        # Naam 2
        if m.player2:
             m_data['player2_name'] = m.player2.name
        elif m.team2:
             m_data['player2_name'] = m.team2.name # Hier pakken we de Team naam!
        else:
             m_data['player2_name'] = "Bye"
             
        results.append(m_data)
        
    return results