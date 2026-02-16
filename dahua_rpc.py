"""
NetManager — Dahua NVR RPC Client
Connects to Dahua NVRs/DVRs via HTTP RPC API to extract camera info & status.
Implements the same MD5 challenge-response auth as the official web client.
"""
import hashlib
import re
from typing import Optional, List, Dict, Any
import httpx

# Inference rules for missing camera models
MODEL_RULES = [
    {"serial_prefix": "9B000AAPAG", "version_contains": "2.800.0000000.8.R", "model": "DH-IPC-HDW1239T1-A-LED-S5"},
    {"serial_prefix": "9F0E033PAG", "version_contains": "", "model": "DH-IPC-HFW2441S-S"},
]

TIMEOUT = 15  # seconds (generous for VPN connections)


def _infer_model(serial: str, version: str) -> str:
    """Try to infer camera model from serial prefix and firmware version."""
    for rule in MODEL_RULES:
        prefix_ok = serial.startswith(rule["serial_prefix"]) if rule["serial_prefix"] else True
        version_ok = rule["version_contains"] in version if rule["version_contains"] else True
        if prefix_ok and version_ok:
            return rule["model"]
    return ""


async def dahua_login(client: httpx.AsyncClient, base_url: str, username: str, password: str) -> Optional[str]:
    """
    Perform Dahua RPC2 two-step login.
    Returns session ID on success, None on failure.
    """
    # Step 1: get realm + random
    try:
        r = await client.post(f"{base_url}/RPC2_Login", json={
            "method": "global.login",
            "params": {"userName": username, "password": "", "clientType": "Web3.0"},
            "id": 1
        }, timeout=TIMEOUT)
        d = r.json()
    except httpx.ConnectError:
        raise ConnectionError(f"No se pudo conectar a {base_url} — verificar IP, puerto y acceso de red/VPN")
    except httpx.TimeoutException:
        raise ConnectionError(f"Timeout conectando a {base_url} — la conexión tardó más de {TIMEOUT}s")
    except Exception as e:
        raise ConnectionError(f"Error de conexión a {base_url}: {type(e).__name__}: {e}")

    if "params" not in d:
        return None

    realm = d["params"].get("realm", "")
    random_val = d["params"].get("random", "")
    sid = d.get("session", "")

    if not realm or not random_val or not sid:
        return None

    # Step 2: compute MD5 challenge response
    pwd_hash = hashlib.md5(f"{username}:{realm}:{password}".encode()).hexdigest().upper()
    final_hash = hashlib.md5(f"{username}:{random_val}:{pwd_hash}".encode()).hexdigest().upper()

    try:
        r = await client.post(f"{base_url}/RPC2_Login", json={
            "method": "global.login",
            "params": {
                "userName": username,
                "password": final_hash,
                "clientType": "Web3.0",
                "authorityType": "Default"
            },
            "id": 2,
            "session": sid
        }, timeout=TIMEOUT)
        data = r.json()
    except Exception as e:
        raise ConnectionError(f"Error en login paso 2: {e}")

    if data.get("result"):
        return sid
    return None


async def dahua_logout(client: httpx.AsyncClient, base_url: str, sid: str):
    """Logout from NVR session."""
    try:
        await client.post(f"{base_url}/RPC2", json={
            "method": "global.logout",
            "params": {},
            "id": 99,
            "session": sid
        }, timeout=5)
    except Exception:
        pass


async def dahua_get_cameras(client: httpx.AsyncClient, base_url: str, sid: str) -> List[Dict[str, Any]]:
    """
    Fetch camera list from NVR RemoteDevice config.
    Returns list of dicts: {channel, name, ip, model, serial, mac}
    """
    try:
        r = await client.post(f"{base_url}/RPC2", json={
            "method": "configManager.getConfig",
            "params": {"name": "RemoteDevice"},
            "id": 3,
            "session": sid
        }, timeout=TIMEOUT)
        data = r.json()
    except Exception:
        return []

    if not data.get("result") or "params" not in data:
        return []

    params = data["params"]
    table = params.get("table", params)
    cameras = []

    if isinstance(table, dict):
        for key, val in table.items():
            if not isinstance(val, dict) or "Address" not in val:
                continue

            match = re.search(r'INFO_(\d+)', key)
            canal = int(match.group(1)) + 1 if match else 0

            if not val.get("Enable"):
                continue

            serial = val.get("SerialNo") or val.get("Name") or ""
            version = val.get("Version") or ""
            model = val.get("DeviceType") or _infer_model(serial, version)

            # Get camera name from VideoInputs
            name = ""
            video_inputs = val.get("VideoInputs", [])
            if video_inputs and len(video_inputs) > 0:
                name = video_inputs[0].get("Name", "")

            cameras.append({
                "channel": canal,
                "name": name,
                "ip": val.get("Address", ""),
                "model": model,
                "serial": serial,
                "mac": val.get("Mac", ""),
                "status": "online",  # If it responds, it's enabled
            })

    cameras.sort(key=lambda x: x["channel"])
    return cameras


async def dahua_get_channel_status(client: httpx.AsyncClient, base_url: str, sid: str,
                                     max_channels: int = 64) -> Dict[int, str]:
    """
    Get online/offline status for each channel.
    Returns {channel_number: "online"|"offline"}
    """
    status_map = {}
    try:
        r = await client.post(f"{base_url}/RPC2", json={
            "method": "configManager.getConfig",
            "params": {"name": "ChannelTitle"},
            "id": 4,
            "session": sid
        }, timeout=TIMEOUT)
        # Try getting connection state
        r2 = await client.post(f"{base_url}/RPC2", json={
            "method": "configManager.getConfig",
            "params": {"name": "RemoteDevice"},
            "id": 5,
            "session": sid
        }, timeout=TIMEOUT)
        data = r2.json()
        if data.get("result") and "params" in data:
            params = data["params"]
            table = params.get("table", params)
            if isinstance(table, dict):
                for key, val in table.items():
                    if not isinstance(val, dict):
                        continue
                    match = re.search(r'INFO_(\d+)', key)
                    if match:
                        ch = int(match.group(1)) + 1
                        # If Enable is True and has Address, camera is configured
                        # ConnectionState might be available
                        enabled = val.get("Enable", False)
                        status_map[ch] = "online" if enabled else "offline"
    except Exception:
        pass

    return status_map


async def sync_nvr(ip: str, port: int, username: str, password: str) -> Dict[str, Any]:
    """
    Complete NVR sync: login, get cameras, get status, logout.
    Returns {ok, cameras, error}.
    Port should be the HTTP port (usually 80), NOT the binary port (37777).
    """
    base_url = f"http://{ip}:{port}"

    async with httpx.AsyncClient() as client:
        try:
            sid = await dahua_login(client, base_url, username, password)
        except ConnectionError as e:
            return {"ok": False, "cameras": [], "error": str(e)}

        if not sid:
            return {"ok": False, "cameras": [], "error": f"Login rechazado por el NVR en {base_url} — credenciales incorrectas o usuario bloqueado"}

        try:
            cameras = await dahua_get_cameras(client, base_url, sid)
            statuses = await dahua_get_channel_status(client, base_url, sid)

            # Merge status into cameras
            for cam in cameras:
                if cam["channel"] in statuses:
                    cam["status"] = statuses[cam["channel"]]

            return {"ok": True, "cameras": cameras, "error": ""}
        except Exception as e:
            return {"ok": False, "cameras": [], "error": f"Error obteniendo cámaras: {e}"}
        finally:
            await dahua_logout(client, base_url, sid)
