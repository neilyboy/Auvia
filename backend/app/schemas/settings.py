from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class QobuzConfigCreate(BaseModel):
    quality: int = 1  # 1: 320kbps MP3, 2: 16/44.1, 3: 24/<=96, 4: 24/>=96
    download_booklets: bool = True
    use_auth_token: bool = True
    email_or_userid: Optional[str] = None
    password_or_token: Optional[str] = None
    app_id: Optional[str] = None
    secrets: Optional[List[str]] = None


class QobuzConfigResponse(BaseModel):
    id: int
    quality: int
    quality_label: str = ""
    download_booklets: bool
    use_auth_token: bool
    email_or_userid: Optional[str] = None
    # Don't expose the actual token, just indicate if it's set
    has_password_or_token: bool = False
    app_id: Optional[str] = None
    has_secrets: bool = False
    is_configured: bool
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StorageLocationCreate(BaseModel):
    name: str
    path: str
    is_active: bool = True
    is_primary: bool = False


class StorageLocationResponse(BaseModel):
    id: int
    name: str
    path: str
    is_active: bool
    is_primary: bool
    total_space: Optional[str] = None
    free_space: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AppSettingResponse(BaseModel):
    id: int
    key: str
    value: Optional[str] = None
    value_type: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class SystemStatusResponse(BaseModel):
    is_setup_complete: bool
    needs_admin: bool
    needs_qobuz_config: bool
    storage_locations: List[StorageLocationResponse] = []
    total_tracks: int = 0
    total_albums: int = 0
    total_artists: int = 0
    queue_length: int = 0


QUALITY_LABELS = {
    1: "320kbps MP3",
    2: "CD Quality (16-bit/44.1kHz)",
    3: "Hi-Res (24-bit/96kHz)",
    4: "Hi-Res+ (24-bit/192kHz)"
}
