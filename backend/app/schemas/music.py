from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ArtistResponse(BaseModel):
    id: Optional[int] = None
    name: str
    qobuz_id: Optional[str] = None
    image_url: Optional[str] = None
    bio: Optional[str] = None

    class Config:
        from_attributes = True


class TrackResponse(BaseModel):
    id: Optional[int] = None
    title: str
    artist_name: str
    album_title: Optional[str] = None
    album_id: Optional[int] = None
    qobuz_id: Optional[str] = None
    qobuz_album_id: Optional[str] = None
    qobuz_album_url: Optional[str] = None
    track_number: Optional[int] = None
    disc_number: Optional[int] = 1
    duration: Optional[int] = None
    duration_formatted: Optional[str] = None
    file_path: Optional[str] = None
    is_downloaded: bool = False
    play_count: int = 0
    cover_art_url: Optional[str] = None

    class Config:
        from_attributes = True


class AlbumResponse(BaseModel):
    id: Optional[int] = None
    title: str
    artist_name: str
    artist_id: Optional[int] = None
    qobuz_id: Optional[str] = None
    qobuz_url: Optional[str] = None
    cover_art_url: Optional[str] = None
    cover_art_local: Optional[str] = None
    release_date: Optional[str] = None
    genre: Optional[str] = None
    total_tracks: Optional[int] = None
    duration: Optional[int] = None
    duration_formatted: Optional[str] = None
    is_downloaded: bool = False
    tracks: List[TrackResponse] = []

    class Config:
        from_attributes = True


class SearchResult(BaseModel):
    query: str
    albums: List[AlbumResponse] = []
    tracks: List[TrackResponse] = []
    artists: List[ArtistResponse] = []


class QueueItemResponse(BaseModel):
    id: int
    track: TrackResponse
    position: int
    is_playing: bool
    added_at: datetime

    class Config:
        from_attributes = True


class PlayHistoryResponse(BaseModel):
    id: int
    track: TrackResponse
    played_at: datetime
    played_duration: Optional[int] = None

    class Config:
        from_attributes = True


class DownloadRequest(BaseModel):
    qobuz_url: str
    album_title: Optional[str] = None
    artist_name: Optional[str] = None
    track_id: Optional[str] = None  # If user wants to play a specific track after download


class DownloadTaskResponse(BaseModel):
    id: int
    qobuz_url: str
    album_title: Optional[str] = None
    artist_name: Optional[str] = None
    status: str
    progress: float
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AddToQueueRequest(BaseModel):
    track_id: Optional[int] = None
    qobuz_track_id: Optional[str] = None
    qobuz_album_url: Optional[str] = None
    track_title: Optional[str] = None  # For matching after download
    track_number: Optional[int] = None  # For matching after download
    play_next: bool = False
    play_now: bool = False


class PlayAlbumRequest(BaseModel):
    album_id: Optional[int] = None
    qobuz_album_id: Optional[str] = None
    qobuz_album_url: Optional[str] = None
    start_track: int = 1
    shuffle: bool = False


class TrendingResponse(BaseModel):
    new_releases: List[AlbumResponse] = []
    trending: List[AlbumResponse] = []
    featured: List[AlbumResponse] = []
    recently_played: List[TrackResponse] = []
    recently_added: List[AlbumResponse] = []


class LikedTrackResponse(BaseModel):
    id: int
    track: TrackResponse
    liked_at: datetime

    class Config:
        from_attributes = True


class LikedAlbumResponse(BaseModel):
    id: int
    album: AlbumResponse
    liked_at: datetime

    class Config:
        from_attributes = True


class LikeRequest(BaseModel):
    track_id: Optional[int] = None
    album_id: Optional[int] = None
