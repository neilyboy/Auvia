from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
import os
from mutagen import File as MutagenFile
from mutagen.easyid3 import EasyID3
from mutagen.flac import FLAC

from app.models.music import Album, Track, Artist, PlayHistory
from app.schemas.music import AlbumResponse, TrackResponse


class MusicService:
    """Service for managing local music library"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_recently_played(self, limit: int = 20) -> List[TrackResponse]:
        """Get recently played tracks"""
        result = await self.db.execute(
            select(PlayHistory)
            .options(
                selectinload(PlayHistory.track).selectinload(Track.artist),
                selectinload(PlayHistory.track).selectinload(Track.album)
            )
            .order_by(desc(PlayHistory.played_at))
            .limit(limit)
        )
        history = result.scalars().all()
        
        seen_tracks = set()
        tracks = []
        
        for item in history:
            if item.track_id not in seen_tracks:
                seen_tracks.add(item.track_id)
                tracks.append(TrackResponse(
                    id=item.track.id,
                    title=item.track.title,
                    artist_name=item.track.artist.name,
                    album_title=item.track.album.title,
                    duration=item.track.duration,
                    duration_formatted=self._format_duration(item.track.duration),
                    is_downloaded=item.track.is_downloaded,
                    play_count=item.track.play_count,
                    cover_art_url=item.track.album.cover_art_url
                ))
        
        return tracks
    
    async def get_recently_added_albums(self, limit: int = 10) -> List[AlbumResponse]:
        """Get recently added/downloaded albums"""
        result = await self.db.execute(
            select(Album)
            .options(selectinload(Album.artist))
            .where(Album.is_downloaded == True)
            .order_by(desc(Album.created_at))
            .limit(limit)
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
                cover_art_local=album.cover_art_local,
                release_date=album.release_date,
                genre=album.genre,
                total_tracks=album.total_tracks,
                is_downloaded=album.is_downloaded
            )
            for album in albums
        ]
    
    async def get_or_create_artist(self, name: str, qobuz_id: str = None) -> Artist:
        """Get existing artist or create new one"""
        if qobuz_id:
            result = await self.db.execute(
                select(Artist).where(Artist.qobuz_id == qobuz_id)
            )
            artist = result.scalar_one_or_none()
            if artist:
                return artist
        
        # Try by name
        result = await self.db.execute(
            select(Artist).where(Artist.name == name)
        )
        artist = result.scalar_one_or_none()
        
        if not artist:
            artist = Artist(name=name, qobuz_id=qobuz_id)
            self.db.add(artist)
            await self.db.commit()
            await self.db.refresh(artist)
        
        return artist
    
    async def get_or_create_album(
        self,
        title: str,
        artist: Artist,
        qobuz_id: str = None,
        qobuz_url: str = None,
        cover_art_url: str = None,
        release_date: str = None,
        genre: str = None
    ) -> Album:
        """Get existing album or create new one"""
        if qobuz_id:
            result = await self.db.execute(
                select(Album).where(Album.qobuz_id == qobuz_id)
            )
            album = result.scalar_one_or_none()
            if album:
                return album
        
        # Try by title and artist
        result = await self.db.execute(
            select(Album).where(
                Album.title == title,
                Album.artist_id == artist.id
            )
        )
        album = result.scalar_one_or_none()
        
        if not album:
            album = Album(
                title=title,
                artist_id=artist.id,
                qobuz_id=qobuz_id,
                qobuz_url=qobuz_url,
                cover_art_url=cover_art_url,
                release_date=release_date,
                genre=genre
            )
            self.db.add(album)
            await self.db.commit()
            await self.db.refresh(album)
        
        return album
    
    async def add_track(
        self,
        title: str,
        artist: Artist,
        album: Album,
        file_path: str,
        qobuz_id: str = None,
        track_number: int = None,
        disc_number: int = 1,
        duration: int = None
    ) -> Track:
        """Add a track to the database"""
        # Check if track already exists by qobuz_id
        if qobuz_id:
            result = await self.db.execute(
                select(Track).where(Track.qobuz_id == qobuz_id)
            )
            track = result.scalar_one_or_none()
            if track:
                track.file_path = file_path
                track.is_downloaded = True
                await self.db.commit()
                return track
        
        # Check if track already exists by file_path
        result = await self.db.execute(
            select(Track).where(Track.file_path == file_path)
        )
        track = result.scalar_one_or_none()
        if track:
            # Update existing track
            track.title = title
            track.track_number = track_number
            track.disc_number = disc_number
            track.duration = duration
            track.is_downloaded = True
            await self.db.commit()
            return track
        
        # Check by album, track number, and title to avoid duplicates
        result = await self.db.execute(
            select(Track).where(
                Track.album_id == album.id,
                Track.track_number == track_number,
                Track.title == title
            )
        )
        track = result.scalar_one_or_none()
        if track:
            track.file_path = file_path
            track.is_downloaded = True
            await self.db.commit()
            return track
        
        track = Track(
            title=title,
            artist_id=artist.id,
            album_id=album.id,
            qobuz_id=qobuz_id,
            track_number=track_number,
            disc_number=disc_number,
            duration=duration,
            file_path=file_path,
            is_downloaded=True
        )
        self.db.add(track)
        await self.db.commit()
        await self.db.refresh(track)
        
        return track
    
    async def scan_directory(self, directory: str) -> dict:
        """Scan a directory for music files and add them to the database"""
        stats = {"albums": 0, "tracks": 0, "errors": 0}
        
        supported_extensions = {'.mp3', '.flac', '.m4a', '.ogg', '.wav'}
        cover_names = {'cover.jpg', 'cover.jpeg', 'cover.png', 'folder.jpg', 'folder.png', 'front.jpg', 'front.png'}
        
        # Track which albums we've processed to update cover art
        processed_albums = {}
        
        for root, dirs, files in os.walk(directory):
            # Look for cover art in this directory
            cover_art_path = None
            for f in files:
                if f.lower() in cover_names:
                    cover_art_path = os.path.join(root, f)
                    break
            
            # For multi-disc albums, also check parent directory for cover art
            if not cover_art_path:
                parent_dir = os.path.dirname(root)
                if parent_dir and parent_dir != directory:
                    for cover_name in cover_names:
                        parent_cover = os.path.join(parent_dir, cover_name)
                        if os.path.exists(parent_cover):
                            cover_art_path = parent_cover
                            break
            
            for filename in files:
                ext = os.path.splitext(filename)[1].lower()
                if ext not in supported_extensions:
                    continue
                
                file_path = os.path.join(root, filename)
                
                try:
                    metadata = self._extract_metadata(file_path)
                    
                    if not metadata:
                        continue
                    
                    # Ensure artist name is valid
                    artist_name = metadata.get("artist")
                    if not artist_name or artist_name.strip() == "":
                        artist_name = "Unknown Artist"
                    
                    # Get or create artist
                    artist = await self.get_or_create_artist(artist_name)
                    
                    # Get or create album
                    album = await self.get_or_create_album(
                        title=metadata.get("album", "Unknown Album"),
                        artist=artist,
                        genre=metadata.get("genre")
                    )
                    
                    if not album.is_downloaded:
                        album.is_downloaded = True
                        album.download_path = root
                        stats["albums"] += 1
                    
                    # Update cover art path if found and not already set
                    if cover_art_path and not album.cover_art_local:
                        album.cover_art_local = cover_art_path
                        print(f"Found cover art for {album.title}: {cover_art_path}")
                    
                    # Track this album
                    processed_albums[album.id] = album
                    
                    # Add track
                    await self.add_track(
                        title=metadata.get("title", filename),
                        artist=artist,
                        album=album,
                        file_path=file_path,
                        track_number=metadata.get("tracknumber"),
                        disc_number=metadata.get("discnumber", 1),
                        duration=metadata.get("duration")
                    )
                    
                    stats["tracks"] += 1
                    
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
                    stats["errors"] += 1
                    # Rollback to recover from database errors
                    try:
                        await self.db.rollback()
                    except:
                        pass
        
        try:
            await self.db.commit()
        except Exception as e:
            print(f"Error committing scan results: {e}")
            await self.db.rollback()
        print(f"Scan complete: {stats}")
        return stats
    
    def _extract_metadata(self, file_path: str) -> Optional[dict]:
        """Extract metadata from an audio file"""
        try:
            audio = MutagenFile(file_path, easy=True)
            
            if audio is None:
                return None
            
            metadata = {
                "title": self._get_tag(audio, "title"),
                "artist": self._get_tag(audio, "artist"),
                "album": self._get_tag(audio, "album"),
                "genre": self._get_tag(audio, "genre"),
                "tracknumber": self._parse_track_number(self._get_tag(audio, "tracknumber")),
                "discnumber": self._parse_track_number(self._get_tag(audio, "discnumber")) or 1,
                "duration": int(audio.info.length) if audio.info else None
            }
            
            return metadata
            
        except Exception as e:
            print(f"Error extracting metadata from {file_path}: {e}")
            return None
    
    def _get_tag(self, audio, tag_name: str) -> Optional[str]:
        """Get a tag value from audio metadata"""
        try:
            value = audio.get(tag_name)
            if value:
                return value[0] if isinstance(value, list) else value
        except:
            pass
        return None
    
    def _parse_track_number(self, value: Optional[str]) -> Optional[int]:
        """Parse track number from string (handles '1/12' format)"""
        if not value:
            return None
        try:
            # Handle "1/12" format
            if "/" in str(value):
                value = str(value).split("/")[0]
            return int(value)
        except:
            return None
    
    def _format_duration(self, seconds: Optional[int]) -> str:
        """Format duration in seconds to MM:SS"""
        if not seconds:
            return "0:00"
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}:{secs:02d}"
    
    async def verify_local_files(self) -> dict:
        """
        Verify that all downloaded tracks still exist on disk.
        Marks tracks/albums as not downloaded if files are missing.
        Returns stats about what was found.
        """
        stats = {"verified": 0, "missing_tracks": 0, "missing_albums": 0}
        
        # Check all tracks marked as downloaded
        result = await self.db.execute(
            select(Track).where(Track.is_downloaded == True)
        )
        tracks = result.scalars().all()
        
        albums_to_check = set()
        
        for track in tracks:
            if track.file_path and not os.path.exists(track.file_path):
                print(f"Missing track file: {track.file_path}")
                track.is_downloaded = False
                track.file_path = None
                stats["missing_tracks"] += 1
                if track.album_id:
                    albums_to_check.add(track.album_id)
            else:
                stats["verified"] += 1
        
        # Check albums - if all tracks are missing, mark album as not downloaded
        for album_id in albums_to_check:
            result = await self.db.execute(
                select(Album).where(Album.id == album_id).options(selectinload(Album.tracks))
            )
            album = result.scalar_one_or_none()
            if album:
                # Check if any tracks are still downloaded
                has_downloaded_tracks = any(t.is_downloaded for t in album.tracks)
                if not has_downloaded_tracks:
                    print(f"Album has no local files, marking as not downloaded: {album.title}")
                    album.is_downloaded = False
                    album.download_path = None
                    album.cover_art_local = None
                    stats["missing_albums"] += 1
        
        await self.db.commit()
        print(f"File verification complete: {stats}")
        return stats
    
    async def check_track_availability(self, track_id: int) -> dict:
        """
        Check if a specific track is available locally.
        Returns availability status and whether re-download is needed.
        """
        result = await self.db.execute(
            select(Track).where(Track.id == track_id).options(selectinload(Track.album))
        )
        track = result.scalar_one_or_none()
        
        if not track:
            return {"available": False, "needs_download": True, "reason": "Track not in database"}
        
        if not track.is_downloaded:
            return {
                "available": False, 
                "needs_download": True, 
                "reason": "Track not downloaded",
                "qobuz_url": track.album.qobuz_url if track.album else None
            }
        
        if track.file_path and os.path.exists(track.file_path):
            return {"available": True, "needs_download": False}
        
        # File is missing - update database and return needs_download
        track.is_downloaded = False
        track.file_path = None
        await self.db.commit()
        
        return {
            "available": False,
            "needs_download": True,
            "reason": "Local file missing",
            "qobuz_url": track.album.qobuz_url if track.album else None
        }
