import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload 

from app.db.session import get_session
from app.models.match import Match
from app.models.player import Player
from app.models.team import Team 
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
    match_in: MatchScoreUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    match = session.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # --- VALIDATION LOGIC ---
    if match.best_of_legs:
        limit = match.best_of_legs
        # In 'Best of 3', you win if you reach 2. (3 // 2 + 1 = 2)
        winning_threshold = (limit // 2) + 1
        
        # 1. Validate Total Legs
        # Example: Best of 3. Max score is 2-1 (Total 3). 2-2 (Total 4) is impossible.
        if match_in.score_p1 + match_in.score_p2 > limit:
            raise HTTPException(
                status_code=400, 
                detail=f"Impossible score: Total legs ({match_in.score_p1 + match_in.score_p2}) cannot exceed Best of {limit}."
            )

        # 2. Validate Individual Score
        # Example: Best of 3. You cannot win 3-0. Max is 2.
        if match_in.score_p1 > winning_threshold or match_in.score_p2 > winning_threshold:
             raise HTTPException(
                status_code=400, 
                detail=f"Impossible score: A player cannot win more than {winning_threshold} legs in a Best of {limit} match."
            )

        # 3. Auto-Complete Logic
        # If someone reached the threshold, the match is over.
        if match_in.score_p1 == winning_threshold or match_in.score_p2 == winning_threshold:
            match.is_completed = True
        else:
            # If no one reached the threshold, it CANNOT be finished yet.
            match.is_completed = False

    # Apply updates
    match.score_p1 = match_in.score_p1
    match.score_p2 = match_in.score_p2
    # We use our calculated is_completed, ignoring the one sent by frontend if we did logic above
    # But if best_of_legs is not set (e.g. infinite practice), we trust the input
    if not match.best_of_legs:
        match.is_completed = match_in.is_completed

    session.add(match)
    session.commit()
    session.refresh(match)
    
    # ... (Rest of the function: Check for Next Round generation) ...
    # Make sure you keep the existing logic that checks for poule completion / knockout advancement here!
    
    # Logic to trigger next round if knockout match is finished...
    if match.is_completed and match.poule_number is None:
         # ... existing knockout logic ...
         pass

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
        
    # 2. Get Matches (MET RELATIES VOOR TEAMS EN SPELERS)
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

        # Referee Naam
        if m.referee:
            m_data['referee_name'] = m.referee.name
        elif m.referee_team:
            m_data['referee_name'] = m.referee_team.name
        else:
            m_data['referee_name'] = "-" # Or "TBD"
             
        results.append(m_data)
        
    return results