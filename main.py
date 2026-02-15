"""
NetManager — API Server
FastAPI + SQLite backend for CCTV infrastructure management
"""
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import (
    init_db, get_db,
    Site, Building, Rack, Router, Switch, Recorder, PatchPanel, Camera
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
    DashboardStats, SiteFullExport
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
# SITES
# ============================================

@app.post("/api/sites", response_model=SiteOut, tags=["Sites"])
def create_site(data: SiteCreate, db: Session = Depends(get_db)):
    return _create(db, Site, data.model_dump())


@app.get("/api/sites", response_model=List[SiteOut], tags=["Sites"])
def list_sites(db: Session = Depends(get_db)):
    return db.query(Site).all()


@app.get("/api/sites/{site_id}", response_model=SiteOut, tags=["Sites"])
def get_site(site_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Site, site_id)


@app.put("/api/sites/{site_id}", response_model=SiteOut, tags=["Sites"])
def update_site(site_id: int, data: SiteUpdate, db: Session = Depends(get_db)):
    return _update(db, Site, site_id, data.model_dump())


@app.delete("/api/sites/{site_id}", tags=["Sites"])
def delete_site(site_id: int, db: Session = Depends(get_db)):
    return _delete(db, Site, site_id)


# ============================================
# FULL SITE EXPORT (single endpoint for frontend)
# ============================================

@app.get("/api/sites/{site_id}/full", response_model=SiteFullExport, tags=["Sites"])
def get_site_full(site_id: int, db: Session = Depends(get_db)):
    """Get all data for a site in one call — used to hydrate the frontend"""
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
def get_dashboard(site_id: int, db: Session = Depends(get_db)):
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
def create_building(data: BuildingCreate, db: Session = Depends(get_db)):
    return _create(db, Building, data.model_dump())

@app.get("/api/sites/{site_id}/buildings", response_model=List[BuildingOut], tags=["Buildings"])
def list_buildings(site_id: int, db: Session = Depends(get_db)):
    return db.query(Building).filter_by(site_id=site_id).all()

@app.put("/api/buildings/{bid}", response_model=BuildingOut, tags=["Buildings"])
def update_building(bid: int, data: BuildingUpdate, db: Session = Depends(get_db)):
    return _update(db, Building, bid, data.model_dump())

@app.delete("/api/buildings/{bid}", tags=["Buildings"])
def delete_building(bid: int, db: Session = Depends(get_db)):
    return _delete(db, Building, bid)


# ============================================
# RACKS
# ============================================

@app.post("/api/racks", response_model=RackOut, tags=["Racks"])
def create_rack(data: RackCreate, db: Session = Depends(get_db)):
    return _create(db, Rack, data.model_dump())

@app.get("/api/sites/{site_id}/racks", response_model=List[RackOut], tags=["Racks"])
def list_racks(site_id: int, db: Session = Depends(get_db)):
    return db.query(Rack).filter_by(site_id=site_id).all()

@app.put("/api/racks/{rid}", response_model=RackOut, tags=["Racks"])
def update_rack(rid: int, data: RackUpdate, db: Session = Depends(get_db)):
    return _update(db, Rack, rid, data.model_dump())

@app.delete("/api/racks/{rid}", tags=["Racks"])
def delete_rack(rid: int, db: Session = Depends(get_db)):
    return _delete(db, Rack, rid)


# ============================================
# ROUTERS
# ============================================

@app.post("/api/routers", response_model=RouterOut, tags=["Routers"])
def create_router(data: RouterCreate, db: Session = Depends(get_db)):
    return _create(db, Router, data.model_dump())

@app.get("/api/sites/{site_id}/routers", response_model=List[RouterOut], tags=["Routers"])
def list_routers(site_id: int, db: Session = Depends(get_db)):
    return db.query(Router).filter_by(site_id=site_id).all()

@app.put("/api/routers/{rid}", response_model=RouterOut, tags=["Routers"])
def update_router(rid: int, data: RouterUpdate, db: Session = Depends(get_db)):
    return _update(db, Router, rid, data.model_dump())

@app.delete("/api/routers/{rid}", tags=["Routers"])
def delete_router(rid: int, db: Session = Depends(get_db)):
    return _delete(db, Router, rid)


# ============================================
# SWITCHES
# ============================================

@app.post("/api/switches", response_model=SwitchOut, tags=["Switches"])
def create_switch(data: SwitchCreate, db: Session = Depends(get_db)):
    return _create(db, Switch, data.model_dump())

@app.get("/api/sites/{site_id}/switches", response_model=List[SwitchOut], tags=["Switches"])
def list_switches(site_id: int, db: Session = Depends(get_db)):
    return db.query(Switch).filter_by(site_id=site_id).all()

@app.put("/api/switches/{sid}", response_model=SwitchOut, tags=["Switches"])
def update_switch(sid: int, data: SwitchUpdate, db: Session = Depends(get_db)):
    return _update(db, Switch, sid, data.model_dump())

@app.delete("/api/switches/{sid}", tags=["Switches"])
def delete_switch(sid: int, db: Session = Depends(get_db)):
    return _delete(db, Switch, sid)


# ============================================
# RECORDERS (NVR/DVR/XVR/HCVR)
# ============================================

@app.post("/api/recorders", response_model=RecorderOut, tags=["Recorders"])
def create_recorder(data: RecorderCreate, db: Session = Depends(get_db)):
    d = data.model_dump()
    d["nics"] = [n.model_dump() if hasattr(n, "model_dump") else n for n in d.get("nics", [])]
    d["disks"] = [dk.model_dump() if hasattr(dk, "model_dump") else dk for dk in d.get("disks", [])]
    return _create(db, Recorder, d)

@app.get("/api/sites/{site_id}/recorders", response_model=List[RecorderOut], tags=["Recorders"])
def list_recorders(site_id: int, db: Session = Depends(get_db)):
    return db.query(Recorder).filter_by(site_id=site_id).all()

@app.put("/api/recorders/{rid}", response_model=RecorderOut, tags=["Recorders"])
def update_recorder(rid: int, data: RecorderUpdate, db: Session = Depends(get_db)):
    d = data.model_dump()
    d["nics"] = [n.model_dump() if hasattr(n, "model_dump") else n for n in d.get("nics", [])]
    d["disks"] = [dk.model_dump() if hasattr(dk, "model_dump") else dk for dk in d.get("disks", [])]
    return _update(db, Recorder, rid, d)

@app.delete("/api/recorders/{rid}", tags=["Recorders"])
def delete_recorder(rid: int, db: Session = Depends(get_db)):
    return _delete(db, Recorder, rid)


# ============================================
# PATCH PANELS
# ============================================

@app.post("/api/patch-panels", response_model=PatchPanelOut, tags=["PatchPanels"])
def create_patch_panel(data: PatchPanelCreate, db: Session = Depends(get_db)):
    return _create(db, PatchPanel, data.model_dump())

@app.get("/api/sites/{site_id}/patch-panels", response_model=List[PatchPanelOut], tags=["PatchPanels"])
def list_patch_panels(site_id: int, db: Session = Depends(get_db)):
    return db.query(PatchPanel).filter_by(site_id=site_id).all()

@app.put("/api/patch-panels/{pid}", response_model=PatchPanelOut, tags=["PatchPanels"])
def update_patch_panel(pid: int, data: PatchPanelUpdate, db: Session = Depends(get_db)):
    return _update(db, PatchPanel, pid, data.model_dump())

@app.delete("/api/patch-panels/{pid}", tags=["PatchPanels"])
def delete_patch_panel(pid: int, db: Session = Depends(get_db)):
    return _delete(db, PatchPanel, pid)


# ============================================
# CAMERAS
# ============================================

@app.post("/api/cameras", response_model=CameraOut, tags=["Cameras"])
def create_camera(data: CameraCreate, db: Session = Depends(get_db)):
    return _create(db, Camera, data.model_dump())

@app.post("/api/cameras/bulk", response_model=List[CameraOut], tags=["Cameras"])
def create_cameras_bulk(data: CameraBulkCreate, db: Session = Depends(get_db)):
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
def get_camera(cid: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Camera, cid)

@app.put("/api/cameras/{cid}", response_model=CameraOut, tags=["Cameras"])
def update_camera(cid: int, data: CameraUpdate, db: Session = Depends(get_db)):
    return _update(db, Camera, cid, data.model_dump())

@app.put("/api/cameras/bulk-update", response_model=List[CameraOut], tags=["Cameras"])
def bulk_update_cameras(
    camera_ids: List[int],
    field: str = Query(...),
    value: str = Query(...),
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
def delete_camera(cid: int, db: Session = Depends(get_db)):
    return _delete(db, Camera, cid)


# ============================================
# VALIDATION ENDPOINT
# ============================================

@app.get("/api/sites/{site_id}/validate", tags=["Validation"])
def validate_site(site_id: int, db: Session = Depends(get_db)):
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
                contact="Fernando Flores", phone="+56 9 XXXX XXXX", email="admin@donbosco.cl")
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
# HEALTH
# ============================================

@app.get("/api/health", tags=["Admin"])
def health():
    return {"status": "ok", "version": "1.0.0"}
