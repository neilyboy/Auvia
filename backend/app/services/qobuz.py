import hashlib
import time
from typing import Dict, List, Optional, Any
import httpx
from app.schemas.music import AlbumResponse, TrackResponse, ArtistResponse


class QobuzService:
    """
    Service for interacting with the Qobuz API.
    Based on the unofficial API implementations from minim and other sources.
    """
    
    BASE_URL = "https://www.qobuz.com/api.json/0.2"
    
    # Default app credentials (these may need to be updated)
    DEFAULT_APP_ID = "950096963"
    DEFAULT_SECRETS = ["979549437fcc4a3faad4867b5cd25dcb"]
    
    _cached_config = None
    
    def __init__(self, app_id: str = None, secrets: List[str] = None):
        self.app_id = app_id or self.DEFAULT_APP_ID
        self.secrets = secrets or self.DEFAULT_SECRETS
        self.user_auth_token = None
    
    @classmethod
    async def create(cls):
        """Factory method to create QobuzService with DB credentials"""
        from app.database import async_session_maker
        from app.models.settings import QobuzConfig
        from sqlalchemy import select
        
        app_id = cls.DEFAULT_APP_ID
        secrets = cls.DEFAULT_SECRETS
        user_auth_token = None
        
        try:
            async with async_session_maker() as session:
                result = await session.execute(select(QobuzConfig).limit(1))
                config = result.scalar_one_or_none()
                
                if config:
                    if config.app_id:
                        app_id = config.app_id
                    if config.secrets:
                        secrets = config.secrets
                    if config.password_or_token:
                        user_auth_token = config.password_or_token
                    print(f"Loaded Qobuz config: app_id={app_id}, has_token={bool(user_auth_token)}")
        except Exception as e:
            print(f"Error loading Qobuz config from DB: {e}")
        
        service = cls(app_id=app_id, secrets=secrets)
        service.user_auth_token = user_auth_token
        return service
        
    def _get_request_sig(self, method: str, timestamp: int) -> str:
        """Generate request signature for API calls"""
        sig_string = f"{method}{timestamp}{self.secrets[0]}"
        return hashlib.md5(sig_string.encode()).hexdigest()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers including auth token if available"""
        headers = {}
        if self.user_auth_token:
            headers["X-User-Auth-Token"] = self.user_auth_token
        return headers
    
    async def search(self, query: str, limit: int = 20) -> Dict[str, List]:
        """
        Search for albums, tracks, and artists.
        Returns combined results from all categories.
        """
        results = {
            "albums": [],
            "tracks": [],
            "artists": []
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0, headers=self._get_headers()) as client:
                timestamp = int(time.time())
                
                params = {
                    "query": query,
                    "limit": limit,
                    "app_id": self.app_id
                }
                
                # Search albums
                album_response = await client.get(
                    f"{self.BASE_URL}/album/search",
                    params=params
                )
                print(f"Qobuz album search status: {album_response.status_code}")
                if album_response.status_code == 200:
                    data = album_response.json()
                    items = data.get("albums", {}).get("items", [])
                    print(f"Qobuz found {len(items)} albums")
                    results["albums"] = self._parse_albums(items)
                else:
                    print(f"Qobuz album search failed: {album_response.text[:200]}")
                
                # Search tracks
                track_response = await client.get(
                    f"{self.BASE_URL}/track/search",
                    params=params
                )
                if track_response.status_code == 200:
                    data = track_response.json()
                    results["tracks"] = self._parse_tracks(data.get("tracks", {}).get("items", []))
                
                # Search artists
                artist_response = await client.get(
                    f"{self.BASE_URL}/artist/search",
                    params=params
                )
                if artist_response.status_code == 200:
                    data = artist_response.json()
                    results["artists"] = self._parse_artists(data.get("artists", {}).get("items", []))
                    
        except Exception as e:
            print(f"Qobuz search error: {e}")
            # Return empty results on error
        
        return results
    
    async def search_albums(self, query: str, limit: int = 20) -> List[AlbumResponse]:
        """Search specifically for albums"""
        try:
            async with httpx.AsyncClient(timeout=10.0, headers=self._get_headers()) as client:
                params = {
                    "query": query,
                    "limit": limit,
                    "app_id": self.app_id
                }
                
                response = await client.get(
                    f"{self.BASE_URL}/album/search",
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return self._parse_albums(data.get("albums", {}).get("items", []))
        except Exception as e:
            print(f"Qobuz album search error: {e}")
        
        return []
    
    async def search_tracks(self, query: str, limit: int = 20) -> List[TrackResponse]:
        """Search specifically for tracks"""
        try:
            async with httpx.AsyncClient(timeout=10.0, headers=self._get_headers()) as client:
                params = {
                    "query": query,
                    "limit": limit,
                    "app_id": self.app_id
                }
                
                response = await client.get(
                    f"{self.BASE_URL}/track/search",
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return self._parse_tracks(data.get("tracks", {}).get("items", []))
        except Exception as e:
            print(f"Qobuz track search error: {e}")
        
        return []
    
    async def search_artists(self, query: str, limit: int = 20) -> List[ArtistResponse]:
        """Search specifically for artists"""
        try:
            async with httpx.AsyncClient(timeout=10.0, headers=self._get_headers()) as client:
                params = {
                    "query": query,
                    "limit": limit,
                    "app_id": self.app_id
                }
                
                response = await client.get(
                    f"{self.BASE_URL}/artist/search",
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return self._parse_artists(data.get("artists", {}).get("items", []))
        except Exception as e:
            print(f"Qobuz artist search error: {e}")
        
        return []
    
    async def get_artist_image(self, artist_name: str) -> Optional[str]:
        """Get artist image URL by searching for the artist name"""
        try:
            artists = await self.search_artists(artist_name, limit=5)
            if artists:
                # Find best match (exact name match preferred)
                for artist in artists:
                    if artist.name.lower() == artist_name.lower() and artist.image_url:
                        return artist.image_url
                # Fallback to first result with image
                for artist in artists:
                    if artist.image_url:
                        return artist.image_url
        except Exception as e:
            print(f"Error getting artist image for {artist_name}: {e}")
        return None
    
    async def get_album(self, album_id: str) -> Optional[AlbumResponse]:
        """Get album details including tracks"""
        try:
            async with httpx.AsyncClient(timeout=10.0, headers=self._get_headers()) as client:
                params = {
                    "album_id": album_id,
                    "app_id": self.app_id
                }
                
                response = await client.get(
                    f"{self.BASE_URL}/album/get",
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return self._parse_album_detail(data)
        except Exception as e:
            print(f"Qobuz get album error: {e}")
        
        return None
    
    async def get_trending(self) -> Dict[str, List[AlbumResponse]]:
        """Get trending, new releases, and featured albums"""
        results = {
            "new_releases": [],
            "trending": [],
            "featured": []
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0, headers=self._get_headers()) as client:
                # Get new releases
                new_params = {
                    "type": "new-releases",
                    "limit": 20,
                    "app_id": self.app_id
                }
                
                new_response = await client.get(
                    f"{self.BASE_URL}/album/getFeatured",
                    params=new_params
                )
                
                print(f"Qobuz new releases status: {new_response.status_code}, app_id: {self.app_id}")
                if new_response.status_code == 200:
                    data = new_response.json()
                    items = data.get("albums", {}).get("items", [])
                    print(f"Qobuz found {len(items)} new releases")
                    results["new_releases"] = self._parse_albums(items)
                else:
                    print(f"Qobuz new releases failed: {new_response.text[:300]}")
                
                # Get press awards/trending
                trending_params = {
                    "type": "press-awards",
                    "limit": 20,
                    "app_id": self.app_id
                }
                
                trending_response = await client.get(
                    f"{self.BASE_URL}/album/getFeatured",
                    params=trending_params
                )
                
                if trending_response.status_code == 200:
                    data = trending_response.json()
                    results["trending"] = self._parse_albums(
                        data.get("albums", {}).get("items", [])
                    )
                
                # Get editor picks/featured
                featured_params = {
                    "type": "editor-picks",
                    "limit": 20,
                    "app_id": self.app_id
                }
                
                featured_response = await client.get(
                    f"{self.BASE_URL}/album/getFeatured",
                    params=featured_params
                )
                
                if featured_response.status_code == 200:
                    data = featured_response.json()
                    results["featured"] = self._parse_albums(
                        data.get("albums", {}).get("items", [])
                    )
                    
        except Exception as e:
            print(f"Qobuz trending error: {e}")
        
        return results
    
    def _parse_albums(self, items: List[Dict]) -> List[AlbumResponse]:
        """Parse album items from API response"""
        albums = []
        for item in items:
            try:
                # Skip if item is not a dict (sometimes API returns weird data)
                if not isinstance(item, dict):
                    continue
                
                # Handle artist - can be nested object or direct
                artist_data = item.get("artist", {})
                if isinstance(artist_data, dict):
                    artist_name = artist_data.get("name", "Unknown Artist")
                else:
                    artist_name = str(artist_data) if artist_data else "Unknown Artist"
                
                qobuz_id = str(item.get("id", ""))
                
                # Build Qobuz URL
                slug = item.get("slug", "")
                qobuz_url = f"https://www.qobuz.com/us-en/album/{slug}/{qobuz_id}" if slug else None
                
                # Get cover art - prefer largest available
                image = item.get("image", {})
                if isinstance(image, dict):
                    cover_art_url = (
                        image.get("large") or 
                        image.get("small") or 
                        image.get("thumbnail")
                    )
                else:
                    cover_art_url = None
                
                # Handle genre - can be nested or direct
                genre_data = item.get("genre", {})
                if isinstance(genre_data, dict):
                    genre = genre_data.get("name")
                else:
                    genre = str(genre_data) if genre_data else None
                
                # Handle released_at - can be string or timestamp
                released_at = item.get("released_at")
                if isinstance(released_at, str) and len(released_at) >= 10:
                    release_date = released_at[:10]
                elif isinstance(released_at, (int, float)):
                    from datetime import datetime
                    release_date = datetime.fromtimestamp(released_at).strftime("%Y-%m-%d")
                else:
                    release_date = None
                
                # Debug: print cover URL for first few albums
                if len(albums) < 3:
                    print(f"Album: {item.get('title')} - Cover URL: {cover_art_url}")
                
                albums.append(AlbumResponse(
                    title=item.get("title", "Unknown Album"),
                    artist_name=artist_name,
                    qobuz_id=qobuz_id,
                    qobuz_url=qobuz_url,
                    cover_art_url=cover_art_url,
                    release_date=release_date,
                    genre=genre,
                    total_tracks=item.get("tracks_count"),
                    duration=item.get("duration"),
                    is_downloaded=False
                ))
            except Exception as e:
                print(f"Error parsing album: {e} - Item: {item}")
                continue
        
        return albums
    
    def _parse_tracks(self, items: List[Dict]) -> List[TrackResponse]:
        """Parse track items from API response"""
        tracks = []
        for item in items:
            try:
                if not isinstance(item, dict):
                    continue
                
                # Handle performer/artist
                performer = item.get("performer", {})
                if isinstance(performer, dict):
                    artist_name = performer.get("name", "")
                else:
                    artist_name = ""
                
                # Fallback to album artist
                if not artist_name:
                    album = item.get("album", {})
                    if isinstance(album, dict):
                        album_artist = album.get("artist", {})
                        if isinstance(album_artist, dict):
                            artist_name = album_artist.get("name", "Unknown Artist")
                        else:
                            artist_name = "Unknown Artist"
                    else:
                        artist_name = "Unknown Artist"
                
                album = item.get("album", {})
                album_title = None
                cover_art_url = None
                qobuz_album_id = None
                qobuz_album_url = None
                
                if isinstance(album, dict):
                    album_title = album.get("title")
                    qobuz_album_id = str(album.get("id", "")) if album.get("id") else None
                    album_slug = album.get("slug", "")
                    if qobuz_album_id:
                        # Use slug if available, otherwise use placeholder
                        if album_slug:
                            qobuz_album_url = f"https://www.qobuz.com/us-en/album/{album_slug}/{qobuz_album_id}"
                        else:
                            qobuz_album_url = f"https://www.qobuz.com/us-en/album/-/{qobuz_album_id}"
                    
                    album_image = album.get("image", {})
                    if isinstance(album_image, dict):
                        cover_art_url = (
                            album_image.get("large") or 
                            album_image.get("small") or 
                            album_image.get("thumbnail")
                        )
                
                tracks.append(TrackResponse(
                    title=item.get("title", "Unknown Track"),
                    artist_name=artist_name,
                    album_title=album_title,
                    qobuz_id=str(item.get("id", "")),
                    qobuz_album_id=qobuz_album_id,
                    qobuz_album_url=qobuz_album_url,
                    track_number=item.get("track_number"),
                    duration=item.get("duration"),
                    duration_formatted=self._format_duration(item.get("duration")),
                    is_downloaded=False,
                    cover_art_url=cover_art_url
                ))
            except Exception as e:
                print(f"Error parsing track: {e} - Item: {item}")
                continue
        
        return tracks
    
    def _parse_artists(self, items: List[Dict]) -> List[ArtistResponse]:
        """Parse artist items from API response"""
        artists = []
        for item in items:
            try:
                if not isinstance(item, dict):
                    continue
                
                image = item.get("image", {})
                if isinstance(image, dict):
                    image_url = (
                        image.get("large") or 
                        image.get("medium") or 
                        image.get("small")
                    )
                else:
                    image_url = None
                
                bio_data = item.get("biography", {})
                if isinstance(bio_data, dict):
                    bio = bio_data.get("content")
                else:
                    bio = None
                
                artists.append(ArtistResponse(
                    name=item.get("name", "Unknown Artist"),
                    qobuz_id=str(item.get("id", "")),
                    image_url=image_url,
                    bio=bio
                ))
            except Exception as e:
                print(f"Error parsing artist: {e} - Item: {item}")
                continue
        
        return artists
    
    def _parse_album_detail(self, data: Dict) -> AlbumResponse:
        """Parse detailed album response including tracks"""
        # Safely get artist name
        artist_data = data.get("artist")
        if isinstance(artist_data, dict):
            artist_name = artist_data.get("name", "Unknown Artist")
        else:
            artist_name = "Unknown Artist"
        
        qobuz_id = str(data.get("id", ""))
        slug = data.get("slug", "")
        
        # Safely get cover art
        image = data.get("image")
        if isinstance(image, dict):
            cover_art_url = (
                image.get("large") or 
                image.get("small") or 
                image.get("thumbnail")
            )
        else:
            cover_art_url = None
        
        # Safely get genre
        genre_data = data.get("genre")
        genre = genre_data.get("name") if isinstance(genre_data, dict) else None
        
        # Parse tracks
        tracks = []
        tracks_data = data.get("tracks")
        track_items = tracks_data.get("items", []) if isinstance(tracks_data, dict) else []
        
        for item in track_items:
            # Safely get performer name
            performer = item.get("performer")
            track_artist = performer.get("name", artist_name) if isinstance(performer, dict) else artist_name
            
            tracks.append(TrackResponse(
                title=item.get("title", "Unknown Track"),
                artist_name=track_artist,
                album_title=data.get("title"),
                qobuz_id=str(item.get("id", "")),
                track_number=item.get("track_number"),
                disc_number=item.get("media_number", 1),
                duration=item.get("duration"),
                duration_formatted=self._format_duration(item.get("duration")),
                is_downloaded=False,
                cover_art_url=cover_art_url
            ))
        
        # Safely get release date
        released_at = data.get("released_at")
        release_date = released_at[:10] if isinstance(released_at, str) and released_at else None
        
        return AlbumResponse(
            title=data.get("title", "Unknown Album"),
            artist_name=artist_name,
            qobuz_id=qobuz_id,
            qobuz_url=f"https://www.qobuz.com/us-en/album/{slug}/{qobuz_id}" if slug else None,
            cover_art_url=cover_art_url,
            release_date=release_date,
            genre=genre,
            total_tracks=data.get("tracks_count"),
            duration=data.get("duration"),
            duration_formatted=self._format_duration(data.get("duration")),
            is_downloaded=False,
            tracks=tracks
        )
    
    def _format_duration(self, seconds: Optional[int]) -> str:
        """Format duration in seconds to MM:SS or HH:MM:SS"""
        if not seconds:
            return "0:00"
        
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        
        if hours > 0:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        return f"{minutes}:{secs:02d}"
    
    @staticmethod
    def extract_album_id_from_url(url: str) -> Optional[str]:
        """Extract album ID from a Qobuz URL"""
        # URL format: https://www.qobuz.com/us-en/album/album-name/album_id
        try:
            parts = url.rstrip("/").split("/")
            return parts[-1]
        except:
            return None
