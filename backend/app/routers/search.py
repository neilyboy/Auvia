from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.models.music import Album, Track, Artist
from app.schemas.music import SearchResult, AlbumResponse, TrackResponse, ArtistResponse
from app.services.qobuz import QobuzService
from app.services.cache import cache_get, cache_set

router = APIRouter(prefix="/search", tags=["Search"])

SEARCH_CACHE_TTL = 300  # 5 minutes


@router.get("", response_model=SearchResult)
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    include_remote: bool = Query(True, description="Include results from Qobuz API"),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for music across local library and Qobuz.
    Results are returned as the user types for instant feedback.
    """
    query = q.strip().lower()
    
    # Search local database
    local_albums = await search_local_albums(db, query)
    local_tracks = await search_local_tracks(db, query)
    local_artists = await search_local_artists(db, query)
    
    # Search Qobuz API for remote results (with caching)
    remote_albums = []
    remote_tracks = []
    remote_artists = []
    
    if include_remote:
        cache_key = f"search_qobuz:{query}"
        cached_results = await cache_get(cache_key)
        
        if cached_results:
            remote_albums = cached_results.get("albums", [])
            remote_tracks = cached_results.get("tracks", [])
            remote_artists = cached_results.get("artists", [])
        else:
            qobuz_service = await QobuzService.create()
            remote_results = await qobuz_service.search(query)
            remote_albums = remote_results.get("albums", [])
            remote_tracks = remote_results.get("tracks", [])
            remote_artists = remote_results.get("artists", [])
            # Cache the Qobuz results
            await cache_set(cache_key, remote_results, SEARCH_CACHE_TTL)
    
    # Merge results, prioritizing local (downloaded) content
    all_albums = merge_album_results(local_albums, remote_albums)
    all_tracks = merge_track_results(local_tracks, remote_tracks)
    all_artists = merge_artist_results(local_artists, remote_artists)
    
    return SearchResult(
        query=q,
        albums=all_albums[:20],
        tracks=all_tracks[:20],
        artists=all_artists[:10]
    )


@router.get("/albums", response_model=List[AlbumResponse])
async def search_albums(
    q: str = Query(..., min_length=1),
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Search for albums specifically"""
    query = q.strip().lower()
    
    # Local search
    local_albums = await search_local_albums(db, query, limit=limit)
    
    # Remote search
    qobuz_service = await QobuzService.create()
    remote_results = await qobuz_service.search_albums(query, limit=limit)
    
    return merge_album_results(local_albums, remote_results)[:limit]


@router.get("/tracks", response_model=List[TrackResponse])
async def search_tracks(
    q: str = Query(..., min_length=1),
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Search for tracks specifically"""
    query = q.strip().lower()
    
    # Local search
    local_tracks = await search_local_tracks(db, query, limit=limit)
    
    # Remote search
    qobuz_service = await QobuzService.create()
    remote_results = await qobuz_service.search_tracks(query, limit=limit)
    
    return merge_track_results(local_tracks, remote_results)[:limit]


@router.get("/artists", response_model=List[ArtistResponse])
async def search_artists(
    q: str = Query(..., min_length=1),
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Search for artists specifically"""
    query = q.strip().lower()
    
    # Local search
    local_artists = await search_local_artists(db, query, limit=limit)
    
    # Remote search
    qobuz_service = await QobuzService.create()
    remote_results = await qobuz_service.search_artists(query, limit=limit)
    
    return merge_artist_results(local_artists, remote_results)[:limit]


async def search_local_albums(db: AsyncSession, query: str, limit: int = 20) -> List[AlbumResponse]:
    """Search local albums database"""
    result = await db.execute(
        select(Album)
        .options(selectinload(Album.artist))
        .where(
            or_(
                Album.title.ilike(f"%{query}%"),
                Album.artist.has(Artist.name.ilike(f"%{query}%"))
            )
        )
        .limit(limit)
    )
    albums = result.scalars().all()
    
    responses = []
    for album in albums:
        # Use local cover art URL if available, fallback to remote
        cover_url = None
        if album.cover_art_local:
            cover_url = f"/api/music/cover/{album.id}"
        elif album.cover_art_url:
            cover_url = album.cover_art_url
        
        responses.append(AlbumResponse(
            id=album.id,
            title=album.title,
            artist_name=album.artist.name,
            artist_id=album.artist_id,
            qobuz_id=album.qobuz_id,
            qobuz_url=album.qobuz_url,
            cover_art_url=cover_url,
            release_date=album.release_date,
            genre=album.genre,
            total_tracks=album.total_tracks,
            is_downloaded=album.is_downloaded
        ))
    
    return responses


async def search_local_tracks(db: AsyncSession, query: str, limit: int = 20) -> List[TrackResponse]:
    """Search local tracks database"""
    result = await db.execute(
        select(Track)
        .options(selectinload(Track.artist), selectinload(Track.album))
        .where(
            or_(
                Track.title.ilike(f"%{query}%"),
                Track.artist.has(Artist.name.ilike(f"%{query}%"))
            )
        )
        .limit(limit)
    )
    tracks = result.scalars().all()
    
    responses = []
    for track in tracks:
        # Use local cover art URL if available, fallback to remote
        cover_url = None
        if track.album and track.album.cover_art_local:
            cover_url = f"/api/music/cover/{track.album.id}"
        elif track.album and track.album.cover_art_url:
            cover_url = track.album.cover_art_url
        
        responses.append(TrackResponse(
            id=track.id,
            title=track.title,
            artist_name=track.artist.name,
            album_title=track.album.title if track.album else None,
            album_id=track.album.id if track.album else None,
            qobuz_id=track.qobuz_id,
            track_number=track.track_number,
            duration=track.duration,
            is_downloaded=track.is_downloaded,
            cover_art_url=cover_url
        ))
    
    return responses


async def search_local_artists(db: AsyncSession, query: str, limit: int = 20) -> List[ArtistResponse]:
    """Search local artists database"""
    result = await db.execute(
        select(Artist)
        .where(Artist.name.ilike(f"%{query}%"))
        .limit(limit)
    )
    artists = result.scalars().all()
    
    return [ArtistResponse.model_validate(artist) for artist in artists]


def normalize_title(title: str) -> str:
    """Normalize title for comparison - lowercase, remove special chars"""
    import re
    if not title:
        return ""
    # Lowercase and remove special characters, extra spaces
    normalized = re.sub(r'[^\w\s]', '', title.lower())
    return ' '.join(normalized.split())


def get_attr(obj, key, default=None):
    """Get attribute from object or dict"""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def merge_album_results(local: List[AlbumResponse], remote) -> List[AlbumResponse]:
    """Merge local and remote album results, prioritizing local"""
    seen_qobuz_ids = set()
    seen_title_artist = set()  # For matching by title+artist when no qobuz_id
    merged = []
    
    # Add local results first (they're downloaded)
    for album in local:
        merged.append(album)
        qobuz_id = get_attr(album, 'qobuz_id')
        if qobuz_id:
            seen_qobuz_ids.add(qobuz_id)
        # Also track by normalized title+artist for matching
        key = (normalize_title(get_attr(album, 'title', '')), normalize_title(get_attr(album, 'artist_name', '')))
        seen_title_artist.add(key)
    
    # Add remote results that aren't already local
    for album in remote:
        qobuz_id = get_attr(album, 'qobuz_id')
        # Skip if we have this qobuz_id locally
        if qobuz_id and qobuz_id in seen_qobuz_ids:
            continue
        
        # Skip if we have an album with same title+artist locally
        key = (normalize_title(get_attr(album, 'title', '')), normalize_title(get_attr(album, 'artist_name', '')))
        if key in seen_title_artist:
            continue
        
        merged.append(album)
        if qobuz_id:
            seen_qobuz_ids.add(qobuz_id)
        seen_title_artist.add(key)
    
    return merged


def merge_track_results(local: List[TrackResponse], remote) -> List[TrackResponse]:
    """Merge local and remote track results, prioritizing local"""
    seen_qobuz_ids = set()
    seen_title_artist = set()  # For matching by title+artist when no qobuz_id
    merged = []
    
    for track in local:
        merged.append(track)
        qobuz_id = get_attr(track, 'qobuz_id')
        if qobuz_id:
            seen_qobuz_ids.add(qobuz_id)
        # Also track by normalized title+artist for matching
        key = (
            normalize_title(get_attr(track, 'title', '')),
            normalize_title(get_attr(track, 'artist_name', '')),
            normalize_title(get_attr(track, 'album_title', ''))
        )
        seen_title_artist.add(key)
    
    for track in remote:
        qobuz_id = get_attr(track, 'qobuz_id')
        # Skip if we have this qobuz_id locally
        if qobuz_id and qobuz_id in seen_qobuz_ids:
            continue
        
        # Skip if we have a track with same title+artist+album locally
        key = (
            normalize_title(get_attr(track, 'title', '')),
            normalize_title(get_attr(track, 'artist_name', '')),
            normalize_title(get_attr(track, 'album_title', ''))
        )
        if key in seen_title_artist:
            continue
        
        merged.append(track)
        if qobuz_id:
            seen_qobuz_ids.add(qobuz_id)
        seen_title_artist.add(key)
    
    return merged


def merge_artist_results(local: List[ArtistResponse], remote) -> List[ArtistResponse]:
    """Merge local and remote artist results, prioritizing local but using remote images"""
    seen_qobuz_ids = set()
    seen_names = set()
    merged = []
    
    # Build a map of remote artists by qobuz_id and name for image lookup
    remote_by_qobuz_id = {}
    remote_by_name = {}
    for artist in remote:
        qobuz_id = get_attr(artist, 'qobuz_id')
        name = get_attr(artist, 'name')
        image_url = get_attr(artist, 'image_url')
        if qobuz_id and image_url:
            remote_by_qobuz_id[qobuz_id] = artist
        if name and image_url:
            remote_by_name[name.lower()] = artist
    
    for artist in local:
        qobuz_id = get_attr(artist, 'qobuz_id')
        name = get_attr(artist, 'name')
        image_url = get_attr(artist, 'image_url')
        
        # If local artist has no image, try to get from remote
        if not image_url:
            remote_match = None
            if qobuz_id and qobuz_id in remote_by_qobuz_id:
                remote_match = remote_by_qobuz_id[qobuz_id]
            elif name and name.lower() in remote_by_name:
                remote_match = remote_by_name[name.lower()]
            
            if remote_match:
                # Create new ArtistResponse with remote image
                artist = ArtistResponse(
                    id=get_attr(artist, 'id'),
                    name=name,
                    qobuz_id=qobuz_id or get_attr(remote_match, 'qobuz_id'),
                    image_url=get_attr(remote_match, 'image_url'),
                    bio=get_attr(artist, 'bio') or get_attr(remote_match, 'bio')
                )
        
        merged.append(artist)
        if qobuz_id:
            seen_qobuz_ids.add(qobuz_id)
        if name:
            seen_names.add(name.lower())
    
    for artist in remote:
        qobuz_id = get_attr(artist, 'qobuz_id')
        name = get_attr(artist, 'name')
        # Skip if we already have this artist by qobuz_id or name
        if qobuz_id and qobuz_id in seen_qobuz_ids:
            continue
        if name and name.lower() in seen_names:
            continue
        merged.append(artist)
        if qobuz_id:
            seen_qobuz_ids.add(qobuz_id)
        if name:
            seen_names.add(name.lower())
    
    return merged
