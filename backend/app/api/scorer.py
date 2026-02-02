import random
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, desc
from pydantic import BaseModel

from app.db.session import get_session
from app.models.scorer_auth import ScorerAccessCode
from app.models.match import Match
from app.models.tournament import Tournament
from app.models.dartboard import Dartboard
from app.api.users import get_current_user # Voor admin acties

router = APIRouter()

# --- SCHEMAS ---
class CodeLogin(BaseModel):
    code: str
    
class CodeOverview(BaseModel):
    board_number: int
    code: str

class ScorerMatchInfo(BaseModel):
    id: int
    player1_name: str
    player2_name: str
    score_p1: int
    score_p2: int
    referee_name: Optional[str] = "-"
    round_str: str  # Bijv "Poule 1" of "KO - R2"

class ScorerStatus(BaseModel):
    tournament_id: int
    board_number: int
    match_id: Optional[int] = None
    state: str 
    # Nieuwe velden
    last_matches: List[ScorerMatchInfo] = []
    next_matches: List[ScorerMatchInfo] = []

# --- ADMIN ENDPOINTS ---

@router.post("/generate-codes/{tournament_id}", response_model=List[CodeOverview])
def generate_codes_for_tournament(
    tournament_id: int,
    session: Session = Depends(get_session),
    current_user = Depends(get_current_user)
):
    """
    Genereert (of herstelt) koppelcodes voor alle borden in een toernooi.
    """
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Toernooi niet gevonden")

    # 1. Haal de fysieke borden op die aan dit toernooi gelinkt zijn [cite: 155]
    # We gebruiken hier 'boards' relatie uit Tournament
    if not tournament.boards:
        return []

    results = []
    
    # Verwijder oude codes voor dit toernooi om conflicten te voorkomen? 
    # Of behoud ze als ze al bestaan. Laten we voor nu 'refresh' doen als ze niet bestaan.
    
    for board in tournament.boards:
        # Check of er al een code is voor dit bord in dit toernooi
        existing = session.exec(
            select(ScorerAccessCode)
            .where(ScorerAccessCode.tournament_id == tournament_id)
            .where(ScorerAccessCode.board_number == board.number)
        ).first()

        if existing:
            results.append(CodeOverview(board_number=board.number, code=existing.code))
        else:
            # Genereer unieke code
            while True:
                new_code = ''.join(random.choices(string.digits, k=4))
                # Check uniekheid globaal (zodat codes niet botsen tussen actieve toernooien)
                if not session.get(ScorerAccessCode, new_code):
                    break
            
            access_obj = ScorerAccessCode(
                code=new_code,
                tournament_id=tournament_id,
                board_number=board.number
            )
            session.add(access_obj)
            results.append(CodeOverview(board_number=board.number, code=new_code))
    
    session.commit()
    # Sorteer op bordnummer voor de UI
    results.sort(key=lambda x: x.board_number)
    return results

# --- TABLET (PUBLIC) ENDPOINTS ---

@router.post("/auth", response_model=ScorerStatus)
def login_with_code(
    login_data: CodeLogin,
    session: Session = Depends(get_session)
):
    """
    Tablet stuurt '4829'. Server zegt: Jij bent Bord 1 in Toernooi X.
    """
    access = session.get(ScorerAccessCode, login_data.code)
    if not access:
        raise HTTPException(status_code=401, detail="Ongeldige code")

    # Geef direct de status terug
    return get_board_status_logic(access.tournament_id, access.board_number, session)

@router.get("/status/{tournament_id}/{board_number}", response_model=ScorerStatus)
def get_board_status(
    tournament_id: int,
    board_number: int,
    session: Session = Depends(get_session)
):
    """
    Wordt elke 5 seconden aangeroepen door de tablet (Polling).
    """
    return get_board_status_logic(tournament_id, board_number, session)

def get_board_status_logic(t_id: int, b_num: int, session: Session) -> ScorerStatus:
    # Zoek de EERSTVOLGENDE actieve wedstrijd op dit bord
    # We sorteren op ID (of ronde) om de oudste openstaande match te pakken
    statement = (
        select(Match)
        .where(Match.tournament_id == t_id)
        .where(Match.board_number == b_num)
        .where(Match.is_completed == False) # [cite: 147]
        .order_by(Match.id)
    )
    match = session.exec(statement).first()

    if match:
        return ScorerStatus(
            tournament_id=t_id,
            board_number=b_num,
            match_id=match.id,
            state="active_match"
        )
    else:
        return ScorerStatus(
            tournament_id=t_id,
            board_number=b_num,
            match_id=None,
            state="waiting"
        )
    
def format_match_info(m: Match) -> ScorerMatchInfo:
    # Resolv namen (eenvoudige versie, idealiter via relaties)
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
    # 1. Huidige actieve match (zoals voorheen)
    active_match = session.exec(
        select(Match)
        .where(Match.tournament_id == t_id)
        .where(Match.board_number == b_num)
        .where(Match.is_completed == False)
        .order_by(Match.id)
    ).first()

    state = "active_match" if active_match else "waiting"
    current_id = active_match.id if active_match else None

    # 2. Laatste 4 Gespeelde Matches (History)
    # We laden relaties in voor namen (selectinload zou netter zijn in imports, maar dit werkt ook als lazy loaded)
    history_matches = session.exec(
        select(Match)
        .where(Match.tournament_id == t_id)
        .where(Match.board_number == b_num)
        .where(Match.is_completed == True)
        .order_by(desc(Match.id)) # Nieuwste eerst
        .limit(4)
    ).all()

    # 3. Aankomende 2 Matches (Queue)
    # Let op: we sluiten de HUIDIGE actieve match uit als die er is
    query_next = select(Match).where(Match.tournament_id == t_id).where(Match.board_number == b_num).where(Match.is_completed == False)
    
    if current_id:
        query_next = query_next.where(Match.id != current_id)
    
    next_matches_db = session.exec(
        query_next.order_by(Match.id).limit(2)
    ).all()

    return ScorerStatus(
        tournament_id=t_id,
        board_number=b_num,
        match_id=current_id,
        state=state,
        last_matches=[format_match_info(m) for m in history_matches],
        next_matches=[format_match_info(m) for m in next_matches_db]
    )