"""
NetManager — Camera Probe Module
TCP connectivity probes to determine real camera online/offline status.

Probes cameras by attempting TCP connections to known ports (554 RTSP, 80 HTTP, 37777 Dahua).
Uses asyncio for high concurrency with configurable limits.
"""
import asyncio
import ipaddress
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger("netmanager.probe")

# Default probe config
DEFAULT_PORTS = [554, 80, 37777]
DEFAULT_TIMEOUT = 2.0
DEFAULT_MAX_CONCURRENCY = 50


def is_valid_ip(ip: str) -> bool:
    """Check if string is a valid IPv4/IPv6 address (not empty, not hostname)."""
    if not ip or not ip.strip():
        return False
    try:
        ipaddress.ip_address(ip.strip())
        return True
    except ValueError:
        return False


async def check_routable(ip: str, timeout: float = 1.0) -> bool:
    """
    Quick check if an IP is routable from this host.
    Attempts a TCP connect on port 80 with short timeout.
    Returns True if connection succeeds OR gets refused (host is reachable).
    Returns False if we get Network Unreachable, timeout, or other failure indicating
    the network path doesn't exist.
    """
    if not is_valid_ip(ip):
        return False
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(ip.strip(), 80),
            timeout=timeout
        )
        writer.close()
        await writer.wait_closed()
        return True
    except ConnectionRefusedError:
        # Host is reachable, just port 80 is closed — still routable
        return True
    except asyncio.TimeoutError:
        # Could be routable but slow, or not routable — ambiguous
        # We treat timeout as "possibly routable" — will try full probe
        return True
    except OSError as e:
        error_str = str(e).lower()
        # "network is unreachable", "no route to host", "host is down"
        if any(kw in error_str for kw in ["unreachable", "no route", "host is down"]):
            return False
        # Other OS errors — assume not routable
        return False
    except Exception:
        return False


async def probe_camera_tcp(
    ip: str,
    ports: List[int] = None,
    timeout_s: float = DEFAULT_TIMEOUT,
) -> Optional[bool]:
    """
    Probe a single camera by attempting TCP connection on multiple ports.

    Returns:
        True  — at least one port connected (camera is ONLINE)
        False — all ports failed with timeout/refused (camera is OFFLINE)
        None  — IP is invalid/empty (cannot determine)
    """
    if not is_valid_ip(ip):
        return None

    ports = ports or DEFAULT_PORTS
    ip = ip.strip()

    for port in ports:
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(ip, port),
                timeout=timeout_s
            )
            writer.close()
            await writer.wait_closed()
            logger.debug("probe OK: %s:%d", ip, port)
            return True
        except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
            continue
        except Exception:
            continue

    logger.debug("probe FAIL: %s (all %d ports)", ip, len(ports))
    return False


async def probe_many(
    cameras: List[Dict],
    ports: List[int] = None,
    timeout_s: float = DEFAULT_TIMEOUT,
    max_concurrency: int = DEFAULT_MAX_CONCURRENCY,
) -> Dict[int, str]:
    """
    Probe multiple cameras concurrently with a semaphore limit.

    Args:
        cameras: list of dicts with at least {"channel": int, "ip": str}
        ports: TCP ports to try per camera
        timeout_s: timeout per port attempt
        max_concurrency: max simultaneous probes

    Returns:
        {channel: "online"|"offline"|"unknown"} for each camera
    """
    ports = ports or DEFAULT_PORTS
    sem = asyncio.Semaphore(max_concurrency)
    results: Dict[int, str] = {}

    # Quick routability check — test one camera IP to see if subnet is reachable
    sample_ips = [c["ip"] for c in cameras if is_valid_ip(c.get("ip", ""))]
    subnet_routable = True

    if sample_ips:
        # Test first valid IP for routability
        test_ip = sample_ips[0]
        subnet_routable = await check_routable(test_ip, timeout=1.5)
        if not subnet_routable:
            logger.info("Subnet not routable from this host (tested %s) — all cameras → unknown", test_ip)
            for cam in cameras:
                results[cam["channel"]] = "unknown"
            return results

    async def _probe_one(cam: Dict):
        channel = cam["channel"]
        ip = cam.get("ip", "")
        if not is_valid_ip(ip):
            results[channel] = "unknown"
            return
        async with sem:
            result = await probe_camera_tcp(ip, ports, timeout_s)
            if result is True:
                results[channel] = "online"
            elif result is False:
                results[channel] = "offline"
            else:
                results[channel] = "unknown"

    tasks = [asyncio.create_task(_probe_one(cam)) for cam in cameras]
    await asyncio.gather(*tasks, return_exceptions=True)

    # Fill any missing channels (from exceptions)
    for cam in cameras:
        if cam["channel"] not in results:
            results[cam["channel"]] = "unknown"

    online = sum(1 for v in results.values() if v == "online")
    offline = sum(1 for v in results.values() if v == "offline")
    unknown = sum(1 for v in results.values() if v == "unknown")
    logger.info("Probe complete: %d cameras — %d online, %d offline, %d unknown",
                len(results), online, offline, unknown)

    return results
