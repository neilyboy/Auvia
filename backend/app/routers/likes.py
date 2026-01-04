from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.models.music import Track, Album, LikedTrack, LikedAlbum
from app.schemas.music import TrackResponse, AlbumResponse, LikedTrackResponse, LikedAlbumResponse

router = APIRouter(prefix="/likes", tags=["likes"])


def format_duration(seconds: int) -> str:
    if not seconds:
        return "0:00"
    mins = seconds // 60
    secs = seconds % 60
    return f"{mins}:{secs:02d}"


@router.get("/tracks", response_model=List[TrackResponse])
async def get_liked_tracks(db: AsyncSession = Depends(get_db)):
    """Get all liked tracks"""
    result = await db.execute(
        select(LikedTrack)
        .options(
            selectinload(LikedTrack.track).selectinload(Track.album),
            selectinload(LikedTrack.track).selectinload(Track.artist)
        )
        .order_by(desc(LikedTrack.liked_at))
    )
    liked = result.scalars().all()
    
    return [
        TrackResponse(
            id=item.track.id,
            title=item.track.title,
            artist_name=item.track.artist.name,
            album_title=item.track.album.title,
            album_id=item.track.album_id,
            qobuz_id=item.track.qobuz_id,
            track_number=item.track.track_number,
            disc_number=item.track.disc_number,
            duration=item.track.duration,
            duration_formatted=format_duration(item.track.duration),
            file_path=item.track.file_path,
            is_downloaded=item.track.is_downloaded,
            play_count=item.track.play_count,
            cover_art_url=item.track.album.cover_art_url
        )
        for item in liked
    ]


@router.get("/albums", response_model=List[AlbumResponse])
async def get_liked_albums(db: AsyncSession = Depends(get_db)):
    """Get all liked albums"""
    result = await db.execute(
        select(LikedAlbum)
        .options(
            selectinload(LikedAlbum.album).selectinload(Album.artist)
        )
        .order_by(desc(LikedAlbum.liked_at))
    )
    liked = result.scalars().all()
    
    return [
        AlbumResponse(
            id=item.album.id,
            title=item.album.title,
            artist_name=item.album.artist.name,
            artist_id=item.album.artist_id,
            qobuz_id=item.album.qobuz_id,
            qobuz_url=item.album.qobuz_url,
            cover_art_url=item.album.cover_art_url,
            release_date=item.album.release_date,
            genre=item.album.genre,
            total_tracks=item.album.total_tracks,
            duration=item.album.duration,
            is_downloaded=item.album.is_downloaded
        )
        for item in liked
    ]


@router.post("/track/{track_id}")
async def like_track(track_id: int, db: AsyncSession = Depends(get_db)):
    """Like a track"""
    # Check if track exists
    result = await db.execute(select(Track).where(Track.id == track_id))
    track = result.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    # Check if already liked
    result = await db.execute(
        select(LikedTrack).where(LikedTrack.track_id == track_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {"status": "already_liked", "track_id": track_id}
    
    # Add to liked
    liked = LikedTrack(track_id=track_id)
    db.add(liked)
    await db.commit()
    
    return {"status": "liked", "track_id": track_id}


@router.delete("/track/{track_id}")
async def unlike_track(track_id: int, db: AsyncSession = Depends(get_db)):
    """Unlike a track"""
    result = await db.execute(
        select(LikedTrack).where(LikedTrack.track_id == track_id)
    )
    liked = result.scalar_one_or_none()
    
    if not liked:
        return {"status": "not_liked", "track_id": track_id}
    
    await db.delete(liked)
    await db.commit()
    
    return {"status": "unliked", "track_id": track_id}


@router.get("/track/{track_id}/status")
async def get_track_like_status(track_id: int, db: AsyncSession = Depends(get_db)):
    """Check if a track is liked"""
    result = await db.execute(
        select(LikedTrack).where(LikedTrack.track_id == track_id)
    )
    liked = result.scalar_one_or_none()
    
    return {"track_id": track_id, "is_liked": liked is not None}


@router.post("/album/{album_id}")
async def like_album(album_id: int, db: AsyncSession = Depends(get_db)):
    """Like an album"""
    # Check if album exists
    result = await db.execute(select(Album).where(Album.id == album_id))
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Check if already liked
    result = await db.execute(
        select(LikedAlbum).where(LikedAlbum.album_id == album_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {"status": "already_liked", "album_id": album_id}
    
    # Add to liked
    liked = LikedAlbum(album_id=album_id)
    db.add(liked)
    await db.commit()
    
    return {"status": "liked", "album_id": album_id}


@router.delete("/album/{album_id}")
async def unlike_album(album_id: int, db: AsyncSession = Depends(get_db)):
    """Unlike an album"""
    result = await db.execute(
        select(LikedAlbum).where(LikedAlbum.album_id == album_id)
    )
    liked = result.scalar_one_or_none()
    
    if not liked:
        return {"status": "not_liked", "album_id": album_id}
    
    await db.delete(liked)
    await db.commit()
    
    return {"status": "unliked", "album_id": album_id}


@router.get("/album/{album_id}/status")
async def get_album_like_status(album_id: int, db: AsyncSession = Depends(get_db)):
    """Check if an album is liked"""
    result = await db.execute(
        select(LikedAlbum).where(LikedAlbum.album_id == album_id)
    )
    liked = result.scalar_one_or_none()
    
    return {"album_id": album_id, "is_liked": liked is not None}


@router.get("/tracks/ids")
async def get_liked_track_ids(db: AsyncSession = Depends(get_db)):
    """Get all liked track IDs (for efficient UI updates)"""
    result = await db.execute(select(LikedTrack.track_id))
    ids = result.scalars().all()
    return {"track_ids": list(ids)}


@router.get("/albums/ids")
async def get_liked_album_ids(db: AsyncSession = Depends(get_db)):
    """Get all liked album IDs (for efficient UI updates)"""
    result = await db.execute(select(LikedAlbum.album_id))
    ids = result.scalars().all()
    return {"album_ids": list(ids)}
