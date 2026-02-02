from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings

# check_same_thread=False is needed only for SQLite
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(
    settings.DATABASE_URL, 
    echo=True, # Set to False in production to reduce log noise
    connect_args=connect_args
)

def init_db():
    """
    Creates all tables defined in SQLModel models.
    Called during startup in main.py.
    """
    # Import ALL models here so SQLModel knows about them before creating tables
    # --- FIX: Added 'dartboard' and 'links' to this list ---
    from app.models import user, player, tournament, match, dartboard, links, team, scorer_auth # noqa: F401
    
    SQLModel.metadata.create_all(engine)

def get_session():
    """
    Dependency to be used in FastAPI endpoints.
    Yields a database session and closes it automatically.
    """
    with Session(engine) as session:
        yield session