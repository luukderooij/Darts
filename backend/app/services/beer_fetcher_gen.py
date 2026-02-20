"""
Beer Fetcher Generation Logic
Assigns beer fetchers to matches based on availability (players not playing or refereeing)
"""
import random
from typing import List, Union, Optional
from sqlmodel import Session, select
from app.models.match import Match
from app.models.player import Player
from app.models.team import Team
from app.models.tournament import Tournament


def get_available_beer_fetchers(
    round_matches: List[Match],
    all_players_or_teams: List[Union[Player, Team]],
    mode: str
) -> List[Union[Player, Team]]:
    """
    Bepaal welke spelers/teams beschikbaar zijn als bierhaler in deze ronde.
    
    Een speler/team is beschikbaar als bierhaler wanneer deze:
    - NIET speelt in deze ronde
    - NIET schrijft in deze ronde
    
    Args:
        round_matches: Alle matches in de huidige ronde
        all_players_or_teams: Alle deelnemers in het toernooi
        mode: 'singles' of 'doubles'
    
    Returns:
        List van beschikbare spelers/teams voor bierhaler rol
    """
    active_ids = set()
    
    for match in round_matches:
        if mode == "singles":
            # Spelers die spelen
            if match.player1_id:
                active_ids.add(match.player1_id)
            if match.player2_id:
                active_ids.add(match.player2_id)
            # Schrijver
            if match.referee_id:
                active_ids.add(match.referee_id)
        else:  # doubles
            # Teams die spelen
            if match.team1_id:
                active_ids.add(match.team1_id)
            if match.team2_id:
                active_ids.add(match.team2_id)
            # Schrijver
            if match.referee_team_id:
                active_ids.add(match.referee_team_id)
    
    # Filter beschikbare bierhalers
    available = [
        entity for entity in all_players_or_teams 
        if entity.id not in active_ids
    ]
    
    return available


def assign_beer_fetchers_to_round(
    session: Session,
    tournament_id: int,
    round_number: int,
    round_matches: List[Match],
    all_players_or_teams: List[Union[Player, Team]],
    mode: str
) -> None:
    """
    Wijst bierhalers toe aan alle matches in een specifieke ronde.
    
    Logica:
    1. Bepaal welke spelers/teams beschikbaar zijn (niet spelend, niet schrijvend)
    2. Als er geen beschikbare spelers zijn, blijft beer_fetcher_id NULL
       (frontend toont dan automatisch "Handige Peppie")
    3. Verdeel bierhalers round-robin over de matches
    
    Args:
        session: Database sessie
        tournament_id: ID van het toernooi
        round_number: Rondenummer
        round_matches: Alle matches in deze ronde
        all_players_or_teams: Alle deelnemers
        mode: 'singles' of 'doubles'
    """
    if not round_matches:
        return
    
    # Stap 1: Bepaal beschikbare bierhalers
    available_fetchers = get_available_beer_fetchers(
        round_matches=round_matches,
        all_players_or_teams=all_players_or_teams,
        mode=mode
    )
    
    # Stap 2: Als er geen beschikbare spelers zijn, laat beer_fetcher NULL
    # Frontend zal "Handige Peppie" tonen als fallback
    if not available_fetchers:
        print(f"⚠️  Ronde {round_number}: Geen beschikbare bierhalers, matches blijven zonder bierhaler (Handige Peppie in frontend)")
        for match in round_matches:
            match.beer_fetcher_id = None
            match.beer_fetcher_team_id = None
    else:
        print(f"✅ Ronde {round_number}: {len(available_fetchers)} beschikbare bierhaler(s)")
        
        # Stap 3: Wijs bierhalers toe (round-robin verdeling)
        fetcher_index = 0
        
        for match in round_matches:
            # Selecteer volgende bierhaler uit de lijst (cyclisch)
            fetcher = available_fetchers[fetcher_index % len(available_fetchers)]
            
            # Wijs toe op basis van mode
            if mode == "singles":
                match.beer_fetcher_id = fetcher.id
                match.beer_fetcher_team_id = None
            else:  # doubles
                match.beer_fetcher_team_id = fetcher.id
                match.beer_fetcher_id = None
            
            fetcher_index += 1
    
    # Commit wijzigingen
    session.add_all(round_matches)
    session.commit()


def assign_beer_fetchers_to_tournament(session: Session, tournament_id: int):
    tournament = session.get(Tournament, tournament_id)
    if not tournament: return

    rounds = tournament.rounds
    all_participants = tournament.teams if tournament.mode == "doubles" else tournament.players

    for round_obj in rounds:
        round_matches = round_obj.matches
        # Wie is er vrij in dit hele tijdblok?
        available = get_available_beer_fetchers(round_matches, all_participants, tournament.mode)
        
        if not available:
            continue

        # Schud de beschikbare mensen zodat niet altijd dezelfde als eerste wordt gekozen
        random.shuffle(available)

        # Wijs aan elke match (bord) een eigen bierhaler toe
        for i, match in enumerate(round_matches):
            # We pakken de i-de beschikbare persoon. 
            # Als er minder bierhalers dan borden zijn, gebruiken we modulo om te herhalen.
            fetcher = available[i % len(available)]
            
            if tournament.mode == "doubles":
                match.beer_fetcher_team_id = fetcher.id
            else:
                match.beer_fetcher_id = fetcher.id
    
    session.commit()


def clear_beer_fetchers(session: Session, tournament_id: int) -> None:
    """
    Verwijdert alle bierhaler toewijzingen van een toernooi.
    Handig voor reset of regeneratie.
    
    Args:
        session: Database sessie
        tournament_id: ID van het toernooi
    """
    matches = session.exec(
        select(Match).where(Match.tournament_id == tournament_id)
    ).all()
    
    for match in matches:
        match.beer_fetcher_id = None
        match.beer_fetcher_team_id = None
    
    session.add_all(matches)
    session.commit()
    
    print(f"🧹 Alle bierhaler toewijzingen verwijderd voor toernooi {tournament_id}")


def reassign_beer_fetcher_for_match(
    session: Session,
    match_id: int,
    new_fetcher_id: Optional[int] = None,
    new_fetcher_team_id: Optional[int] = None
) -> Match:
    """
    Wijzigt de bierhaler van een specifieke match.
    Gebruikt in de dashboard manage pagina.
    
    Args:
        session: Database sessie
        match_id: ID van de match
        new_fetcher_id: Nieuwe player ID (voor singles)
        new_fetcher_team_id: Nieuwe team ID (voor doubles)
    
    Returns:
        Updated Match object
    """
    match = session.get(Match, match_id)
    if not match:
        raise ValueError(f"Match {match_id} not found")
    
    # Update bierhaler
    if new_fetcher_id is not None:
        match.beer_fetcher_id = new_fetcher_id
        match.beer_fetcher_team_id = None
    elif new_fetcher_team_id is not None:
        match.beer_fetcher_team_id = new_fetcher_team_id
        match.beer_fetcher_id = None
    else:
        # Verwijder bierhaler (wordt "Handige Peppie" in frontend)
        match.beer_fetcher_id = None
        match.beer_fetcher_team_id = None
    
    session.add(match)
    session.commit()
    session.refresh(match)
    
    return match