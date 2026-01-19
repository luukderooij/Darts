from typing import List, Dict
import random
from sqlmodel import Session, select
from app.models.match import Match
from app.models.player import Player
from app.models.tournament import Tournament

# --- POULE FASE LOGICA ---

def generate_poule_phase(
    tournament_id: int,
    players: List[Player],
    num_poules: int,
    legs_best_of: int,
    sets_best_of: int,
    session: Session
):
    """
    Verdeelt spelers over N poules en genereert voor elke poule een Round Robin schema.
    """
    if len(players) < num_poules:
        # Fallback: als er minder spelers zijn dan poules, stop alles in 1 poule
        num_poules = 1

    # 1. Spelers husselen voor willekeurige indeling
    shuffled_players = list(players)
    random.shuffle(shuffled_players)

    # 2. Verdeel over poules (Modulo verdeling)
    poules_map = {i: [] for i in range(1, num_poules + 1)}
    
    for idx, player in enumerate(shuffled_players):
        target_poule = (idx % num_poules) + 1
        poules_map[target_poule].append(player)

    # 3. Genereer wedstrijden per poule
    matches_to_add = []
    
    for poule_num, pool_players in poules_map.items():
        new_matches = _create_round_robin_matches(
            tournament_id=tournament_id,
            players=pool_players,
            poule_number=poule_num,
            legs=legs_best_of,
            sets=sets_best_of
        )
        matches_to_add.extend(new_matches)

    session.add_all(matches_to_add)
    session.commit()


def generate_round_robin_global(
    tournament_id: int, 
    players: List[Player], 
    legs_best_of: int,
    sets_best_of: int,
    session: Session
):
    """
    Klassieke Round Robin (alles in 1 grote groep).
    """
    matches = _create_round_robin_matches(tournament_id, players, None, legs_best_of, sets_best_of)
    session.add_all(matches)
    session.commit()


def _create_round_robin_matches(
    tournament_id: int, 
    players: List[Player], 
    poule_number: int | None,
    legs: int,
    sets: int
) -> List[Match]:
    matches = []
    if len(players) < 2:
        return matches

    # Dummy toevoegen bij oneven aantal
    rotation = list(players)
    if len(rotation) % 2 != 0:
        rotation.append(None)
    
    num_players = len(rotation)
    num_rounds = num_players - 1
    half = num_players // 2

    for round_idx in range(num_rounds):
        round_num = round_idx + 1
        
        for i in range(half):
            p1 = rotation[i]
            p2 = rotation[num_players - 1 - i]
            
            if p1 and p2:
                match = Match(
                    tournament_id=tournament_id,
                    round_number=round_num,
                    poule_number=poule_number,
                    player1_id=p1.id,
                    player2_id=p2.id,
                    best_of_legs=legs,
                    best_of_sets=sets,
                    is_completed=False
                )
                matches.append(match)

        # Rotate
        rotation.insert(1, rotation.pop())
    
    return matches


# --- KNOCKOUT LOGICA (HYBRIDE) ---

def generate_knockout_from_poules(tournament: Tournament, session: Session):
    """
    Berekent de stand in de poules en genereert de eerste knockout ronde.
    """
    # 1. Haal alle poule wedstrijden op
    matches = session.exec(select(Match).where(Match.tournament_id == tournament.id).where(Match.poule_number != None)).all()
    
    # 2. Bereken statistieken per speler
    stats = {} 
    
    for m in matches:
        if not m.is_completed:
            continue
            
        p1, p2 = m.player1_id, m.player2_id
        if p1 not in stats: stats[p1] = {'id': p1, 'w': 0, 'pts': 0, 'ld': 0, 'poule': m.poule_number}
        if p2 not in stats: stats[p2] = {'id': p2, 'w': 0, 'pts': 0, 'ld': 0, 'poule': m.poule_number}
        
        stats[p1]['ld'] += (m.score_p1 - m.score_p2)
        stats[p2]['ld'] += (m.score_p2 - m.score_p1)
        
        if m.score_p1 > m.score_p2:
            stats[p1]['w'] += 1
            stats[p1]['pts'] += 2
        else:
            stats[p2]['w'] += 1
            stats[p2]['pts'] += 2

    # 3. Sorteer per poule
    poules_results = {}
    
    for pid, data in stats.items():
        p_num = data['poule']
        if p_num not in poules_results: poules_results[p_num] = []
        poules_results[p_num].append(data)
        
    for p_num in poules_results:
        poules_results[p_num].sort(key=lambda x: (x['pts'], x['ld'], x['w']), reverse=True)

    # 4. Selecteer de qualifiers
    limit = tournament.qualifiers_per_poule
    active_poules = sorted(poules_results.keys())
    
    # Verzamelen per positie (alle 1e plekken, alle 2e plekken)
    ranked_buckets = [[] for _ in range(limit)]
    
    for p_num in active_poules:
        players_in_poule = poules_results[p_num]
        for i in range(min(len(players_in_poule), limit)):
            ranked_buckets[i].append(players_in_poule[i]['id'])
            
    # 5. Maak de pairings
    knockout_matches = []
    
    # SCENARIO: 1 POULE
    if tournament.number_of_poules == 1:
        # Alles op een hoop gooien en bracket maken
        flat_list = []
        if 1 in poules_results:
            poule1 = poules_results[1]
            for i in range(min(len(poule1), limit)):
                flat_list.append(poule1[i]['id'])
        
        _create_bracket_matches(tournament, flat_list, session)
        return

    # SCENARIO: 2 POULES (Kruisfinale)
    if tournament.number_of_poules == 2:
        group_winners = ranked_buckets[0]
        runners_up = ranked_buckets[1]
        
        if len(group_winners) > 0 and len(runners_up) > 1:
            knockout_matches.append(_create_ko_match(tournament, group_winners[0], runners_up[1]))
            
        if len(group_winners) > 1 and len(runners_up) > 0:
            knockout_matches.append(_create_ko_match(tournament, group_winners[1], runners_up[0]))
            
        session.add_all(knockout_matches)
        session.commit()
        return

    # SCENARIO: OVERIG (Simpele pairing 1 vs 2)
    winners = ranked_buckets[0]
    runners = ranked_buckets[1] if len(ranked_buckets) > 1 else []
    
    runners.reverse() # Spreiding
    
    for i in range(len(winners)):
        p1 = winners[i]
        if i < len(runners):
            p2 = runners[i]
            knockout_matches.append(_create_ko_match(tournament, p1, p2))
            
    session.add_all(knockout_matches)
    session.commit()


# --- ALGEMENE KNOCKOUT HELPERS ---

def generate_knockout(
    tournament_id: int, 
    players: List[Player], 
    legs_best_of: int,
    sets_best_of: int,
    session: Session
):
    """
    Direct Knockout generator (zonder poules vooraf).
    """
    import random
    random.shuffle(players)
    
    # Hack: we maken een fake tournament object om _create_bracket_matches te hergebruiken
    # zonder dat we het hele object uit de DB hoeven te halen.
    class FakeTournament:
        id = tournament_id
        starting_legs_ko = legs_best_of
        sets_per_match = sets_best_of
        
    fake_tourn = FakeTournament()
    
    player_ids = [p.id for p in players]
    _create_bracket_matches(fake_tourn, player_ids, session)


def _create_bracket_matches(tournament, player_ids, session):
    """Generieke bracket generator"""
    n = len(player_ids)
    bracket_size = 1
    while bracket_size < n:
        bracket_size *= 2
        
    padded_players = list(player_ids)
    while len(padded_players) < bracket_size:
        padded_players.append(None)
        
    matches = []
    for i in range(bracket_size // 2):
        p1 = padded_players[i]
        p2 = padded_players[bracket_size - 1 - i]
        
        if p1 and p2:
            matches.append(_create_ko_match(tournament, p1, p2))
            
    session.add_all(matches)
    session.commit()


def _create_ko_match(tournament, p1_id, p2_id):
    return Match(
        tournament_id=tournament.id,
        round_number=1, 
        poule_number=None, 
        player1_id=p1_id,
        player2_id=p2_id,
        best_of_legs=tournament.starting_legs_ko,
        best_of_sets=tournament.sets_per_match,
        is_completed=False
    )