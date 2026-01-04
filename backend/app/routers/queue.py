from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.music import Track, Album, QueueItem, PlayHistory, DownloadTask
from app.schemas.music import (
    QueueItemResponse, TrackResponse, AddToQueueRequest, 
    PlayAlbumRequest, DownloadRequest, DownloadTaskResponse
)
from app.services.download import DownloadService

router = APIRouter(prefix="/queue", tags=["Queue"])


@router.get("/", response_model=List[QueueItemResponse])
async def get_queue(db: AsyncSession = Depends(get_db)):
    """Get current playback queue"""
    result = await db.execute(
        select(QueueItem)
        .options(
            selectinload(QueueItem.track).selectinload(Track.artist),
            selectinload(QueueItem.track).selectinload(Track.album)
        )
        .order_by(QueueItem.position)
    )
    queue_items = result.scalars().all()
    
    responses = []
    for item in queue_items:
        # Use local cover art URL if available
        cover_url = None
        if item.track.album:
            if item.track.album.cover_art_local:
                cover_url = f"/api/music/cover/{item.track.album.id}"
            elif item.track.album.cover_art_url:
                cover_url = item.track.album.cover_art_url
        
        responses.append(QueueItemResponse(
            id=item.id,
            track=TrackResponse(
                id=item.track.id,
                title=item.track.title,
                artist_name=item.track.artist.name,
                album_title=item.track.album.title if item.track.album else None,
                album_id=item.track.album.id if item.track.album else None,
                duration=item.track.duration,
                duration_formatted=format_duration(item.track.duration),
                is_downloaded=item.track.is_downloaded,
                cover_art_url=cover_url,
                file_path=item.track.file_path
            ),
            position=item.position,
            is_playing=item.is_playing,
            added_at=item.added_at
        ))
    
    return responses


@router.post("/add")
async def add_to_queue(
    request: AddToQueueRequest,
    db: AsyncSession = Depends(get_db)
):
    """Add a track to the queue"""
    download_service = DownloadService(db)
    
    # If we have a local track ID
    if request.track_id:
        result = await db.execute(
            select(Track).where(Track.id == request.track_id)
        )
        track = result.scalar_one_or_none()
        
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")
        
        # If track isn't downloaded, trigger download
        if not track.is_downloaded and request.qobuz_album_url:
            await download_service.start_download(request.qobuz_album_url)
    
    # If we need to download first (track not in DB yet)
    elif request.qobuz_album_url:
        # Start download and add to queue when ready
        task = await download_service.start_download(
            request.qobuz_album_url,
            track_id=request.qobuz_track_id,
            play_now=request.play_now,
            play_next=request.play_next
        )
        return {"message": "Download started - will queue when ready", "task_id": task.id}
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide track_id or qobuz_album_url"
        )
    
    # Get current max position
    max_pos_result = await db.execute(
        select(func.max(QueueItem.position))
    )
    max_pos = max_pos_result.scalar() or 0
    
    # Determine position
    if request.play_next:
        # Find currently playing position and insert after
        current_result = await db.execute(
            select(QueueItem).where(QueueItem.is_playing == True)
        )
        current = current_result.scalar_one_or_none()
        
        if current:
            # Shift all items after current
            await db.execute(
                QueueItem.__table__.update()
                .where(QueueItem.position > current.position)
                .values(position=QueueItem.position + 1)
            )
            position = current.position + 1
        else:
            position = 1
    else:
        position = max_pos + 1
    
    # Add to queue
    queue_item = QueueItem(
        track_id=track.id,
        position=position,
        is_playing=request.play_now
    )
    db.add(queue_item)
    
    if request.play_now:
        # Set all others to not playing
        await db.execute(
            QueueItem.__table__.update()
            .where(QueueItem.id != queue_item.id)
            .values(is_playing=False)
        )
    
    await db.commit()
    
    return {"message": "Added to queue", "position": position}


@router.post("/play-album")
async def play_album(
    request: PlayAlbumRequest,
    db: AsyncSession = Depends(get_db)
):
    """Add all tracks from an album to the queue"""
    download_service = DownloadService(db)
    
    # Get album
    if request.album_id:
        result = await db.execute(
            select(Album)
            .options(selectinload(Album.tracks))
            .where(Album.id == request.album_id)
        )
        album = result.scalar_one_or_none()
        
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        
        if not album.is_downloaded:
            # Need to download first
            if album.qobuz_url:
                task = await download_service.start_download(album.qobuz_url, play_now=True)
                return {"message": "Download started - will play when ready", "task_id": task.id}
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Album not downloaded and no Qobuz URL available"
                )
        
        tracks = sorted(album.tracks, key=lambda t: (t.disc_number or 1, t.track_number or 0))
        
    elif request.qobuz_album_url:
        # Download album first
        task = await download_service.start_download(request.qobuz_album_url, play_now=True)
        return {"message": "Download started - will play when ready", "task_id": task.id}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide album_id or qobuz_album_url"
        )
    
    # Clear current queue
    await db.execute(delete(QueueItem))
    
    # Add all tracks
    for i, track in enumerate(tracks):
        queue_item = QueueItem(
            track_id=track.id,
            position=i + 1,
            is_playing=(i == request.start_track - 1)
        )
        db.add(queue_item)
    
    await db.commit()
    
    return {"message": f"Added {len(tracks)} tracks to queue"}


@router.post("/clear")
async def clear_queue(db: AsyncSession = Depends(get_db)):
    """Clear the entire queue"""
    await db.execute(delete(QueueItem))
    await db.commit()
    return {"message": "Queue cleared"}


@router.delete("/{item_id}")
async def remove_from_queue(item_id: int, db: AsyncSession = Depends(get_db)):
    """Remove a specific item from the queue"""
    result = await db.execute(
        select(QueueItem).where(QueueItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    removed_position = item.position
    await db.delete(item)
    
    # Reorder remaining items
    await db.execute(
        QueueItem.__table__.update()
        .where(QueueItem.position > removed_position)
        .values(position=QueueItem.position - 1)
    )
    
    await db.commit()
    return {"message": "Removed from queue"}


@router.post("/reorder")
async def reorder_queue(
    item_id: int,
    new_position: int,
    db: AsyncSession = Depends(get_db)
):
    """Move a queue item to a new position"""
    result = await db.execute(
        select(QueueItem).where(QueueItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    old_position = item.position
    
    if old_position < new_position:
        # Moving down - shift items up
        await db.execute(
            QueueItem.__table__.update()
            .where(
                QueueItem.position > old_position,
                QueueItem.position <= new_position
            )
            .values(position=QueueItem.position - 1)
        )
    else:
        # Moving up - shift items down
        await db.execute(
            QueueItem.__table__.update()
            .where(
                QueueItem.position >= new_position,
                QueueItem.position < old_position
            )
            .values(position=QueueItem.position + 1)
        )
    
    item.position = new_position
    await db.commit()
    
    return {"message": "Queue reordered"}


@router.post("/next")
async def play_next(db: AsyncSession = Depends(get_db)):
    """Skip to next track in queue"""
    result = await db.execute(
        select(QueueItem)
        .options(selectinload(QueueItem.track))
        .where(QueueItem.is_playing == True)
    )
    current = result.scalar_one_or_none()
    
    if current:
        # Log play history
        history = PlayHistory(
            track_id=current.track_id,
            played_at=datetime.utcnow()
        )
        db.add(history)
        
        # Update play count
        current.track.play_count += 1
        current.track.last_played = datetime.utcnow()
        
        current.is_playing = False
        current_pos = current.position
    else:
        current_pos = 0
    
    # Get next track
    next_result = await db.execute(
        select(QueueItem)
        .where(QueueItem.position > current_pos)
        .order_by(QueueItem.position)
        .limit(1)
    )
    next_item = next_result.scalar_one_or_none()
    
    if next_item:
        next_item.is_playing = True
        await db.commit()
        return {"message": "Playing next track", "track_id": next_item.track_id}
    else:
        await db.commit()
        return {"message": "End of queue", "track_id": None}


@router.post("/previous")
async def play_previous(db: AsyncSession = Depends(get_db)):
    """Go back to previous track in queue"""
    result = await db.execute(
        select(QueueItem).where(QueueItem.is_playing == True)
    )
    current = result.scalar_one_or_none()
    
    if current:
        current.is_playing = False
        current_pos = current.position
    else:
        # Get last item position + 1
        max_result = await db.execute(select(func.max(QueueItem.position)))
        current_pos = (max_result.scalar() or 0) + 1
    
    # Get previous track
    prev_result = await db.execute(
        select(QueueItem)
        .where(QueueItem.position < current_pos)
        .order_by(QueueItem.position.desc())
        .limit(1)
    )
    prev_item = prev_result.scalar_one_or_none()
    
    if prev_item:
        prev_item.is_playing = True
        await db.commit()
        return {"message": "Playing previous track", "track_id": prev_item.track_id}
    else:
        await db.commit()
        return {"message": "Beginning of queue", "track_id": None}


@router.get("/now-playing")
async def get_now_playing(db: AsyncSession = Depends(get_db)):
    """Get currently playing track"""
    result = await db.execute(
        select(QueueItem)
        .options(
            selectinload(QueueItem.track).selectinload(Track.artist),
            selectinload(QueueItem.track).selectinload(Track.album)
        )
        .where(QueueItem.is_playing == True)
    )
    current = result.scalar_one_or_none()
    
    if not current:
        return None
    
    return QueueItemResponse(
        id=current.id,
        track=TrackResponse(
            id=current.track.id,
            title=current.track.title,
            artist_name=current.track.artist.name,
            album_title=current.track.album.title,
            duration=current.track.duration,
            duration_formatted=format_duration(current.track.duration),
            file_path=current.track.file_path,
            is_downloaded=current.track.is_downloaded,
            cover_art_url=current.track.album.cover_art_url
        ),
        position=current.position,
        is_playing=current.is_playing,
        added_at=current.added_at
    )


@router.get("/downloads", response_model=List[DownloadTaskResponse])
async def get_download_tasks(db: AsyncSession = Depends(get_db)):
    """Get all download tasks"""
    result = await db.execute(
        select(DownloadTask).order_by(DownloadTask.created_at.desc()).limit(50)
    )
    tasks = result.scalars().all()
    return [DownloadTaskResponse.model_validate(task) for task in tasks]


def format_duration(seconds: int | None) -> str:
    """Format duration in seconds to MM:SS"""
    if not seconds:
        return "0:00"
    minutes = seconds // 60
    secs = seconds % 60
    return f"{minutes}:{secs:02d}"
