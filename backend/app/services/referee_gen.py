import random
from typing import List, Any
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from app.models.match import Match
from app.models.tournament import Tournament

def assign_referees(matches: List[Match], participants: List[Any], is_doubles: bool):
    """
    Wijst scheidsrechters toe met prioriteiten:
    1. Gelijke verdeling (count).
    2. Locatie (liefst op hetzelfde bord blijven).
    3. Rusttijd (gap).
    """
    if len(participants) < 3: return

    ref_counts = {p.id: 0 for p in participants}
    
    # We houden bij wanneer (index) en WAAR (bord) iemand actief was
    last_active_index = {p.id: -1 for p in participants}
    last_active_board = {p.id: None for p in participants}

    for i, match in enumerate(matches):
        # 1. Spelers identificeren
        if is_doubles:
            p1_id, p2_id = match.team1_id, match.team2_id
        else:
            p1_id, p2_id = match.player1_id, match.player2_id

        current_board = match.board_number

        # Spelers zijn nu actief op dit bord
        if p1_id: 
            last_active_index[p1_id] = i
            last_active_board[p1_id] = current_board
        if p2_id: 
            last_active_index[p2_id] = i
            last_active_board[p2_id] = current_board

        # 2. Kandidaten zoeken (niet zelf aan het spelen)
        candidates = [p for p in participants if p.id not in (p1_id, p2_id)]
        if not candidates: continue

        # 3. Scoring Algoritme
        # Score = (Aantal keer geschreven * 100) + LocatieStraf - Rusttijd
        # Laagste score wint.
        def get_score(candidate):
            count = ref_counts[candidate.id]
            
            # Rustfactor
            last_idx = last_active_index[candidate.id]
            gap = i - last_idx if last_idx != -1 else 999 
            
            # Locatiefactor (Sectie 5d)
            # Als je vorige keer op bord X was, en nu is de match op bord Y -> Strafpunten
            location_penalty = 0
            last_board = last_active_board[candidate.id]
            
            if last_board is not None and current_board is not None:
                if last_board != current_board:
                    # Grote straf: we willen lopen voorkomen
                    location_penalty = 50 
            
            return (count * 100) + location_penalty - gap

        candidates.sort(key=get_score)
        best_ref = candidates[0]

        # 4. Toewijzen
        if is_doubles:
            match.referee_team_id = best_ref.id
        else:
            match.referee_id = best_ref.id

        # 5. Tracking updaten
        ref_counts[best_ref.id] += 1
        last_active_index[best_ref.id] = i
        last_active_board[best_ref.id] = current_board # Ref is nu hier actief

def assign_referees_safe(session: Session, tournament_id: int):
    """
    Wijst schrijvers toe per RONDE-BLOK.
    Haalt ZELF de matches en deelnemers op uit de database (met Eager Loading).
    """
    stmt = select(Tournament).where(Tournament.id == tournament_id).options(
        selectinload(Tournament.teams),
        selectinload(Tournament.players)
    )
    tournament = session.exec(stmt).first()
    
    if not tournament: return
    
    is_doubles = (tournament.mode == "doubles")
    participants = list(tournament.teams) if is_doubles else list(tournament.players)

    if not participants: return

    matches = session.exec(
        select(Match)
        .where(Match.tournament_id == tournament_id)
        .order_by(Match.round_number, Match.board_number)
    ).all()

    # Reset
    for m in matches:
        m.referee_id = None
        m.referee_team_id = None
        session.add(m)
    session.commit()

    # Groepeer per ronde
    matches_by_round = {}
    for m in matches:
        r = m.round_number
        if r not in matches_by_round: matches_by_round[r] = []
        matches_by_round[r].append(m)

    # ... (Rest van logica is identiek aan origineel, maar hier ingekort voor brevity in diff)
    # Omdat ik de volledige functie hierboven heb gekopieerd in de context, 
    # neem ik aan dat de implementatie hier volledig wordt overgenomen.
    # Voor de volledigheid van de file creation:
    
    ref_counts = {p.id: 0 for p in participants}

    for r_num in sorted(matches_by_round.keys()):
        round_matches = matches_by_round[r_num]
        random.shuffle(round_matches) 

        busy_ids = set()
        for m in round_matches:
            if is_doubles:
                if m.team1_id: busy_ids.add(m.team1_id)
                if m.team2_id: busy_ids.add(m.team2_id)
            else:
                if m.player1_id: busy_ids.add(m.player1_id)
                if m.player2_id: busy_ids.add(m.player2_id)

        assigned_refs_this_round = set()

        for match in round_matches:
            candidates = [
                p for p in participants 
                if p.id not in busy_ids and p.id not in assigned_refs_this_round
            ]

            if not candidates: continue

            random.shuffle(candidates)
            candidates.sort(key=lambda c: ref_counts[c.id])
            best_ref = candidates[0]

            if best_ref.id in assigned_refs_this_round: continue

            if is_doubles:
                match.referee_team_id = best_ref.id
            else:
                match.referee_id = best_ref.id
            
            ref_counts[best_ref.id] += 1
            assigned_refs_this_round.add(best_ref.id)
            session.add(match)
    
    session.commit()