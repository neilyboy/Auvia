import asyncio
import os
import toml
from typing import Tuple, Optional
from pathlib import Path


class StreamripService:
    """Service for interacting with streamrip CLI"""
    
    CONFIG_PATH = Path.home() / ".config" / "streamrip" / "config.toml"
    
    def __init__(self):
        self.config_path = self.CONFIG_PATH
    
    async def download(self, url: str, output_path: str) -> Tuple[bool, Optional[str]]:
        """
        Download an album from Qobuz using streamrip.
        Returns (success, output_directory)
        """
        try:
            # Ensure output directory exists
            os.makedirs(output_path, exist_ok=True)
            
            # Update config with download path before downloading
            await self._set_download_folder(output_path)
            
            # Build streamrip command with -ndb to skip internal database check
            # This ensures re-downloads work even if streamrip thinks it already has the file
            cmd = ["rip", "-ndb", "url", url]
            
            print(f"Executing: {' '.join(cmd)}")
            
            # Execute streamrip
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            stdout_text = stdout.decode() if stdout else ""
            stderr_text = stderr.decode() if stderr else ""
            
            print(f"Streamrip stdout: {stdout_text[:500]}")
            if stderr_text:
                print(f"Streamrip stderr: {stderr_text[:500]}")
            
            if process.returncode == 0:
                return True, output_path
            else:
                print(f"Streamrip error (code {process.returncode}): {stderr_text}")
                return False, None
                
        except Exception as e:
            print(f"Download error: {e}")
            return False, None
    
    async def _set_download_folder(self, folder: str) -> bool:
        """Update the download folder in streamrip config"""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            
            if self.config_path.exists():
                config = toml.load(self.config_path)
            else:
                config = self._get_default_config()
            
            if "downloads" not in config:
                config["downloads"] = {}
            
            config["downloads"]["folder"] = folder
            
            with open(self.config_path, "w") as f:
                toml.dump(config, f)
            
            return True
        except Exception as e:
            print(f"Error setting download folder: {e}")
            return False
    
    async def update_config(self, qobuz_config) -> bool:
        """Update streamrip configuration file with Qobuz credentials"""
        try:
            # Ensure config directory exists
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Load existing config or create new one
            if self.config_path.exists():
                config = toml.load(self.config_path)
            else:
                config = self._get_default_config()
            
            # Update Qobuz section
            if "qobuz" not in config:
                config["qobuz"] = {}
            
            config["qobuz"]["quality"] = qobuz_config.quality
            config["qobuz"]["download_booklets"] = qobuz_config.download_booklets
            config["qobuz"]["use_auth_token"] = qobuz_config.use_auth_token
            
            if qobuz_config.email_or_userid:
                config["qobuz"]["email_or_userid"] = qobuz_config.email_or_userid
            
            if qobuz_config.password_or_token:
                config["qobuz"]["password_or_token"] = qobuz_config.password_or_token
            
            if qobuz_config.app_id:
                config["qobuz"]["app_id"] = qobuz_config.app_id
            
            if qobuz_config.secrets:
                config["qobuz"]["secrets"] = qobuz_config.secrets
            
            # Ensure filepaths section has correct folder format (no [container] suffix)
            if "filepaths" not in config:
                config["filepaths"] = {}
            config["filepaths"]["folder_format"] = "{albumartist} - {title} ({year})"
            config["filepaths"]["track_format"] = "{tracknumber}. {artist} - {title}"
            
            # Write config
            with open(self.config_path, "w") as f:
                toml.dump(config, f)
            
            return True
            
        except Exception as e:
            print(f"Error updating streamrip config: {e}")
            return False
    
    def _get_default_config(self) -> dict:
        """Get default streamrip configuration"""
        return {
            "downloads": {
                "folder": "/music",
                "source_subdirectories": False,
                "disc_subdirectories": True,
                "concurrency": True,
                "max_connections": 6,
                "requests_per_minute": -1
            },
            "qobuz": {
                "quality": 1,
                "download_booklets": True,
                "use_auth_token": True,
                "email_or_userid": "",
                "password_or_token": "",
                "app_id": "950096963",
                "secrets": ["979549437fcc4a3faad4867b5cd25dcb"]
            },
            "tidal": {
                "quality": 3,
                "download_videos": True
            },
            "deezer": {
                "quality": 2,
                "deezloader_warnings": True
            },
            "soundcloud": {
                "quality": 0
            },
            "youtube": {
                "quality": 0,
                "download_videos": False
            },
            "filepaths": {
                "add_singles_to_folder": False,
                "folder_format": "{albumartist} - {title} ({year})",
                "track_format": "{tracknumber}. {artist} - {title}"
            },
            "artwork": {
                "embed": True,
                "embed_size": "large",
                "embed_max_width": -1,
                "save_artwork": True,
                "saved_max_width": -1
            },
            "metadata": {
                "set_playlist_to_album": True,
                "exclude": []
            },
            "conversion": {
                "enabled": False,
                "codec": "MP3",
                "sampling_rate": 48000,
                "bit_depth": 24,
                "lossy_bitrate": 320
            },
            "misc": {
                "version": "2.0"
            },
            "cli": {
                "text_output": True,
                "progress_bars": True,
                "max_search_results": 100
            },
            "database": {
                "downloads_enabled": True,
                "downloads_path": "/root/.config/streamrip/downloads.db",
                "failed_downloads_enabled": True,
                "failed_downloads_path": "/root/.config/streamrip/failed_downloads.db"
            }
        }
    
    async def verify_credentials(self) -> Tuple[bool, str]:
        """Verify Qobuz credentials are working"""
        try:
            # Try a simple search to verify credentials
            process = await asyncio.create_subprocess_exec(
                "rip", "search", "qobuz", "album", "test",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                return True, "Credentials verified"
            else:
                return False, stderr.decode() or "Authentication failed"
                
        except Exception as e:
            return False, str(e)
    
    def get_config(self) -> Optional[dict]:
        """Get current streamrip configuration"""
        try:
            if self.config_path.exists():
                return toml.load(self.config_path)
        except:
            pass
        return None
    
    async def download_to_path(self, url: str, output_path: str, quality: int = 1) -> bool:
        """
        Download an album to a specific path with specified quality.
        Used for direct downloads to user's device.
        
        Quality: 1=MP3 320, 2=16/44.1, 3=24/96, 4=24/192
        """
        try:
            # Ensure output directory exists
            os.makedirs(output_path, exist_ok=True)
            
            # Save current config
            original_config = None
            if self.config_path.exists():
                original_config = toml.load(self.config_path)
            
            # Update config with download path and quality
            config = original_config.copy() if original_config else self._get_default_config()
            
            if "downloads" not in config:
                config["downloads"] = {}
            config["downloads"]["folder"] = output_path
            
            if "qobuz" not in config:
                config["qobuz"] = {}
            config["qobuz"]["quality"] = quality
            
            # Write temporary config
            with open(self.config_path, "w") as f:
                toml.dump(config, f)
            
            # Build streamrip command
            cmd = ["rip", "-ndb", "url", url]
            
            print(f"Direct download: {' '.join(cmd)} (quality={quality})")
            
            # Execute streamrip
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            stdout_text = stdout.decode() if stdout else ""
            stderr_text = stderr.decode() if stderr else ""
            
            print(f"Streamrip stdout: {stdout_text[:500]}")
            if stderr_text:
                print(f"Streamrip stderr: {stderr_text[:500]}")
            
            # Restore original config
            if original_config:
                with open(self.config_path, "w") as f:
                    toml.dump(original_config, f)
            
            return process.returncode == 0
            
        except Exception as e:
            print(f"Direct download error: {e}")
            # Try to restore original config
            if original_config:
                try:
                    with open(self.config_path, "w") as f:
                        toml.dump(original_config, f)
                except:
                    pass
            return False
