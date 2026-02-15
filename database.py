"""
NetManager — Database Models & Connection
SQLite with SQLAlchemy ORM
"""
import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean, Float,
    DateTime, ForeignKey, Text, JSON, event
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////app/data/netmanager.db")

# Ensure data directory exists for Docker volume
if DATABASE_URL.startswith("sqlite:////"):
    _db_path = DATABASE_URL.replace("sqlite:////", "/")
elif DATABASE_URL.startswith("sqlite:///"):
    _db_path = DATABASE_URL.replace("sqlite:///", "")
else:
    _db_path = ""

if _db_path:
    _db_dir = os.path.dirname(_db_path)
    if _db_dir and not os.path.exists(_db_dir):
        os.makedirs(_db_dir, exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ============================================
# MODELS
# ============================================

class Site(Base):
    __tablename__ = "sites"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    address = Column(String(500), default="")
    contact = Column(String(200), default="")
    phone = Column(String(50), default="")
    email = Column(String(200), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    buildings = relationship("Building", back_populates="site", cascade="all, delete-orphan")
    racks = relationship("Rack", back_populates="site", cascade="all, delete-orphan")
    routers = relationship("Router", back_populates="site", cascade="all, delete-orphan")
    switches = relationship("Switch", back_populates="site", cascade="all, delete-orphan")
    recorders = relationship("Recorder", back_populates="site", cascade="all, delete-orphan")
    cameras = relationship("Camera", back_populates="site", cascade="all, delete-orphan")
    patch_panels = relationship("PatchPanel", back_populates="site", cascade="all, delete-orphan")


class Building(Base):
    __tablename__ = "buildings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    floors = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("Site", back_populates="buildings")
    racks = relationship("Rack", back_populates="building")


class Rack(Base):
    __tablename__ = "racks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    building_id = Column(Integer, ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200), nullable=False)
    location = Column(String(300), default="")
    floor = Column(String(20), default="")
    capacity = Column(Integer, default=42)
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("Site", back_populates="racks")
    building = relationship("Building", back_populates="racks")
    switches = relationship("Switch", back_populates="rack")
    recorders = relationship("Recorder", back_populates="rack")
    cameras = relationship("Camera", back_populates="rack")
    patch_panels = relationship("PatchPanel", back_populates="rack")
    routers = relationship("Router", back_populates="rack")


class Router(Base):
    __tablename__ = "routers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    rack_id = Column(Integer, ForeignKey("racks.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200), nullable=False)
    model = Column(String(200), default="")
    lan_ip = Column(String(45), default="")
    wan_ip = Column(String(45), default="")
    interfaces = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("Site", back_populates="routers")
    rack = relationship("Rack", back_populates="routers")


class Switch(Base):
    __tablename__ = "switches"
    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    rack_id = Column(Integer, ForeignKey("racks.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200), nullable=False)
    model = Column(String(200), default="")
    ip = Column(String(45), default="")
    ports = Column(Integer, default=24)
    poe = Column(Boolean, default=True)
    uplink = Column(String(300), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("Site", back_populates="switches")
    rack = relationship("Rack", back_populates="switches")
    cameras = relationship("Camera", back_populates="switch")


class Recorder(Base):
    """NVR / DVR / XVR / HCVR"""
    __tablename__ = "recorders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    rack_id = Column(Integer, ForeignKey("racks.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200), nullable=False)
    type = Column(String(10), default="NVR")  # NVR, DVR, XVR, HCVR
    model = Column(String(200), default="")
    channels = Column(Integer, default=16)
    nics = Column(JSON, default=list)     # [{ label, ip }]
    disks = Column(JSON, default=list)    # [{ size, status }]
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("Site", back_populates="recorders")
    rack = relationship("Rack", back_populates="recorders")
    cameras = relationship("Camera", back_populates="recorder")


class PatchPanel(Base):
    __tablename__ = "patch_panels"
    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    rack_id = Column(Integer, ForeignKey("racks.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200), nullable=False)
    ports = Column(Integer, default=24)
    type = Column(String(20), default="Cat6")
    cable_route = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("Site", back_populates="patch_panels")
    rack = relationship("Rack", back_populates="patch_panels")
    cameras = relationship("Camera", back_populates="patch_panel")


class Camera(Base):
    __tablename__ = "cameras"
    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    recorder_id = Column(Integer, ForeignKey("recorders.id", ondelete="SET NULL"), nullable=True)
    rack_id = Column(Integer, ForeignKey("racks.id", ondelete="SET NULL"), nullable=True)
    switch_id = Column(Integer, ForeignKey("switches.id", ondelete="SET NULL"), nullable=True)
    patch_panel_id = Column(Integer, ForeignKey("patch_panels.id", ondelete="SET NULL"), nullable=True)
    patch_panel_port = Column(Integer, nullable=True)

    channel = Column(Integer, nullable=True)
    name = Column(String(200), default="")
    cam_type = Column(String(20), default="ip-net")  # ip-net, ip-poe-nvr, analog
    ip = Column(String(45), default="")
    model = Column(String(200), default="")
    serial = Column(String(100), default="")
    mac = Column(String(17), default="")
    location = Column(String(300), default="")
    cable_route = Column(Text, default="")
    status = Column(String(20), default="online")  # online, offline

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="cameras")
    recorder = relationship("Recorder", back_populates="cameras")
    rack = relationship("Rack", back_populates="cameras")
    switch = relationship("Switch", back_populates="cameras")
    patch_panel = relationship("PatchPanel", back_populates="cameras")


# ============================================
# DB HELPERS
# ============================================

def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency: yield a session, auto-close"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================
# AUTH MODELS
# ============================================

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(200), default="")
    password_hash = Column(String(200), nullable=False)
    role = Column(String(20), default="viewer")  # admin, viewer
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    site_access = relationship("UserSite", back_populates="user", cascade="all, delete-orphan")


class UserSite(Base):
    """Many-to-many: which sites a viewer can access"""
    __tablename__ = "user_sites"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)

    user = relationship("User", back_populates="site_access")
    site = relationship("Site")
