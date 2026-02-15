"""
NetManager — Pydantic Schemas
Request/Response models for the API
"""
from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict


# ============================================
# SITE
# ============================================

class SiteBase(BaseModel):
    name: str
    address: str = ""
    contact: str = ""
    phone: str = ""
    email: str = ""

class SiteCreate(SiteBase): pass
class SiteUpdate(SiteBase): pass

class SiteOut(SiteBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
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
