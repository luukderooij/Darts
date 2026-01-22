from typing import List, Dict
import random
import math
from sqlmodel import Session, select
from app.models.match import Match
from app.models.team import Team
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
    Genereert een dynamische knockout fase op basis van Global Seeding.
    Werkt voor elk aantal poules en qualifiers.
    """
    # 1. Haal alle gespeelde poule wedstrijden op
    matches = session.exec(
        select(Match)
        .where(Match.tournament_id == tournament.id)
        .where(Match.poule_number != None)
    ).all()
    
    # 2. Bereken statistieken per speler
    stats = {} 
    
    for m in matches:
        if not m.is_completed:
            continue
            
        p1, p2 = m.player1_id, m.player2_id
        # Init stats als ze nog niet bestaan
        if p1 not in stats: stats[p1] = {'id': p1, 'w': 0, 'pts': 0, 'ld': 0, 'poule': m.poule_number}
        if p2 not in stats: stats[p2] = {'id': p2, 'w': 0, 'pts': 0, 'ld': 0, 'poule': m.poule_number}
        
        # Leg Difference (Saldo)
        stats[p1]['ld'] += (m.score_p1 - m.score_p2)
        stats[p2]['ld'] += (m.score_p2 - m.score_p1)
        
        # Punten (2 voor winst)
        if m.score_p1 > m.score_p2:
            stats[p1]['w'] += 1
            stats[p1]['pts'] += 2
        else:
            stats[p2]['w'] += 1
            stats[p2]['pts'] += 2

    # 3. Groepeer per poule en sorteer DAARBINNEN
    poules_map = {}
    for pid, data in stats.items():
        p_num = data['poule']
        if p_num not in poules_map: poules_map[p_num] = []
        poules_map[p_num].append(data)
        
    for p_num in poules_map:
        # Sorteren: Meeste punten -> Hoogste saldo -> Meeste winstpartijen
        poules_map[p_num].sort(key=lambda x: (x['pts'], x['ld'], x['w']), reverse=True)

    # 4. Global Seeding (Buckets maken)
    # We zetten alle nummers 1 bij elkaar, alle nummers 2 bij elkaar, etc.
    limit = tournament.qualifiers_per_poule
    ranked_buckets = [[] for _ in range(limit)]
    
    sorted_poule_numbers = sorted(poules_map.keys())
    
    for p_num in sorted_poule_numbers:
        players_in_poule = poules_map[p_num]
        for rank_idx in range(min(len(players_in_poule), limit)):
            ranked_buckets[rank_idx].append(players_in_poule[rank_idx])

    # Sorteer nu de buckets zelf (zodat de Beste #1 bovenaan staat)
    for bucket in ranked_buckets:
        bucket.sort(key=lambda x: (x['pts'], x['ld'], x['w']), reverse=True)

    # 5. Maak één lange ranglijst (Flatten)
    final_seed_list = []
    for bucket in ranked_buckets:
        for p_data in bucket:
            final_seed_list.append(p_data['id'])
            
    if not final_seed_list:
        return 

    # --- NIEUWE LOGICA: Check op Byes ---
    if not tournament.allow_byes:
        num_qualifiers = len(final_seed_list)
        # Bereken de grootste macht van 2 die in het aantal past (Floor)
        # Voorbeeld: 10 spelers -> log2(10)=3.32 -> floor=3 -> 2^3 = 8 spelers.
        # Voorbeeld: 7 spelers -> log2(7)=2.8 -> floor=2 -> 2^2 = 4 spelers.
        power_of_two = math.floor(math.log2(num_qualifiers))
        target_size = 2 ** power_of_two
        
        # Als we minder dan 2 spelers overhouden, is er geen KO mogelijk
        if target_size < 2:
             # Fallback: doe niets of pak minimaal 2 als die er zijn
             pass 
        elif target_size < num_qualifiers:
            # We snijden de lijst af. Omdat de lijst al gesorteerd is op sterkte,
            # vallen automatisch de zwakste qualifiers af.
            final_seed_list = final_seed_list[:target_size]

    # 6. Bracket Grootte Berekenen (Macht van 2)
    num_qualifiers = len(final_seed_list)
    # Zoekt de eerstvolgende macht van 2 (bijv 10 spelers -> 16 bracket size)
    bracket_size = 2 ** math.ceil(math.log2(num_qualifiers))
    
    # Vul aan met None (dit zijn de Byes)
    padded_players = list(final_seed_list)
    while len(padded_players) < bracket_size:
        padded_players.append(None)

    # 7. Wedstrijden Genereren (Hoogste Seed vs Laagste Seed)
    knockout_matches = []
    half_size = bracket_size // 2
    
    for i in range(half_size):
        # Seed 1 speelt tegen Seed 16 (of Bye), Seed 2 tegen 15, etc.
        p1_id = padded_players[i]
        p2_id = padded_players[bracket_size - 1 - i]
        
        if p1_id and p2_id:
            # Echte wedstrijd (Speler vs Speler)
            match = _create_ko_match(tournament, p1_id, p2_id)
            knockout_matches.append(match)
            
        elif p1_id and p2_id is None:
            # Speler vs Bye -> We maken een wedstrijd die DIRECT AFGEROND is.
            # Hierdoor verschijnt hij in de bracket als gewonnen en gaat de speler door.
            bye_match = Match(
                tournament_id=tournament.id,
                round_number=1,
                poule_number=None,
                player1_id=p1_id,
                player2_id=None, # Geen tegenstander
                score_p1=tournament.starting_legs_ko, # Automatische winst score
                score_p2=0,
                is_completed=True, # Direct klaar!
                best_of_legs=tournament.starting_legs_ko,
                best_of_sets=tournament.sets_per_match
            )
            knockout_matches.append(bye_match)

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

def check_and_advance_knockout(tournament_id: int, current_round: int, session: Session):
    """
    Checkt of een knockout ronde compleet is. 
    Zo ja: Genereert de volgende ronde.
    """
    # 1. Haal alle wedstrijden van deze ronde op
    matches = session.exec(
        select(Match)
        .where(Match.tournament_id == tournament_id)
        .where(Match.round_number == current_round)
        .where(Match.poule_number == None) 
    ).all()
    
    if not matches:
        return

    # 2. Check of ALLES compleet is
    if not all(m.is_completed for m in matches):
        return # Nog niet iedereen is klaar

    # --- NIEUWE CHECK: Bestaat de volgende ronde al? ---
    # Dit voorkomt dat we dubbele wedstrijden aanmaken als je per ongeluk 2x opslaat.
    next_round = current_round + 1
    existing_next_round = session.exec(
        select(Match)
        .where(Match.tournament_id == tournament_id)
        .where(Match.round_number == next_round)
        .where(Match.poule_number == None)
    ).first()
    
    if existing_next_round:
        print(f"Ronde {next_round} bestaat al, we genereren niets nieuws.")
        return
    # ---------------------------------------------------

    print(f"--- Ronde {current_round} compleet! Genereren Ronde {current_round + 1} ---")

    # 3. Verzamel winnaars
    matches.sort(key=lambda x: x.id)
    
    winners = []
    for m in matches:
        if m.score_p1 > m.score_p2:
            winners.append(m.player1_id)
        else:
            winners.append(m.player2_id)
            
    # Als er maar 1 winnaar over is, is het toernooi klaar!
    if len(winners) < 2:
        print(f"Toernooi {tournament_id} is afgelopen. Winnaar ID: {winners[0]}")
        t = session.get(Tournament, tournament_id)
        if t:
            t.status = "finished"
            session.add(t)
            session.commit()
        return

    # 4. Maak wedstrijden voor de volgende ronde
    t = session.get(Tournament, tournament_id)
    legs = t.starting_legs_ko if t else 5
    sets = t.sets_per_match if t else 1
    
    new_matches = []
    for i in range(0, len(winners), 2):
        p1 = winners[i]
        p2 = winners[i+1]
        
        new_match = Match(
            tournament_id=tournament_id,
            round_number=next_round,
            poule_number=None,
            player1_id=p1,
            player2_id=p2,
            score_p1=0,
            score_p2=0,
            is_completed=False,
            best_of_legs=legs,
            best_of_sets=sets
        )
        new_matches.append(new_match)
        
    session.add_all(new_matches)
    session.commit()

def create_random_teams(tournament_id: int, player_ids: list[int], session: Session):
    """
    Eis 1: Automatisch team systeem (Random).
    Eis 3: Automatische naamgeving.
    """
    # 1. Spelers ophalen
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    
    if len(players) % 2 != 0:
        raise ValueError("Aantal spelers moet even zijn voor koppels!")

    # 2. Husselen
    random.shuffle(players)

    teams = []
    # 3. Koppels maken (per 2)
    for i in range(0, len(players), 2):
        p1 = players[i]
        p2 = players[i+1]

        # Eis 3: Automatische naam
        # Bijv: "Van Gerwen & Van Barneveld"
        team_name = f"{p1.last_name or p1.first_name} & {p2.last_name or p2.first_name}"

        team = Team(name=team_name, tournament_id=tournament_id)
        team.players = [p1, p2]
        session.add(team)
        teams.append(team)
    
    session.commit()
    return teams

def create_manual_team(tournament_id: int, player_ids: list[int], custom_name: str | None, session: Session):
    """
    Eis 2: Vrije keuze team samenstelling.
    Eis 3: Team naam keuze (met fallback).
    """
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    
    if not players:
        raise ValueError("Geen geldige spelers geselecteerd")

    # Eis 3: Naam logica
    if custom_name and custom_name.strip() != "":
        final_name = custom_name
    else:
        # Fallback: namen aan elkaar plakken
        names = [p.last_name or p.first_name for p in players]
        final_name = " & ".join(names)

    team = Team(name=final_name, tournament_id=tournament_id)
    team.players = players
    
    session.add(team)
    session.commit()
    session.refresh(team)
    return team