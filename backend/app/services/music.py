from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
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
        # Validate name - must not be None or empty
        if not name or (isinstance(name, str) and not name.strip()):
            name = "Unknown Artist"
        
        # Normalize name for comparison (strip whitespace)
        name = name.strip()
        
        if qobuz_id:
            result = await self.db.execute(
                select(Artist).where(Artist.qobuz_id == qobuz_id)
            )
            artist = result.scalar_one_or_none()
            if artist:
                return artist
        
        # Try by name (case-insensitive)
        result = await self.db.execute(
            select(Artist).where(func.lower(Artist.name) == func.lower(name))
        )
        artist = result.scalar_one_or_none()
        
        if not artist:
            artist = Artist(name=name, qobuz_id=qobuz_id)
            self.db.add(artist)
            await self.db.commit()
            await self.db.refresh(artist)
        elif qobuz_id and not artist.qobuz_id:
            # Update existing artist with qobuz_id if we have it now
            artist.qobuz_id = qobuz_id
            await self.db.commit()
        
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
        # Validate title - must not be None or empty
        if not title or (isinstance(title, str) and not title.strip()):
            title = "Unknown Album"
        
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
        # Validate title - must not be None or empty
        if not title or (isinstance(title, str) and not title.strip()):
            # Extract from filename as fallback
            title = os.path.splitext(os.path.basename(file_path))[0] if file_path else "Unknown Track"
        
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
            # Update existing track - including artist/album if they were wrong
            track.title = title
            track.track_number = track_number
            track.disc_number = disc_number
            track.duration = duration
            track.is_downloaded = True
            # Fix artist/album if we now have better data
            if artist and artist.name != "Unknown Artist":
                track.artist_id = artist.id
            if album and album.artist_id == artist.id:
                track.album_id = album.id
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
    
    async def scan_directory(self, directory: str, qobuz_album_id: str = None, qobuz_url: str = None) -> dict:
        """
        Scan a directory for music files and add them to the database.
        
        Args:
            directory: Path to scan
            qobuz_album_id: Optional Qobuz album ID to link with scanned album
            qobuz_url: Optional Qobuz URL to link with scanned album
        """
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
                    
                    # If metadata extraction failed, try to parse from filename/folder
                    if not metadata:
                        metadata = self._extract_metadata_from_path(file_path, filename, root)
                    
                    if not metadata:
                        print(f"Could not extract any metadata from {file_path}")
                        stats["errors"] += 1
                        continue
                    
                    # Ensure all required fields have valid values (not None or empty)
                    artist_name = metadata.get("artist")
                    album_title = metadata.get("album")
                    track_title = metadata.get("title")
                    
                    # Always try to extract from folder name if artist/album missing
                    # Folder format is typically "Artist - Album (Year)"
                    if not artist_name or not album_title or artist_name == "Unknown Artist":
                        folder_artist, folder_album = self._extract_artist_album_from_path(root)
                        if not artist_name or (isinstance(artist_name, str) and not artist_name.strip()) or artist_name == "Unknown Artist":
                            artist_name = folder_artist or "Unknown Artist"
                        if not album_title or (isinstance(album_title, str) and not album_title.strip()):
                            album_title = folder_album or self._extract_album_from_path(root) or "Unknown Album"
                    
                    if not track_title or (isinstance(track_title, str) and not track_title.strip()):
                        track_title = self._clean_filename_for_title(filename)
                    
                    # Get or create artist
                    artist = await self.get_or_create_artist(artist_name)
                    
                    # Get or create album (link with qobuz_id if provided)
                    album = await self.get_or_create_album(
                        title=album_title,
                        artist=artist,
                        qobuz_id=qobuz_album_id,
                        qobuz_url=qobuz_url,
                        genre=metadata.get("genre")
                    )
                    
                    # Update qobuz_id if not set but we have it
                    if qobuz_album_id and not album.qobuz_id:
                        album.qobuz_id = qobuz_album_id
                    if qobuz_url and not album.qobuz_url:
                        album.qobuz_url = qobuz_url
                    
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
                        title=track_title,
                        artist=artist,
                        album=album,
                        file_path=file_path,
                        track_number=metadata.get("tracknumber"),
                        disc_number=metadata.get("discnumber") or 1,
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
    
    def _extract_metadata_from_path(self, file_path: str, filename: str, directory: str) -> Optional[dict]:
        """
        Extract metadata from file path and filename when tags are missing/corrupt.
        Handles common naming patterns like:
        - "Artist - Album (Year)/01. Artist - Title.mp3"
        - "Artist - Album/01 Title.mp3"
        """
        import re
        
        try:
            # Try to get duration even if tags failed
            duration = None
            try:
                audio = MutagenFile(file_path)
                if audio and audio.info:
                    duration = int(audio.info.length)
            except:
                pass
            
            # Extract from directory name (usually "Artist - Album (Year)")
            dir_name = os.path.basename(directory)
            artist_name = None
            album_name = None
            
            # Pattern: "Artist - Album (Year)" or "Artist - Album"
            dir_match = re.match(r'^(.+?)\s*-\s*(.+?)(?:\s*\(\d{4}\))?$', dir_name)
            if dir_match:
                artist_name = dir_match.group(1).strip()
                album_name = dir_match.group(2).strip()
            else:
                # Just use directory name as album
                album_name = dir_name
            
            # Extract from filename
            base_name = os.path.splitext(filename)[0]
            track_number = None
            track_title = None
            
            # Pattern: "01. Artist - Title" or "01 - Title" or "01 Title"
            track_match = re.match(r'^(\d+)[.\s-]+(?:(.+?)\s*-\s*)?(.+)$', base_name)
            if track_match:
                track_number = int(track_match.group(1))
                if track_match.group(2):
                    # Has artist in filename
                    if not artist_name:
                        artist_name = track_match.group(2).strip()
                track_title = track_match.group(3).strip()
            else:
                track_title = base_name
            
            return {
                "title": track_title,
                "artist": artist_name,
                "album": album_name,
                "genre": None,
                "tracknumber": track_number,
                "discnumber": 1,
                "duration": duration
            }
            
        except Exception as e:
            print(f"Error extracting metadata from path {file_path}: {e}")
            return None
    
    def _extract_artist_album_from_path(self, directory: str) -> tuple:
        """Extract artist and album from directory path (e.g., 'Artist - Album (Year)')"""
        import re
        dir_name = os.path.basename(directory)
        
        # Pattern: "Artist - Album (Year)" or "Artist - Album"
        match = re.match(r'^(.+?)\s+-\s+(.+?)(?:\s*\(\d{4}\))?$', dir_name)
        if match:
            return match.group(1).strip(), match.group(2).strip()
        
        # No match - return None for artist, use dir_name as album
        return None, dir_name if dir_name else None
    
    def _extract_album_from_path(self, directory: str) -> Optional[str]:
        """Extract album name from directory path"""
        import re
        dir_name = os.path.basename(directory)
        
        # Pattern: "Artist - Album (Year)" -> extract Album
        match = re.match(r'^.+?\s+-\s+(.+?)(?:\s*\(\d{4}\))?$', dir_name)
        if match:
            return match.group(1).strip()
        
        # Just return directory name
        return dir_name if dir_name else None
    
    def _clean_filename_for_title(self, filename: str) -> str:
        """Clean filename to use as track title"""
        import re
        # Remove extension
        base = os.path.splitext(filename)[0]
        
        # Remove track number prefix (e.g., "01. ", "01 - ")
        base = re.sub(r'^\d+[.\s-]+', '', base)
        
        # Remove artist prefix if present (e.g., "Artist - ")
        if ' - ' in base:
            parts = base.split(' - ', 1)
            if len(parts) == 2:
                base = parts[1]
        
        return base.strip() or filename
    
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
        
        # Check albums - if all tracks are missing, DELETE the album entirely
        # This prevents stale records from appearing in search results
        for album_id in albums_to_check:
            result = await self.db.execute(
                select(Album).where(Album.id == album_id).options(selectinload(Album.tracks))
            )
            album = result.scalar_one_or_none()
            if album:
                # Check if any tracks are still downloaded
                has_downloaded_tracks = any(t.is_downloaded for t in album.tracks)
                if not has_downloaded_tracks:
                    print(f"Album has no local files, deleting from database: {album.title}")
                    # Delete all tracks for this album first
                    for track in album.tracks:
                        await self.db.delete(track)
                    # Delete the album
                    await self.db.delete(album)
                    stats["missing_albums"] += 1
        
        # Clean up orphaned artists (artists with no albums)
        from sqlalchemy import func
        orphan_result = await self.db.execute(
            select(Artist).where(
                ~Artist.id.in_(select(Album.artist_id).distinct())
            )
        )
        orphaned_artists = orphan_result.scalars().all()
        for artist in orphaned_artists:
            print(f"Deleting orphaned artist: {artist.name}")
            await self.db.delete(artist)
        
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
