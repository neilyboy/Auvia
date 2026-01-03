from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import settings
from app.database import init_db
from app.routers import auth, music, admin, queue, search


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    
    # Initialize default storage locations if none exist
    from app.database import async_session_maker
    from app.models.settings import StorageLocation
    from sqlalchemy import select
    
    async with async_session_maker() as db:
        result = await db.execute(select(StorageLocation))
        if not result.scalars().first():
            # Add default storage locations
            default_locations = [
                StorageLocation(
                    name="Primary Music Storage",
                    path="/music",
                    is_active=True,
                    is_primary=True
                ),
                StorageLocation(
                    name="Secondary Storage",
                    path="/music2",
                    is_active=True,
                    is_primary=False
                ),
                StorageLocation(
                    name="Tertiary Storage",
                    path="/music3",
                    is_active=True,
                    is_primary=False
                )
            ]
            for loc in default_locations:
                db.add(loc)
            await db.commit()
    
    # Verify local files on startup to detect missing files
    from app.services.music import MusicService
    async with async_session_maker() as db:
        music_service = MusicService(db)
        stats = await music_service.verify_local_files()
        print(f"Startup file verification: {stats}")
    
    yield
    # Shutdown
    pass


app = FastAPI(
    title=settings.app_name,
    description=f"{settings.app_name} - {settings.app_tagline}. A modern jukebox web application.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(music.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(queue.router, prefix="/api")
app.include_router(search.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "tagline": settings.app_tagline
    }


@app.get("/api/info")
async def app_info():
    """Get application info"""
    return {
        "name": settings.app_name,
        "tagline": settings.app_tagline,
        "version": "1.0.0"
    }


# Serve cover art and audio files
if os.path.exists("/music"):
    app.mount("/files/music", StaticFiles(directory="/music"), name="music")
if os.path.exists("/music2"):
    app.mount("/files/music2", StaticFiles(directory="/music2"), name="music2")
if os.path.exists("/music3"):
    app.mount("/files/music3", StaticFiles(directory="/music3"), name="music3")
