import math
import random
import functools
from typing import List, Dict, Any
from sqlmodel import Session, select
from app.models.match import Match
from app.models.team import Team
from app.models.player import Player
from app.models.tournament import Tournament

# ==========================================
# 1. POULE FASE LOGICA (VOOR SINGLES)
# ==========================================

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
        num_poules = 1

    # 1. Spelers husselen
    shuffled_players = list(players)
    random.shuffle(shuffled_players)

    # 2. Verdeel over poules
    poules_map = {i: [] for i in range(1, num_poules + 1)}
    
    for idx, player in enumerate(shuffled_players):
        target_poule = (idx % num_poules) + 1
        poules_map[target_poule].append(player)

    # 3. Genereer wedstrijden
    matches_to_add = []
    for poule_num, pool_players in poules_map.items():
        new_matches = _create_round_robin_matches(
            tournament_id=tournament_id,
            players=pool_players,
            poule_number=poule_num,
            legs=legs_best_of,
            sets=sets_best_of
        )
        
        new_matches.sort(key=lambda m: m.round_number)
        assign_referees(new_matches, pool_players, is_doubles=False)
        # --------------------------------

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
    """Klassieke Round Robin (alles in 1 grote groep)."""
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
        rotation.insert(1, rotation.pop())
    
    return matches


# ==========================================
# 2. NIEUWE KNOCKOUT LOGICA (TEAMS + SINGLES)
# ==========================================

# backend/app/services/tournament_gen.py

import functools
# Voeg functools toe aan de imports bovenin backend/app/services/tournament_gen.py

# backend/app/services/tournament_gen.py

def calculate_poule_standings(session: Session, tournament: Tournament) -> Dict[int, List[dict]]:
    """
    Berekent de stand per poule volgens Order of Merit Rules:
    Punten (2 per winst) -> Leg-Difference -> Head-to-Head -> 9-dart-Shoot-out.
    """
    matches = session.exec(
        select(Match)
        .where(Match.tournament_id == tournament.id)
        .where(Match.poule_number != None)
        .where(Match.is_completed == True)
    ).all()

    is_doubles = tournament.mode == "doubles"
    raw_standings = {} 
    h2h_winners = {} 

    def init_entity(poule_num, entity_id, entity_name):
        if poule_num not in raw_standings:
            raw_standings[poule_num] = {}
        if entity_id not in raw_standings[poule_num]:
            raw_standings[poule_num][entity_id] = {
                "id": entity_id,
                "name": entity_name,
                "points": 0,
                "played": 0,
                "legs_won": 0,
                "legs_lost": 0,
                "leg_diff": 0,
                "needs_shootout": False  # Nieuwe vlag voor stap 3
            }

    for m in matches:
        if is_doubles:
            if not m.team1 or not m.team2: session.refresh(m, ["team1", "team2"])
            id_1, id_2 = m.team1_id, m.team2_id
            name_1, name_2 = (m.team1.name if m.team1 else "Team ?"), (m.team2.name if m.team2 else "Team ?")
        else:
            if not m.player1 or not m.player2: session.refresh(m, ["player1", "player2"])
            id_1, id_2 = m.player1_id, m.player2_id
            name_1, name_2 = (m.player1.name if m.player1 else "Player ?"), (m.player2.name if m.player2 else "Player ?")

        if not id_1 or not id_2: continue

        init_entity(m.poule_number, id_1, name_1)
        init_entity(m.poule_number, id_2, name_2)

        stats_1 = raw_standings[m.poule_number][id_1]
        stats_2 = raw_standings[m.poule_number][id_2]

        stats_1["played"] += 1
        stats_2["played"] += 1
        stats_1["legs_won"] += m.score_p1
        stats_1["legs_lost"] += m.score_p2
        stats_2["legs_won"] += m.score_p2
        stats_2["legs_lost"] += m.score_p1

        winner_id = id_1 if m.score_p1 > m.score_p2 else id_2
        if m.score_p1 > m.score_p2:
            stats_1["points"] += 2
        else:
            stats_2["points"] += 2
            
        pair = tuple(sorted([id_1, id_2]))
        h2h_winners[(m.poule_number, pair)] = winner_id

    def compare_entities(a, b, poule_num):
        # 1. Punten
        if a["points"] != b["points"]:
            return a["points"] - b["points"]
        # 2. Leg Difference
        if a["leg_diff"] != b["leg_diff"]:
            return a["leg_diff"] - b["leg_diff"]
        # 3. Head-to-Head
        pair = tuple(sorted([a["id"], b["id"]]))
        winner_id = h2h_winners.get((poule_num, pair))
        if winner_id == a["id"]: return 1
        if winner_id == b["id"]: return -1
        return 0

    final_standings = {}
    for p_num in range(1, tournament.number_of_poules + 1):
        if p_num in raw_standings:
            poule_list = list(raw_standings[p_num].values())
            for p in poule_list:
                p["leg_diff"] = p["legs_won"] - p["legs_lost"]
            
            # Sortering uitvoeren
            poule_list.sort(key=functools.cmp_to_key(lambda a, b: compare_entities(a, b, p_num)), reverse=True)

            # STAP 3 FIX: Controleer op onbesliste standen (Shoot-out nodig)
            for i in range(len(poule_list) - 1):
                # OUDE CODE (Te strikt voor cirkels):
                # if compare_entities(poule_list[i], poule_list[i+1], p_num) == 0:
                
                # NIEUWE CODE (Detecteer gelijke statistieken):
                p1 = poule_list[i]
                p2 = poule_list[i+1]
                
                # Als Punten EN Saldo gelijk zijn -> Flaggen als Shootout risico
                if p1["points"] == p2["points"] and p1["leg_diff"] == p2["leg_diff"]:
                    poule_list[i]["needs_shootout"] = True
                    poule_list[i+1]["needs_shootout"] = True

            final_standings[p_num] = poule_list
        else:
            final_standings[p_num] = []

    return final_standings


# HIER IS DE FUNCTIE WAAR DE ERROR OVER KLAAGDE
def generate_knockout_bracket(session: Session, tournament: Tournament):
    """
    Genereert bracket op basis van standings voor Singles én Doubles.
    """
    standings = calculate_poule_standings(session, tournament)
    is_doubles = tournament.mode == "doubles"

    # Verzamel Qualifiers
    qualifiers = []
    q_per_poule = tournament.qualifiers_per_poule if tournament.qualifiers_per_poule else 2
    
    for p_num in range(1, tournament.number_of_poules + 1):
        poule_list = standings.get(p_num, [])
        top_x = poule_list[:q_per_poule]
        qualifiers.extend(top_x)

    if not qualifiers:
        print("Geen qualifiers. Zijn poules gespeeld?")
        return

    # Bracket Grootte (Macht van 2)
    count = len(qualifiers)
    bracket_size = 2
    while bracket_size < count:
        bracket_size *= 2
    
    qualified_ids = [q["id"] for q in qualifiers]
    
    # Byes toevoegen
    while len(qualified_ids) < bracket_size:
        qualified_ids.append(None)

    # Husselen (Simple Seeding)
    random.shuffle(qualified_ids)
    
    # Matches aanmaken
    matches_in_first_round = bracket_size // 2
    current_round = 1 
    
    for i in range(matches_in_first_round):
        p1_id = qualified_ids[i * 2]
        p2_id = qualified_ids[i * 2 + 1]
        
        match = Match(
            tournament_id=tournament.id,
            round_number=current_round,
            poule_number=None, # KO Match
            best_of_legs=tournament.starting_legs_ko,
            best_of_sets=tournament.sets_per_match,
            is_completed=False,
            score_p1=0,
            score_p2=0
        )
        
        # KOPPEL JUISTE KOLOMMEN
        if is_doubles:
            match.team1_id = p1_id
            match.team2_id = p2_id
            # Bye logica
            if p2_id is None and p1_id is not None:
                match.score_p1 = math.ceil(tournament.starting_legs_ko / 2) + 1
                match.is_completed = True
            if p1_id is None:
                match.is_completed = True
        else: # Singles
            match.player1_id = p1_id
            match.player2_id = p2_id
            # Bye logica
            if p2_id is None and p1_id is not None:
                match.score_p1 = math.ceil(tournament.starting_legs_ko / 2) + 1
                match.is_completed = True
            if p1_id is None:
                match.is_completed = True

        session.add(match)
    
    session.commit()
    print(f"Knockout (Teams/Singles) gegenereerd: {matches_in_first_round} wedstrijden.")


def check_and_advance_knockout(tournament_id: int, current_round: int, session: Session):
    """
    Checkt of ronde klaar is en genereert de volgende.
    Werkt nu ook voor TEAMS.
    """
    tournament = session.get(Tournament, tournament_id)
    if not tournament: return
    is_doubles = tournament.mode == "doubles"

    matches = session.exec(
        select(Match)
        .where(Match.tournament_id == tournament_id)
        .where(Match.round_number == current_round)
        .where(Match.poule_number == None) 
    ).all()
    
    if not matches: return 
    if not all(m.is_completed for m in matches): return 

    # Check of volgende ronde al bestaat
    next_round = current_round + 1
    existing = session.exec(select(Match).where(Match.tournament_id==tournament_id).where(Match.round_number==next_round).where(Match.poule_number==None)).first()
    if existing: return

    # Sorteer op ID om bracket structuur te behouden
    matches.sort(key=lambda m: m.id)
    
    next_round_count = len(matches) // 2
    if next_round_count < 1:
        print("Toernooi afgelopen.")
        return

    new_matches = []
    for i in range(next_round_count):
        m1 = matches[i * 2]
        m2 = matches[i * 2 + 1]
        
        # Bepaal winnaars
        if is_doubles:
            w1 = m1.team1_id if m1.score_p1 > m1.score_p2 else m1.team2_id
            w2 = m2.team1_id if m2.score_p1 > m2.score_p2 else m2.team2_id
        else:
            w1 = m1.player1_id if m1.score_p1 > m1.score_p2 else m1.player2_id
            w2 = m2.player1_id if m2.score_p1 > m2.score_p2 else m2.player2_id
            
        new_match = Match(
            tournament_id=tournament_id,
            round_number=next_round,
            poule_number=None,
            best_of_legs=tournament.starting_legs_ko,
            best_of_sets=tournament.sets_per_match,
            is_completed=False,
            score_p1=0, score_p2=0
        )
        
        if is_doubles:
            new_match.team1_id = w1
            new_match.team2_id = w2
        else:
            new_match.player1_id = w1
            new_match.player2_id = w2
            
        new_matches.append(new_match)
        
    session.add_all(new_matches)
    session.commit()
    print(f"Ronde {next_round} gegenereerd.")


# ==========================================
# 3. DIRECT KNOCKOUT & HELPERS
# ==========================================

def generate_knockout(
    tournament_id: int, 
    players: List[Player], 
    legs_best_of: int,
    sets_best_of: int,
    session: Session
):
    """Direct Knockout generator (Oud, voor Singles zonder poules)."""
    random.shuffle(players)
    
    class FakeTournament:
        id = tournament_id
        starting_legs_ko = legs_best_of
        sets_per_match = sets_best_of
        
    fake_tourn = FakeTournament()
    player_ids = [p.id for p in players]
    _create_bracket_matches(fake_tourn, player_ids, session)

def _create_bracket_matches(tournament, player_ids, session):
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

# ==========================================
# 4. TEAM HELPERS
# ==========================================

def create_random_teams(tournament_id: int, player_ids: list[int], session: Session):
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    if len(players) % 2 != 0:
        raise ValueError("Aantal spelers moet even zijn voor koppels!")

    random.shuffle(players)
    teams = []
    for i in range(0, len(players), 2):
        p1 = players[i]
        p2 = players[i+1]
        team_name = f"{p1.last_name or p1.first_name} & {p2.last_name or p2.first_name}"
        team = Team(name=team_name, tournament_id=tournament_id)
        team.players = [p1, p2]
        session.add(team)
        teams.append(team)
    
    session.commit()
    return teams

def create_manual_team(tournament_id: int, player_ids: list[int], custom_name: str | None, session: Session):
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    if not players:
        raise ValueError("Geen geldige spelers geselecteerd")

    if custom_name and custom_name.strip() != "":
        final_name = custom_name
    else:
        names = [p.last_name or p.first_name for p in players]
        final_name = " & ".join(names)

    team = Team(name=final_name, tournament_id=tournament_id)
    team.players = players
    session.add(team)
    session.commit()
    session.refresh(team)
    return team

def assign_referees(matches: List[Match], participants: List[Any], is_doubles: bool):
    """
    Assigns referees to a list of matches ensuring:
    1. Equal distribution (everyone refs same amount).
    2. Spacing (try not to ref immediately after playing).
    """
    if len(participants) < 3:
        return # Not enough people to have a referee

    # Track how many times each entity has refereed
    ref_counts = {p.id: 0 for p in participants}
    
    # Track the last match index where an entity was involved (playing or reffing)
    # Used to calculate 'rest' periods. Initialize to -1.
    last_active_index = {p.id: -1 for p in participants}

    for i, match in enumerate(matches):
        # 1. Identify who is playing
        if is_doubles:
            p1_id = match.team1_id
            p2_id = match.team2_id
        else:
            p1_id = match.player1_id
            p2_id = match.player2_id

        # Update activity for players (they are busy playing this match)
        if p1_id: last_active_index[p1_id] = i
        if p2_id: last_active_index[p2_id] = i

        # 2. Find Candidates (Everyone in poule NOT playing this match)
        candidates = [p for p in participants if p.id not in (p1_id, p2_id)]

        if not candidates:
            continue

        # 3. Scoring Algorithm
        # We want the candidate with the LOWEST ref_count.
        # Tie-breaker: The one who has been inactive the longest
        def get_score(candidate):
            count = ref_counts[candidate.id]
            
            # Calculate gap since last activity
            last_idx = last_active_index[candidate.id]
            gap = i - last_idx if last_idx != -1 else 999 
            
            # Score = (Count * 100) - Gap
            return (count * 100) - gap

        # Sort candidates by score (Lowest is best)
        candidates.sort(key=get_score)
        
        if not candidates:
            continue
            
        best_ref = candidates[0]

        # 4. Assign
        if is_doubles:
            match.referee_team_id = best_ref.id
        else:
            match.referee_id = best_ref.id

        # 5. Update Tracking
        ref_counts[best_ref.id] += 1
        last_active_index[best_ref.id] = i