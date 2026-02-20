import random
from sqlmodel import Session, select
from app.models.player import Player
from app.models.team import Team

def create_random_teams(tournament_id: int, player_ids: list[int], session: Session):
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    if len(players) % 2 != 0: raise ValueError("Aantal spelers moet even zijn!")
    random.shuffle(players)
    teams = []
    for i in range(0, len(players), 2):
        p1 = players[i]
        p2 = players[i+1]
        team = Team(name=f"{p1.last_name or p1.first_name} & {p2.last_name or p2.first_name}", tournament_id=tournament_id)
        team.players = [p1, p2]
        session.add(team)
        teams.append(team)
    session.commit()
    return teams

def create_manual_team(tournament_id: int, player_ids: list[int], custom_name: str | None, session: Session):
    players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    if not players: raise ValueError("Geen geldige spelers")
    name = custom_name if custom_name and custom_name.strip() else " & ".join([p.last_name or p.first_name for p in players])
    team = Team(name=name, tournament_id=tournament_id)
    team.players = players
    session.add(team)
    session.commit()
    session.refresh(team)
    return team