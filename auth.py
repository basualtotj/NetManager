"""
NetManager — Authentication
JWT tokens + password hashing + role-based access
"""
import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import hashlib
import hmac
import json
import base64

from database import get_db, User, UserSite, Site

# ============================================
# CONFIG
# ============================================

SECRET_KEY = os.getenv("SECRET_KEY", "netmanager-secret-change-in-production-2024")
TOKEN_EXPIRE_HOURS = 72

security = HTTPBearer(auto_error=False)


# ============================================
# PASSWORD HASHING (simple, no bcrypt dependency)
# ============================================

def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return f"{salt}${h.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, h = password_hash.split("$")
        expected = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
        return hmac.compare_digest(expected.hex(), h)
    except Exception:
        return False


# ============================================
# JWT (simple, no PyJWT dependency)
# ============================================

def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _b64decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * padding)

def create_token(user_id: int, username: str, role: str) -> str:
    header = _b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload_data = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": (datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)).isoformat()
    }
    payload = _b64encode(json.dumps(payload_data).encode())
    signature = hmac.new(SECRET_KEY.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    sig = _b64encode(signature)
    return f"{header}.{payload}.{sig}"


def decode_token(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, payload, sig = parts
        expected_sig = hmac.new(SECRET_KEY.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64encode(expected_sig), sig):
            return None
        data = json.loads(_b64decode(payload))
        if datetime.fromisoformat(data["exp"]) < datetime.utcnow():
            return None
        return data
    except Exception:
        return None


# ============================================
# DEPENDENCIES
# ============================================

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Require valid JWT token, return User object"""
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token requerido")
    data = decode_token(credentials.credentials)
    if not data:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o expirado")
    user = db.query(User).get(data["sub"])
    if not user or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario no encontrado o inactivo")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Require admin role"""
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Se requiere rol admin")
    return user


def get_user_site_ids(user: User, db: Session) -> list:
    """Get list of site IDs the user can access"""
    if user.role == "admin":
        return [s.id for s in db.query(Site).all()]
    return [us.site_id for us in db.query(UserSite).filter_by(user_id=user.id).all()]


def check_site_access(user: User, site_id: int, db: Session):
    """Raise 403 if user can't access this site"""
    if user.role == "admin":
        return
    has_access = db.query(UserSite).filter_by(user_id=user.id, site_id=site_id).first()
    if not has_access:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso a este sitio")


# ============================================
# SEED ADMIN USER
# ============================================

def ensure_admin_exists(db: Session):
    """Create default admin user if none exists"""
    admin = db.query(User).filter_by(role="admin").first()
    if not admin:
        admin = User(
            username="admin",
            display_name="Administrador",
            password_hash=hash_password("admin123"),
            role="admin"
        )
        db.add(admin)
        db.commit()
        print(">>> Default admin created: admin / admin123")
