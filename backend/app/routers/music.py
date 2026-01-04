from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse, StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional
import os
import aiofiles

from app.database import get_db
from app.models.music import Album, Track, Artist, PlayHistory
from app.models.settings import AppSettings
from app.schemas.music import (
    AlbumResponse, TrackResponse, ArtistResponse, 
    PlayHistoryResponse, TrendingResponse
)
from app.services.music import MusicService
from app.services.qobuz import QobuzService
from app.services.streamrip import StreamripService

router = APIRouter(prefix="/music", tags=["Music"])


@router.get("/trending", response_model=TrendingResponse)
async def get_trending(db: AsyncSession = Depends(get_db)):
    """Get trending, new releases, and recently played music"""
    qobuz_service = await QobuzService.create()
    music_service = MusicService(db)
    
    # Get trending from Qobuz API
    trending_data = await qobuz_service.get_trending()
    
    # Get recently played from local DB
    recently_played = await music_service.get_recently_played(limit=20)
    
    # Get recently added albums
    recently_added = await music_service.get_recently_added_albums(limit=10)
    
    return TrendingResponse(
        new_releases=trending_data.get("new_releases", []),
        trending=trending_data.get("trending", []),
        featured=trending_data.get("featured", []),
        recently_played=recently_played,
        recently_added=recently_added
    )


@router.get("/albums", response_model=List[AlbumResponse])
async def get_albums(
    page: int = 1,
    limit: int = 20,
    downloaded_only: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Get all albums with optional filtering"""
    query = select(Album).options(selectinload(Album.artist))
    
    if downloaded_only:
        query = query.where(Album.is_downloaded == True)
    
    query = query.order_by(desc(Album.created_at))
    query = query.offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(query)
    albums = result.scalars().all()
    
    def get_qobuz_url(album):
        """Construct qobuz_url from qobuz_id if not present"""
        if album.qobuz_url:
            return album.qobuz_url
        if album.qobuz_id:
            return f"https://www.qobuz.com/us-en/album/-/{album.qobuz_id}"
        return None
    
    return [
        AlbumResponse(
            id=album.id,
            title=album.title,
            artist_name=album.artist.name,
            artist_id=album.artist_id,
            qobuz_id=album.qobuz_id,
            qobuz_url=get_qobuz_url(album),
            cover_art_url=album.cover_art_url,
            cover_art_local=album.cover_art_local,
            release_date=album.release_date,
            genre=album.genre,
            total_tracks=album.total_tracks,
            duration=album.duration,
            is_downloaded=album.is_downloaded
        )
        for album in albums
    ]


@router.get("/albums/by-qobuz/{qobuz_id}")
async def get_album_by_qobuz_id(
    qobuz_id: str, 
    title: str = None,
    artist: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Get album by Qobuz ID - used for polling after download"""
    import re
    
    def normalize(s):
        if not s:
            return ""
        return ' '.join(re.sub(r'[^\w\s]', '', s.lower()).split())
    
    # First trigger a quick scan to pick up newly downloaded files
    music_service = MusicService(db)
    await music_service.scan_directory("/music")
    
    # Try to find by qobuz_id first
    result = await db.execute(
        select(Album)
        .options(selectinload(Album.artist), selectinload(Album.tracks))
        .where(Album.qobuz_id == qobuz_id)
    )
    album = result.scalar_one_or_none()
    
    # If not found by qobuz_id and we have title+artist, try matching by those
    if not album and title and artist:
        result = await db.execute(
            select(Album)
            .options(selectinload(Album.artist), selectinload(Album.tracks))
            .where(Album.is_downloaded == True)
        )
        all_albums = result.scalars().all()
        
        norm_title = normalize(title)
        norm_artist = normalize(artist)
        
        for a in all_albums:
            if normalize(a.title) == norm_title and normalize(a.artist.name) == norm_artist:
                album = a
                # Update the qobuz_id for future lookups
                album.qobuz_id = qobuz_id
                await db.commit()
                break
    
    if not album:
        return {"found": False, "album": None}
    
    tracks = [
        TrackResponse(
            id=track.id,
            title=track.title,
            artist_name=album.artist.name,
            album_title=album.title,
            album_id=album.id,
            qobuz_id=track.qobuz_id,
            track_number=track.track_number,
            disc_number=track.disc_number,
            duration=track.duration,
            duration_formatted=format_duration(track.duration),
            file_path=track.file_path,
            is_downloaded=track.is_downloaded,
            play_count=track.play_count,
            cover_art_url=album.cover_art_url
        )
        for track in sorted(album.tracks, key=lambda t: (t.disc_number or 1, t.track_number or 0))
    ]
    
    # Construct qobuz_url from qobuz_id if not present
    qobuz_url = album.qobuz_url
    if not qobuz_url and album.qobuz_id:
        qobuz_url = f"https://www.qobuz.com/us-en/album/-/{album.qobuz_id}"
    
    return {
        "found": True,
        "album": AlbumResponse(
            id=album.id,
            title=album.title,
            artist_name=album.artist.name,
            artist_id=album.artist_id,
            qobuz_id=album.qobuz_id,
            qobuz_url=qobuz_url,
            cover_art_url=album.cover_art_url,
            cover_art_local=album.cover_art_local,
            release_date=album.release_date,
            genre=album.genre,
            total_tracks=album.total_tracks,
            duration=album.duration,
            duration_formatted=format_duration(album.duration),
            is_downloaded=album.is_downloaded,
            tracks=tracks
        )
    }


@router.get("/albums/{album_id}", response_model=AlbumResponse)
async def get_album(album_id: int, db: AsyncSession = Depends(get_db)):
    """Get album details with tracks"""
    result = await db.execute(
        select(Album)
        .options(selectinload(Album.artist), selectinload(Album.tracks))
        .where(Album.id == album_id)
    )
    album = result.scalar_one_or_none()
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    tracks = [
        TrackResponse(
            id=track.id,
            title=track.title,
            artist_name=album.artist.name,
            album_title=album.title,
            album_id=album.id,
            qobuz_id=track.qobuz_id,
            track_number=track.track_number,
            disc_number=track.disc_number,
            duration=track.duration,
            duration_formatted=format_duration(track.duration),
            file_path=track.file_path,
            is_downloaded=track.is_downloaded,
            play_count=track.play_count,
            cover_art_url=album.cover_art_url
        )
        for track in sorted(album.tracks, key=lambda t: (t.disc_number or 1, t.track_number or 0))
    ]
    
    # Construct qobuz_url from qobuz_id if not present
    qobuz_url = album.qobuz_url
    if not qobuz_url and album.qobuz_id:
        qobuz_url = f"https://www.qobuz.com/us-en/album/-/{album.qobuz_id}"
    
    return AlbumResponse(
        id=album.id,
        title=album.title,
        artist_name=album.artist.name,
        artist_id=album.artist_id,
        qobuz_id=album.qobuz_id,
        qobuz_url=qobuz_url,
        cover_art_url=album.cover_art_url,
        cover_art_local=album.cover_art_local,
        release_date=album.release_date,
        genre=album.genre,
        total_tracks=album.total_tracks,
        duration=album.duration,
        duration_formatted=format_duration(album.duration),
        is_downloaded=album.is_downloaded,
        tracks=tracks
    )


@router.get("/tracks/{track_id}", response_model=TrackResponse)
async def get_track(track_id: int, db: AsyncSession = Depends(get_db)):
    """Get track details"""
    result = await db.execute(
        select(Track)
        .options(selectinload(Track.artist), selectinload(Track.album))
        .where(Track.id == track_id)
    )
    track = result.scalar_one_or_none()
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    return TrackResponse(
        id=track.id,
        title=track.title,
        artist_name=track.artist.name,
        album_title=track.album.title,
        qobuz_id=track.qobuz_id,
        track_number=track.track_number,
        disc_number=track.disc_number,
        duration=track.duration,
        duration_formatted=format_duration(track.duration),
        file_path=track.file_path,
        is_downloaded=track.is_downloaded,
        play_count=track.play_count,
        cover_art_url=track.album.cover_art_url
    )


@router.get("/tracks/{track_id}/stream")
async def stream_track(track_id: int, db: AsyncSession = Depends(get_db)):
    """Stream a downloaded track"""
    result = await db.execute(
        select(Track).where(Track.id == track_id)
    )
    track = result.scalar_one_or_none()
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    if not track.is_downloaded or not track.file_path:
        raise HTTPException(status_code=404, detail="Track not downloaded")
    
    if not os.path.exists(track.file_path):
        raise HTTPException(status_code=404, detail="Track file not found")
    
    # Get file extension and mime type
    ext = os.path.splitext(track.file_path)[1].lower()
    mime_types = {
        ".mp3": "audio/mpeg",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg"
    }
    mime_type = mime_types.get(ext, "audio/mpeg")
    
    return FileResponse(
        track.file_path,
        media_type=mime_type,
        filename=f"{track.title}{ext}"
    )


@router.get("/albums/qobuz/{qobuz_id}", response_model=AlbumResponse)
async def get_qobuz_album(qobuz_id: str):
    """Get album details including tracks from Qobuz API"""
    qobuz_service = await QobuzService.create()
    album = await qobuz_service.get_album(qobuz_id)
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found on Qobuz")
    
    return album


@router.get("/artists", response_model=List[ArtistResponse])
async def get_artists(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Get all artists"""
    query = select(Artist).order_by(Artist.name)
    query = query.offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(query)
    artists = result.scalars().all()
    
    return [ArtistResponse.model_validate(artist) for artist in artists]


@router.get("/artists/{artist_id}", response_model=ArtistResponse)
async def get_artist(artist_id: int, db: AsyncSession = Depends(get_db)):
    """Get artist details"""
    result = await db.execute(
        select(Artist).where(Artist.id == artist_id)
    )
    artist = result.scalar_one_or_none()
    
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")
    
    return ArtistResponse.model_validate(artist)


@router.get("/artists/{artist_id}/albums", response_model=List[AlbumResponse])
async def get_artist_albums(artist_id: int, db: AsyncSession = Depends(get_db)):
    """Get all albums by an artist"""
    result = await db.execute(
        select(Album)
        .options(selectinload(Album.artist))
        .where(Album.artist_id == artist_id)
        .order_by(desc(Album.release_date))
    )
    albums = result.scalars().all()
    
    return [
        AlbumResponse(
            id=album.id,
            title=album.title,
            artist_name=album.artist.name,
            artist_id=album.artist_id,
            qobuz_id=album.qobuz_id,
            qobuz_url=album.qobuz_url,
            cover_art_url=album.cover_art_url,
            release_date=album.release_date,
            genre=album.genre,
            total_tracks=album.total_tracks,
            is_downloaded=album.is_downloaded
        )
        for album in albums
    ]


@router.post("/history/{track_id}")
async def record_play(track_id: int, db: AsyncSession = Depends(get_db)):
    """Record that a track was played"""
    # Verify track exists
    result = await db.execute(select(Track).where(Track.id == track_id))
    track = result.scalar_one_or_none()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    # Update track play count and last played
    track.play_count = (track.play_count or 0) + 1
    track.last_played = func.now()
    
    # Add to play history
    history = PlayHistory(track_id=track_id)
    db.add(history)
    await db.commit()
    
    return {"status": "recorded", "track_id": track_id, "play_count": track.play_count}


@router.get("/history", response_model=List[PlayHistoryResponse])
async def get_play_history(
    page: int = 1,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get play history"""
    result = await db.execute(
        select(PlayHistory)
        .options(
            selectinload(PlayHistory.track).selectinload(Track.artist),
            selectinload(PlayHistory.track).selectinload(Track.album)
        )
        .order_by(desc(PlayHistory.played_at))
        .offset((page - 1) * limit)
        .limit(limit)
    )
    history = result.scalars().all()
    
    return [
        PlayHistoryResponse(
            id=item.id,
            track=TrackResponse(
                id=item.track.id,
                title=item.track.title,
                artist_name=item.track.artist.name,
                album_title=item.track.album.title,
                duration=item.track.duration,
                duration_formatted=format_duration(item.track.duration),
                is_downloaded=item.track.is_downloaded,
                cover_art_url=item.track.album.cover_art_url
            ),
            played_at=item.played_at,
            played_duration=item.played_duration
        )
        for item in history
    ]


def format_duration(seconds: Optional[int]) -> str:
    """Format duration in seconds to MM:SS or HH:MM:SS"""
    if not seconds:
        return "0:00"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


@router.post("/scan")
async def scan_library(db: AsyncSession = Depends(get_db)):
    """Scan music directories and update database"""
    from app.models.settings import StorageLocation
    
    music_service = MusicService(db)
    total_stats = {"albums": 0, "tracks": 0, "errors": 0}
    
    # Scan all active storage locations
    result = await db.execute(
        select(StorageLocation).where(StorageLocation.is_active == True)
    )
    locations = result.scalars().all()
    
    # Also scan default /music directory
    paths_to_scan = ["/music"]
    for loc in locations:
        if loc.path not in paths_to_scan:
            paths_to_scan.append(loc.path)
    
    for path in paths_to_scan:
        if os.path.exists(path):
            stats = await music_service.scan_directory(path)
            total_stats["albums"] += stats["albums"]
            total_stats["tracks"] += stats["tracks"]
            total_stats["errors"] += stats["errors"]
    
    return {"message": "Scan complete", "stats": total_stats}


@router.post("/verify")
async def verify_local_files(db: AsyncSession = Depends(get_db)):
    """Verify all downloaded files exist and update database for missing ones"""
    music_service = MusicService(db)
    stats = await music_service.verify_local_files()
    return {"message": "Verification complete", "stats": stats}


@router.get("/track/{track_id}/check")
async def check_track_availability(track_id: int, db: AsyncSession = Depends(get_db)):
    """Check if a track is available locally, triggers re-download if missing"""
    music_service = MusicService(db)
    return await music_service.check_track_availability(track_id)


@router.get("/cover/{album_id}")
async def get_album_cover(
    album_id: int, 
    size: int = None,  # Optional size (e.g., 300 for 300x300)
    format: str = None,  # Optional format: 'webp' or 'jpeg'
    db: AsyncSession = Depends(get_db)
):
    """Serve local album cover art with optional resizing and format conversion"""
    from PIL import Image
    from io import BytesIO
    
    result = await db.execute(
        select(Album).where(Album.id == album_id)
    )
    album = result.scalar_one_or_none()
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Find cover art path
    cover_path = None
    
    # Try local cover art first
    if album.cover_art_local and os.path.exists(album.cover_art_local):
        cover_path = album.cover_art_local
    else:
        # Fall back to download path + cover.jpg
        cover_names = ['cover.jpg', 'cover.jpeg', 'cover.png', 'folder.jpg', 'front.jpg']
        if album.download_path:
            # Check in download path
            for cover_name in cover_names:
                path = os.path.join(album.download_path, cover_name)
                if os.path.exists(path):
                    cover_path = path
                    album.cover_art_local = path
                    await db.commit()
                    break
            
            # For multi-disc albums, check parent directory
            if not cover_path:
                parent_dir = os.path.dirname(album.download_path)
                if parent_dir:
                    for cover_name in cover_names:
                        path = os.path.join(parent_dir, cover_name)
                        if os.path.exists(path):
                            cover_path = path
                            album.cover_art_local = path
                            await db.commit()
                            break
    
    if not cover_path:
        raise HTTPException(status_code=404, detail="Cover art not found")
    
    # If no optimization requested, serve original file
    if not size and not format:
        return FileResponse(
            cover_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"}
        )
    
    # Optimize the image
    try:
        # Check for cached optimized version
        cache_dir = "/tmp/auvia_cover_cache"
        os.makedirs(cache_dir, exist_ok=True)
        
        size_str = str(size) if size else "orig"
        fmt = format.lower() if format else "jpeg"
        if fmt not in ['webp', 'jpeg', 'jpg']:
            fmt = 'jpeg'
        if fmt == 'jpg':
            fmt = 'jpeg'
            
        cache_key = f"{album_id}_{size_str}_{fmt}"
        cache_path = os.path.join(cache_dir, f"{cache_key}.{fmt if fmt != 'jpeg' else 'jpg'}")
        
        # Return cached version if exists and newer than original
        if os.path.exists(cache_path):
            cache_mtime = os.path.getmtime(cache_path)
            orig_mtime = os.path.getmtime(cover_path)
            if cache_mtime > orig_mtime:
                media_type = "image/webp" if fmt == "webp" else "image/jpeg"
                return FileResponse(
                    cache_path,
                    media_type=media_type,
                    headers={"Cache-Control": "public, max-age=86400"}
                )
        
        # Process image
        with Image.open(cover_path) as img:
            # Convert to RGB if necessary (for PNG with transparency)
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            # Resize if size specified
            if size:
                # Maintain aspect ratio, fit within size x size
                img.thumbnail((size, size), Image.Resampling.LANCZOS)
            
            # Save to buffer
            buffer = BytesIO()
            if fmt == 'webp':
                img.save(buffer, format='WEBP', quality=85, method=4)
                media_type = "image/webp"
            else:
                img.save(buffer, format='JPEG', quality=85, optimize=True)
                media_type = "image/jpeg"
            
            # Cache the result
            buffer.seek(0)
            with open(cache_path, 'wb') as f:
                f.write(buffer.read())
            
            buffer.seek(0)
            return Response(
                content=buffer.read(),
                media_type=media_type,
                headers={"Cache-Control": "public, max-age=86400"}
            )
    except Exception as e:
        # Fall back to original file on error
        print(f"Cover optimization error: {e}")
        return FileResponse(
            cover_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"}
        )


@router.get("/stream/{track_id}")
async def stream_track(
    track_id: int, 
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Stream a local audio file with range request support"""
    result = await db.execute(
        select(Track).where(Track.id == track_id)
    )
    track = result.scalar_one_or_none()
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    if not track.file_path or not os.path.exists(track.file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    # Determine media type
    ext = os.path.splitext(track.file_path)[1].lower()
    media_types = {
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav'
    }
    media_type = media_types.get(ext, 'audio/mpeg')
    
    file_path = track.file_path
    file_size = os.path.getsize(file_path)
    
    # Handle range requests for proper audio streaming
    range_header = request.headers.get("range")
    
    if range_header:
        # Parse range header
        range_match = range_header.replace("bytes=", "").split("-")
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if range_match[1] else file_size - 1
        
        # Ensure valid range
        if start >= file_size:
            return Response(status_code=416)  # Range not satisfiable
        
        end = min(end, file_size - 1)
        content_length = end - start + 1
        
        # Read the requested range
        with open(file_path, "rb") as f:
            f.seek(start)
            data = f.read(content_length)
        
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": media_type,
        }
        
        return Response(content=data, status_code=206, headers=headers, media_type=media_type)
    
    # No range request - return full file
    return FileResponse(
        file_path,
        media_type=media_type,
        filename=os.path.basename(file_path),
        headers={"Accept-Ranges": "bytes"}
    )


@router.get("/direct-download-enabled")
async def check_direct_download_enabled(db: AsyncSession = Depends(get_db)):
    """Check if direct download feature is enabled"""
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == "direct_download_enabled")
    )
    setting = result.scalar_one_or_none()
    return {"enabled": setting.value == "true" if setting else False}


@router.post("/direct-download")
async def direct_download_album(
    qobuz_url: str,
    quality: int = 1,
    db: AsyncSession = Depends(get_db)
):
    """
    Download an album directly to the user's device.
    Quality: 1=MP3 320, 2=16/44.1, 3=24/96, 4=24/192
    Returns a zip file for download.
    """
    import tempfile
    import zipfile
    import shutil
    import asyncio
    
    # Check if feature is enabled
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == "direct_download_enabled")
    )
    setting = result.scalar_one_or_none()
    if not setting or setting.value != "true":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Direct download feature is not enabled"
        )
    
    # Validate quality and get label for filename
    quality_labels = {
        1: "MP3",
        2: "CD",
        3: "HiRes",
        4: "HiRes+"
    }
    if quality not in quality_labels:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid quality. Use 1=MP3, 2=CD, 3=Hi-Res, 4=Hi-Res+"
        )
    quality_tag = quality_labels[quality]
    
    # Create temp directory for download
    temp_dir = tempfile.mkdtemp(prefix="auvia_direct_")
    
    try:
        # Use streamrip to download with specified quality
        streamrip_service = StreamripService()
        success = await streamrip_service.download_to_path(
            qobuz_url, 
            temp_dir, 
            quality=quality
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Download failed"
            )
        
        # Find downloaded files and extract album info
        downloaded_files = []
        album_folder_name = None
        for root, dirs, files in os.walk(temp_dir):
            # Get the first-level folder name as album info
            rel_root = os.path.relpath(root, temp_dir)
            if rel_root != "." and album_folder_name is None:
                album_folder_name = rel_root.split(os.sep)[0]
            
            for file in files:
                if file.endswith(('.mp3', '.flac', '.jpg', '.png', '.pdf')):
                    downloaded_files.append(os.path.join(root, file))
        
        if not downloaded_files:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No files downloaded"
            )
        
        # Parse album folder name and create clean format
        # Streamrip typically creates: "Artist - Title (Year)" or similar
        import re
        album_name = album_folder_name or "Album"
        
        # Try to extract and format nicely: "Artist - Title (Year)"
        # Title case the album name for cleaner appearance
        def title_case_preserve(s):
            # Title case but preserve certain patterns
            words = s.split()
            result = []
            for word in words:
                if word.isupper() and len(word) <= 4:  # Keep short acronyms
                    result.append(word)
                elif word.startswith('(') or word.endswith(')'):
                    result.append(word)
                else:
                    result.append(word.capitalize())
            return ' '.join(result)
        
        # Clean up the album name
        clean_album_name = title_case_preserve(album_name)
        
        # Create clean ZIP folder name with quality tag
        zip_folder_name = f"{clean_album_name} [{quality_tag}]"
        
        # Create zip file with flat structure
        zip_path = os.path.join(temp_dir, "album.zip")
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in downloaded_files:
                # Get just the filename, place directly in the clean folder
                filename = os.path.basename(file_path)
                arcname = f"{zip_folder_name}/{filename}"
                zipf.write(file_path, arcname)
        
        # Stream the zip file
        async def stream_and_cleanup():
            try:
                async with aiofiles.open(zip_path, 'rb') as f:
                    while chunk := await f.read(8192):
                        yield chunk
            finally:
                # Cleanup temp directory after streaming
                await asyncio.sleep(1)  # Brief delay to ensure file is fully sent
                shutil.rmtree(temp_dir, ignore_errors=True)
        
        # Sanitize filename and add quality tag
        safe_name = "".join(c for c in clean_album_name if c.isalnum() or c in (' ', '-', '_', '(', ')')).strip()
        filename_with_quality = f"{safe_name} [{quality_tag}].zip"
        
        return StreamingResponse(
            stream_and_cleanup(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{filename_with_quality}"'
            }
        )
        
    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Download failed: {str(e)}"
        )
