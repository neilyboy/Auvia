import asyncio
import os
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.music import DownloadTask, Album, Track, Artist
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
        track_id: str = None
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
        asyncio.create_task(self._execute_download(task.id, track_id))
        
        return task
    
    async def _execute_download(self, task_id: int, play_track_id: str = None):
        """Execute the download in background"""
        from app.database import async_session_maker
        
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
                    
                    # Scan downloaded files and add to database
                    music_service = MusicService(db)
                    await music_service.scan_directory(output_path or download_path)
                else:
                    task.status = "failed"
                    task.error_message = "Download failed"
                
            except Exception as e:
                task.status = "failed"
                task.error_message = str(e)
            
            await db.commit()
    
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
