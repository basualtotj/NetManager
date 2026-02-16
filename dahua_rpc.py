"""
NetManager — Dahua NVR RPC2 Client (v2 — production-grade)

Connects to Dahua NVRs/DVRs via HTTP RPC API to extract camera info & status.
Implements MD5 challenge-response auth identical to the official web client.

Error codes:
  INVALID_TARGET   — IP/host/puerto inválido o malformado
  TIMEOUT          — El NVR no respondió dentro del plazo
  CONNECT          — No se pudo establecer conexión TCP
  HTTP_STATUS      — El NVR respondió con HTTP status inesperado
  JSON_PARSE       — La respuesta no es JSON válido
  LOGIN_REJECTED   — Credenciales rechazadas por el NVR
  RPC_ERROR        — Error en llamada RPC post-login
"""
import hashlib
import re
import logging
from typing import Optional, List, Dict, Any
import httpx

logger = logging.getLogger("netmanager.dahua")

# ============================================
# MODEL INFERENCE RULES
# ============================================
MODEL_RULES = [
    {"serial_prefix": "9B000AAPAG", "version_contains": "2.800.0000000.8.R", "model": "DH-IPC-HDW1239T1-A-LED-S5"},
    {"serial_prefix": "9F0E033PAG", "version_contains": "", "model": "DH-IPC-HFW2441S-S"},
]

TIMEOUT = 15  # seconds
MAX_RETRIES_STEP1 = 1  # retry step1 once on timeout


# ============================================
# TYPED ERRORS
# ============================================
class DahuaRpcError(Exception):
    """Error con código tipificado para el frontend."""
    def __init__(self, code: str, message: str, base_url: str = ""):
        self.code = code
        self.message = message
        self.base_url = base_url
        super().__init__(f"[{code}] {message}")

    def to_dict(self) -> dict:
        return {"code": self.code, "message": self.message, "base_url": self.base_url}


# ============================================
# TARGET VALIDATION
# ============================================
def normalize_target(ip: str = "", port: int = 80) -> str:
    """
    Valida y normaliza IP/host/puerto a una base_url HTTP limpia.
    Evita URLs malformadas que causan "string did not match expected pattern".

    Args:
        ip: Dirección IP o hostname (e.g. "10.1.1.200", "nvr.local")
        port: Puerto HTTP (default 80). 37777 se rechaza explícitamente.

    Returns:
        base_url limpio (e.g. "http://10.1.1.200:80")

    Raises:
        DahuaRpcError(INVALID_TARGET) si el input es inválido.
    """
    # Validar IP/host
    ip = (ip or "").strip()
    if not ip:
        raise DahuaRpcError("INVALID_TARGET",
            "IP/host vacío — ingresa la dirección del NVR")

    # Rechazar caracteres peligrosos
    if any(c in ip for c in [" ", "'", '"', ";", "&", "|", "\n", "\r"]):
        raise DahuaRpcError("INVALID_TARGET",
            f"IP/host contiene caracteres inválidos: '{ip}'")

    # Validar puerto
    port = int(port) if port is not None else 80
    if port < 1 or port > 65535:
        raise DahuaRpcError("INVALID_TARGET",
            f"Puerto fuera de rango: {port} (debe ser 1-65535)")

    if port == 37777:
        raise DahuaRpcError("INVALID_TARGET",
            "Puerto 37777 es el protocolo binario Dahua, no HTTP. "
            "Usar el puerto HTTP del NVR (generalmente 80 o 443)")

    result = f"http://{ip}:{port}"
    logger.debug("normalize_target: %s:%d → %s", ip, port, result)
    return result


# ============================================
# MD5 HASH (Dahua challenge-response)
# ============================================
def compute_dahua_hash(username: str, password: str, realm: str, random_val: str) -> str:
    """
    Calcula el hash MD5 Dahua de dos pasos.
    Paso 1: MD5(username:realm:password) → uppercase hex
    Paso 2: MD5(username:random:paso1) → uppercase hex
    """
    step1 = hashlib.md5(f"{username}:{realm}:{password}".encode()).hexdigest().upper()
    step2 = hashlib.md5(f"{username}:{random_val}:{step1}".encode()).hexdigest().upper()
    return step2


def _infer_model(serial: str, version: str) -> str:
    """Inferir modelo de cámara desde serial prefix y firmware."""
    for rule in MODEL_RULES:
        prefix_ok = serial.startswith(rule["serial_prefix"]) if rule["serial_prefix"] else True
        version_ok = rule["version_contains"] in version if rule["version_contains"] else True
        if prefix_ok and version_ok:
            return rule["model"]
    return ""


# ============================================
# RPC CALLS
# ============================================
async def _rpc_call(client: httpx.AsyncClient, url: str, payload: dict,
                    timeout: float = TIMEOUT) -> dict:
    """
    Ejecuta una llamada RPC y maneja errores comunes.
    Retorna el dict JSON de la respuesta.
    """
    try:
        r = await client.post(url, json=payload, timeout=timeout)
    except httpx.ConnectError as e:
        raise DahuaRpcError("CONNECT",
            f"No se pudo conectar a {url} — verificar IP, puerto y acceso de red/VPN. "
            f"Detalle: {e}", url)
    except httpx.TimeoutException:
        raise DahuaRpcError("TIMEOUT",
            f"Timeout ({timeout}s) conectando a {url} — "
            f"el NVR no respondió a tiempo", url)
    except Exception as e:
        raise DahuaRpcError("CONNECT",
            f"Error inesperado conectando a {url}: {type(e).__name__}: {e}", url)

    if r.status_code != 200:
        raise DahuaRpcError("HTTP_STATUS",
            f"HTTP {r.status_code} desde {url} (se esperaba 200)", url)

    try:
        return r.json()
    except Exception:
        body_preview = r.text[:200] if r.text else "(vacío)"
        raise DahuaRpcError("JSON_PARSE",
            f"Respuesta no-JSON desde {url}: {body_preview}", url)


def _parse_connection_state(val: dict) -> str:
    """
    Determina online/offline usando ConnectionState si existe, fallback a Enable.
    Dahua retorna ConnectionState como bool, string, o int según firmware.
    """
    conn_state = val.get("ConnectionState")
    if conn_state is not None:
        if isinstance(conn_state, bool):
            return "online" if conn_state else "offline"
        if isinstance(conn_state, str):
            return "online" if conn_state.lower() in ("true", "connected", "1") else "offline"
        if isinstance(conn_state, (int, float)):
            return "online" if conn_state else "offline"
    # Fallback: Enable=True means configured (not necessarily connected)
    return "online" if val.get("Enable") else "offline"


async def dahua_login(client: httpx.AsyncClient, base_url: str,
                      username: str, password: str) -> str:
    """
    Login Dahua RPC2 en dos pasos.
    Retorna session ID. Lanza DahuaRpcError si falla.
    """
    logger.info("Login NVR: %s (usuario: %s)", base_url, username)

    # Paso 1: obtener realm + random (con retry)
    d = None
    for attempt in range(1 + MAX_RETRIES_STEP1):
        try:
            d = await _rpc_call(client, f"{base_url}/RPC2_Login", {
                "method": "global.login",
                "params": {"userName": username, "password": "", "clientType": "Web3.0"},
                "id": 1
            })
            break
        except DahuaRpcError as e:
            if e.code == "TIMEOUT" and attempt < MAX_RETRIES_STEP1:
                logger.warning("Timeout en paso 1, reintentando (%d/%d)...",
                               attempt + 1, MAX_RETRIES_STEP1)
                continue
            raise

    if "params" not in d:
        raise DahuaRpcError("LOGIN_REJECTED",
            f"El NVR en {base_url} no retornó parámetros de autenticación — "
            f"posiblemente no es un dispositivo Dahua o el puerto es incorrecto",
            base_url)

    realm = d["params"].get("realm", "")
    random_val = d["params"].get("random", "")
    sid = d.get("session", "")

    if not realm or not random_val or not sid:
        raise DahuaRpcError("LOGIN_REJECTED",
            f"Respuesta de login incompleta desde {base_url} (realm/random/session vacíos)",
            base_url)

    # Paso 2: enviar hash MD5
    final_hash = compute_dahua_hash(username, password, realm, random_val)

    data = await _rpc_call(client, f"{base_url}/RPC2_Login", {
        "method": "global.login",
        "params": {
            "userName": username,
            "password": final_hash,
            "clientType": "Web3.0",
            "authorityType": "Default"
        },
        "id": 2,
        "session": sid
    })

    if not data.get("result"):
        error_code = data.get("error", {}).get("code", "desconocido")
        raise DahuaRpcError("LOGIN_REJECTED",
            f"Credenciales rechazadas por el NVR en {base_url} — "
            f"verificar usuario/contraseña (error NVR: {error_code})",
            base_url)

    logger.info("Login OK: %s (session: %s...)", base_url, sid[:8])
    return sid


async def dahua_logout(client: httpx.AsyncClient, base_url: str, sid: str):
    """Cerrar sesión. No lanza excepciones."""
    try:
        await client.post(f"{base_url}/RPC2", json={
            "method": "global.logout", "params": {}, "id": 99, "session": sid
        }, timeout=5)
        logger.debug("Logout OK: %s", base_url)
    except Exception:
        pass


async def dahua_get_cameras(client: httpx.AsyncClient, base_url: str,
                            sid: str) -> List[Dict[str, Any]]:
    """
    Obtener lista de cámaras desde RemoteDevice config.
    Retorna lista de dicts: {channel, name, ip, model, serial, mac, status}
    """
    data = await _rpc_call(client, f"{base_url}/RPC2", {
        "method": "configManager.getConfig",
        "params": {"name": "RemoteDevice"},
        "id": 3,
        "session": sid
    })

    if not data.get("result") or "params" not in data:
        logger.warning("RemoteDevice sin datos desde %s", base_url)
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
                "status": _parse_connection_state(val),
            })

    cameras.sort(key=lambda x: x["channel"])
    logger.info("RemoteDevice: %d cámaras habilitadas desde %s", len(cameras), base_url)
    return cameras


async def dahua_get_channel_status(client: httpx.AsyncClient, base_url: str,
                                   sid: str) -> Dict[int, str]:
    """
    Obtener estado online/offline por canal.
    Usa ConnectionState real, fallback a Enable.
    Retorna {channel_number: "online"|"offline"}
    """
    status_map = {}
    try:
        data = await _rpc_call(client, f"{base_url}/RPC2", {
            "method": "configManager.getConfig",
            "params": {"name": "RemoteDevice"},
            "id": 5,
            "session": sid
        })

        if data.get("result") and "params" in data:
            params = data["params"]
            table = params.get("table", params)
            if isinstance(table, dict):
                for key, val in table.items():
                    if not isinstance(val, dict):
                        continue
                    match = re.search(r'INFO_(\d+)', key)
                    if not match:
                        continue
                    ch = int(match.group(1)) + 1
                    status_map[ch] = _parse_connection_state(val)

        logger.debug("Channel status: %d canales desde %s", len(status_map), base_url)
    except DahuaRpcError as e:
        logger.warning("No se pudo obtener status de canales: [%s] %s", e.code, e.message)
    except Exception as e:
        logger.warning("Error obteniendo status: %s", e)

    return status_map


# ============================================
# SYNC COMPLETO
# ============================================
async def sync_nvr(ip: str, port: int, username: str, password: str) -> Dict[str, Any]:
    """
    Sincronización completa: validar → login → cámaras → status → logout.
    Retorna {ok, cameras, error, error_code, base_url, debug}.

    El campo 'debug' incluye información para diagnóstico sin exponer passwords.
    """
    # 1. Validar y normalizar target
    try:
        base_url = normalize_target(ip=ip, port=port)
    except DahuaRpcError as e:
        return {
            "ok": False, "cameras": [], "error": e.message,
            "error_code": e.code, "base_url": "",
            "debug": {"step": "normalize", "ip": ip, "port": port}
        }

    debug_info = {
        "base_url": base_url,
        "username": username,
        "port_used": port,
        "timeout": TIMEOUT,
        "step": "init"
    }

    # 2. Login
    async with httpx.AsyncClient() as client:
        sid = None
        try:
            debug_info["step"] = "login"
            sid = await dahua_login(client, base_url, username, password)
        except DahuaRpcError as e:
            logger.error("NVR login failed: [%s] %s", e.code, e.message)
            return {
                "ok": False, "cameras": [], "error": e.message,
                "error_code": e.code, "base_url": base_url,
                "debug": {**debug_info, "step": "login_failed"}
            }

        # 3. Obtener cámaras y status
        try:
            debug_info["step"] = "get_cameras"
            cameras = await dahua_get_cameras(client, base_url, sid)

            debug_info["step"] = "get_status"
            statuses = await dahua_get_channel_status(client, base_url, sid)

            # Merge status
            for cam in cameras:
                if cam["channel"] in statuses:
                    cam["status"] = statuses[cam["channel"]]

            online = sum(1 for c in cameras if c["status"] == "online")
            offline = len(cameras) - online
            debug_info["step"] = "done"
            debug_info["cameras_found"] = len(cameras)
            debug_info["online"] = online
            debug_info["offline"] = offline

            logger.info("NVR sync OK: %s — %d cámaras (%d online, %d offline)",
                        base_url, len(cameras), online, offline)

            return {
                "ok": True, "cameras": cameras, "error": "",
                "error_code": "", "base_url": base_url,
                "debug": debug_info
            }

        except DahuaRpcError as e:
            logger.error("NVR data fetch failed: [%s] %s", e.code, e.message)
            return {
                "ok": False, "cameras": [], "error": e.message,
                "error_code": e.code, "base_url": base_url,
                "debug": {**debug_info, "error_step": debug_info["step"]}
            }
        except Exception as e:
            logger.error("NVR unexpected error: %s: %s", type(e).__name__, e)
            return {
                "ok": False, "cameras": [],
                "error": f"Error inesperado obteniendo cámaras: {type(e).__name__}: {e}",
                "error_code": "RPC_ERROR", "base_url": base_url,
                "debug": {**debug_info, "exception": str(e)}
            }
        finally:
            if sid:
                await dahua_logout(client, base_url, sid)
