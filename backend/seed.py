# FILE: backend/seed.py
import random
import sys
import os

# Zorg dat Python de 'app' module kan vinden
sys.path.append(os.path.join(os.path.dirname(__file__), "."))

from sqlmodel import Session, select, delete
from app.db.session import engine, init_db
from app.models.user import User
from app.models.player import Player
from app.models.dartboard import Dartboard
from app.models.tournament import Tournament
from app.models.match import Match
from app.core.security import get_password_hash
from app.services.tournament_gen import generate_poule_phase

def create_admin(session: Session):
    print("--- Admin aanmaken ---")
    # Check of admin al bestaat om dubbelen te voorkomen
    existing = session.exec(select(User).where(User.email == "luukderooij@gmail.com")).first()
    if existing:
        print("Admin bestaat al, slaan over.")
        return existing

    admin = User(
        first_name="Luuk",
        last_name="de Rooij",
        email="luukderooij@gmail.com",
        hashed_password=get_password_hash("lderooij")
    )
    session.add(admin)
    session.commit()
    session.refresh(admin)
    print(f"Admin aangemaakt: {admin.email}")
    return admin

def create_players(session: Session, admin_id: int):
    print("--- 16 Spelers aanmaken ---")
    player_data = [
        ("Luke", "Littler", "The Nuke"),
        ("Michael", "van Gerwen", "MvG"),
        ("Luke", "Humphries", "Cool Hand Luke"),
        ("Gerwyn", "Price", "The Iceman"),
        ("Michael", "Smith", "Bully Boy"),
        ("Nathan", "Aspinall", "The Asp"),
        ("Peter", "Wright", "Snakebite"),
        ("Rob", "Cross", "Voltage"),
        ("Raymond", "van Barneveld", "Barney"),
        ("Dirk", "van Duijvenbode", "Aubergenius"),
        ("Danny", "Noppert", "The Freeze"),
        ("Gian", "van Veen", "GVV"),
        ("Vincent", "van der Voort", "The Dutch Destroyer"),
        ("Dimitri", "Van den Bergh", "The Dreammaker"),
        ("Stephen", "Bunting", "The Bullet"),
        ("Dave", "Chisnall", "Chizzy")
    ]

    players = []
    for first, last, nick in player_data:
        # Check bestaan
        existing = session.exec(select(Player).where(Player.nickname == nick)).first()
        if existing:
            players.append(existing)
            continue
            
        p = Player(
            first_name=first,
            last_name=last,
            nickname=nick,
            email=f"{first.lower()}.{last.lower().replace(' ', '')}@example.com",
            user_id=admin_id
        )
        session.add(p)
        players.append(p)
    
    session.commit()
    for p in players:
        session.refresh(p)
    print(f"{len(players)} spelers klaar.")
    return players

def create_boards(session: Session):
    print("--- 4 Borden aanmaken ---")
    board_data = [
        (1, "Main Stage"),
        (2, "Practice Area"),
        (3, "Bar Area"),
        (4, "VIP Room")
    ]
    
    boards = []
    for num, name in board_data:
        existing = session.exec(select(Dartboard).where(Dartboard.number == num)).first()
        if existing:
            boards.append(existing)
            continue

        b = Dartboard(name=name, number=num)
        session.add(b)
        boards.append(b)
    
    session.commit()
    for b in boards:
        session.refresh(b)
    print(f"{len(boards)} borden klaar.")
    return boards

def simulate_match_scores(session: Session, tournament_id: int, legs_to_win: int):
    """Vult willekeurige scores in voor alle wedstrijden in een toernooi"""
    matches = session.exec(select(Match).where(Match.tournament_id == tournament_id)).all()
    
    print(f"  > Simuleren van {len(matches)} wedstrijden...")
    
    for match in matches:
        if match.is_completed:
            continue
            
        # Simuleer een winnaar
        loser_score = random.randint(0, legs_to_win - 1)
        
        if random.random() > 0.5:
            match.score_p1 = legs_to_win
            match.score_p2 = loser_score
        else:
            match.score_p1 = loser_score
            match.score_p2 = legs_to_win
            
        match.is_completed = True
        session.add(match)
    
    session.commit()

def create_tournament_1(session: Session, user: User, players: list, boards: list):
    print("\n--- Toernooi 1: De Kleine Cup (1 Poule) ---")
    # Settings
    t = Tournament(
        name="De Kleine Cup",
        date="2024-05-20",
        format="hybrid",
        number_of_poules=1,
        qualifiers_per_poule=2,
        starting_legs_group=3, # First to 2
        starting_legs_ko=5,
        allow_byes=True,       # <--- TOEGEVOEGD
        user_id=user.id,
        status="active"
    )
    
    # Koppel 4 willekeurige spelers en 1 bord
    t.players = players[:4]
    t.boards = [boards[0]] 
    
    session.add(t)
    session.commit()
    session.refresh(t)
    
    # Genereer wedstrijden
    generate_poule_phase(
        tournament_id=t.id,
        players=t.players,
        num_poules=t.number_of_poules,
        legs_best_of=t.starting_legs_group,
        sets_best_of=t.sets_per_match,
        session=session
    )
    
    # Vul de scores in
    legs_needed = (t.starting_legs_group // 2) + 1
    simulate_match_scores(session, t.id, legs_needed)
    print("Toernooi 1 aangemaakt en gespeeld.")

def create_tournament_2(session: Session, user: User, players: list, boards: list):
    print("\n--- Toernooi 2: Het Grote Kampioenschap (2 Poules) ---")
    # Settings
    t = Tournament(
        name="Het Grote Kampioenschap",
        date="2024-06-15",
        format="hybrid",
        number_of_poules=2,
        qualifiers_per_poule=2,
        starting_legs_group=5, # First to 3
        starting_legs_ko=7,    # First to 4
        allow_byes=True,       # <--- TOEGEVOEGD
        user_id=user.id,
        status="active"
    )
    
    # Koppel 9 spelers en alle borden
    t.players = players[:9]
    t.boards = boards
    
    session.add(t)
    session.commit()
    session.refresh(t)
    
    # Genereer wedstrijden
    generate_poule_phase(
        tournament_id=t.id,
        players=t.players,
        num_poules=t.number_of_poules,
        legs_best_of=t.starting_legs_group,
        sets_best_of=t.sets_per_match,
        session=session
    )
    
    # Vul de scores in
    legs_needed = (t.starting_legs_group // 2) + 1
    simulate_match_scores(session, t.id, legs_needed)
    print("Toernooi 2 aangemaakt en gespeeld.")

def main():
    print("Start seeding database...")
    init_db() # Zorgt dat tabellen bestaan
    
    with Session(engine) as session:
        # 1. Admin
        admin = create_admin(session)
        
        # 2. Spelers
        players = create_players(session, admin.id)
        
        # 3. Borden
        boards = create_boards(session)
        
        # 4. Toernooi 1
        create_tournament_1(session, admin, players, boards)
        
        # 5. Toernooi 2
        create_tournament_2(session, admin, players, boards)
        
        # Print statements BINNEN de sessie
        print("\n=== SEEDING SUCCESVOL ===")
        print(f"Gebruiker: {admin.email}")
        print(f"Wachtwoord: lderooij")

if __name__ == "__main__":
    main()