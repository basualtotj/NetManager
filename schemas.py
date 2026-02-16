"""
NetManager — Pydantic Schemas
Request/Response models for the API
"""
from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict


# ============================================
# NETWORK SEGMENT
# ============================================

class NetworkSegmentItem(BaseModel):
    name: str = ""
    subnet: str = ""
    color: str = "#3b82f6"
    auto: bool = False  # True = auto-detected from device IPs


# ============================================
# SITE
# ============================================

class SiteBase(BaseModel):
    name: str
    address: str = ""
    contact: str = ""
    phone: str = ""
    email: str = ""
    network_segments: List[NetworkSegmentItem] = []
    cctv_subnet: str = ""  # e.g. "10.1.0.0/22"

class SiteCreate(SiteBase): pass
class SiteUpdate(SiteBase): pass

class SiteOut(SiteBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cctv_subnet: str = ""
    created_at: Optional[datetime] = None


# ============================================
# BUILDING
# ============================================

class BuildingBase(BaseModel):
    name: str
    floors: int = 1

class BuildingCreate(BuildingBase):
    site_id: int

class BuildingUpdate(BuildingBase): pass

class BuildingOut(BuildingBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    site_id: int


# ============================================
# RACK
# ============================================

class RackBase(BaseModel):
    name: str
    location: str = ""
    floor: str = ""
    capacity: int = 42
    building_id: Optional[int] = None

class RackCreate(RackBase):
    site_id: int

class RackUpdate(RackBase): pass

class RackOut(RackBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    site_id: int


# ============================================
# ROUTER
# ============================================

class RouterBase(BaseModel):
    name: str
    model: str = ""
    lan_ip: str = ""
    wan_ip: str = ""
    interfaces: str = ""
    rack_id: Optional[int] = None

class RouterCreate(RouterBase):
    site_id: int

class RouterUpdate(RouterBase): pass

class RouterOut(RouterBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    site_id: int


# ============================================
# SWITCH
# ============================================

class SwitchBase(BaseModel):
    name: str
    model: str = ""
    ip: str = ""
    ports: int = 24
    poe: bool = True
    uplink: str = ""
    rack_id: Optional[int] = None

class SwitchCreate(SwitchBase):
    site_id: int

class SwitchUpdate(SwitchBase): pass

class SwitchOut(SwitchBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    site_id: int


# ============================================
# RECORDER (NVR/DVR/XVR/HCVR)
# ============================================

class NicItem(BaseModel):
    label: str = ""
    ip: str = ""

class DiskItem(BaseModel):
    size: str = ""
    status: str = "ok"

class RecorderBase(BaseModel):
    name: str
    type: str = "NVR"
    model: str = ""
    channels: int = 16
    nics: List[NicItem] = []
    disks: List[DiskItem] = []
    rack_id: Optional[int] = None

class RecorderCreate(RecorderBase):
    site_id: int

class RecorderUpdate(RecorderBase): pass

class RecorderOut(RecorderBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    site_id: int


# ============================================
# PATCH PANEL
# ============================================

class PatchPanelBase(BaseModel):
    name: str
    ports: int = 24
    type: str = "Cat6"
    cable_route: str = ""
    rack_id: Optional[int] = None

class PatchPanelCreate(PatchPanelBase):
    site_id: int

class PatchPanelUpdate(PatchPanelBase): pass

class PatchPanelOut(PatchPanelBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    site_id: int


# ============================================
# CAMERA
# ============================================

class CameraBase(BaseModel):
    channel: Optional[int] = None
    name: str = ""
    cam_type: str = "ip-net"
    ip: str = ""
    model: str = ""
    serial: str = ""
    mac: str = ""
    location: str = ""
    cable_route: str = ""
    status: str = "online"
    configured: bool = True
    status_config: str = "enabled"
    status_real: str = "unknown"
    recorder_id: Optional[int] = None
    rack_id: Optional[int] = None
    switch_id: Optional[int] = None
    patch_panel_id: Optional[int] = None
    patch_panel_port: Optional[int] = None

class CameraCreate(CameraBase):
    site_id: int

class CameraBulkCreate(BaseModel):
    """Create multiple cameras at once"""
    site_id: int
    cameras: List[CameraBase]

class CameraUpdate(CameraBase): pass

class CameraOut(CameraBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    site_id: int
    last_seen_at: Optional[datetime] = None
    offline_streak: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================
# DASHBOARD / STATS
# ============================================

class DashboardStats(BaseModel):
    cameras: int = 0
    cameras_online: int = 0
    cameras_offline: int = 0
    recorders: int = 0
    switches: int = 0
    racks: int = 0
    routers: int = 0
    patch_panels: int = 0
    buildings: int = 0
    total_storage_tb: float = 0
    recorders_by_type: dict = {}
    cameras_by_rack: dict = {}
    cameras_by_recorder: dict = {}


# ============================================
# FULL SITE EXPORT (for frontend state)
# ============================================

class SiteFullExport(BaseModel):
    """Complete site data for frontend hydration"""
    site: SiteOut
    buildings: List[BuildingOut] = []
    racks: List[RackOut] = []
    routers: List[RouterOut] = []
    switches: List[SwitchOut] = []
    recorders: List[RecorderOut] = []
    cameras: List[CameraOut] = []
    patch_panels: List[PatchPanelOut] = []


# ============================================
# AUTH
# ============================================

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: "UserOut"

class UserBase(BaseModel):
    username: str
    display_name: str = ""
    role: str = "viewer"
    active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None

class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    site_ids: List[int] = []

class UserSiteAssign(BaseModel):
    site_ids: List[int]

class SiteListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    address: str = ""
    camera_count: int = 0


class NetworkSegmentsUpdate(BaseModel):
    """Update manual network segments for a site"""
    segments: List[NetworkSegmentItem] = []


class NetworkSegmentsOut(BaseModel):
    """Combined auto-detected + manual segments"""
    segments: List[NetworkSegmentItem] = []


# ============================================
# NVR CREDENTIALS & SYNC
# ============================================

class NvrCredentialCreate(BaseModel):
    site_id: int
    recorder_id: Optional[int] = None
    label: str = ""
    ip: str
    port: int = 80
    username: str = "admin"
    password: str  # plain — encrypted on server side

class NvrCredentialUpdate(BaseModel):
    label: Optional[str] = None
    ip: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None   # optional — only update if provided
    active: Optional[bool] = None
    recorder_id: Optional[int] = None

class NvrCredentialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    site_id: int
    recorder_id: Optional[int] = None
    label: str = ""
    ip: str
    port: int = 80
    username: str = "admin"
    active: bool = True
    last_sync: Optional[datetime] = None
    last_status: str = ""
    created_at: Optional[datetime] = None

class NvrCameraPreview(BaseModel):
    """Camera data extracted from NVR RPC"""
    channel: int
    name: str = ""
    ip: str = ""
    model: str = ""
    serial: str = ""
    mac: str = ""
    status: str = "online"
    configured: bool = True
    status_config: str = "enabled"
    status_real: str = "unknown"

class NvrSyncPreview(BaseModel):
    """Preview before committing sync"""
    credential_id: int
    nvr_label: str = ""
    cameras: List[NvrCameraPreview] = []
    new_cameras: List[NvrCameraPreview] = []
    existing_cameras: List[NvrCameraPreview] = []
    updated_cameras: List[NvrCameraPreview] = []

class NvrSyncRequest(BaseModel):
    credential_id: int
    action: str = "sync_cameras"  # sync_cameras, update_status, full_sync
    add_new: bool = True          # whether to add new cameras
    update_existing: bool = True  # whether to update existing camera info

class NvrSyncResult(BaseModel):
    ok: bool
    action: str = ""
    cameras_found: int = 0
    cameras_added: int = 0
    cameras_updated: int = 0
    cameras_online: int = 0
    cameras_offline: int = 0
    message: str = ""
    error_code: str = ""
    base_url: str = ""

class SyncLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    credential_id: int
    site_id: int
    user_id: Optional[int] = None
    action: str = ""
    status: str = ""
    cameras_found: int = 0
    cameras_added: int = 0
    cameras_updated: int = 0
    cameras_online: int = 0
    cameras_offline: int = 0
    error_message: str = ""
    created_at: Optional[datetime] = None


# ============================================
# HYBRID MONITORING
# ============================================

class HybridSyncResult(BaseModel):
    """Result of a hybrid sync run (NVR inventory + TCP probe)."""
    site_id: int = 0
    ok: bool = False
    error: str = ""
    error_code: str = ""
    total: int = 0
    online: int = 0
    offline: int = 0
    unknown: int = 0
    added: int = 0
    updated: int = 0
    inventory_changes: int = 0
    status_changes: int = 0
    elapsed_ms: int = 0
    run_id: str = ""


class HybridSyncAllResult(BaseModel):
    """Result of syncing all sites."""
    ok: bool = True
    sites_synced: int = 0
    results: List[HybridSyncResult] = []
    total_elapsed_ms: int = 0


class CameraEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    site_id: int
    camera_id: Optional[int] = None
    channel: Optional[int] = None
    event_type: str = ""
    from_status: str = ""
    to_status: str = ""
    severity: str = "info"
    message: str = ""
    created_at: Optional[datetime] = None
