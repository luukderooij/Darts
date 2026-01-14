from typing import List, Dict
from sqlmodel import Session
from app.models.match import Match
from app.models.player import Player

def generate_round_robin(
    tournament_id: int, 
    players: List[Player], 
    session: Session
):
    """
    Generates a Round Robin schedule (everyone plays everyone once).
    Uses the "Circle Method" algorithm.
    """
    if len(players) < 2:
        return

    # If odd number of players, add a dummy "Bye" player (None)
    rotation = list(players)
    if len(rotation) % 2 != 0:
        rotation.append(None)
    
    num_players = len(rotation)
    num_rounds = num_players - 1
    half = num_players // 2

    matches_to_add = []

    for round_idx in range(num_rounds):
        round_num = round_idx + 1
        
        for i in range(half):
            p1 = rotation[i]
            p2 = rotation[num_players - 1 - i]
            
            # If neither is None (Bye), schedule the match
            if p1 and p2:
                match = Match(
                    tournament_id=tournament_id,
                    round_number=round_num,
                    player1_id=p1.id,
                    player2_id=p2.id,
                    score_p1=0,
                    score_p2=0,
                    is_completed=False
                )
                matches_to_add.append(match)

        # Rotate players: Keep index 0 fixed, rotate the rest
        # [0, 1, 2, 3] -> [0, 3, 1, 2]
        rotation.insert(1, rotation.pop())

    session.add_all(matches_to_add)
    session.commit()

def generate_knockout(
    tournament_id: int, 
    players: List[Player], 
    session: Session
):
    """
    Generates a Single Elimination Knockout bracket.
    Only generates the FIRST round. Subsequent rounds are generated as winners advance.
    """
    import random
    
    # Shuffle players for random seeding
    random.shuffle(players)
    
    # Calculate bracket size (next power of 2)
    # e.g., 5 players -> need bracket of 8
    n = len(players)
    bracket_size = 1
    while bracket_size < n:
        bracket_size *= 2
        
    # Number of byes needed
    byes = bracket_size - n
    
    # Create the matches for Round 1
    # We pair players from the list.
    # The first 'byes' number of players get a free pass (handled by logic or dummy matches)
    # For MVP simplicity, we will just pair them up sequentially.
    
    matches_to_add = []
    round_num = 1
    
    # Simple pairing strategy
    # Note: A real production knockout generator is more complex (handling seeds/byes properly)
    # This is a simplified version: Just pair 0 vs 1, 2 vs 3, etc.
    
    for i in range(0, n - 1, 2):
        p1 = players[i]
        p2 = players[i+1]
        
        match = Match(
            tournament_id=tournament_id,
            round_number=round_num,
            player1_id=p1.id,
            player2_id=p2.id
        )
        matches_to_add.append(match)
        
    session.add_all(matches_to_add)
    session.commit()