"""
NetManager — API Server
FastAPI + SQLite backend for CCTV infrastructure management
"""
import logging
from typing import List, Optional
import ipaddress
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os

# ============================================
# LOGGING CONFIG
# ============================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("netmanager")

from database import (
    init_db, get_db,
    Site, Building, Rack, Router, Switch, Recorder, PatchPanel, Camera,
    User, UserSite, NvrCredential, SyncLog,
    CameraSnapshot, CameraEvent
)
from schemas import (
    SiteCreate, SiteUpdate, SiteOut,
    BuildingCreate, BuildingUpdate, BuildingOut,
    RackCreate, RackUpdate, RackOut,
    RouterCreate, RouterUpdate, RouterOut,
    SwitchCreate, SwitchUpdate, SwitchOut,
    RecorderCreate, RecorderUpdate, RecorderOut,
    PatchPanelCreate, PatchPanelUpdate, PatchPanelOut,
    CameraCreate, CameraUpdate, CameraOut, CameraBulkCreate,
    DashboardStats, SiteFullExport,
    LoginRequest, LoginResponse, UserCreate, UserUpdate, UserOut,
    UserSiteAssign, SiteListItem,
    NetworkSegmentItem, NetworkSegmentsUpdate, NetworkSegmentsOut,
    NvrCredentialCreate, NvrCredentialUpdate, NvrCredentialOut,
    NvrSyncPreview, NvrSyncRequest, NvrSyncResult, SyncLogOut,
    NvrCameraPreview,
    HybridSyncResult, HybridSyncAllResult, CameraEventOut,
)
from auth import (
    hash_password, verify_password, create_token,
    get_current_user, require_admin, get_user_site_ids,
    check_site_access, ensure_admin_exists
)

# ============================================
# APP INIT
# ============================================

app = FastAPI(
    title="NetManager API",
    description="Backend para gestión de infraestructura CCTV y red",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    db = next(get_db())
    ensure_admin_exists(db)
    db.close()


# ============================================
# GENERIC CRUD HELPERS
# ============================================

def _get_or_404(db: Session, model, item_id: int):
    item = db.query(model).get(item_id)
    if not item:
        raise HTTPException(404, f"{model.__name__} {item_id} not found")
    return item


def _create(db: Session, model, data: dict):
    item = model(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _update(db: Session, model, item_id: int, data: dict):
    item = _get_or_404(db, model, item_id)
    for k, v in data.items():
        if hasattr(item, k):
            setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


def _delete(db: Session, model, item_id: int):
    item = _get_or_404(db, model, item_id)
    db.delete(item)
    db.commit()
    return {"ok": True, "id": item_id}


# ============================================
# AUTH ENDPOINTS
# ============================================

@app.post("/api/auth/login", response_model=LoginResponse, tags=["Auth"])
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    if not user.active:
        raise HTTPException(403, "Usuario desactivado")
    token = create_token(user.id, user.username, user.role)
    site_ids = get_user_site_ids(user, db)
    return LoginResponse(
        token=token,
        user=UserOut(id=user.id, username=user.username, display_name=user.display_name,
                     role=user.role, active=user.active, site_ids=site_ids)
    )

@app.get("/api/auth/me", response_model=UserOut, tags=["Auth"])
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    site_ids = get_user_site_ids(user, db)
    return UserOut(id=user.id, username=user.username, display_name=user.display_name,
                   role=user.role, active=user.active, site_ids=site_ids)


# ============================================
# USER MANAGEMENT (admin only)
# ============================================

@app.post("/api/users", response_model=UserOut, tags=["Users"])
def create_user(data: UserCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(User).filter_by(username=data.username).first():
        raise HTTPException(400, f"Username '{data.username}' ya existe")
    user = User(username=data.username, display_name=data.display_name,
                password_hash=hash_password(data.password), role=data.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(id=user.id, username=user.username, display_name=user.display_name,
                   role=user.role, active=user.active, site_ids=[])

@app.get("/api/users", response_model=List[UserOut], tags=["Users"])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).all()
    result = []
    for u in users:
        site_ids = [us.site_id for us in db.query(UserSite).filter_by(user_id=u.id).all()]
        result.append(UserOut(id=u.id, username=u.username, display_name=u.display_name,
                              role=u.role, active=u.active, site_ids=site_ids))
    return result

@app.put("/api/users/{uid}", response_model=UserOut, tags=["Users"])
def update_user(uid: int, data: UserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).get(uid)
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.role is not None:
        user.role = data.role
    if data.active is not None:
        user.active = data.active
    if data.password:
        user.password_hash = hash_password(data.password)
    db.commit()
    db.refresh(user)
    site_ids = [us.site_id for us in db.query(UserSite).filter_by(user_id=user.id).all()]
    return UserOut(id=user.id, username=user.username, display_name=user.display_name,
                   role=user.role, active=user.active, site_ids=site_ids)

@app.delete("/api/users/{uid}", tags=["Users"])
def delete_user(uid: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return _delete(db, User, uid)

@app.put("/api/users/{uid}/sites", response_model=UserOut, tags=["Users"])
def assign_user_sites(uid: int, data: UserSiteAssign, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Assign sites to a viewer user (replaces all current assignments)"""
    user = db.query(User).get(uid)
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    db.query(UserSite).filter_by(user_id=uid).delete()
    for sid in data.site_ids:
        db.add(UserSite(user_id=uid, site_id=sid))
    db.commit()
    return UserOut(id=user.id, username=user.username, display_name=user.display_name,
                   role=user.role, active=user.active, site_ids=data.site_ids)


# ============================================
# SITES (protected)
# ============================================

@app.post("/api/sites", response_model=SiteOut, tags=["Sites"])
def create_site(data: SiteCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return _create(db, Site, data.model_dump())


@app.get("/api/sites", response_model=List[SiteListItem], tags=["Sites"])
def list_sites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List sites the current user can access"""
    site_ids = get_user_site_ids(user, db)
    sites = db.query(Site).filter(Site.id.in_(site_ids)).all() if site_ids else []
    result = []
    for s in sites:
        cam_count = db.query(Camera).filter_by(site_id=s.id).count()
        result.append(SiteListItem(id=s.id, name=s.name, address=s.address, camera_count=cam_count))
    return result


@app.get("/api/sites/{site_id}", response_model=SiteOut, tags=["Sites"])
def get_site(site_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_site_access(user, site_id, db)
    return _get_or_404(db, Site, site_id)


@app.put("/api/sites/{site_id}", response_model=SiteOut, tags=["Sites"])
def update_site(site_id: int, data: SiteUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    d = data.model_dump()
    # Serialize NetworkSegmentItem objects to plain dicts for JSON column
    if "network_segments" in d:
        d["network_segments"] = [
            s if isinstance(s, dict) else s
            for s in d["network_segments"]
        ]
    return _update(db, Site, site_id, d)


@app.delete("/api/sites/{site_id}", tags=["Sites"])
def delete_site(site_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return _delete(db, Site, site_id)


# ============================================
# NETWORK SEGMENTS (auto-detect + manual)
# ============================================

def _detect_subnets(ips: List[str], prefix: int = 24) -> dict:
    """Group IPs into /prefix subnets and return {subnet_str: count}"""
    subnets = {}
    for raw in ips:
        raw = (raw or "").strip()
        if not raw:
            continue
        try:
            addr = ipaddress.ip_address(raw)
            net = ipaddress.ip_network(f"{addr}/{prefix}", strict=False)
            key = str(net)
            subnets[key] = subnets.get(key, 0) + 1
        except ValueError:
            continue
    return subnets


AUTO_SEGMENT_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
                        "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"]


@app.get("/api/sites/{site_id}/network-segments", response_model=NetworkSegmentsOut, tags=["Network"])
def get_network_segments(site_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return auto-detected segments from device IPs + manual segments saved on the site"""
    check_site_access(user, site_id, db)
    site = _get_or_404(db, Site, site_id)

    # Collect all IPs from every device type in this site
    all_ips = []
    for cam in db.query(Camera).filter_by(site_id=site_id).all():
        if cam.ip:
            all_ips.append(cam.ip)
    for sw in db.query(Switch).filter_by(site_id=site_id).all():
        if sw.ip:
            all_ips.append(sw.ip)
    for rt in db.query(Router).filter_by(site_id=site_id).all():
        if rt.lan_ip:
            all_ips.append(rt.lan_ip)
        if rt.wan_ip:
            all_ips.append(rt.wan_ip)
    for rec in db.query(Recorder).filter_by(site_id=site_id).all():
        for nic in (rec.nics or []):
            ip = nic.get("ip", "") if isinstance(nic, dict) else ""
            if ip:
                all_ips.append(ip)

    detected = _detect_subnets(all_ips)

    # Build auto segments
    auto_segments = []
    for i, (subnet, count) in enumerate(sorted(detected.items(), key=lambda x: -x[1])):
        color = AUTO_SEGMENT_COLORS[i % len(AUTO_SEGMENT_COLORS)]
        auto_segments.append(NetworkSegmentItem(
            name=f"Auto ({count} hosts)",
            subnet=subnet,
            color=color,
            auto=True,
        ))

    # Manual segments from the site record
    manual = []
    for seg in (site.network_segments or []):
        s = seg if isinstance(seg, dict) else seg
        manual.append(NetworkSegmentItem(
            name=s.get("name", ""),
            subnet=s.get("subnet", ""),
            color=s.get("color", "#64748b"),
            auto=False,
        ))

    # Merge: manual first (they may label auto-detected subnets), then auto that aren't already covered
    manual_subnets = {m.subnet for m in manual}
    # For manual segments that match an auto-detected subnet, enrich the name with host count
    for m in manual:
        if m.subnet in detected:
            m.name = f"{m.name} ({detected[m.subnet]} hosts)"

    merged = list(manual)
    for a in auto_segments:
        if a.subnet not in manual_subnets:
            merged.append(a)

    return NetworkSegmentsOut(segments=merged)


@app.put("/api/sites/{site_id}/network-segments", response_model=NetworkSegmentsOut, tags=["Network"])
def update_network_segments(site_id: int, data: NetworkSegmentsUpdate,
                            user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Save manual network segments for a site (auto-detected ones are not stored)"""
    check_site_access(user, site_id, db)
    site = _get_or_404(db, Site, site_id)
    # Only store non-auto segments
    site.network_segments = [
        {"name": s.name, "subnet": s.subnet, "color": s.color}
        for s in data.segments if not s.auto
    ]
    db.commit()
    db.refresh(site)
    # Return the full merged view
    return get_network_segments(site_id, user, db)


# ============================================
# FULL SITE EXPORT (single endpoint for frontend)
# ============================================

@app.get("/api/sites/{site_id}/full", response_model=SiteFullExport, tags=["Sites"])
def get_site_full(site_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all data for a site in one call — used to hydrate the frontend"""
    check_site_access(user, site_id, db)
    site = _get_or_404(db, Site, site_id)
    return SiteFullExport(
        site=site,
        buildings=db.query(Building).filter_by(site_id=site_id).all(),
        racks=db.query(Rack).filter_by(site_id=site_id).all(),
        routers=db.query(Router).filter_by(site_id=site_id).all(),
        switches=db.query(Switch).filter_by(site_id=site_id).all(),
        recorders=db.query(Recorder).filter_by(site_id=site_id).all(),
        cameras=db.query(Camera).filter_by(site_id=site_id).all(),
        patch_panels=db.query(PatchPanel).filter_by(site_id=site_id).all(),
    )


# ============================================
# DASHBOARD STATS
# ============================================

@app.get("/api/sites/{site_id}/dashboard", response_model=DashboardStats, tags=["Dashboard"])
def get_dashboard(site_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_site_access(user, site_id, db)
    _get_or_404(db, Site, site_id)
    cams = db.query(Camera).filter_by(site_id=site_id).all()
    recs = db.query(Recorder).filter_by(site_id=site_id).all()
    racks = db.query(Rack).filter_by(site_id=site_id).all()

    online = sum(1 for c in cams if c.status != "offline")
    total_tb = sum(
        float(d.get("size", "0").replace("TB", "").strip())
        for r in recs for d in (r.disks or [])
        if "TB" in str(d.get("size", ""))
    )
    rec_types = {}
    for r in recs:
        t = r.type or "NVR"
        rec_types[t] = rec_types.get(t, 0) + 1

    cams_by_rack = {}
    for rack in racks:
        cams_by_rack[rack.name] = sum(1 for c in cams if c.rack_id == rack.id)

    cams_by_rec = {}
    for r in recs:
        cams_by_rec[r.name] = sum(1 for c in cams if c.recorder_id == r.id)

    return DashboardStats(
        cameras=len(cams),
        cameras_online=online,
        cameras_offline=len(cams) - online,
        recorders=len(recs),
        switches=db.query(Switch).filter_by(site_id=site_id).count(),
        racks=len(racks),
        routers=db.query(Router).filter_by(site_id=site_id).count(),
        patch_panels=db.query(PatchPanel).filter_by(site_id=site_id).count(),
        buildings=db.query(Building).filter_by(site_id=site_id).count(),
        total_storage_tb=total_tb,
        recorders_by_type=rec_types,
        cameras_by_rack=cams_by_rack,
        cameras_by_recorder=cams_by_rec,
    )


# ============================================
# BUILDINGS
# ============================================

@app.post("/api/buildings", response_model=BuildingOut, tags=["Buildings"])
def create_building(data: BuildingCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _create(db, Building, data.model_dump())

@app.get("/api/sites/{site_id}/buildings", response_model=List[BuildingOut], tags=["Buildings"])
def list_buildings(site_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Building).filter_by(site_id=site_id).all()

@app.put("/api/buildings/{bid}", response_model=BuildingOut, tags=["Buildings"])
def update_building(bid: int, data: BuildingUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _update(db, Building, bid, data.model_dump())

@app.delete("/api/buildings/{bid}", tags=["Buildings"])
def delete_building(bid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _delete(db, Building, bid)


# ============================================
# RACKS
# ============================================

@app.post("/api/racks", response_model=RackOut, tags=["Racks"])
def create_rack(data: RackCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _create(db, Rack, data.model_dump())

@app.get("/api/sites/{site_id}/racks", response_model=List[RackOut], tags=["Racks"])
def list_racks(site_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Rack).filter_by(site_id=site_id).all()

@app.put("/api/racks/{rid}", response_model=RackOut, tags=["Racks"])
def update_rack(rid: int, data: RackUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _update(db, Rack, rid, data.model_dump())

@app.delete("/api/racks/{rid}", tags=["Racks"])
def delete_rack(rid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _delete(db, Rack, rid)


# ============================================
# ROUTERS
# ============================================

@app.post("/api/routers", response_model=RouterOut, tags=["Routers"])
def create_router(data: RouterCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _create(db, Router, data.model_dump())

@app.get("/api/sites/{site_id}/routers", response_model=List[RouterOut], tags=["Routers"])
def list_routers(site_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Router).filter_by(site_id=site_id).all()

@app.put("/api/routers/{rid}", response_model=RouterOut, tags=["Routers"])
def update_router(rid: int, data: RouterUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _update(db, Router, rid, data.model_dump())

@app.delete("/api/routers/{rid}", tags=["Routers"])
def delete_router(rid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _delete(db, Router, rid)


# ============================================
# SWITCHES
# ============================================

@app.post("/api/switches", response_model=SwitchOut, tags=["Switches"])
def create_switch(data: SwitchCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _create(db, Switch, data.model_dump())

@app.get("/api/sites/{site_id}/switches", response_model=List[SwitchOut], tags=["Switches"])
def list_switches(site_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Switch).filter_by(site_id=site_id).all()

@app.put("/api/switches/{sid}", response_model=SwitchOut, tags=["Switches"])
def update_switch(sid: int, data: SwitchUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _update(db, Switch, sid, data.model_dump())

@app.delete("/api/switches/{sid}", tags=["Switches"])
def delete_switch(sid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _delete(db, Switch, sid)


# ============================================
# RECORDERS (NVR/DVR/XVR/HCVR)
# ============================================

@app.post("/api/recorders", response_model=RecorderOut, tags=["Recorders"])
def create_recorder(data: RecorderCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = data.model_dump()
    d["nics"] = [n.model_dump() if hasattr(n, "model_dump") else n for n in d.get("nics", [])]
    d["disks"] = [dk.model_dump() if hasattr(dk, "model_dump") else dk for dk in d.get("disks", [])]
    return _create(db, Recorder, d)

@app.get("/api/sites/{site_id}/recorders", response_model=List[RecorderOut], tags=["Recorders"])
def list_recorders(site_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Recorder).filter_by(site_id=site_id).all()

@app.put("/api/recorders/{rid}", response_model=RecorderOut, tags=["Recorders"])
def update_recorder(rid: int, data: RecorderUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = data.model_dump()
    d["nics"] = [n.model_dump() if hasattr(n, "model_dump") else n for n in d.get("nics", [])]
    d["disks"] = [dk.model_dump() if hasattr(dk, "model_dump") else dk for dk in d.get("disks", [])]
    return _update(db, Recorder, rid, d)

@app.delete("/api/recorders/{rid}", tags=["Recorders"])
def delete_recorder(rid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _delete(db, Recorder, rid)


# ============================================
# PATCH PANELS
# ============================================

@app.post("/api/patch-panels", response_model=PatchPanelOut, tags=["PatchPanels"])
def create_patch_panel(data: PatchPanelCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _create(db, PatchPanel, data.model_dump())

@app.get("/api/sites/{site_id}/patch-panels", response_model=List[PatchPanelOut], tags=["PatchPanels"])
def list_patch_panels(site_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(PatchPanel).filter_by(site_id=site_id).all()

@app.put("/api/patch-panels/{pid}", response_model=PatchPanelOut, tags=["PatchPanels"])
def update_patch_panel(pid: int, data: PatchPanelUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _update(db, PatchPanel, pid, data.model_dump())

@app.delete("/api/patch-panels/{pid}", tags=["PatchPanels"])
def delete_patch_panel(pid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _delete(db, PatchPanel, pid)


# ============================================
# CAMERAS
# ============================================

@app.post("/api/cameras", response_model=CameraOut, tags=["Cameras"])
def create_camera(data: CameraCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _create(db, Camera, data.model_dump())

@app.post("/api/cameras/bulk", response_model=List[CameraOut], tags=["Cameras"])
def create_cameras_bulk(data: CameraBulkCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create multiple cameras in a single transaction"""
    created = []
    for cam_data in data.cameras:
        d = cam_data.model_dump()
        d["site_id"] = data.site_id
        cam = Camera(**d)
        db.add(cam)
        created.append(cam)
    db.commit()
    for c in created:
        db.refresh(c)
    return created

@app.get("/api/sites/{site_id}/cameras", response_model=List[CameraOut], tags=["Cameras"])
def list_cameras(
    site_id: int,
    status: Optional[str] = None,
    recorder_id: Optional[int] = None,
    rack_id: Optional[int] = None,
    cam_type: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(Camera).filter_by(site_id=site_id)
    if status:
        q = q.filter_by(status=status)
    if recorder_id:
        q = q.filter_by(recorder_id=recorder_id)
    if rack_id:
        q = q.filter_by(rack_id=rack_id)
    if cam_type:
        q = q.filter_by(cam_type=cam_type)
    return q.order_by(Camera.channel).all()

@app.get("/api/cameras/{cid}", response_model=CameraOut, tags=["Cameras"])
def get_camera(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_or_404(db, Camera, cid)

@app.put("/api/cameras/{cid}", response_model=CameraOut, tags=["Cameras"])
def update_camera(cid: int, data: CameraUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _update(db, Camera, cid, data.model_dump())

@app.put("/api/cameras/bulk-update", response_model=List[CameraOut], tags=["Cameras"])
def bulk_update_cameras(
    camera_ids: List[int],
    field: str = Query(...),
    value: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk update a single field on multiple cameras"""
    allowed = {"status", "recorder_id", "rack_id", "switch_id", "patch_panel_id", "cam_type", "location"}
    if field not in allowed:
        raise HTTPException(400, f"Field '{field}' not allowed for bulk update")
    updated = []
    for cid in camera_ids:
        cam = db.query(Camera).get(cid)
        if cam:
            setattr(cam, field, value)
            updated.append(cam)
    db.commit()
    for c in updated:
        db.refresh(c)
    return updated

@app.delete("/api/cameras/{cid}", tags=["Cameras"])
def delete_camera(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _delete(db, Camera, cid)


# ============================================
# VALIDATION ENDPOINT
# ============================================

@app.get("/api/sites/{site_id}/validate", tags=["Validation"])
def validate_site(site_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Run all validations and return conflicts"""
    cams = db.query(Camera).filter_by(site_id=site_id).all()
    switches = db.query(Switch).filter_by(site_id=site_id).all()
    pps = db.query(PatchPanel).filter_by(site_id=site_id).all()

    errors = []
    warnings = []

    # Duplicate IPs
    ip_map = {}
    for c in cams:
        if c.ip:
            ip_map.setdefault(c.ip, []).append(c)
    for ip, group in ip_map.items():
        if len(group) > 1:
            same_type = all(c.cam_type == group[0].cam_type for c in group)
            names = [c.name or f"CH{c.channel}" for c in group]
            ids = [c.id for c in group]
            if same_type:
                errors.append({"type": "ip_duplicate", "msg": f"IP {ip} duplicada: {', '.join(names)}", "ids": ids})
            else:
                warnings.append({"type": "ip_cross_segment", "msg": f"IP {ip} en segmentos diferentes: {', '.join(names)}", "ids": ids})

    # Duplicate channels per recorder
    ch_map = {}
    for c in cams:
        if c.channel and c.recorder_id:
            key = (c.recorder_id, c.channel)
            ch_map.setdefault(key, []).append(c)
    for (_, ch), group in ch_map.items():
        if len(group) > 1:
            names = [c.name or c.ip or f"ID{c.id}" for c in group]
            errors.append({"type": "channel_duplicate", "msg": f"Canal {ch} duplicado: {', '.join(names)}", "ids": [c.id for c in group]})

    # Duplicate PP ports
    pp_map = {}
    for c in cams:
        if c.patch_panel_id and c.patch_panel_port:
            key = (c.patch_panel_id, c.patch_panel_port)
            pp_map.setdefault(key, []).append(c)
    for (ppid, port), group in pp_map.items():
        if len(group) > 1:
            pp = next((p for p in pps if p.id == ppid), None)
            names = [c.name or c.ip or f"ID{c.id}" for c in group]
            errors.append({"type": "pp_port_duplicate", "msg": f"Puerto {port} de {pp.name if pp else 'PP'} duplicado: {', '.join(names)}", "ids": [c.id for c in group]})

    # Switch overload
    for sw in switches:
        count = sum(1 for c in cams if c.switch_id == sw.id)
        if count > sw.ports:
            warnings.append({"type": "switch_overload", "msg": f"{sw.name}: {count} cámaras exceden {sw.ports} puertos", "ids": []})

    return {"errors": errors, "warnings": warnings, "total": len(errors) + len(warnings)}


# ============================================
# SEED DATA (Don Bosco)
# ============================================

@app.post("/api/seed/donbosco", tags=["Admin"])
def seed_donbosco(db: Session = Depends(get_db)):
    """Seed the database with Don Bosco test data"""
    # Check if already seeded
    if db.query(Site).filter_by(name="Colegio Técnico Industrial Don Bosco").first():
        raise HTTPException(400, "Don Bosco data already exists")

    site = Site(name="Colegio Técnico Industrial Don Bosco", address="Antofagasta, Chile",
                contact="Fernando Flores", phone="+56 9 XXXX XXXX", email="admin@donbosco.cl",
                network_segments=[
                    {"name": "LAN", "subnet": "192.168.100.0/22", "color": "#3b82f6"},
                    {"name": "CCTV", "subnet": "192.168.1.0/24", "color": "#10b981"},
                    {"name": "Switches", "subnet": "10.1.1.0/24", "color": "#f59e0b"},
                    {"name": "VPN L2TP", "subnet": "10.10.10.0/24", "color": "#ef4444"},
                    {"name": "WAN", "subnet": "190.4.208.0/21", "color": "#f97316"},
                ])
    db.add(site)
    db.flush()

    # Buildings
    b1 = Building(site_id=site.id, name="Edificio Principal", floors=4)
    db.add(b1)
    db.flush()

    # Racks
    racks_data = [
        ("Rack Biblioteca", "Sala Biblioteca", "1", b1.id),
        ("Rack Sala 8", "Sala 8, Piso 1", "1", b1.id),
        ("Rack Salón Juan Pablo", "Salón Juan Pablo, Piso 2", "2", b1.id),
        ("Rack Sala Computación", "Sala Computación, Piso 2", "2", b1.id),
        ("Rack Sala 304", "Sala 304, Piso 3", "3", b1.id),
    ]
    racks = []
    for name, loc, floor, bid in racks_data:
        r = Rack(site_id=site.id, building_id=bid, name=name, location=loc, floor=floor)
        db.add(r)
        racks.append(r)
    db.flush()

    # Router
    rt = Router(site_id=site.id, rack_id=racks[0].id, name="Don Bosco Big Boss",
                model="MikroTik", lan_ip="192.168.100.1", wan_ip="190.4.214.251",
                interfaces="ether1-WAN, Bridge Don Bosco")
    db.add(rt)

    # Switches
    sw_data = [
        ("SW-Core-Biblioteca", "Switch PoE 48p", "10.1.1.10", 48, True, racks[0].id, "MikroTik ether2"),
        ("SW-Sala8", "Switch PoE 24p", "10.1.1.11", 24, True, racks[1].id, "SW-Core-Biblioteca"),
        ("SW-Juan-Pablo", "Switch PoE 24p", "10.1.1.12", 24, True, racks[2].id, "SW-Core-Biblioteca"),
        ("SW-Computacion", "Switch PoE 24p", "10.1.1.13", 24, True, racks[3].id, "SW-Core-Biblioteca"),
        ("SW-Sala304", "Switch PoE 24p", "10.1.1.14", 24, True, racks[4].id, "SW-Core-Biblioteca"),
    ]
    switches = []
    for name, model, ip, ports, poe, rid, uplink in sw_data:
        s = Switch(site_id=site.id, rack_id=rid, name=name, model=model,
                   ip=ip, ports=ports, poe=poe, uplink=uplink)
        db.add(s)
        switches.append(s)
    db.flush()

    # Recorders
    nvr1 = Recorder(site_id=site.id, rack_id=racks[0].id, name="NVR Principal", type="NVR",
                    model="DHI-NVR5464-EI", channels=64,
                    nics=[{"label": "NIC1 (Cámaras)", "ip": "192.168.1.250"}, {"label": "NIC2 (Admin)", "ip": "10.1.1.200"}],
                    disks=[{"size": "4TB", "status": "ok"}, {"size": "4TB", "status": "ok"}])
    dvr1 = Recorder(site_id=site.id, rack_id=racks[1].id, name="DVR Portería", type="DVR",
                    model="DH-XVR5108HS-I3", channels=8,
                    nics=[{"label": "LAN", "ip": "10.1.1.201"}],
                    disks=[{"size": "2TB", "status": "ok"}, {"size": "2TB", "status": "degraded"}])
    db.add_all([nvr1, dvr1])
    db.flush()

    # Patch Panels
    pp_data = [
        ("PP-Biblioteca-01", 48, "Cat6", racks[0].id, "Distribución principal planta baja"),
        ("PP-Sala8-01", 24, "Cat6", racks[1].id, "Piso 1 ala sur"),
        ("PP-JuanPablo-01", 24, "Cat6", racks[2].id, "Piso 2 ala norte"),
        ("PP-Computacion-01", 24, "Cat6", racks[3].id, "Piso 2 ala sur"),
        ("PP-Sala304-01", 24, "Cat6", racks[4].id, "Piso 3"),
    ]
    pps = []
    for name, ports, ptype, rid, route in pp_data:
        p = PatchPanel(site_id=site.id, rack_id=rid, name=name, ports=ports, type=ptype, cable_route=route)
        db.add(p)
        pps.append(p)
    db.flush()

    # Sample cameras (first 8 IP + 2 analog)
    cam_samples = [
        (1, "SALA-15", "ip-net", "192.168.1.120", "DH-IPC-HDW1239T1-A-LED-S5", nvr1.id, racks[1].id, switches[1].id, pps[1].id, 1, "Sala 15, Piso 1", "online"),
        (2, "SALA-14", "ip-net", "192.168.1.121", "DH-IPC-HDW1239T1-A-LED-S5", nvr1.id, racks[1].id, switches[1].id, pps[1].id, 2, "Sala 14, Piso 1", "online"),
        (3, "SALA-03", "ip-net", "192.168.1.122", "DH-IPC-HDW1239T1-A-LED-S5", nvr1.id, racks[1].id, switches[1].id, pps[1].id, 3, "Sala 03, Piso 1", "online"),
        (5, "PASILLO PISO 3", "ip-net", "192.168.1.124", "DH-IPC-HFW2441S-S", nvr1.id, racks[4].id, switches[4].id, pps[4].id, 1, "Pasillo, Piso 3", "offline"),
        (17, "CASINO", "ip-net", "192.168.1.136", "DH-IPC-HFW2441S-S", nvr1.id, racks[0].id, switches[0].id, pps[0].id, 3, "Casino, Planta baja", "online"),
        (28, "MULTICANCHA", "ip-net", "192.168.1.151", "DH-IPC-HDW1239T1-A-LED-S5", nvr1.id, racks[0].id, switches[0].id, pps[0].id, 7, "Multicancha exterior", "offline"),
        (1, "PORTERÍA ENTRADA", "analog", "", "DH-HAC-HDW1200EMP", dvr1.id, racks[1].id, None, None, None, "Portería entrada", "online"),
        (2, "PORTERÍA SALIDA", "analog", "", "DH-HAC-HDW1200EMP", dvr1.id, racks[1].id, None, None, None, "Portería salida", "online"),
    ]
    for ch, name, ctype, ip, model, rec_id, r_id, sw_id, pp_id, pp_port, loc, status in cam_samples:
        cam = Camera(
            site_id=site.id, channel=ch, name=name, cam_type=ctype, ip=ip,
            model=model, recorder_id=rec_id, rack_id=r_id, switch_id=sw_id,
            patch_panel_id=pp_id, patch_panel_port=pp_port, location=loc, status=status,
            cable_route=f"Cámara → {'PP → SW → Uplink' if ctype == 'ip-net' else 'Coaxial → DVR'}"
        )
        db.add(cam)

    db.commit()
    return {"ok": True, "site_id": site.id, "msg": "Don Bosco seeded successfully"}


# ============================================
# NVR CREDENTIALS (admin only)
# ============================================

from crypto_utils import encrypt_password, decrypt_password
from dahua_rpc import sync_nvr as _sync_nvr_rpc
from datetime import datetime as _dt
import asyncio


@app.post("/api/nvr-credentials", response_model=NvrCredentialOut, tags=["NVR Sync"])
def create_nvr_credential(data: NvrCredentialCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Add NVR credentials for a site (admin only). Password is encrypted."""
    _get_or_404(db, Site, data.site_id)
    cred = NvrCredential(
        site_id=data.site_id,
        recorder_id=data.recorder_id,
        label=data.label or f"NVR {data.ip}",
        ip=data.ip,
        port=data.port,
        username=data.username,
        password_enc=encrypt_password(data.password),
        active=True,
    )
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return cred


@app.get("/api/sites/{site_id}/nvr-credentials", response_model=List[NvrCredentialOut], tags=["NVR Sync"])
def list_nvr_credentials(site_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """List NVR credentials for a site (admin only). Passwords are NOT returned."""
    return db.query(NvrCredential).filter_by(site_id=site_id).all()


@app.put("/api/nvr-credentials/{cid}", response_model=NvrCredentialOut, tags=["NVR Sync"])
def update_nvr_credential(cid: int, data: NvrCredentialUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Update NVR credential (admin only)."""
    cred = _get_or_404(db, NvrCredential, cid)
    if data.label is not None:
        cred.label = data.label
    if data.ip is not None:
        cred.ip = data.ip
    if data.port is not None:
        cred.port = data.port
    if data.username is not None:
        cred.username = data.username
    if data.password is not None and data.password:
        cred.password_enc = encrypt_password(data.password)
    if data.active is not None:
        cred.active = data.active
    if data.recorder_id is not None:
        cred.recorder_id = data.recorder_id
    db.commit()
    db.refresh(cred)
    return cred


@app.delete("/api/nvr-credentials/{cid}", tags=["NVR Sync"])
def delete_nvr_credential(cid: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Delete NVR credential (admin only)."""
    return _delete(db, NvrCredential, cid)


@app.post("/api/nvr-credentials/{cid}/test", tags=["NVR Sync"])
async def test_nvr_connection(cid: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Test NVR connection without syncing."""
    cred = _get_or_404(db, NvrCredential, cid)
    password = decrypt_password(cred.password_enc)
    logger.info("Testing NVR connection: cred=%d ip=%s:%d", cid, cred.ip, cred.port)
    result = await _sync_nvr_rpc(cred.ip, cred.port, cred.username, password)
    if result["ok"]:
        cred.last_status = "ok"
        cred.last_sync = _dt.utcnow()
        db.commit()
        return {
            "ok": True,
            "message": f"Conexión exitosa — {len(result['cameras'])} cámaras detectadas",
            "error_code": "",
            "debug": result.get("debug", {})
        }
    else:
        cred.last_status = "error"
        db.commit()
        return {
            "ok": False,
            "message": result["error"],
            "error_code": result.get("error_code", ""),
            "debug": result.get("debug", {})
        }


@app.post("/api/nvr-credentials/{cid}/preview", tags=["NVR Sync"])
async def preview_nvr_sync(cid: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Connect to NVR, get cameras, and compare with existing DB. Returns preview without making changes."""
    cred = _get_or_404(db, NvrCredential, cid)
    password = decrypt_password(cred.password_enc)
    logger.info("Preview NVR sync: cred=%d ip=%s:%d", cid, cred.ip, cred.port)
    result = await _sync_nvr_rpc(cred.ip, cred.port, cred.username, password)

    if not result["ok"]:
        cred.last_status = "error"
        db.commit()
        return {
            "ok": False,
            "error": result["error"],
            "error_code": result.get("error_code", ""),
            "base_url": result.get("base_url", ""),
            "debug": result.get("debug", {}),
            "credential_id": cid,
            "cameras": [], "new_cameras": [], "existing_cameras": [], "updated_cameras": []
        }

    nvr_cameras = result["cameras"]
    # Get existing cameras for this site + recorder
    existing_db = db.query(Camera).filter_by(site_id=cred.site_id)
    if cred.recorder_id:
        existing_db = existing_db.filter_by(recorder_id=cred.recorder_id)
    existing = existing_db.all()

    # Match by channel (within same recorder) or by IP
    existing_by_ch = {c.channel: c for c in existing if c.channel}
    existing_by_ip = {c.ip: c for c in existing if c.ip}

    new_cams = []
    existing_cams = []
    updated_cams = []

    for nc in nvr_cameras:
        preview = NvrCameraPreview(
            channel=nc["channel"], name=nc["name"], ip=nc["ip"],
            model=nc["model"], serial=nc["serial"], mac=nc["mac"],
            status=nc.get("status", "online")
        )
        match = existing_by_ch.get(nc["channel"]) or existing_by_ip.get(nc["ip"])
        if match:
            existing_cams.append(preview)
            # Check if any field differs
            changed = (
                (nc["model"] and nc["model"] != match.model) or
                (nc["serial"] and nc["serial"] != match.serial) or
                (nc["mac"] and nc["mac"] != match.mac) or
                (nc["name"] and nc["name"] != match.name) or
                (nc["ip"] and nc["ip"] != match.ip)
            )
            if changed:
                updated_cams.append(preview)
        else:
            new_cams.append(preview)

    cred.last_status = "ok"
    cred.last_sync = _dt.utcnow()
    db.commit()

    return {
        "ok": True,
        "credential_id": cid,
        "nvr_label": cred.label,
        "cameras": [NvrCameraPreview(**nc).model_dump() for nc in nvr_cameras],
        "new_cameras": [c.model_dump() for c in new_cams],
        "existing_cameras": [c.model_dump() for c in existing_cams],
        "updated_cameras": [c.model_dump() for c in updated_cams],
    }


@app.post("/api/nvr-credentials/{cid}/sync", response_model=NvrSyncResult, tags=["NVR Sync"])
async def execute_nvr_sync(cid: int, req: NvrSyncRequest,
                           admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Execute NVR sync: add new cameras and/or update existing ones."""
    cred = _get_or_404(db, NvrCredential, cid)
    password = decrypt_password(cred.password_enc)
    logger.info("Execute NVR sync: cred=%d action=%s ip=%s:%d", cid, req.action, cred.ip, cred.port)
    result = await _sync_nvr_rpc(cred.ip, cred.port, cred.username, password)

    log = SyncLog(
        credential_id=cid, site_id=cred.site_id,
        user_id=admin.id, action=req.action,
    )

    if not result["ok"]:
        log.status = "error"
        log.error_message = result["error"]
        db.add(log)
        cred.last_status = "error"
        db.commit()
        return NvrSyncResult(
            ok=False, action=req.action, message=result["error"],
            error_code=result.get("error_code", ""),
            base_url=result.get("base_url", ""),
        )

    nvr_cameras = result["cameras"]
    log.cameras_found = len(nvr_cameras)

    # Get existing cameras
    existing_q = db.query(Camera).filter_by(site_id=cred.site_id)
    if cred.recorder_id:
        existing_q = existing_q.filter_by(recorder_id=cred.recorder_id)
    existing = existing_q.all()
    existing_by_ch = {c.channel: c for c in existing if c.channel}
    existing_by_ip = {c.ip: c for c in existing if c.ip}

    added = 0
    updated = 0
    online_count = 0
    offline_count = 0

    for nc in nvr_cameras:
        status = nc.get("status", "online")
        if status == "online":
            online_count += 1
        else:
            offline_count += 1

        match = existing_by_ch.get(nc["channel"]) or existing_by_ip.get(nc["ip"])

        if match:
            # Update existing camera
            if req.update_existing and req.action in ("sync_cameras", "full_sync"):
                changed = False
                if nc["model"] and nc["model"] != match.model:
                    match.model = nc["model"]; changed = True
                if nc["serial"] and nc["serial"] != match.serial:
                    match.serial = nc["serial"]; changed = True
                if nc["mac"] and nc["mac"] != match.mac:
                    match.mac = nc["mac"]; changed = True
                if nc["name"] and nc["name"] != match.name:
                    match.name = nc["name"]; changed = True
                if nc["ip"] and nc["ip"] != match.ip:
                    match.ip = nc["ip"]; changed = True
                if changed:
                    updated += 1
            # Always update status
            if req.action in ("update_status", "full_sync"):
                match.status = status
        else:
            # Add new camera
            if req.add_new and req.action in ("sync_cameras", "full_sync"):
                cam = Camera(
                    site_id=cred.site_id,
                    recorder_id=cred.recorder_id,
                    channel=nc["channel"],
                    name=nc["name"],
                    ip=nc["ip"],
                    model=nc["model"],
                    serial=nc["serial"],
                    mac=nc["mac"],
                    cam_type="ip-net" if nc["ip"] else "analog",
                    status=status,
                )
                db.add(cam)
                added += 1

    log.cameras_added = added
    log.cameras_updated = updated
    log.cameras_online = online_count
    log.cameras_offline = offline_count
    log.status = "ok"
    db.add(log)
    cred.last_status = "ok"
    cred.last_sync = _dt.utcnow()
    db.commit()

    msg_parts = []
    if added: msg_parts.append(f"{added} cámaras agregadas")
    if updated: msg_parts.append(f"{updated} actualizadas")
    msg_parts.append(f"{online_count} online, {offline_count} offline")

    return NvrSyncResult(
        ok=True, action=req.action,
        cameras_found=len(nvr_cameras), cameras_added=added,
        cameras_updated=updated, cameras_online=online_count,
        cameras_offline=offline_count,
        message=" — ".join(msg_parts),
        base_url=result.get("base_url", ""),
    )


@app.get("/api/sites/{site_id}/sync-logs", response_model=List[SyncLogOut], tags=["NVR Sync"])
def list_sync_logs(site_id: int, limit: int = Query(default=50, le=200),
                   admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Get sync history for a site."""
    return db.query(SyncLog).filter_by(site_id=site_id).order_by(SyncLog.created_at.desc()).limit(limit).all()


# ============================================
# HYBRID MONITORING (jobs + events)
# ============================================

from nvr_sync_service import sync_site as _hybrid_sync_site, sync_all_sites as _hybrid_sync_all
import time as _time

JOB_SECRET = os.getenv("JOB_SECRET", "netmanager-job-secret-change-me")


@app.post("/api/jobs/nvr/sync-all", tags=["Jobs"])
async def job_sync_all(request: Request, db: Session = Depends(get_db)):
    """
    Sync all sites with active NVR credentials.
    Protected by x-job-secret header. Designed for n8n/cron.
    """
    secret = request.headers.get("x-job-secret", "")
    if secret != JOB_SECRET:
        raise HTTPException(403, "Invalid or missing x-job-secret header")

    t0 = _time.monotonic()
    results = await _hybrid_sync_all(db)
    elapsed = int((_time.monotonic() - t0) * 1000)

    return {
        "ok": True,
        "sites_synced": len(results),
        "results": results,
        "total_elapsed_ms": elapsed,
    }


@app.post("/api/jobs/nvr/sync-site/{site_id}", tags=["Jobs"])
async def job_sync_site(site_id: int, request: Request,
                        db: Session = Depends(get_db)):
    """
    Sync a single site. Protected by x-job-secret header.
    """
    secret = request.headers.get("x-job-secret", "")
    if secret != JOB_SECRET:
        raise HTTPException(403, "Invalid or missing x-job-secret header")

    result = await _hybrid_sync_site(site_id, db)
    return result.to_dict()


@app.post("/api/admin/nvr/hybrid-sync/{site_id}", response_model=HybridSyncResult, tags=["NVR Sync"])
async def admin_hybrid_sync(site_id: int, admin: User = Depends(require_admin),
                            db: Session = Depends(get_db)):
    """
    Admin trigger: run hybrid sync (NVR inventory + TCP probe) for a site.
    """
    logger.info("Admin hybrid sync: site=%d by user=%s", site_id, admin.username)
    result = await _hybrid_sync_site(site_id, db)
    return HybridSyncResult(**result.to_dict())


@app.get("/api/sites/{site_id}/camera-events", response_model=List[CameraEventOut], tags=["Monitoring"])
def list_camera_events(site_id: int, limit: int = Query(default=100, le=500),
                       severity: Optional[str] = None,
                       user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """Get camera events (status/inventory changes) for a site."""
    check_site_access(user, site_id, db)
    q = db.query(CameraEvent).filter_by(site_id=site_id)
    if severity:
        q = q.filter_by(severity=severity)
    return q.order_by(CameraEvent.created_at.desc()).limit(limit).all()


# ============================================
# HEALTH
# ============================================

@app.get("/api/health", tags=["Admin"])
def health():
    return {"status": "ok", "version": "1.0.0"}


# ============================================
# FRONTEND (Static Files)
# ============================================

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

@app.get("/", include_in_schema=False)
def serve_frontend():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
