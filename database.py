"""
NetManager — Database Models & Connection
SQLite with SQLAlchemy ORM
"""
import logging
import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean, Float,
    DateTime, ForeignKey, Text, JSON, event, text, inspect
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

logger = logging.getLogger("netmanager.db")

_default_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "netmanager.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_default_db}")

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
    network_segments = Column(JSON, default=list)  # [{ name, subnet, color }]
    cctv_subnet = Column(String(100), default="")  # e.g. "10.1.0.0/22" — cameras subnet
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
    status = Column(String(20), default="online")  # legacy: online, offline

    # Hybrid monitoring fields
    configured = Column(Boolean, default=True)             # True if NVR has Enable=True
    status_config = Column(String(20), default="enabled")  # enabled / disabled (from NVR)
    status_real = Column(String(20), default="unknown")    # online / offline / unknown (from probe)
    last_seen_at = Column(DateTime, nullable=True)         # last time probe confirmed online
    offline_streak = Column(Integer, default=0)            # consecutive failed probes (for anti-jitter)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="cameras")
    recorder = relationship("Recorder", back_populates="cameras")
    rack = relationship("Rack", back_populates="cameras")
    switch = relationship("Switch", back_populates="cameras")
    patch_panel = relationship("PatchPanel", back_populates="cameras")


class CameraSnapshot(Base):
    """Point-in-time snapshot of all cameras from a monitoring run."""
    __tablename__ = "camera_snapshots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    run_id = Column(String(50), nullable=False)            # UUID per run
    collected_at = Column(DateTime, default=datetime.utcnow)
    payload_json = Column(Text, default="")                # JSON: full camera list + status

    site = relationship("Site")


class CameraEvent(Base):
    """Event log for camera status/inventory changes with deduplication."""
    __tablename__ = "camera_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True)
    channel = Column(Integer, nullable=True)
    event_type = Column(String(30), default="status_change")  # status_change, inventory_change
    from_status = Column(String(20), default="")
    to_status = Column(String(20), default="")
    severity = Column(String(10), default="info")             # info, warn, crit
    message = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("Site")
    camera = relationship("Camera")


# ============================================
# DB HELPERS
# ============================================

def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)


def _table_has_column(conn, table: str, column: str) -> bool:
    """Check if a column exists in a SQLite table."""
    result = conn.execute(text(f"PRAGMA table_info({table})"))
    cols = {row[1] for row in result.fetchall()}
    return column in cols


def _table_exists(conn, table: str) -> bool:
    """Check if a table exists in the database."""
    result = conn.execute(text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=:t"
    ), {"t": table})
    return result.fetchone() is not None


def run_migrations():
    """
    Idempotent SQLite schema migration — safe to call on every startup.
    Adds any columns/tables that exist in the ORM models but are missing
    from the live database.

    WHY: SQLAlchemy's create_all() creates missing tables but does NOT
    add columns to existing tables.  In production (EasyPanel / Docker)
    the SQLite file persists across deploys, so new columns added in code
    would cause "no such column" errors without explicit ALTER TABLE.
    """
    logger.info("Running schema migrations ...")
    applied = 0

    with engine.connect() as conn:
        # ------------------------------------------------------------------
        # sites table
        # ------------------------------------------------------------------
        if _table_exists(conn, "sites"):
            _cols = [
                ("cctv_subnet", "TEXT DEFAULT ''"),
                ("network_segments", "TEXT DEFAULT '[]'"),
            ]
            for col_name, col_def in _cols:
                if not _table_has_column(conn, "sites", col_name):
                    conn.execute(text(
                        f"ALTER TABLE sites ADD COLUMN {col_name} {col_def}"
                    ))
                    logger.info("  + sites.%s", col_name)
                    applied += 1

        # ------------------------------------------------------------------
        # cameras table — hybrid monitoring columns
        # ------------------------------------------------------------------
        if _table_exists(conn, "cameras"):
            _cols = [
                ("configured",     "INTEGER DEFAULT 1"),
                ("status_config",  "TEXT DEFAULT 'enabled'"),
                ("status_real",    "TEXT DEFAULT 'unknown'"),
                ("last_seen_at",   "TEXT"),           # DATETIME stored as TEXT in SQLite
                ("offline_streak", "INTEGER DEFAULT 0"),
            ]
            for col_name, col_def in _cols:
                if not _table_has_column(conn, "cameras", col_name):
                    conn.execute(text(
                        f"ALTER TABLE cameras ADD COLUMN {col_name} {col_def}"
                    ))
                    logger.info("  + cameras.%s", col_name)
                    applied += 1

        # ------------------------------------------------------------------
        # New tables — create_all handles these but we log it for clarity
        # ------------------------------------------------------------------
        for tbl in ("camera_snapshots", "camera_events"):
            if not _table_exists(conn, tbl):
                logger.info("  + table %s (will be created by create_all)", tbl)

        conn.commit()

    # Now let create_all pick up any brand-new tables
    Base.metadata.create_all(bind=engine)

    logger.info("Schema migrations complete (%d ALTER(s) applied)", applied)


def check_schema_ok() -> dict:
    """
    Quick check that critical columns exist.
    Returns {"ok": True} or {"ok": False, "missing": [...]}.
    """
    missing = []
    required = [
        ("sites",   "cctv_subnet"),
        ("cameras", "configured"),
        ("cameras", "status_config"),
        ("cameras", "status_real"),
        ("cameras", "offline_streak"),
        ("cameras", "last_seen_at"),
    ]
    required_tables = ["camera_snapshots", "camera_events"]

    try:
        with engine.connect() as conn:
            for tbl, col in required:
                if _table_exists(conn, tbl) and not _table_has_column(conn, tbl, col):
                    missing.append(f"{tbl}.{col}")
            for tbl in required_tables:
                if not _table_exists(conn, tbl):
                    missing.append(f"table:{tbl}")
    except Exception as e:
        return {"ok": False, "missing": [f"error: {e}"]}

    return {"ok": len(missing) == 0, "missing": missing}


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


class NvrCredential(Base):
    """Stored NVR/DVR credentials per site — passwords encrypted"""
    __tablename__ = "nvr_credentials"
    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    recorder_id = Column(Integer, ForeignKey("recorders.id", ondelete="SET NULL"), nullable=True)
    label = Column(String(200), default="")          # friendly name, e.g. "NVR Principal"
    ip = Column(String(45), nullable=False)           # NVR IP
    port = Column(Integer, default=80)                # HTTP port (usually 80)
    username = Column(String(100), default="admin")
    password_enc = Column(Text, default="")           # encrypted password
    active = Column(Boolean, default=True)
    last_sync = Column(DateTime, nullable=True)
    last_status = Column(String(50), default="")      # ok, error, timeout
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("Site")
    recorder = relationship("Recorder")
    sync_logs = relationship("SyncLog", back_populates="credential", cascade="all, delete-orphan")


class SyncLog(Base):
    """Log of every NVR sync operation"""
    __tablename__ = "sync_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    credential_id = Column(Integer, ForeignKey("nvr_credentials.id", ondelete="CASCADE"), nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), default="")           # sync_cameras, update_status, full_sync
    status = Column(String(20), default="")           # ok, error
    cameras_found = Column(Integer, default=0)
    cameras_added = Column(Integer, default=0)
    cameras_updated = Column(Integer, default=0)
    cameras_online = Column(Integer, default=0)
    cameras_offline = Column(Integer, default=0)
    error_message = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    credential = relationship("NvrCredential", back_populates="sync_logs")
