import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.match import Match
from app.models.player import Player
from app.models.tournament import Tournament
from app.models.user import User
from app.schemas.match import MatchRead, MatchScoreUpdate
from app.api.users import get_current_user

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
    
    # Auth Logic
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
    
    # Logging
    logger.info(f"MATCH {match.id}: {match.score_p1} - {match.score_p2}")
    
    # Return with names (simple fetch for single update)
    p1 = session.get(Player, match.player1_id) if match.player1_id else None
    p2 = session.get(Player, match.player2_id) if match.player2_id else None
    
    # Convert to dictionary and add names manually
    match_dict = match.model_dump()
    match_dict['player1_name'] = p1.name if p1 else "Bye"
    match_dict['player2_name'] = p2.name if p2 else "Bye"

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
        # Check scorer UUID too
        statement_scorer = select(Tournament).where(Tournament.scorer_uuid == public_uuid)
        tournament = session.exec(statement_scorer).first()
        
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
        
    # 2. Get Matches
    statement_matches = select(Match).where(Match.tournament_id == tournament.id).order_by(Match.id)
    matches = session.exec(statement_matches).all()
    
    # 3. Bulk Fetch Player Names
    player_ids = set()
    for m in matches:
        if m.player1_id: player_ids.add(m.player1_id)
        if m.player2_id: player_ids.add(m.player2_id)
        
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    player_map = {p.id: p.name for p in players}
    
    # 4. Attach names to response
    results = []
    for m in matches:
        # Convert the SQLModel to a dict so we can add extra fields
        m_data = m.model_dump()
        m_data['player1_name'] = player_map.get(m.player1_id, "Bye")
        m_data['player2_name'] = player_map.get(m.player2_id, "Bye")
        results.append(m_data)
        
    return results