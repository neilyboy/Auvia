from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Artist(Base):
    __tablename__ = "artists"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    qobuz_id = Column(String(100), unique=True, nullable=True, index=True)
    image_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    albums = relationship("Album", back_populates="artist")
    tracks = relationship("Track", back_populates="artist")


class Album(Base):
    __tablename__ = "albums"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    artist_id = Column(Integer, ForeignKey("artists.id"), nullable=False)
    qobuz_id = Column(String(100), unique=True, nullable=True, index=True)
    qobuz_url = Column(Text, nullable=True)
    cover_art_url = Column(Text, nullable=True)
    cover_art_local = Column(Text, nullable=True)
    release_date = Column(String(20), nullable=True)
    genre = Column(String(100), nullable=True)
    total_tracks = Column(Integer, nullable=True)
    duration = Column(Integer, nullable=True)  # Total duration in seconds
    is_downloaded = Column(Boolean, default=False)
    download_path = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    artist = relationship("Artist", back_populates="albums")
    tracks = relationship("Track", back_populates="album")


class Track(Base):
    __tablename__ = "tracks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    artist_id = Column(Integer, ForeignKey("artists.id"), nullable=False)
    album_id = Column(Integer, ForeignKey("albums.id"), nullable=False)
    qobuz_id = Column(String(100), unique=True, nullable=True, index=True)
    track_number = Column(Integer, nullable=True)
    disc_number = Column(Integer, default=1)
    duration = Column(Integer, nullable=True)  # Duration in seconds
    file_path = Column(Text, nullable=True)
    is_downloaded = Column(Boolean, default=False)
    play_count = Column(Integer, default=0)
    last_played = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    artist = relationship("Artist", back_populates="tracks")
    album = relationship("Album", back_populates="tracks")


class PlayHistory(Base):
    __tablename__ = "play_history"
    
    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False)
    played_at = Column(DateTime(timezone=True), server_default=func.now())
    played_duration = Column(Integer, nullable=True)  # How much was played in seconds
    
    track = relationship("Track")


class QueueItem(Base):
    __tablename__ = "queue"
    
    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False)
    position = Column(Integer, nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    is_playing = Column(Boolean, default=False)
    
    track = relationship("Track")


class DownloadTask(Base):
    __tablename__ = "download_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    qobuz_url = Column(Text, nullable=False)
    album_title = Column(String(255), nullable=True)
    artist_name = Column(String(255), nullable=True)
    status = Column(String(50), default="pending")  # pending, downloading, completed, failed
    progress = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


class LikedTrack(Base):
    __tablename__ = "liked_tracks"
    
    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False, unique=True)
    liked_at = Column(DateTime(timezone=True), server_default=func.now())
    
    track = relationship("Track")


class LikedAlbum(Base):
    __tablename__ = "liked_albums"
    
    id = Column(Integer, primary_key=True, index=True)
    album_id = Column(Integer, ForeignKey("albums.id"), nullable=False, unique=True)
    liked_at = Column(DateTime(timezone=True), server_default=func.now())
    
    album = relationship("Album")
