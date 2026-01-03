from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://auvia:auvia_secret@localhost:5432/auvia"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # Security
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    
    # Music Storage
    music_storage_path: str = "/music"
    
    # App Info
    app_name: str = "Auvia"
    app_tagline: str = "Set the Atmosphere"
    
    class Config:
        env_file = ".env"


settings = Settings()
