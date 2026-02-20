from typing import List
from sqlmodel import Session
from app.models.match import Match
from app.models.tournament import Tournament, TournamentRound

def assign_matches_to_logical_rounds(session: Session, tournament_id: int, matches: List[Match]):
    """
    Verdeelt matches over rondes met 'Fair Play' logica:
    1. Voorkomt dat spelers 2x in dezelfde ronde spelen (Conflict Check).
    2. Probeert spelers/teams zoveel mogelijk rust tussen partijen te geven (Spread Check).
    """
    tournament = session.get(Tournament, tournament_id)
    if not tournament: return

    session.refresh(tournament)
    boards = sorted(tournament.boards, key=lambda b: b.number)
    num_boards = len(boards)
    if num_boards == 0: num_boards = 1

    is_doubles = (tournament.mode == "doubles")
    
    # We maken een kopie van de lijst om uit te "graaien"
    # We sorteren initieel op de round_number van de generator, zodat de basisstructuur klopt
    remaining_matches = sorted(matches, key=lambda m: (m.round_number or 0, m.id or 0))
    
    # Houd bij wanneer iemand voor het laatst gespeeld heeft (Ronde index)
    # Startwaarde -1 betekent "nog niet gespeeld" (dus hoge prioriteit)
    last_played_round = {} 

    logical_rounds_data = []
    current_round_index = 1

    print(f"DEBUG: Slim spreiden van {len(matches)} matches over {num_boards} borden...")

    while remaining_matches:
        # Maak een nieuwe ronde aan in het geheugen
        round_matches = []
        busy_ids_in_round = set()
        
        # We proberen de borden te vullen (maximaal aantal borden)
        # We blijven zoeken in de lijst tot de borden vol zijn OF we geen enkele match meer kunnen plaatsen
        matches_to_remove = []

        # Sorteer de overgebleven matches op prioriteit voor DEZE ronde.
        # Prioriteit formule: Hoe langer geleden gespeeld, hoe liever we ze nu willen.
        def calculate_priority(match):
            if is_doubles:
                ids = [match.team1_id, match.team2_id]
            else:
                ids = [match.player1_id, match.player2_id]
            
            # Som van rondes geleden dat ze gespeeld hebben
            # Hoe lager 'last_played', hoe langer geleden.
            # We willen mensen met lage 'last_played' eerst.
            score = 0
            for pid in ids:
                lp = last_played_round.get(pid, -10) # -10 zorgt dat 'nog nooit gespeeld' voorrang krijgt
                score += (current_round_index - lp) 
            return -score # Reverse sort: we willen de match met de grootste 'gap' bovenaan

        # Sorteer de kandidaten lijst dynamisch voor deze ronde
        remaining_matches.sort(key=calculate_priority)

        # Loop door de gesorteerde lijst en vul de gaten
        for match in remaining_matches:
            if len(round_matches) >= num_boards:
                break # Ronde is vol

            # Check wie erin zitten
            if is_doubles:
                p1_id, p2_id = match.team1_id, match.team2_id
            else:
                p1_id, p2_id = match.player1_id, match.player2_id

            # Conflict Check: Speelt één van deze mensen al in deze ronde?
            if p1_id in busy_ids_in_round or p2_id in busy_ids_in_round:
                continue # Kan niet, sla over en zoek verder in de lijst

            # Geen conflict? Plaatsen!
            round_matches.append(match)
            busy_ids_in_round.add(p1_id)
            busy_ids_in_round.add(p2_id)
            matches_to_remove.append(match)

        # Verwijder de geplaatste matches uit de hooflijst
        for m in matches_to_remove:
            remaining_matches.remove(m)
            
            # Update 'Laatst gespeeld' status
            if is_doubles:
                last_played_round[m.team1_id] = current_round_index
                last_played_round[m.team2_id] = current_round_index
            else:
                last_played_round[m.player1_id] = current_round_index
                last_played_round[m.player2_id] = current_round_index

        logical_rounds_data.append(round_matches)
        current_round_index += 1

    # --- OPSLAAN IN DB ---
    for i, r_matches in enumerate(logical_rounds_data):
        round_idx = i + 1
        
        db_round = TournamentRound(
            tournament_id=tournament_id,
            round_index=round_idx,
            name=f"Ronde {round_idx}",
            is_active=(round_idx == 1)
        )
        session.add(db_round)
        session.flush()

        for b_idx, match in enumerate(r_matches):
            match.round_id = db_round.id
            match.round_number = round_idx
            
            if b_idx < len(boards):
                match.board_number = boards[b_idx].number
                match.board_id = boards[b_idx].id
            
            session.add(match)

    session.commit()