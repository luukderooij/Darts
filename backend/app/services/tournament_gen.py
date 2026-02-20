# backend/app/services/tournament_gen.py
import math
import random
import functools
from typing import List, Dict, Any
from sqlmodel import Session, select
from app.models.match import Match
from app.models.team import Team
from app.models.player import Player
from app.models.tournament import Tournament, TournamentRound
from app.services.beer_fetcher_gen import assign_beer_fetchers_to_tournament
from app.services.referee_gen import assign_referees_safe
from app.services.scheduler_logic import assign_matches_to_logical_rounds
from sqlalchemy.orm import selectinload

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
    Verdeelt DEELNEMERS (Spelers of Teams) over poules en genereert wedstrijden.
    """
    # 1. Haal toernooi op MET RELATIES
    stmt = select(Tournament).where(Tournament.id == tournament_id).options(
        selectinload(Tournament.teams),
        selectinload(Tournament.players),
        selectinload(Tournament.boards) # Ook borden meteen laden
    )
    tournament = session.exec(stmt).first()
    
    if not tournament: return []
    
    session.refresh(tournament) 
    is_doubles = (tournament.mode == "doubles")

    # 2. BEPAAL DEELNEMERS (Correctie: via relatie ophalen)
    participants = []
    if is_doubles:
        # FIX: Team heeft geen tournament_id kolom, haal op via de relatie
        participants = tournament.teams
        print(f"DEBUG: Doubles Mode - Gevonden teams: {len(participants)}")
        
        if len(participants) == 0:
            print("ERROR: Geen teams gevonden! Maak eerst teams aan.")
            return []
    else:
        participants = list(players)
        print(f"DEBUG: Singles Mode - Gevonden spelers: {len(participants)}")

    # Check borden
    boards = sorted(tournament.boards, key=lambda b: b.number) if tournament.boards else []
    print(f"DEBUG: Toernooi {tournament_id} heeft {len(boards)} borden beschikbaar.")

    # 3. Husselen en verdelen over poules
    if len(participants) < num_poules:
        num_poules = 1

    shuffled_participants = list(participants)
    random.shuffle(shuffled_participants)

    poules_map = {i: [] for i in range(1, num_poules + 1)}
    for idx, entity in enumerate(shuffled_participants):
        target_poule = (idx % num_poules) + 1
        poules_map[target_poule].append(entity)

    # 4. Matches genereren
    all_created_matches = []
    
    max_matches_limit = getattr(tournament, 'matches_per_player', None)
    if max_matches_limit == 0: max_matches_limit = None 

    for poule_num, pool_entities in poules_map.items():
        poule_matches = _create_round_robin_matches(
            tournament_id=tournament_id,
            participants=pool_entities,
            poule_number=poule_num,
            legs=legs_best_of,
            sets=sets_best_of, 
            max_rounds=max_matches_limit,
            is_doubles=is_doubles
        )
        all_created_matches.extend(poule_matches)

    # 5. Opslaan
    session.add_all(all_created_matches)
    session.commit()

    # 6. Indelen
    print("DEBUG: Start herindeling over borden...")
    assign_matches_to_logical_rounds(session, tournament_id, all_created_matches)
    
    for m in all_created_matches:
        session.refresh(m)

    # 7. Scheidsrechters (let op de simpele aanroep!)
    print("DEBUG: Start veilige scheidsrechter toewijzing...")
    assign_referees_safe(session, tournament_id)

    # 8. Bierhalers
    assign_beer_fetchers_to_tournament(session, tournament_id)

    return all_created_matches


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
    participants: List[Any], # Kan Player of Team zijn
    poule_number: int | None, 
    legs: int, 
    sets: int,
    max_rounds: int | None = None,
    is_doubles: bool = False # Nieuwe parameter
) -> List[Match]:
    matches = []
    if len(participants) < 2:
        return matches

    rotation = list(participants)
    if len(rotation) % 2 != 0:
        rotation.append(None) # Dummy
    
    num_entities = len(rotation)
    total_possible_rounds = num_entities - 1
    
    # De limiet logic:
    # Als max_rounds = 5, speelt ieder Team/Speler exact 5 keer.
    if max_rounds and max_rounds > 0:
        num_rounds_to_play = min(max_rounds, total_possible_rounds)
    else:
        num_rounds_to_play = total_possible_rounds

    half = num_entities // 2

    for round_idx in range(num_rounds_to_play):
        round_num = round_idx + 1 
        
        for i in range(half):
            entity1 = rotation[i]
            entity2 = rotation[num_entities - 1 - i]
            
            if entity1 and entity2:
                match = Match(
                    tournament_id=tournament_id,
                    round_number=round_num,
                    poule_number=poule_number,
                    best_of_legs=legs,
                    best_of_sets=sets,
                    is_completed=False
                )
                
                # HIER MAKEN WE HET ONDERSCHEID
                if is_doubles:
                    match.team1_id = entity1.id
                    match.team2_id = entity2.id
                else:
                    match.player1_id = entity1.id
                    match.player2_id = entity2.id
                    
                matches.append(match)
        
        rotation.insert(1, rotation.pop())
    
    return matches


# ==========================================
# 2. KNOCKOUT LOGICA & STANDEN
# ==========================================

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
                "needs_shootout": False
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
            
            poule_list.sort(key=functools.cmp_to_key(lambda a, b: compare_entities(a, b, p_num)), reverse=True)

            total_matches_needed = len(poule_list) - 1
            poule_finished = all(p["played"] >= total_matches_needed for p in poule_list)

            if poule_finished:
                # Stap 2: Groepeer spelers op basis van Punten & Leg-Saldo
                # Dit zijn de 'harde' stats. Als die gelijk zijn, kijken we naar H2H.
                groups = {}
                for p in poule_list:
                    key = (p["points"], p["leg_diff"])
                    if key not in groups:
                        groups[key] = []
                    groups[key].append(p)

                # Stap 3: Analyseer elke groep die groter is dan 1 persoon
                for key, group in groups.items():
                    if len(group) > 1:
                        # We bouwen een mini-stand op van ALLEEN onderlinge wedstrijden in deze groep
                        internal_wins = {p["id"]: 0 for p in group}
                        
                        # Check elke mogelijke match binnen de groep
                        for i in range(len(group)):
                            for j in range(i + 1, len(group)):
                                p_a = group[i]
                                p_b = group[j]
                                
                                # Haal winnaar uit de eerder gemaakte h2h tabel
                                pair = tuple(sorted([p_a["id"], p_b["id"]]))
                                winner_id = h2h_winners.get((p_num, pair))

                                if winner_id == p_a["id"]:
                                    internal_wins[p_a["id"]] += 1
                                elif winner_id == p_b["id"]:
                                    internal_wins[p_b["id"]] += 1

                        # Stap 4: Conclusie trekken
                        # Een shootout is nodig als IEDEREEN in de groep evenveel interne winstpunten heeft.
                        # Bijv: Bij 3 spelers heeft iedereen 1x gewonnen (Cirkel).
                        # Als er 1 iemand alles won, heeft die 2 punten en de rest 1 of 0 -> Geen shootout.
                        
                        wins_values = list(internal_wins.values())
                        
                        # Zijn alle waarden in de lijst identiek? (bv. [1, 1, 1])
                        is_deadlock = len(set(wins_values)) == 1
                        
                        if is_deadlock:
                            for p in group:
                                p["needs_shootout"] = True

            # Sla op in de final standings
            final_standings[p_num] = poule_list
        else:
            final_standings[p_num] = []

    return final_standings

# Voeg deze helper toe bovenaan of vlak voor generate_knockout_bracket
def get_bracket_order(num_items: int) -> List[int]:
    """
    Geeft de index-volgorde terug voor een standaard seeded bracket.
    Bijv voor 4 items (Halve finales): [0, 3, 2, 1] -> Seed 1 vs 4, Seed 3 vs 2
    """
    if num_items == 0: return []
    # Start met finale: seeds 1 en 2
    rounds = [1, 2]
    
    # Bouw op tot het gewenste aantal (powers of 2)
    while len(rounds) < num_items:
        next_round = []
        for seed in rounds:
            next_round.append(seed)
            next_round.append((len(rounds) * 2 + 1) - seed)
        rounds = next_round
        
    # Converteer seeds (1-based) naar 0-based index en pas de pairing volgorde aan
    # We willen dat Match 1 (index 0) speelt tegen Match 2 (index 1) in de volgende ronde.
    # Standaard lijst: 1, 8, 5, 4, 3, 6, 7, 2
    # Paar 1: 1 vs 8. Paar 2: 5 vs 4.
    # Als we ze gewoon in deze volgorde in de DB zetten, speelt (1vs8) tegen (5vs4). Dat klopt!
    return [x - 1 for x in rounds]

def generate_knockout_bracket(session: Session, tournament: Tournament):
    """
    Genereert bracket met correcte seeding zodat toppers elkaar pas in de finale treffen.
    """
    standings = calculate_poule_standings(session, tournament)
    is_doubles = tournament.mode == "doubles"
    
    qualifiers = []
    q_per_poule = tournament.qualifiers_per_poule if tournament.qualifiers_per_poule else 2

    # 1. Verzamel alle qualifiers
    for p_num, players in standings.items():
        top_x = players[:q_per_poule]
        for rank_idx, p in enumerate(top_x):
            p_data = p.copy()
            p_data['poule_number'] = p_num
            p_data['poule_rank'] = rank_idx + 1
            qualifiers.append(p_data)

    if not qualifiers:
        print("Geen qualifiers gevonden.")
        return

    # 2. Global Ranking (voor Seeds)
    # Sorteer iedereen op prestatie (Punten > Saldo > Won > Rank)
    qualifiers.sort(key=lambda x: (
        x['poule_rank'],      # Eerst alle nummers 1
        -x['points'],         # Dan meeste punten
        -x['leg_diff'],       # Dan beste saldo
        -x['legs_won']
    ))

    total_players = len(qualifiers)
    bracket_size = 2
    while bracket_size < total_players:
        bracket_size *= 2
    
    num_byes = bracket_size - total_players
    
    # De lijst 'bracket_slots' gaat alle 'Units' bevatten (Matches of Byes)
    # We vullen ze eerst op volgorde van sterkte (Seed 1, Seed 2, ...)
    bracket_slots = []

    # A. Maak Byes voor de top seeds
    for i in range(num_byes):
        player = qualifiers[i]
        
        # Maak een VOLTOOIDE match (Bye)
        match = Match(
            tournament_id=tournament.id,
            round_number=1,
            poule_number=None,
            best_of_legs=tournament.starting_legs_ko,
            best_of_sets=tournament.sets_per_match,
            is_completed=True,
            score_p1=math.ceil(tournament.starting_legs_ko / 2),
            score_p2=0
        )
        if is_doubles:
            match.team1_id = player['id']
        else:
            match.player1_id = player['id']
            
        bracket_slots.append(match)

    # B. Maak Wedstrijden voor de rest (Sterk vs Zwak principe overgebleven veld)
    remaining_players = qualifiers[num_byes:]
    # We hebben nu (bracket_size / 2) - num_byes aan "echte" wedstrijden nodig
    # We koppelen de overgebleven sterkste aan de overgebleven zwakste
    # Omdat 'qualifiers' al gesorteerd is, is remaining_players[0] de sterkste "niet-bye" speler.
    
    while len(remaining_players) > 1:
        p1 = remaining_players.pop(0) # Sterkste overgebleven
        
        # Zoek tegenstander (liefst uit andere poule) - Cyclisch zoeken
        opponent = None
        found_idx = -1
        max_poules = tournament.number_of_poules

        # Probeer van zwak naar sterk te zoeken naar iemand uit andere poule
        for i in range(len(remaining_players) -1, -1, -1):
            cand = remaining_players[i]
            if cand['poule_number'] != p1['poule_number']:
                found_idx = i
                break
        
        if found_idx == -1:
            found_idx = len(remaining_players) - 1 # Pak gewoon de zwakste
            
        opponent = remaining_players.pop(found_idx)

        match = Match(
            tournament_id=tournament.id,
            round_number=1,
            poule_number=None,
            best_of_legs=tournament.starting_legs_ko,
            best_of_sets=tournament.sets_per_match,
            is_completed=False,
            score_p1=0, score_p2=0
        )
        if is_doubles:
            match.team1_id = p1['id']
            match.team2_id = opponent['id']
        else:
            match.player1_id = p1['id']
            match.player2_id = opponent['id']
            
        bracket_slots.append(match)

    # 3. REORDERING (De Fix)
    # We hebben nu een lijst 'bracket_slots' die gesorteerd is op sterkte van de "hoofdrolspeler".
    # Slot 0 = Seed 1 (Bye), Slot 1 = Seed 2 (Bye), Slot X = Match met Seed Y.
    # We moeten deze lijst husselen naar de bracket volgorde (1, 8, 4, 5, 3, 6, 2, 7)
    
    # Aantal slots in ronde 1 (matches + byes) zou bracket_size / 2 moeten zijn
    # Bijv: 6 spelers -> bracket 8 -> 2 Byes, 2 Matches. Totaal 4 slots in de boom.
    num_slots_in_round = bracket_size // 2
    
    # Haal de index-volgorde op
    order_indices = get_bracket_order(num_slots_in_round)
    
    final_matches_list = []
    
    # We plaatsen de matches in de database in de volgorde van het schema (Boven naar Beneden)
    # Hierdoor pakt 'check_and_advance' straks automatisch Match 1 vs Match 2.
    for idx in order_indices:
        if idx < len(bracket_slots):
            final_matches_list.append(bracket_slots[idx])

    session.add_all(final_matches_list)
    session.commit()


def check_and_advance_knockout(tournament_id: int, current_round: int, session: Session):
    """
    Checkt of ronde klaar is en genereert de volgende.
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
    
    if not matches or not all(m.is_completed for m in matches): return

    next_round = current_round + 1
    existing = session.exec(select(Match).where(Match.tournament_id==tournament_id).where(Match.round_number==next_round).where(Match.poule_number==None)).first()
    if existing: return

    matches.sort(key=lambda m: m.id)
    next_round_count = len(matches) // 2
    if next_round_count < 1: return

    new_matches = []
    for i in range(next_round_count):
        m1 = matches[i * 2]
        m2 = matches[i * 2 + 1]
        
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