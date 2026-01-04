from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import shutil
import os

from app.database import get_db
from app.models.user import User
from app.models.music import Album, Track, Artist
from app.models.settings import QobuzConfig, StorageLocation, AppSettings
from app.schemas.settings import (
    QobuzConfigCreate, QobuzConfigResponse, 
    StorageLocationCreate, StorageLocationResponse,
    SystemStatusResponse, QUALITY_LABELS
)
from app.services.auth import get_current_admin_user
from app.services.streamrip import StreamripService
from app.services.cache import cache_clear_pattern

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get overall system status"""
    # Check for admin
    admin_result = await db.execute(
        select(User).where(User.is_admin == True)
    )
    has_admin = admin_result.scalar_one_or_none() is not None
    
    # Check for Qobuz config
    qobuz_result = await db.execute(
        select(QobuzConfig).where(QobuzConfig.is_configured == True)
    )
    has_qobuz = qobuz_result.scalar_one_or_none() is not None
    
    # Get storage locations
    storage_result = await db.execute(select(StorageLocation))
    storage_locations = storage_result.scalars().all()
    
    # Get counts
    tracks_count = await db.execute(select(func.count(Track.id)))
    albums_count = await db.execute(select(func.count(Album.id)))
    artists_count = await db.execute(select(func.count(Artist.id)))
    
    return SystemStatusResponse(
        is_setup_complete=has_admin and has_qobuz,
        needs_admin=not has_admin,
        needs_qobuz_config=not has_qobuz,
        storage_locations=[StorageLocationResponse.model_validate(s) for s in storage_locations],
        total_tracks=tracks_count.scalar() or 0,
        total_albums=albums_count.scalar() or 0,
        total_artists=artists_count.scalar() or 0
    )


@router.get("/qobuz-config", response_model=QobuzConfigResponse)
async def get_qobuz_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get current Qobuz configuration"""
    result = await db.execute(select(QobuzConfig))
    config = result.scalar_one_or_none()
    
    if not config:
        # Return empty config
        return QobuzConfigResponse(
            id=0,
            quality=1,
            quality_label=QUALITY_LABELS[1],
            download_booklets=True,
            use_auth_token=True,
            is_configured=False
        )
    
    return QobuzConfigResponse(
        id=config.id,
        quality=config.quality,
        quality_label=QUALITY_LABELS.get(config.quality, "Unknown"),
        download_booklets=config.download_booklets,
        use_auth_token=config.use_auth_token,
        email_or_userid=config.email_or_userid,
        has_password_or_token=bool(config.password_or_token),
        app_id=config.app_id,
        has_secrets=bool(config.secrets),
        is_configured=config.is_configured,
        updated_at=config.updated_at
    )


@router.post("/qobuz-config", response_model=QobuzConfigResponse)
async def save_qobuz_config(
    config_data: QobuzConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Save Qobuz configuration"""
    result = await db.execute(select(QobuzConfig))
    config = result.scalar_one_or_none()
    
    if config:
        # Update existing
        config.quality = config_data.quality
        config.download_booklets = config_data.download_booklets
        config.use_auth_token = config_data.use_auth_token
        if config_data.email_or_userid:
            config.email_or_userid = config_data.email_or_userid
        if config_data.password_or_token:
            config.password_or_token = config_data.password_or_token
        if config_data.app_id:
            config.app_id = config_data.app_id
        if config_data.secrets:
            config.secrets = config_data.secrets
        
        # Mark as configured if we have credentials
        config.is_configured = bool(
            config.email_or_userid and 
            config.password_or_token
        )
    else:
        # Create new
        config = QobuzConfig(
            quality=config_data.quality,
            download_booklets=config_data.download_booklets,
            use_auth_token=config_data.use_auth_token,
            email_or_userid=config_data.email_or_userid,
            password_or_token=config_data.password_or_token,
            app_id=config_data.app_id,
            secrets=config_data.secrets,
            is_configured=bool(
                config_data.email_or_userid and 
                config_data.password_or_token
            )
        )
        db.add(config)
    
    await db.commit()
    await db.refresh(config)
    
    # Update streamrip config file
    streamrip_service = StreamripService()
    await streamrip_service.update_config(config)
    
    return QobuzConfigResponse(
        id=config.id,
        quality=config.quality,
        quality_label=QUALITY_LABELS.get(config.quality, "Unknown"),
        download_booklets=config.download_booklets,
        use_auth_token=config.use_auth_token,
        email_or_userid=config.email_or_userid,
        has_password_or_token=bool(config.password_or_token),
        app_id=config.app_id,
        has_secrets=bool(config.secrets),
        is_configured=config.is_configured,
        updated_at=config.updated_at
    )


@router.get("/storage", response_model=list[StorageLocationResponse])
async def get_storage_locations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get all storage locations"""
    result = await db.execute(select(StorageLocation))
    locations = result.scalars().all()
    
    # Build response manually to avoid async lazy loading issues
    responses = []
    for location in locations:
        total_space = None
        free_space = None
        try:
            usage = shutil.disk_usage(location.path)
            total_space = format_bytes(usage.total)
            free_space = format_bytes(usage.free)
            # Update in DB
            location.total_space = total_space
            location.free_space = free_space
        except:
            pass
        
        responses.append(StorageLocationResponse(
            id=location.id,
            name=location.name,
            path=location.path,
            is_primary=location.is_primary,
            total_space=total_space or location.total_space,
            free_space=free_space or location.free_space,
            created_at=location.created_at,
            updated_at=location.updated_at
        ))
    
    await db.commit()
    
    return responses


@router.post("/storage", response_model=StorageLocationResponse)
async def add_storage_location(
    location_data: StorageLocationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Add a new storage location"""
    # Verify path exists
    if not os.path.exists(location_data.path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path does not exist"
        )
    
    if not os.path.isdir(location_data.path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path is not a directory"
        )
    
    # If setting as primary, unset other primaries
    if location_data.is_primary:
        await db.execute(
            StorageLocation.__table__.update().values(is_primary=False)
        )
    
    # Get disk space
    try:
        usage = shutil.disk_usage(location_data.path)
        total_space = format_bytes(usage.total)
        free_space = format_bytes(usage.free)
    except:
        total_space = None
        free_space = None
    
    location = StorageLocation(
        name=location_data.name,
        path=location_data.path,
        is_active=location_data.is_active,
        is_primary=location_data.is_primary,
        total_space=total_space,
        free_space=free_space
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    
    return StorageLocationResponse.model_validate(location)


@router.put("/storage/{location_id}", response_model=StorageLocationResponse)
async def update_storage_location(
    location_id: int,
    location_data: StorageLocationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update a storage location"""
    result = await db.execute(
        select(StorageLocation).where(StorageLocation.id == location_id)
    )
    location = result.scalar_one_or_none()
    
    if not location:
        raise HTTPException(status_code=404, detail="Storage location not found")
    
    # If setting as primary, unset other primaries
    if location_data.is_primary and not location.is_primary:
        await db.execute(
            StorageLocation.__table__.update().values(is_primary=False)
        )
    
    location.name = location_data.name
    location.path = location_data.path
    location.is_active = location_data.is_active
    location.is_primary = location_data.is_primary
    
    await db.commit()
    await db.refresh(location)
    
    return StorageLocationResponse.model_validate(location)


@router.delete("/storage/{location_id}")
async def delete_storage_location(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a storage location"""
    result = await db.execute(
        select(StorageLocation).where(StorageLocation.id == location_id)
    )
    location = result.scalar_one_or_none()
    
    if not location:
        raise HTTPException(status_code=404, detail="Storage location not found")
    
    await db.delete(location)
    await db.commit()
    
    return {"message": "Storage location deleted"}


@router.get("/quality-options")
async def get_quality_options():
    """Get available quality options"""
    return [
        {"value": k, "label": v}
        for k, v in QUALITY_LABELS.items()
    ]


@router.get("/settings/direct-download")
async def get_direct_download_setting(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get direct download setting"""
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == "direct_download_enabled")
    )
    setting = result.scalar_one_or_none()
    return {"enabled": setting.value == "true" if setting else False}


@router.post("/settings/direct-download")
async def set_direct_download_setting(
    enabled: bool,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Enable/disable direct download feature"""
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == "direct_download_enabled")
    )
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.value = "true" if enabled else "false"
    else:
        setting = AppSettings(
            key="direct_download_enabled",
            value="true" if enabled else "false",
            value_type="bool",
            description="Allow users to download albums directly to their device"
        )
        db.add(setting)
    
    await db.commit()
    return {"enabled": enabled}


def format_bytes(size: int) -> str:
    """Format bytes to human readable string"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} PB"


@router.post("/clear-cache")
async def clear_cache(
    current_user: User = Depends(get_current_admin_user)
):
    """Clear all search and Qobuz caches"""
    search_cleared = await cache_clear_pattern("search_qobuz:*")
    qobuz_cleared = await cache_clear_pattern("qobuz:*")
    trending_cleared = await cache_clear_pattern("trending:*")
    
    total = search_cleared + qobuz_cleared + trending_cleared
    return {"message": f"Cleared {total} cached items", "count": total}
