from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Application Info
    PROJECT_NAME: str = "Dart Tournament Manager"
    
    # Database
    # Default to SQLite for dev, but ready for Postgres
    DATABASE_URL: str = "sqlite:///./darts.db"
    
    # Security
    # In production, this should be a long, random string!
    SECRET_KEY: str = "change_this_secret_in_production_9823749823"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()