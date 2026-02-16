import asyncio
import httpx
from dahua_rpc import dahua_login, dahua_logout

BASE = "http://10.1.1.200:80"
USER = "admin"
PASS = "donbosco2024"

# Servicios que, por nombre, suelen tener estado de video/canales.
CANDIDATES = [
    "RemoteMagicBox",
    "RemoteNetApp",
    "RemoteDeviceManager",
    "RemoteEventManager",
    "RemoteVideoInAnalyse",
    "RemoteDevVideoIn",
    "VideoLink",
    "StateManager",
    "NetDevManager",
]

async def call(c, sid, method, params, _id):
    r = await c.post(f"{BASE}/RPC2", json={"method": method, "params": params, "id": _id, "session": sid}, timeout=15)
    return r

async def main():
    async with httpx.AsyncClient() as c:
        sid = await dahua_login(c, BASE, USER, PASS)
        print("SID_OK:", bool(sid))
        if not sid:
            return

        # 1) Obtener capacidades/métodos del API (ya sabemos que system.methodHelp existe)
        # 2) Pedir ayuda por prefijo: probamos nombres típicos de métodos por servicio con methodHelp
        probes = []
        for svc in CANDIDATES:
            for m in ["getState", "getStatus", "getDeviceStatus", "getVideoState", "getChannelState", "getConnectState"]:
                probes.append(f"{svc}.{m}")

        hits = 0
        for i, full in enumerate(probes, start=1):
            r = await call(c, sid, "system.methodHelp", {"method": full}, 7000 + i)
            txt = r.text
            # Heurística: si NO dice "Method not found", guardamos
            if "Method not found" not in txt and "\"result\":false" not in txt:
                hits += 1
                print("\n=== HIT:", full, "===")
                print(txt[:2000])

        print("\nTOTAL_HITS:", hits, "de", len(probes))

        await dahua_logout(c, BASE, sid)

if __name__ == "__main__":
    asyncio.run(main())