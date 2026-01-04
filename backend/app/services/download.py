import asyncio
import os
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.models.music import DownloadTask, Album, Track, Artist, QueueItem
from app.models.settings import StorageLocation, QobuzConfig
from app.services.streamrip import StreamripService
from app.services.music import MusicService


class DownloadService:
    """Service for managing music downloads via streamrip"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.streamrip = StreamripService()
    
    async def start_download(
        self,
        qobuz_url: str,
        album_title: str = None,
        artist_name: str = None,
        track_id: str = None,
        play_now: bool = False,
        play_next: bool = False
    ) -> DownloadTask:
        """Start a new download task"""
        # Check if already downloading this URL
        result = await self.db.execute(
            select(DownloadTask).where(
                DownloadTask.qobuz_url == qobuz_url,
                DownloadTask.status.in_(["pending", "downloading"])
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            return existing
        
        # Create download task
        task = DownloadTask(
            qobuz_url=qobuz_url,
            album_title=album_title,
            artist_name=artist_name,
            status="pending"
        )
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        
        # Start download in background
        asyncio.create_task(self._execute_download(task.id, track_id, play_now, play_next))
        
        return task
    
    async def _execute_download(self, task_id: int, play_track_id: str = None, play_now: bool = False, play_next: bool = False):
        """Execute the download in background"""
        from app.database import async_session_maker
        from sqlalchemy.orm import selectinload
        
        async with async_session_maker() as db:
            # Get task
            result = await db.execute(
                select(DownloadTask).where(DownloadTask.id == task_id)
            )
            task = result.scalar_one_or_none()
            
            if not task:
                return
            
            try:
                # Update status
                task.status = "downloading"
                await db.commit()
                
                # Get download path
                storage_result = await db.execute(
                    select(StorageLocation).where(
                        StorageLocation.is_primary == True,
                        StorageLocation.is_active == True
                    )
                )
                storage = storage_result.scalar_one_or_none()
                
                if not storage:
                    # Fall back to first active storage
                    storage_result = await db.execute(
                        select(StorageLocation).where(StorageLocation.is_active == True)
                    )
                    storage = storage_result.scalar_one_or_none()
                
                download_path = storage.path if storage else "/music"
                
                # Initialize streamrip config with Qobuz credentials
                qobuz_result = await db.execute(select(QobuzConfig).limit(1))
                qobuz_config = qobuz_result.scalar_one_or_none()
                
                if qobuz_config:
                    await self.streamrip.update_config(qobuz_config)
                else:
                    print("Warning: No Qobuz config found")
                
                # Execute streamrip download
                success, output_path = await self.streamrip.download(
                    task.qobuz_url,
                    download_path
                )
                
                if success:
                    task.status = "completed"
                    task.completed_at = datetime.utcnow()
                    
                    # Extract qobuz_id from URL for linking
                    qobuz_album_id = task.qobuz_url.rstrip('/').split('/')[-1]
                    
                    # Scan downloaded files and add to database with qobuz_id
                    music_service = MusicService(db)
                    await music_service.scan_directory(
                        output_path or download_path,
                        qobuz_album_id=qobuz_album_id,
                        qobuz_url=task.qobuz_url
                    )
                    
                    # Queue tracks if requested
                    if play_now or play_next:
                        await self._queue_downloaded_tracks(
                            db, task.qobuz_url, play_track_id, play_now, play_next
                        )
                else:
                    task.status = "failed"
                    task.error_message = "Download failed"
                
            except Exception as e:
                task.status = "failed"
                task.error_message = str(e)
                print(f"Download error: {e}")
            
            await db.commit()
    
    async def _queue_downloaded_tracks(
        self,
        db: AsyncSession,
        qobuz_url: str,
        play_track_id: str = None,
        play_now: bool = False,
        play_next: bool = False
    ):
        """Queue downloaded tracks for playback"""
        from sqlalchemy.orm import selectinload
        
        try:
            # Extract qobuz album ID from URL
            # URL format: https://www.qobuz.com/us-en/album/album-slug/ALBUM_ID
            qobuz_album_id = qobuz_url.rstrip('/').split('/')[-1]
            
            # Find the album by qobuz_id
            result = await db.execute(
                select(Album)
                .options(selectinload(Album.tracks))
                .where(Album.qobuz_id == qobuz_album_id)
            )
            album = result.scalar_one_or_none()
            
            if not album:
                # Try to find by qobuz_url
                result = await db.execute(
                    select(Album)
                    .options(selectinload(Album.tracks))
                    .where(Album.qobuz_url == qobuz_url)
                )
                album = result.scalar_one_or_none()
            
            if not album or not album.tracks:
                print(f"Could not find album or tracks for queueing: {qobuz_url}")
                return
            
            # Sort tracks by disc and track number
            tracks = sorted(album.tracks, key=lambda t: (t.disc_number or 1, t.track_number or 0))
            
            # If play_track_id specified, find that specific track
            if play_track_id:
                print(f"Looking for specific track with qobuz_id: {play_track_id}")
                target_track = next((t for t in tracks if t.qobuz_id == play_track_id), None)
                
                # If not found by qobuz_id, try to match by track number from qobuz_id
                # Qobuz track IDs are often just the track number on the album
                if not target_track and play_track_id.isdigit():
                    track_num = int(play_track_id)
                    target_track = next((t for t in tracks if t.track_number == track_num), None)
                    if target_track:
                        print(f"Found track by track number: {target_track.title}")
                
                if target_track:
                    print(f"Queueing only specific track: {target_track.title}")
                    tracks = [target_track]  # Only queue the specific track
                else:
                    print(f"Could not find track {play_track_id}, queueing all {len(tracks)} tracks")
            
            if play_now:
                # Clear existing queue and add new tracks
                await db.execute(delete(QueueItem))
                
                for i, track in enumerate(tracks):
                    queue_item = QueueItem(
                        track_id=track.id,
                        position=i + 1,
                        is_playing=(i == 0)  # First track starts playing
                    )
                    db.add(queue_item)
                
                print(f"Queued {len(tracks)} tracks for immediate playback")
                
            elif play_next:
                # Find current playing position and insert after
                current_result = await db.execute(
                    select(QueueItem).where(QueueItem.is_playing == True)
                )
                current = current_result.scalar_one_or_none()
                
                if current:
                    insert_position = current.position + 1
                    
                    # Shift existing items to make room
                    await db.execute(
                        QueueItem.__table__.update()
                        .where(QueueItem.position >= insert_position)
                        .values(position=QueueItem.position + len(tracks))
                    )
                else:
                    insert_position = 1
                
                for i, track in enumerate(tracks):
                    queue_item = QueueItem(
                        track_id=track.id,
                        position=insert_position + i,
                        is_playing=False
                    )
                    db.add(queue_item)
                
                print(f"Queued {len(tracks)} tracks to play next")
            
            else:
                # Add to end of queue
                max_pos_result = await db.execute(select(func.max(QueueItem.position)))
                max_pos = max_pos_result.scalar() or 0
                
                for i, track in enumerate(tracks):
                    queue_item = QueueItem(
                        track_id=track.id,
                        position=max_pos + i + 1,
                        is_playing=False
                    )
                    db.add(queue_item)
                
                print(f"Added {len(tracks)} tracks to queue")
            
            await db.commit()
            
        except Exception as e:
            print(f"Error queueing tracks: {e}")
    
    async def get_task_status(self, task_id: int) -> Optional[DownloadTask]:
        """Get status of a download task"""
        result = await self.db.execute(
            select(DownloadTask).where(DownloadTask.id == task_id)
        )
        return result.scalar_one_or_none()
    
    async def cancel_download(self, task_id: int) -> bool:
        """Cancel a pending download"""
        result = await self.db.execute(
            select(DownloadTask).where(
                DownloadTask.id == task_id,
                DownloadTask.status == "pending"
            )
        )
        task = result.scalar_one_or_none()
        
        if task:
            task.status = "cancelled"
            await self.db.commit()
            return True
        
        return False
    
    async def retry_download(self, task_id: int) -> Optional[DownloadTask]:
        """Retry a failed download"""
        result = await self.db.execute(
            select(DownloadTask).where(
                DownloadTask.id == task_id,
                DownloadTask.status == "failed"
            )
        )
        task = result.scalar_one_or_none()
        
        if task:
            task.status = "pending"
            task.error_message = None
            await self.db.commit()
            
            # Start download again
            asyncio.create_task(self._execute_download(task.id))
            return task
        
        return None
    
    async def cleanup_old_tasks(self, days: int = 7):
        """Clean up old completed/failed tasks"""
        from datetime import timedelta
        
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        result = await self.db.execute(
            select(DownloadTask).where(
                DownloadTask.status.in_(["completed", "failed", "cancelled"]),
                DownloadTask.created_at < cutoff
            )
        )
        tasks = result.scalars().all()
        
        for task in tasks:
            await self.db.delete(task)
        
        await self.db.commit()
        
        return len(tasks)
