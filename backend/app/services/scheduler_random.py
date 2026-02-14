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
    Genereert een schema voor een 'Super League' (Random Poule).
    Iedereen zit in Poule 1 en speelt X willekeurige wedstrijden.
    """
    if len(players) < 2:
        return

    # We proberen 10 keer een geldig schema te maken. 
    # Random generatie kan soms vastlopen, dus retry-mechanisme is belangrijk.
    best_matches: List[Match] = []
    
    for attempt in range(10):
        current_matches: List[Match] = []
        
        # Houd bij hoeveel wedstrijden iedereen al heeft: {player_id: count}
        usage = {p.id: 0 for p in players}
        
        # Maak alle mogelijke unieke matchups
        possible_pairs: List[Tuple[Player, Player]] = []
        for i in range(len(players)):
            for j in range(i + 1, len(players)):
                possible_pairs.append((players[i], players[j]))
        
        # Schud de mogelijke matchups door elkaar
        random.shuffle(possible_pairs)
        
        # Vul de wedstrijden
        for p1, p2 in possible_pairs:
            # Als beide spelers nog ruimte hebben in hun schema
            if usage[p1.id] < matches_per_player and usage[p2.id] < matches_per_player:
                
                # Match aanmaken
                match = Match(
                    tournament_id=tournament_id,
                    round_number=1, # Wordt later overschreven
                    poule_number=1, # Iedereen in 1 grote poule
                    player1_id=p1.id,
                    player2_id=p2.id,
                    best_of_legs=legs_best_of,
                    best_of_sets=sets_best_of,
                    is_completed=False,
                    score_p1=0,
                    score_p2=0
                )
                current_matches.append(match)
                usage[p1.id] += 1
                usage[p2.id] += 1
        
        # Check kwaliteit van deze poging
        # Het is perfect als iedereen precies het gevraagde aantal matches heeft
        is_perfect = all(count == matches_per_player for count in usage.values())
        
        if is_perfect:
            best_matches = current_matches
            break
        
        # Als het niet perfect is, kijken we of deze poging beter is dan de vorige
        if len(current_matches) > len(best_matches):
            best_matches = current_matches

    # --- Nabewerking: Rondes toewijzen ---
    # Om te voorkomen dat speler A drie keer achter elkaar moet, verdelen we het virtueel.
    # We schatten dat er (N / 2) wedstrijden per "tijdsblok" kunnen plaatsvinden.
    matches_per_round_block = max(1, len(players) // 2)
    
    for i, match in enumerate(best_matches):
        match.round_number = (i // matches_per_round_block) + 1

    # Opslaan in database
    session.add_all(best_matches)
    session.commit()