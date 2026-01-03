from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.database import Base


class AppSettings(Base):
    __tablename__ = "app_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    value_type = Column(String(20), default="string")  # string, int, bool, json
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class StorageLocation(Base):
    __tablename__ = "storage_locations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    path = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    is_primary = Column(Boolean, default=False)
    total_space = Column(String(50), nullable=True)  # Human readable
    free_space = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class QobuzConfig(Base):
    __tablename__ = "qobuz_config"
    
    id = Column(Integer, primary_key=True, index=True)
    quality = Column(Integer, default=1)  # 1: 320kbps MP3, 2: 16/44.1, 3: 24/<=96, 4: 24/>=96
    download_booklets = Column(Boolean, default=True)
    use_auth_token = Column(Boolean, default=True)
    email_or_userid = Column(String(255), nullable=True)
    password_or_token = Column(Text, nullable=True)
    app_id = Column(String(50), nullable=True)
    secrets = Column(JSON, nullable=True)  # List of secrets
    is_configured = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
