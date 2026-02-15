import random
from typing import List, Tuple
from sqlmodel import Session
from app.models.match import Match
from app.models.player import Player

def generate_random_schedule(
    tournament_id: int,
    players: List[Player],
    matches_per_player: int,
    legs_best_of: int,
    sets_best_of: int,
    session: Session
) -> None:
    """
    Genereert een schema via het 'Pot Systeem'.
    Elke speler gaat N keer in de pot. We trekken er random 2 uit.
    """
    if len(players) < 2:
        return

    # Stap 1: Bereken het TOTAAL aantal slots
    # Als 5 spelers 1x willen spelen, heb je 5 slots. Dat is oneven -> gaat niet.
    # We moeten zorgen dat het totaal aantal slots even is.
    total_slots = len(players) * matches_per_player
    
    # Correctie voor oneven totalen (we halen 1 slot weg bij de laatste speler in de lijst)
    # Dit is wiskundig onvermijdelijk: je kunt geen 5 wedstrijden verdelen over 2-tallen.
    limit_correction = 0
    if total_slots % 2 != 0:
        limit_correction = 1 
        # Dit betekent dat 1 speler helaas 1 wedstrijd minder speelt dan gevraagd.

    best_schedule = []
    
    # We proberen het genereren een paar keer opnieuw als we vastlopen 
    # (bijv. als de laatste 2 tickets van dezelfde persoon zijn)
    for attempt in range(20):
        schedule = []
        
        # MAAK DE POT
        # Voorbeeld: [ID1, ID1, ID2, ID2, ID3, ID3]
        pot = []
        for i, p in enumerate(players):
            # De laatste speler vangt de klap op als het totaal oneven is
            count = matches_per_player
            if limit_correction > 0 and i == len(players) - 1:
                count -= 1
            
            pot.extend([p.id] * count)
            
        random.shuffle(pot)
        
        # Trek paren uit de pot
        valid_attempt = True
        temp_pairs = []
        
        while len(pot) >= 2:
            p1_id = pot.pop(0)
            
            # Zoek een geschikte tegenstander in de pot
            # We zoeken de EERSTE in de lijst die NIET zichzelf is
            found_opponent_idx = -1
            for idx, candidate_id in enumerate(pot):
                if candidate_id != p1_id:
                    # OPTIONEEL: Je kunt hier checken of ze al tegen elkaar speelden in 'temp_pairs'
                    # als je dubbele matchups wilt minimaliseren. Voor nu laten we dat toe
                    # om te garanderen dat de pot leeg komt.
                    found_opponent_idx = idx
                    break
            
            if found_opponent_idx != -1:
                p2_id = pot.pop(found_opponent_idx)
                temp_pairs.append((p1_id, p2_id))
            else:
                # Oeps, alleen nog maar kaartjes van p1_id over in de pot?
                # Dan is deze poging mislukt (deadlock). Opnieuw!
                valid_attempt = False
                break
        
        if valid_attempt:
            best_schedule = temp_pairs
            break # Gelukt!
            
    # --- Opslaan in Database ---
    
    # Bepaal hoeveel wedstrijden er ongeveer in 1 'tijdsblok' passen
    # Zodat niet alle wedstrijden van Speler A 'ronde 1' heten.
    matches_per_round_block = max(1, len(players) // 2)

    db_matches = []
    for i, (p1_id, p2_id) in enumerate(best_schedule):
        # Ronde nummer berekenen voor spreiding
        round_num = (i // matches_per_round_block) + 1
        
        match = Match(
            tournament_id=tournament_id,
            round_number=round_num,
            poule_number=1, # Super League = Poule 1
            player1_id=p1_id,
            player2_id=p2_id,
            best_of_legs=legs_best_of,
            best_of_sets=sets_best_of,
            is_completed=False,
            score_p1=0,
            score_p2=0
        )
        db_matches.append(match)

    session.add_all(db_matches)
    session.commit()
    
    # Debug info
    print(f"DEBUG: {len(db_matches)} matches gegenereerd. (Doel was ong. {total_slots/2})")