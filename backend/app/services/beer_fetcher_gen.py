"""
Beer Fetcher Generation Logic
Assigns beer fetchers to matches based on availability (players not playing or refereeing)
"""

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


def assign_beer_fetchers_to_tournament(
    session: Session,
    tournament_id: int
) -> None:
    """
    Hoofdfunctie: Wijst bierhalers toe aan ALLE rondes in een toernooi.
    
    Deze functie wordt aangeroepen na het genereren van matches en schrijvers.
    
    Args:
        session: Database sessie
        tournament_id: ID van het toernooi
    """
    # Haal tournament op
    tournament = session.get(Tournament, tournament_id)
    if not tournament:
        raise ValueError(f"Tournament {tournament_id} not found")
    
    # Check of bierhaler functie is ingeschakeld
    if not tournament.enable_beer_fetchers:
        print(f"ℹ️  Bierhaler functie is uitgeschakeld voor toernooi '{tournament.name}'")
        return
    
    print(f"\n🍺 === BIERHALER TOEWIJZING START ===")
    print(f"Toernooi: {tournament.name}")
    print(f"Mode: {tournament.mode}")
    
    # Haal alle matches op
    all_matches = session.exec(
        select(Match)
        .where(Match.tournament_id == tournament_id)
        .order_by(Match.round_number, Match.id)
    ).all()
    
    if not all_matches:
        print("⚠️  Geen matches gevonden om bierhalers aan toe te wijzen")
        return
    
    # Haal alle deelnemers op
    if tournament.mode == "singles":
        # Voor singles: alle players die aan dit tournament gekoppeld zijn
        player_ids = set()
        for match in all_matches:
            if match.player1_id:
                player_ids.add(match.player1_id)
            if match.player2_id:
                player_ids.add(match.player2_id)
        
        all_players = session.exec(
            select(Player).where(Player.id.in_(player_ids))
        ).all()
        participants = list(all_players)
    else:  # doubles
        # Voor doubles: alle teams
        team_ids = set()
        for match in all_matches:
            if match.team1_id:
                team_ids.add(match.team1_id)
            if match.team2_id:
                team_ids.add(match.team2_id)
        
        all_teams = session.exec(
            select(Team).where(Team.id.in_(team_ids))
        ).all()
        participants = list(all_teams)
    
    print(f"Aantal deelnemers: {len(participants)}")
    
    # Groepeer matches per ronde
    rounds_dict = {}
    for match in all_matches:
        if match.round_number not in rounds_dict:
            rounds_dict[match.round_number] = []
        rounds_dict[match.round_number].append(match)
    
    # Wijs bierhalers toe per ronde
    for round_num in sorted(rounds_dict.keys()):
        round_matches = rounds_dict[round_num]
        
        assign_beer_fetchers_to_round(
            session=session,
            tournament_id=tournament_id,
            round_number=round_num,
            round_matches=round_matches,
            all_players_or_teams=participants,
            mode=tournament.mode
        )
    
    print(f"🍺 === BIERHALER TOEWIJZING VOLTOOID ===\n")


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