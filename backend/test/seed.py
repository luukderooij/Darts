import sys
import os

# --- PATH FIX: Add the parent directory to Python's path ---
# This gets the folder where this script is running (backend/test)
current_dir = os.path.dirname(os.path.abspath(__file__))
# This gets the parent folder (backend)
parent_dir = os.path.dirname(current_dir)
# This adds 'backend' to the places Python looks for code
sys.path.append(parent_dir)
# -----------------------------------------------------------

from sqlmodel import Session, select
from app.db.session import engine, init_db
from app.models.user import User
from app.models.player import Player
from app.models.dartboard import Dartboard
from app.core.security import get_password_hash

def seed_data():
    print(f"🌱 Seeding database...")
    
    # 1. Ensure tables exist
    init_db()

    with Session(engine) as session:
        # --- Create Admin User ---
        existing_user = session.exec(select(User).where(User.email == "admin@admin.com")).first()
        
        if not existing_user:
            print("Creating Admin User...")
            admin_user = User(
                email="admin@admin.com",
                first_name="Admin",
                last_name="User",
                hashed_password=get_password_hash("admin123")
            )
            session.add(admin_user)
            session.commit()
            session.refresh(admin_user)
            user_id = admin_user.id
        else:
            print("Admin User already exists.")
            user_id = existing_user.id

        # --- Create Boards ---
        if not session.exec(select(Dartboard)).first():
            print("Creating Boards...")
            boards = [
                Dartboard(name="Main Stage", number=1),
                Dartboard(name="Practice Board", number=2),
                Dartboard(name="Bar Area", number=3),
                Dartboard(name="VIP Room", number=4),
            ]
            for b in boards:
                session.add(b)

        # --- Create Players ---
        if not session.exec(select(Player)).first():
            print("Creating Players...")
            players = [
                Player(first_name="Luke", last_name="Littler", nickname="The Nuke", email="luke@darts.com", user_id=user_id),
                Player(first_name="Michael", last_name="van Gerwen", nickname="Mighty Mike", email="mvg@darts.com", user_id=user_id),
                Player(first_name="Luke", last_name="Humphries", nickname="Cool Hand", email="coolhand@darts.com", user_id=user_id),
                Player(first_name="Gerwyn", last_name="Price", nickname="The Iceman", email="iceman@darts.com", user_id=user_id),
                Player(first_name="Michael", last_name="Smith", nickname="Bully Boy", email="bully@darts.com", user_id=user_id),
                Player(first_name="Peter", last_name="Wright", nickname="Snakebite", email="snake@darts.com", user_id=user_id),
                Player(first_name="Nathan", last_name="Aspinall", nickname="The Asp", email="asp@darts.com", user_id=user_id),
                Player(first_name="Rob", last_name="Cross", nickname="Voltage", email="voltage@darts.com", user_id=user_id),
            ]
            for p in players:
                session.add(p)

        session.commit()
        print("✅ Database populated successfully!")

if __name__ == "__main__":
    seed_data()