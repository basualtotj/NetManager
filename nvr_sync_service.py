"""
NetManager — NVR Hybrid Sync Service
Orchestrates: NVR inventory + TCP probe + DB upsert + change detection + anti-jitter.

Usage:
    result = await sync_site(site_id, db)

Returns a SyncRunResult with summary stats and events generated.
"""
import json
import logging
import uuid
import time
from datetime import datetime
from typing import Dict, List, Any, Optional

from sqlalchemy.orm import Session

from database import (
    Site, Camera, NvrCredential, SyncLog,
    CameraSnapshot, CameraEvent
)
from crypto_utils import decrypt_password
from dahua_rpc import sync_nvr as _sync_nvr_rpc
from camera_probe import probe_many, is_valid_ip

logger = logging.getLogger("netmanager.sync")

# Anti-jitter: require N consecutive offline probes before marking offline/crit
OFFLINE_STRIKES_THRESHOLD = 2


class SyncRunResult:
    """Result of a single sync_site run."""
    def __init__(self):
        self.site_id: int = 0
        self.ok: bool = False
        self.error: str = ""
        self.error_code: str = ""
        self.total: int = 0
        self.online: int = 0
        self.offline: int = 0
        self.unknown: int = 0
        self.added: int = 0
        self.updated: int = 0
        self.inventory_changes: int = 0
        self.status_changes: int = 0
        self.elapsed_ms: int = 0
        self.run_id: str = ""

    def to_dict(self) -> dict:
        return {
            "site_id": self.site_id,
            "ok": self.ok,
            "error": self.error,
            "error_code": self.error_code,
            "total": self.total,
            "online": self.online,
            "offline": self.offline,
            "unknown": self.unknown,
            "added": self.added,
            "updated": self.updated,
            "inventory_changes": self.inventory_changes,
            "status_changes": self.status_changes,
            "elapsed_ms": self.elapsed_ms,
            "run_id": self.run_id,
        }


def _detect_inventory_changes(
    old: Dict[str, Any], new: Dict[str, Any], channel: int
) -> List[str]:
    """Compare old vs new camera data, return list of changed field names."""
    fields = ["ip", "mac", "model", "serial", "name"]
    changes = []
    for f in fields:
        old_val = (old.get(f) or "").strip()
        new_val = (new.get(f) or "").strip()
        if new_val and old_val != new_val:
            changes.append(f)
    return changes


async def sync_site(site_id: int, db: Session) -> SyncRunResult:
    """
    Full hybrid sync for one site:
    1. Get NVR credentials
    2. Fetch inventory from NVR (RemoteDevice)
    3. TCP-probe cameras for real status
    4. Upsert cameras in DB
    5. Save snapshot
    6. Detect changes + generate events with anti-jitter

    Returns SyncRunResult with summary.
    """
    t0 = time.monotonic()
    result = SyncRunResult()
    result.site_id = site_id
    result.run_id = str(uuid.uuid4())[:12]

    # 1. Get active credential for this site
    cred = db.query(NvrCredential).filter_by(
        site_id=site_id, active=True
    ).first()

    if not cred:
        result.error = "No hay credenciales NVR activas para este sitio"
        result.error_code = "NO_CREDENTIALS"
        result.elapsed_ms = int((time.monotonic() - t0) * 1000)
        return result

    # 2. Fetch inventory from NVR
    logger.info("[%s] Sync site=%d (%s:%d) run=%s",
                result.run_id, site_id, cred.ip, cred.port, result.run_id)

    password = decrypt_password(cred.password_enc)
    nvr_result = await _sync_nvr_rpc(cred.ip, cred.port, cred.username, password)

    if not nvr_result["ok"]:
        result.error = nvr_result["error"]
        result.error_code = nvr_result.get("error_code", "NVR_ERROR")
        cred.last_status = "error"
        db.commit()
        result.elapsed_ms = int((time.monotonic() - t0) * 1000)

        # Log the failure
        log = SyncLog(
            credential_id=cred.id, site_id=site_id,
            action="hybrid_sync", status="error",
            error_message=result.error,
        )
        db.add(log)
        db.commit()
        return result

    nvr_cameras = nvr_result["cameras"]
    result.total = len(nvr_cameras)

    # 3. TCP probe for real status
    probed_status = await probe_many(nvr_cameras)

    # 4. Get existing cameras from DB
    existing_q = db.query(Camera).filter_by(site_id=site_id)
    if cred.recorder_id:
        existing_q = existing_q.filter_by(recorder_id=cred.recorder_id)
    existing = existing_q.all()
    existing_by_ch: Dict[int, Camera] = {c.channel: c for c in existing if c.channel}
    existing_by_ip: Dict[str, Camera] = {c.ip: c for c in existing if c.ip}

    now = datetime.utcnow()
    events_to_add: List[CameraEvent] = []

    # 5. Upsert each camera
    for nc in nvr_cameras:
        ch = nc["channel"]
        real_status = probed_status.get(ch, "unknown")

        # Count totals
        if real_status == "online":
            result.online += 1
        elif real_status == "offline":
            result.offline += 1
        else:
            result.unknown += 1

        # Find existing camera
        match = existing_by_ch.get(ch) or existing_by_ip.get(nc.get("ip", ""))

        if match:
            # --- INVENTORY CHANGE DETECTION ---
            old_data = {
                "ip": match.ip or "",
                "mac": match.mac or "",
                "model": match.model or "",
                "serial": match.serial or "",
                "name": match.name or "",
            }
            changes = _detect_inventory_changes(old_data, nc, ch)
            if changes:
                result.inventory_changes += 1
                msg = f"CH{ch} inventario cambió: {', '.join(changes)}"
                events_to_add.append(CameraEvent(
                    site_id=site_id,
                    camera_id=match.id,
                    channel=ch,
                    event_type="inventory_change",
                    from_status=json.dumps({f: old_data[f] for f in changes}),
                    to_status=json.dumps({f: nc.get(f, "") for f in changes}),
                    severity="info",
                    message=msg,
                ))

            # Update fields from NVR
            if nc.get("name"):
                match.name = nc["name"]
            if nc.get("ip"):
                match.ip = nc["ip"]
            if nc.get("mac"):
                match.mac = nc["mac"]
            if nc.get("model"):
                match.model = nc["model"]
            if nc.get("serial"):
                match.serial = nc["serial"]
            match.configured = True
            match.status_config = "enabled"

            # --- STATUS CHANGE DETECTION with anti-jitter ---
            old_status_real = match.status_real or "unknown"

            if real_status == "online":
                match.offline_streak = 0
                match.last_seen_at = now
                if old_status_real != "online":
                    result.status_changes += 1
                    sev = "info" if old_status_real == "unknown" else "info"
                    events_to_add.append(CameraEvent(
                        site_id=site_id,
                        camera_id=match.id,
                        channel=ch,
                        event_type="status_change",
                        from_status=old_status_real,
                        to_status="online",
                        severity=sev,
                        message=f"CH{ch} {match.name}: {old_status_real} → online",
                    ))
                match.status_real = "online"
                match.status = "online"  # legacy field

            elif real_status == "offline":
                match.offline_streak = (match.offline_streak or 0) + 1
                if match.offline_streak >= OFFLINE_STRIKES_THRESHOLD:
                    if old_status_real != "offline":
                        result.status_changes += 1
                        events_to_add.append(CameraEvent(
                            site_id=site_id,
                            camera_id=match.id,
                            channel=ch,
                            event_type="status_change",
                            from_status=old_status_real,
                            to_status="offline",
                            severity="crit",
                            message=f"CH{ch} {match.name}: {old_status_real} → offline ({match.offline_streak} strikes)",
                        ))
                    match.status_real = "offline"
                    match.status = "offline"
                else:
                    # First strike — warn but don't change status_real yet
                    if old_status_real == "online":
                        events_to_add.append(CameraEvent(
                            site_id=site_id,
                            camera_id=match.id,
                            channel=ch,
                            event_type="status_change",
                            from_status=old_status_real,
                            to_status="offline",
                            severity="warn",
                            message=f"CH{ch} {match.name}: probe fallido ({match.offline_streak}/{OFFLINE_STRIKES_THRESHOLD})",
                        ))
                    # Keep current status_real until threshold

            else:
                # unknown — don't change status_real, don't generate events
                if old_status_real == "unknown" or not match.status_real:
                    match.status_real = "unknown"

            match.updated_at = now
            result.updated += 1

        else:
            # New camera — add to DB
            cam = Camera(
                site_id=site_id,
                recorder_id=cred.recorder_id,
                channel=ch,
                name=nc.get("name", ""),
                ip=nc.get("ip", ""),
                model=nc.get("model", ""),
                serial=nc.get("serial", ""),
                mac=nc.get("mac", ""),
                cam_type="ip-net" if nc.get("ip") else "analog",
                configured=True,
                status_config="enabled",
                status_real=real_status,
                status=real_status if real_status != "unknown" else "online",
                last_seen_at=now if real_status == "online" else None,
                offline_streak=0 if real_status != "offline" else 1,
            )
            db.add(cam)
            result.added += 1

    # 6. Save snapshot
    snapshot_payload = []
    for nc in nvr_cameras:
        ch = nc["channel"]
        snapshot_payload.append({
            "channel": ch,
            "name": nc.get("name", ""),
            "ip": nc.get("ip", ""),
            "mac": nc.get("mac", ""),
            "model": nc.get("model", ""),
            "serial": nc.get("serial", ""),
            "configured": True,
            "status_config": "enabled",
            "status_real": probed_status.get(ch, "unknown"),
        })

    snapshot = CameraSnapshot(
        site_id=site_id,
        run_id=result.run_id,
        payload_json=json.dumps(snapshot_payload),
    )
    db.add(snapshot)

    # 7. Add events (deduplicated — same event_type+channel within 5 min is dropped)
    for evt in events_to_add:
        # Dedup: check if same event exists in last 5 minutes
        recent = db.query(CameraEvent).filter(
            CameraEvent.site_id == site_id,
            CameraEvent.channel == evt.channel,
            CameraEvent.event_type == evt.event_type,
            CameraEvent.to_status == evt.to_status,
            CameraEvent.created_at >= datetime(now.year, now.month, now.day,
                                                now.hour, max(0, now.minute - 5)),
        ).first()
        if not recent:
            db.add(evt)

    # 8. Update credential and log
    cred.last_status = "ok"
    cred.last_sync = now

    log = SyncLog(
        credential_id=cred.id,
        site_id=site_id,
        action="hybrid_sync",
        status="ok",
        cameras_found=result.total,
        cameras_added=result.added,
        cameras_updated=result.updated,
        cameras_online=result.online,
        cameras_offline=result.offline,
    )
    db.add(log)
    db.commit()

    result.ok = True
    result.elapsed_ms = int((time.monotonic() - t0) * 1000)

    logger.info("[%s] Sync complete: site=%d total=%d online=%d offline=%d unknown=%d "
                "added=%d updated=%d inv_changes=%d status_changes=%d elapsed=%dms",
                result.run_id, site_id, result.total, result.online, result.offline,
                result.unknown, result.added, result.updated, result.inventory_changes,
                result.status_changes, result.elapsed_ms)

    return result


async def sync_all_sites(db: Session) -> List[dict]:
    """
    Sync all sites that have active NVR credentials.
    Returns list of SyncRunResult dicts.
    """
    # Find all sites with active credentials
    creds = db.query(NvrCredential).filter_by(active=True).all()
    site_ids = list(set(c.site_id for c in creds))

    logger.info("sync_all_sites: %d sites to sync", len(site_ids))

    results = []
    for sid in site_ids:
        try:
            r = await sync_site(sid, db)
            results.append(r.to_dict())
        except Exception as e:
            logger.error("sync_all_sites: site=%d failed: %s", sid, e)
            results.append({
                "site_id": sid,
                "ok": False,
                "error": f"{type(e).__name__}: {e}",
                "error_code": "INTERNAL_ERROR",
            })

    return results
