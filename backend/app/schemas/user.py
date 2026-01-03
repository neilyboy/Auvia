from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    is_admin: bool = False
    pin: Optional[str] = Field(None, min_length=4, max_length=10)


class UserLogin(BaseModel):
    username: str
    password: str


class PinLogin(BaseModel):
    pin: str


class UserResponse(BaseModel):
    id: int
    username: str
    is_admin: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SetupCheck(BaseModel):
    is_setup_complete: bool
    needs_admin: bool
    needs_qobuz_config: bool
