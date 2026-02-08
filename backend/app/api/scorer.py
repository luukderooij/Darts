# FILE: backend/app/api/scorer.py
import random
import string
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, desc, delete
from pydantic import BaseModel

from app.db.session import get_session
from app.models.scorer_auth import ScorerAccessCode
from app.models.match import Match
from app.models.tournament import Tournament
from app.models.dartboard import Dartboard

router = APIRouter()

# --- SCHEMAS ---
class CodeLogin(BaseModel):
    code: str
    
class CodeOverview(BaseModel):
    board_number: int
    code: str
    is_expired: bool

class ScorerMatchInfo(BaseModel):
    id: int
    player1_name: str
    player2_name: str
    score_p1: int
    score_p2: int
    referee_name: Optional[str] = "-"
    round_str: str 

class ScorerStatus(BaseModel):
    tournament_id: int
    board_number: int
    match_id: Optional[int] = None
    state: str 
    last_matches: List[ScorerMatchInfo] = []
    next_matches: List[ScorerMatchInfo] = []

# --- HELPERS ---
def get_required_boards(tournament_id: int, session: Session) -> List[int]:
    """Berekent welke bordnummers nodig zijn."""
    used_board_numbers = session.exec(
        select(Match.board_number)
        .where(Match.tournament_id == tournament_id)
        .where(Match.board_number != None)
        .distinct()
    ).all()
    target = sorted(list(set([n for n in used_board_numbers if n is not None])))
    if not target:
        # Fallback: Bord 1 t/m 16 als er nog geen matches gepland zijn
        target = list(range(1, 17))
    return target

def create_unique_code(tournament_id: int, board_num: int, session: Session) -> ScorerAccessCode:
    """Maakt een unieke code aan."""
    attempts = 0
    while attempts < 100:
        new_code = ''.join(random.choices(string.digits, k=4))
        check_exists = session.exec(select(ScorerAccessCode).where(ScorerAccessCode.code == new_code)).first()
        if not check_exists:
            return ScorerAccessCode(
                code=new_code,
                tournament_id=tournament_id,
                board_number=board_num,
                created_at=datetime.utcnow()
            )
        attempts += 1
    raise HTTPException(status_code=500, detail="Kon geen unieke code genereren")

# --- ADMIN ENDPOINTS ---

@router.post("/generate-codes/{tournament_id}", response_model=List[CodeOverview])
def view_or_ensure_codes(
    tournament_id: int,
    session: Session = Depends(get_session)
):
    """
    Kijkt of codes bestaan. Vult AAN indien nodig.
    """
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")

    target_board_numbers = get_required_boards(tournament_id, session)
    results = []
    expiration_limit = datetime.utcnow() - timedelta(days=7)

    codes_created = 0

    for b_num in target_board_numbers:
        existing = session.exec(
            select(ScorerAccessCode)
            .where(ScorerAccessCode.tournament_id == tournament_id)
            .where(ScorerAccessCode.board_number == b_num)
        ).first()

        if existing:
            is_expired = existing.created_at < expiration_limit
            results.append(CodeOverview(board_number=b_num, code=existing.code, is_expired=is_expired))
        else:
            new_access = create_unique_code(tournament_id, b_num, session)
            session.add(new_access)
            results.append(CodeOverview(board_number=b_num, code=new_access.code, is_expired=False))
            codes_created += 1
            
    session.commit()
    print(f"DEBUG ADMIN: {codes_created} nieuwe codes aangemaakt voor Toernooi {tournament_id}.")
    
    results.sort(key=lambda x: x.board_number)
    return results

@router.post("/refresh-codes/{tournament_id}", response_model=List[CodeOverview])
def force_refresh_codes(
    tournament_id: int,
    session: Session = Depends(get_session)
):
    """KNOP ACTIE: Forceer nieuwe codes."""
    print(f"DEBUG ADMIN: Oude codes verwijderen voor Toernooi {tournament_id}...")
    statement = delete(ScorerAccessCode).where(ScorerAccessCode.tournament_id == tournament_id)
    session.exec(statement)
    session.commit()
    
    # Roep de generate functie aan om nieuwe te maken
    return view_or_ensure_codes(tournament_id, session)

# --- TABLET ENDPOINTS ---

@router.post("/auth", response_model=ScorerStatus)
def login_with_code(
    login_data: CodeLogin,
    session: Session = Depends(get_session)
):
    clean_code = login_data.code.strip()
    
    # Zoek de code
    access = session.exec(
        select(ScorerAccessCode).where(ScorerAccessCode.code == clean_code)
    ).first()

    if not access:
        # Geen panic dump meer, gewoon een error
        raise HTTPException(status_code=403, detail="Ongeldige code")

    # CHECK: Is de code verlopen (ouder dan 7 dagen)?
    expiration_limit = datetime.utcnow() - timedelta(days=7)
    if access.created_at < expiration_limit:
        raise HTTPException(status_code=403, detail="Code is verlopen. Vraag nieuwe codes.")

    return get_board_status_logic(access.tournament_id, access.board_number, session)

@router.get("/status/{tournament_id}/{board_number}", response_model=ScorerStatus)
def get_board_status(
    tournament_id: int,
    board_number: int,
    session: Session = Depends(get_session)
):
    return get_board_status_logic(tournament_id, board_number, session)

# --- HELPER LOGIC ---

def format_match_info(m: Match) -> ScorerMatchInfo:
    p1 = m.player1.name if m.player1 else (m.team1.name if m.team1 else "Bye")
    p2 = m.player2.name if m.player2 else (m.team2.name if m.team2 else "Bye")
    ref = "-"
    if m.referee: ref = m.referee.name
    elif m.referee_team: ref = m.referee_team.name
    elif m.custom_referee_name: ref = m.custom_referee_name
    r_str = f"Poule {m.poule_number}" if m.poule_number else f"KO R{m.round_number}"

    return ScorerMatchInfo(
        id=m.id,
        player1_name=p1,
        player2_name=p2,
        score_p1=m.score_p1,
        score_p2=m.score_p2,
        referee_name=ref,
        round_str=r_str
    )

def get_board_status_logic(t_id: int, b_num: int, session: Session) -> ScorerStatus:
    active_match = session.exec(
        select(Match)
        .where(Match.tournament_id == t_id)
        .where(Match.board_number == b_num)
        .where(Match.is_completed == False)
        .order_by(Match.id)
    ).first()

    state = "active_match" if active_match else "waiting"
    current_id = active_match.id if active_match else None

    history_matches = session.exec(
        select(Match)
        .where(Match.tournament_id == t_id)
        .where(Match.board_number == b_num)
        .where(Match.is_completed == True)
        .order_by(desc(Match.id))
        .limit(4)
    ).all()

    query_next = select(Match).where(Match.tournament_id == t_id).where(Match.board_number == b_num).where(Match.is_completed == False)
    if current_id:
        query_next = query_next.where(Match.id != current_id)
    next_matches_db = session.exec(query_next.order_by(Match.id).limit(2)).all()

    return ScorerStatus(
        tournament_id=t_id,
        board_number=b_num,
        match_id=current_id,
        state=state,
        last_matches=[format_match_info(m) for m in history_matches],
        next_matches=[format_match_info(m) for m in next_matches_db]
    )