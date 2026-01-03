from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.settings import QobuzConfig
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse, PinLogin, SetupCheck
from app.services.auth import (
    get_password_hash, verify_password, create_access_token, 
    get_current_user, get_current_admin_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/setup-status", response_model=SetupCheck)
async def check_setup_status(db: AsyncSession = Depends(get_db)):
    """Check if initial setup is complete"""
    # Check for admin user
    admin_result = await db.execute(
        select(User).where(User.is_admin == True)
    )
    has_admin = admin_result.scalar_one_or_none() is not None
    
    # Check for Qobuz config
    qobuz_result = await db.execute(
        select(QobuzConfig).where(QobuzConfig.is_configured == True)
    )
    has_qobuz = qobuz_result.scalar_one_or_none() is not None
    
    return SetupCheck(
        is_setup_complete=has_admin and has_qobuz,
        needs_admin=not has_admin,
        needs_qobuz_config=not has_qobuz
    )


@router.post("/setup", response_model=TokenResponse)
async def initial_setup(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create the initial admin user (only works if no admin exists)"""
    # Check if admin already exists
    result = await db.execute(
        select(User).where(User.is_admin == True)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setup already complete. Admin user exists."
        )
    
    # Create admin user
    hashed_password = get_password_hash(user_data.password)
    admin_user = User(
        username=user_data.username,
        hashed_password=hashed_password,
        is_admin=True,
        pin=user_data.pin
    )
    db.add(admin_user)
    await db.commit()
    await db.refresh(admin_user)
    
    # Create token
    access_token = create_access_token(data={"sub": admin_user.username})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(admin_user)
    )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with username and password"""
    result = await db.execute(
        select(User).where(User.username == credentials.username)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    
    access_token = create_access_token(data={"sub": user.username})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.post("/pin-login", response_model=TokenResponse)
async def pin_login(credentials: PinLogin, db: AsyncSession = Depends(get_db)):
    """Quick login with PIN (admin only)"""
    result = await db.execute(
        select(User).where(User.pin == credentials.pin, User.is_admin == True)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid PIN"
        )
    
    access_token = create_access_token(data={"sub": user.username})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse.model_validate(current_user)


@router.post("/change-password")
async def change_password(
    old_password: str,
    new_password: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change current user's password"""
    if not verify_password(old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid current password"
        )
    
    current_user.hashed_password = get_password_hash(new_password)
    await db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/change-pin")
async def change_pin(
    new_pin: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Change admin PIN"""
    if len(new_pin) < 4 or len(new_pin) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN must be 4-10 characters"
        )
    
    current_user.pin = new_pin
    await db.commit()
    
    return {"message": "PIN changed successfully"}
