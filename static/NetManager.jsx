const { useState, useEffect, useCallback, useRef } = React;

// ============================================
// DATA STORE (in-memory, persistent via state)
// ============================================
const DEFAULT_SITE = {
  name: "Colegio Técnico Industrial Don Bosco",
  address: "Antofagasta, Chile",
  contact: "Fernando Flores",
  phone: "+56 9 XXXX XXXX",
  email: "admin@donbosco.cl",
  networkSegments: [],
};

const DEFAULT_DATA = {
  site: { ...DEFAULT_SITE },
  buildings: [
    { id: "b1", name: "Edificio Principal", floors: 3 },
  ],
  racks: [
    { id: "r1", name: "Rack Biblioteca", location: "Biblioteca", buildingId: "b1", floor: "1", capacity: "42" },
    { id: "r2", name: "Rack Sala 8", location: "Sala 8", buildingId: "b1", floor: "1", capacity: "12" },
    { id: "r3", name: "Rack Salón Juan Pablo", location: "Salón Juan Pablo", buildingId: "b1", floor: "2", capacity: "12" },
    { id: "r4", name: "Rack Sala Computación", location: "Sala Computación", buildingId: "b1", floor: "2", capacity: "12" },
    { id: "r5", name: "Rack Sala 304", location: "Sala 304", buildingId: "b1", floor: "3", capacity: "12" },
  ],
  switches: [
    { id: "sw1", name: "SW-Core-Biblioteca", model: "Switch PoE 48p", ip: "10.1.1.10", ports: "48", poe: true, rackId: "r1", uplink: "MikroTik ether2" },
    { id: "sw2", name: "SW-Sala8", model: "Switch PoE 24p", ip: "10.1.1.11", ports: "24", poe: true, rackId: "r2", uplink: "SW-Core-Biblioteca" },
    { id: "sw3", name: "SW-Juan-Pablo", model: "Switch PoE 24p", ip: "10.1.1.12", ports: "24", poe: true, rackId: "r3", uplink: "SW-Core-Biblioteca" },
    { id: "sw4", name: "SW-Computacion", model: "Switch PoE 24p", ip: "10.1.1.13", ports: "24", poe: true, rackId: "r4", uplink: "SW-Core-Biblioteca" },
    { id: "sw5", name: "SW-Sala304", model: "Switch PoE 24p", ip: "10.1.1.14", ports: "24", poe: true, rackId: "r5", uplink: "SW-Core-Biblioteca" },
  ],
  nvrs: [
    { id: "nvr1", name: "NVR Principal", type: "NVR", model: "DHI-NVR5464-EI", nics: [{ label: "NIC1 (Cámaras)", ip: "192.168.1.250" }, { label: "NIC2 (Admin)", ip: "10.1.1.200" }], channels: "64", disks: [{ size: "4TB", status: "ok" }, { size: "4TB", status: "ok" }], rackId: "r1" },
    { id: "nvr2", name: "DVR Portería", type: "DVR", model: "DH-XVR5108HS-I3", nics: [{ label: "LAN", ip: "10.1.1.201" }], channels: "8", disks: [{ size: "2TB", status: "ok" }, { size: "2TB", status: "degraded" }], rackId: "r2" },
  ],
  routers: [
    { id: "rt1", name: "Don Bosco Big Boss", model: "MikroTik", lanIp: "192.168.100.1", wanIp: "190.4.214.251", rackId: "r1", interfaces: "ether1-WAN, Bridge Don Bosco" },
  ],
  cameras: [
    { id: "c1", channel: "1", name: "SALA-15", ip: "192.168.1.120", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAGA3828", mac: "3c:e3:6b:ce:3c:e5", nvrId: "nvr1", rackId: "r2", switchId: "sw2", patchPanelId: "pp2", patchPanelPort: "1", location: "Sala 15, Piso 1 ala sur", cableRoute: "Cámara → PP-Sala8 :1 → SW-Sala8 :1 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c2", channel: "2", name: "SALA-14", ip: "192.168.1.121", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAGC9BF0", mac: "", nvrId: "nvr1", rackId: "r2", switchId: "sw2", patchPanelId: "pp2", patchPanelPort: "2", location: "Sala 14, Piso 1 ala sur", cableRoute: "Cámara → PP-Sala8 :2 → SW-Sala8 :2 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c3", channel: "3", name: "SALA - 03", ip: "192.168.1.122", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAGDE2FD", mac: "", nvrId: "nvr1", rackId: "r2", switchId: "sw2", patchPanelId: "pp2", patchPanelPort: "3", location: "Sala 03, Piso 1 ala sur", cableRoute: "Cámara → PP-Sala8 :3 → SW-Sala8 :3 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c4", channel: "4", name: "SALA - 07", ip: "192.168.1.123", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAGC66C9", mac: "", nvrId: "nvr1", rackId: "r3", switchId: "sw3", patchPanelId: "pp3", patchPanelPort: "1", location: "Sala 07, Piso 2 ala norte", cableRoute: "Cámara → PP-JuanPablo :1 → SW-Juan-Pablo :1 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c5", channel: "5", name: "PASILLO PISO 3", ip: "192.168.1.124", model: "DH-IPC-HFW2441S-S", serial: "9F0E033PAGD5F5B", mac: "", nvrId: "nvr1", rackId: "r5", switchId: "sw5", patchPanelId: "pp5", patchPanelPort: "1", location: "Pasillo principal, Piso 3", cableRoute: "Cámara → PP-Sala304 :1 → SW-Sala304 :1 → Uplink SW-Core", camType: "ip-net", status: "offline" },
    { id: "c6", channel: "6", name: "Sala 09", ip: "192.168.1.125", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAG139AE", mac: "", nvrId: "nvr1", rackId: "r3", switchId: "sw3", patchPanelId: "pp3", patchPanelPort: "2", location: "Sala 09, Piso 2 ala norte", cableRoute: "Cámara → PP-JuanPablo :2 → SW-Juan-Pablo :2 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c7", channel: "7", name: "SALA - 10", ip: "192.168.1.126", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAGED406", mac: "", nvrId: "nvr1", rackId: "r4", switchId: "sw4", patchPanelId: "pp4", patchPanelPort: "1", location: "Sala 10, Piso 2 ala sur", cableRoute: "Cámara → PP-Computacion :1 → SW-Computacion :1 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c8", channel: "8", name: "SALA - 06", ip: "192.168.1.127", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAGA13D5", mac: "3c:e3:6b:ce:40:6a", nvrId: "nvr1", rackId: "r2", switchId: "sw2", patchPanelId: "pp2", patchPanelPort: "4", location: "Sala 06, Piso 1 ala sur", cableRoute: "Cámara → PP-Sala8 :4 → SW-Sala8 :4 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c9", channel: "9", name: "PASILLO P1 SUR", ip: "192.168.1.128", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAGC4B63", mac: "", nvrId: "nvr1", rackId: "r2", switchId: "sw2", patchPanelId: "pp2", patchPanelPort: "5", location: "Pasillo sur, Piso 1", cableRoute: "Cámara → PP-Sala8 :5 → SW-Sala8 :5 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c10", channel: "10", name: "SALA - 13", ip: "192.168.1.129", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAG27403", mac: "", nvrId: "nvr1", rackId: "r3", switchId: "sw3", patchPanelId: "pp3", patchPanelPort: "3", location: "Sala 13, Piso 2 ala norte", cableRoute: "Cámara → PP-JuanPablo :3 → SW-Juan-Pablo :3 → Uplink SW-Core", camType: "ip-net", status: "offline" },
    { id: "c11", channel: "11", name: "SALA - 08", ip: "192.168.1.130", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAGA2B62", mac: "", nvrId: "nvr1", rackId: "r3", switchId: "sw3", patchPanelId: "pp3", patchPanelPort: "4", location: "Sala 08, Piso 2 ala norte", cableRoute: "Cámara → PP-JuanPablo :4 → SW-Juan-Pablo :4 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c12", channel: "12", name: "SALA - 12", ip: "192.168.1.131", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAGAFD5F", mac: "", nvrId: "nvr1", rackId: "r4", switchId: "sw4", patchPanelId: "pp4", patchPanelPort: "2", location: "Sala 12, Piso 2 ala sur", cableRoute: "Cámara → PP-Computacion :2 → SW-Computacion :2 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c13", channel: "13", name: "SALA - 01", ip: "192.168.1.132", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAGF7B7D", mac: "", nvrId: "nvr1", rackId: "r1", switchId: "sw1", patchPanelId: "pp1", patchPanelPort: "1", location: "Sala 01, Planta baja", cableRoute: "Cámara → PP-Biblioteca :1 → SW-Core :1", camType: "ip-net", status: "online" },
    { id: "c14", channel: "14", name: "HALL CENTRAL", ip: "192.168.1.133", model: "", serial: "", mac: "", nvrId: "nvr1", rackId: "r1", switchId: "sw1", patchPanelId: "pp1", patchPanelPort: "2", location: "Hall central, Planta baja", cableRoute: "Cámara → PP-Biblioteca :2 → SW-Core :2", camType: "ip-net", status: "online" },
    { id: "c15", channel: "15", name: "SALA - 04", ip: "192.168.1.134", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAG17A4B", mac: "", nvrId: "nvr1", rackId: "r2", switchId: "sw2", patchPanelId: "pp2", patchPanelPort: "6", location: "Sala 04, Piso 1 ala sur", cableRoute: "Cámara → PP-Sala8 :6 → SW-Sala8 :6 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c16", channel: "16", name: "BAGNO ALA NORTE", ip: "192.168.1.135", model: "DH-IPC-HFW2441S-S", serial: "9F0E033PAG21538", mac: "", nvrId: "nvr1", rackId: "r3", switchId: "sw3", patchPanelId: "pp3", patchPanelPort: "5", location: "Baño ala norte, Piso 2", cableRoute: "Cámara → PP-JuanPablo :5 → SW-Juan-Pablo :5 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c17", channel: "17", name: "CASINO", ip: "192.168.1.136", model: "DH-IPC-HFW2441S-S", serial: "9F0E033PAG4A1B2", mac: "", nvrId: "nvr1", rackId: "r1", switchId: "sw1", patchPanelId: "pp1", patchPanelPort: "3", location: "Casino, Planta baja", cableRoute: "Cámara → PP-Biblioteca :3 → SW-Core :3", camType: "ip-net", status: "online" },
    { id: "c18", channel: "18", name: "PATIO TRASERO", ip: "192.168.1.140", model: "", serial: "9F0E033PAGD316C", mac: "", nvrId: "nvr1", rackId: "r1", switchId: "sw1", patchPanelId: "pp1", patchPanelPort: "4", location: "Patio trasero", cableRoute: "Cámara → PP-Biblioteca :4 → SW-Core :4", camType: "ip-net", status: "offline" },
    { id: "c19", channel: "19", name: "DESCANSO SALA PROFESORES", ip: "192.168.1.142", model: "", serial: "9B000AAPAG5C23E", mac: "", nvrId: "nvr1", rackId: "r4", switchId: "sw4", patchPanelId: "pp4", patchPanelPort: "3", location: "Sala profesores, Piso 2", cableRoute: "Cámara → PP-Computacion :3 → SW-Computacion :3 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c20", channel: "20", name: "ESCALERA P2", ip: "192.168.1.141", model: "", serial: "", mac: "", nvrId: "nvr1", rackId: "r4", switchId: "sw4", patchPanelId: "pp4", patchPanelPort: "4", location: "Escalera principal, Piso 2", cableRoute: "Cámara → PP-Computacion :4 → SW-Computacion :4 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c21", channel: "21", name: "SALA - 16", ip: "192.168.1.143", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAG1425C", mac: "", nvrId: "nvr1", rackId: "r5", switchId: "sw5", patchPanelId: "pp5", patchPanelPort: "2", location: "Sala 16, Piso 3", cableRoute: "Cámara → PP-Sala304 :2 → SW-Sala304 :2 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c22", channel: "22", name: "SALA - 21", ip: "192.168.1.144", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAGA3DFB", mac: "", nvrId: "nvr1", rackId: "r5", switchId: "sw5", patchPanelId: "pp5", patchPanelPort: "3", location: "Sala 21, Piso 3", cableRoute: "Cámara → PP-Sala304 :3 → SW-Sala304 :3 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c23", channel: "23", name: "SALA - 26", ip: "192.168.1.145", model: "", serial: "9B000AAPAGE9DEB", mac: "", nvrId: "nvr1", rackId: "r5", switchId: "sw5", patchPanelId: "pp5", patchPanelPort: "4", location: "Sala 26, Piso 3", cableRoute: "Cámara → PP-Sala304 :4 → SW-Sala304 :4 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c24", channel: "24", name: "LABORATORIO CIENCIAS", ip: "192.168.1.147", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAG372D1", mac: "", nvrId: "nvr1", rackId: "r4", switchId: "sw4", patchPanelId: "pp4", patchPanelPort: "5", location: "Lab. Ciencias, Piso 2 ala sur", cableRoute: "Cámara → PP-Computacion :5 → SW-Computacion :5 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c25", channel: "25", name: "TALLER ELECTRÓNICA", ip: "192.168.1.148", model: "", serial: "", mac: "", nvrId: "nvr1", rackId: "r4", switchId: "sw4", patchPanelId: "pp4", patchPanelPort: "6", location: "Taller electrónica, Piso 2", cableRoute: "Cámara → PP-Computacion :6 → SW-Computacion :6 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c26", channel: "26", name: "BODEGA", ip: "192.168.1.149", model: "", serial: "", mac: "", nvrId: "nvr1", rackId: "r1", switchId: "sw1", patchPanelId: "pp1", patchPanelPort: "5", location: "Bodega, Planta baja", cableRoute: "Cámara → PP-Biblioteca :5 → SW-Core :5", camType: "ip-net", status: "online" },
    { id: "c27", channel: "27", name: "GIMNASIO", ip: "192.168.1.150", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAG483E2", mac: "", nvrId: "nvr1", rackId: "r1", switchId: "sw1", patchPanelId: "pp1", patchPanelPort: "6", location: "Gimnasio, Planta baja", cableRoute: "Cámara → PP-Biblioteca :6 → SW-Core :6", camType: "ip-net", status: "online" },
    { id: "c28", channel: "28", name: "MULTICANCHA", ip: "192.168.1.151", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAG593F3", mac: "", nvrId: "nvr1", rackId: "r1", switchId: "sw1", patchPanelId: "pp1", patchPanelPort: "7", location: "Multicancha exterior", cableRoute: "Cámara → PP-Biblioteca :7 → SW-Core :7", camType: "ip-net", status: "offline" },
    { id: "c29", channel: "29", name: "ACCESO SUR", ip: "192.168.1.152", model: "", serial: "", mac: "", nvrId: "nvr1", rackId: "r2", switchId: "sw2", patchPanelId: "pp2", patchPanelPort: "7", location: "Acceso sur", cableRoute: "Cámara → PP-Sala8 :7 → SW-Sala8 :7 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c30", channel: "30", name: "ESTACIONAMIENTO", ip: "192.168.1.153", model: "", serial: "", mac: "", nvrId: "nvr1", rackId: "r1", switchId: "sw1", patchPanelId: "pp1", patchPanelPort: "8", location: "Estacionamiento", cableRoute: "Cámara → PP-Biblioteca :8 → SW-Core :8", camType: "ip-net", status: "online" },
    { id: "c31", channel: "31", name: "SALA - 02", ip: "192.168.1.191", model: "DH-IPC-HDW1239T1-A-LED-S5", serial: "9B000AAPAG03EFE", mac: "3c:e3:6b:ce:40:2e", nvrId: "nvr1", rackId: "r2", switchId: "sw2", patchPanelId: "pp2", patchPanelPort: "8", location: "Sala 02, Piso 1 ala sur", cableRoute: "Cámara → PP-Sala8 :8 → SW-Sala8 :8 → Uplink SW-Core", camType: "ip-net", status: "online" },
    { id: "c32", channel: "1", name: "PORTERÍA ENTRADA", ip: "", model: "DH-HAC-HDW1200EMP", serial: "DVR-P001", mac: "", nvrId: "nvr2", rackId: "r2", switchId: "", patchPanelId: "", patchPanelPort: "", location: "Portería, entrada principal", cableRoute: "Cámara → Cable coaxial RG59 → DVR Portería CH1", camType: "analog", status: "online" },
    { id: "c33", channel: "2", name: "PORTERÍA SALIDA", ip: "", model: "DH-HAC-HDW1200EMP", serial: "DVR-P002", mac: "", nvrId: "nvr2", rackId: "r2", switchId: "", patchPanelId: "", patchPanelPort: "", location: "Portería, salida vehicular", cableRoute: "Cámara → Cable coaxial RG59 → DVR Portería CH2", camType: "analog", status: "online" },
    { id: "c34", channel: "3", name: "REJA PERIMETRAL NORTE", ip: "", model: "DH-HAC-HFW1200THP", serial: "DVR-P003", mac: "", nvrId: "nvr2", rackId: "r2", switchId: "", patchPanelId: "", patchPanelPort: "", location: "Reja perimetral norte", cableRoute: "Cámara → UTP + Balun → DVR Portería CH3", camType: "analog", status: "online" },
    { id: "c35", channel: "4", name: "REJA PERIMETRAL SUR", ip: "", model: "DH-HAC-HFW1200THP", serial: "DVR-P004", mac: "", nvrId: "nvr2", rackId: "r2", switchId: "", patchPanelId: "", patchPanelPort: "", location: "Reja perimetral sur", cableRoute: "Cámara → UTP + Balun → DVR Portería CH4", camType: "analog", status: "offline" },
  ],
  patchPanels: [
    { id: "pp1", name: "PP-Biblioteca-01", ports: "48", type: "Cat6", rackId: "r1", cableRoute: "Distribución principal planta baja" },
    { id: "pp2", name: "PP-Sala8-01", ports: "24", type: "Cat6", rackId: "r2", cableRoute: "Piso 1 ala sur" },
    { id: "pp3", name: "PP-JuanPablo-01", ports: "24", type: "Cat6", rackId: "r3", cableRoute: "Piso 2 ala norte" },
    { id: "pp4", name: "PP-Computacion-01", ports: "24", type: "Cat6", rackId: "r4", cableRoute: "Piso 2 ala sur" },
    { id: "pp5", name: "PP-Sala304-01", ports: "24", type: "Cat6", rackId: "r5", cableRoute: "Piso 3" },
  ],
};

// ============================================
// ICONS (SVG inline)
// ============================================
const Icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
  ),
  camera: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
  ),
  server: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
  ),
  network: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="6"/><rect x="16" y="16" width="6" height="6"/><rect x="2" y="16" width="6" height="6"/><path d="M5 16v-4h14v4"/><line x1="12" y1="12" x2="12" y2="8"/></svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
  ),
  upload: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  ),
  building: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="2"/><line x1="15" y1="22" x2="15" y2="2"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
  ),
  router: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="14" width="20" height="7" rx="2" ry="2"/><path d="M6.5 14V8a4 4 0 0 1 8 0"/><circle cx="12" cy="8" r="1"/></svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  ),
  chevron: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  ),
  topology: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="12" y1="8" x2="5" y2="16"/><line x1="12" y1="8" x2="19" y2="16"/></svg>
  ),
  cable: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z"/><path d="M15 9a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2V9z"/><path d="M9 10h6"/></svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const genId = () => Math.random().toString(36).substring(2, 10);

// ============================================
// API CLIENT
// Connects to FastAPI backend with JWT auth
// ============================================
const API_BASE = window.NETMANAGER_API || "";

const api = {
  _token: null,
  setToken(t) { this._token = t; },
  _headers() {
    const h = { "Content-Type": "application/json" };
    if (this._token) h["Authorization"] = `Bearer ${this._token}`;
    return h;
  },
  async get(path) {
    const r = await fetch(`${API_BASE}${path}`, { headers: this._headers() });
    if (r.status === 401) throw new Error("UNAUTHORIZED");
    if (!r.ok) throw new Error(`GET ${path}: ${r.status}`);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: this._headers(), body: JSON.stringify(body) });
    if (r.status === 401) throw new Error("UNAUTHORIZED");
    if (!r.ok) throw new Error(`POST ${path}: ${r.status}`);
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(`${API_BASE}${path}`, { method: "PUT", headers: this._headers(), body: JSON.stringify(body) });
    if (r.status === 401) throw new Error("UNAUTHORIZED");
    if (!r.ok) throw new Error(`PUT ${path}: ${r.status}`);
    return r.json();
  },
  async del(path) {
    const r = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: this._headers() });
    if (r.status === 401) throw new Error("UNAUTHORIZED");
    if (!r.ok) throw new Error(`DELETE ${path}: ${r.status}`);
    return r.json();
  }
};

// Entity → API path mapping
const ENTITY_API = {
  cameras: "cameras",
  racks: "racks",
  switches: "switches",
  nvrs: "recorders",
  routers: "routers",
  buildings: "buildings",
  patchPanels: "patch-panels",
};

// Map frontend field names to backend field names
const toBackend = (entity, item) => {
  if (entity === "cameras") {
    return {
      channel: item.channel ? parseInt(item.channel) : null,
      name: item.name || "", cam_type: item.camType || "ip-net",
      ip: item.ip || "", model: item.model || "", serial: item.serial || "",
      mac: item.mac || "", location: item.location || "",
      cable_route: item.cableRoute || "", status: item.status || "online",
      recorder_id: item.nvrId ? parseInt(item.nvrId) : null,
      rack_id: item.rackId ? parseInt(item.rackId) : null,
      switch_id: item.switchId ? parseInt(item.switchId) : null,
      patch_panel_id: item.patchPanelId ? parseInt(item.patchPanelId) : null,
      patch_panel_port: item.patchPanelPort ? parseInt(item.patchPanelPort) : null,
    };
  }
  if (entity === "nvrs") {
    return {
      name: item.name, type: item.type || "NVR", model: item.model || "",
      channels: parseInt(item.channels) || 16,
      nics: item.nics || [], disks: item.disks || [],
      rack_id: item.rackId ? parseInt(item.rackId) : null,
    };
  }
  if (entity === "switches") {
    return {
      name: item.name, model: item.model || "", ip: item.ip || "",
      ports: parseInt(item.ports) || 24, poe: !!item.poe, uplink: item.uplink || "",
      rack_id: item.rackId ? parseInt(item.rackId) : null,
    };
  }
  if (entity === "routers") {
    return {
      name: item.name, model: item.model || "",
      lan_ip: item.lanIp || "", wan_ip: item.wanIp || "",
      interfaces: item.interfaces || "",
      rack_id: item.rackId ? parseInt(item.rackId) : null,
    };
  }
  if (entity === "patchPanels") {
    return {
      name: item.name, ports: parseInt(item.ports) || 24,
      type: item.type || "Cat6", cable_route: item.cableRoute || "",
      rack_id: item.rackId ? parseInt(item.rackId) : null,
    };
  }
  if (entity === "racks") {
    return {
      name: item.name, location: item.location || "", floor: item.floor || "",
      capacity: parseInt(item.capacity) || 42,
      building_id: item.buildingId ? parseInt(item.buildingId) : null,
    };
  }
  if (entity === "buildings") {
    return { name: item.name, floors: parseInt(item.floors) || 1 };
  }
  return item;
};

// Map backend response to frontend format
const toFrontend = (entity, item) => {
  if (entity === "cameras") {
    return {
      id: String(item.id), channel: String(item.channel || ""),
      name: item.name || "", camType: item.cam_type || "ip-net",
      ip: item.ip || "", model: item.model || "", serial: item.serial || "",
      mac: item.mac || "", location: item.location || "",
      cableRoute: item.cable_route || "", status: item.status || "online",
      nvrId: item.recorder_id ? String(item.recorder_id) : "",
      rackId: item.rack_id ? String(item.rack_id) : "",
      switchId: item.switch_id ? String(item.switch_id) : "",
      patchPanelId: item.patch_panel_id ? String(item.patch_panel_id) : "",
      patchPanelPort: item.patch_panel_port ? String(item.patch_panel_port) : "",
    };
  }
  if (entity === "nvrs") {
    return {
      id: String(item.id), name: item.name, type: item.type || "NVR",
      model: item.model || "", channels: String(item.channels || 16),
      nics: item.nics || [], disks: item.disks || [],
      rackId: item.rack_id ? String(item.rack_id) : "",
    };
  }
  if (entity === "switches") {
    return {
      id: String(item.id), name: item.name, model: item.model || "",
      ip: item.ip || "", ports: String(item.ports || 24),
      poe: !!item.poe, uplink: item.uplink || "",
      rackId: item.rack_id ? String(item.rack_id) : "",
    };
  }
  if (entity === "routers") {
    return {
      id: String(item.id), name: item.name, model: item.model || "",
      lanIp: item.lan_ip || "", wanIp: item.wan_ip || "",
      interfaces: item.interfaces || "",
      rackId: item.rack_id ? String(item.rack_id) : "",
    };
  }
  if (entity === "patchPanels") {
    return {
      id: String(item.id), name: item.name,
      ports: String(item.ports || 24), type: item.type || "Cat6",
      cableRoute: item.cable_route || "",
      rackId: item.rack_id ? String(item.rack_id) : "",
    };
  }
  if (entity === "racks") {
    return {
      id: String(item.id), name: item.name, location: item.location || "",
      floor: item.floor || "", capacity: String(item.capacity || 42),
      buildingId: item.building_id ? String(item.building_id) : "",
    };
  }
  if (entity === "buildings") {
    return { id: String(item.id), name: item.name, floors: String(item.floors || 1) };
  }
  return { ...item, id: String(item.id) };
};

// ============================================
// MODAL COMPONENT
// ============================================
function Modal({ isOpen, onClose, title, children, width = "480px" }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: "#141c2b", border: "1px solid #2a3550", borderRadius: "12px",
        padding: "24px", width, maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#e2e8f0" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>{Icons.x}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============================================
// FORM FIELD COMPONENT
// ============================================
function Field({ label, value, onChange, type = "text", placeholder = "", options = null, required = false }) {
  const baseStyle = {
    width: "100%", padding: "8px 12px", background: "#0f172a", border: "1px solid #2a3550",
    borderRadius: "6px", color: "#e2e8f0", fontSize: "13px", fontFamily: "'JetBrains Mono', monospace",
    outline: "none", transition: "border-color 0.2s"
  };
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={{ ...baseStyle, cursor: "pointer" }}>
          <option value="">Seleccionar...</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...baseStyle, resize: "vertical" }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={baseStyle} />
      )}
    </div>
  );
}

// ============================================
// BUTTON COMPONENTS
// ============================================
function Btn({ children, onClick, variant = "primary", size = "md", icon = null, disabled = false }) {
  const variants = {
    primary: { bg: "#2563eb", hover: "#1d4ed8", color: "#fff" },
    secondary: { bg: "#1e293b", hover: "#334155", color: "#94a3b8" },
    danger: { bg: "#7f1d1d", hover: "#991b1b", color: "#fca5a5" },
    ghost: { bg: "transparent", hover: "#1e293b", color: "#94a3b8" },
    success: { bg: "#065f46", hover: "#047857", color: "#6ee7b7" },
  };
  const sizes = { sm: { px: "8px", py: "4px", fs: "11px" }, md: { px: "14px", py: "7px", fs: "12px" }, lg: { px: "20px", py: "10px", fs: "13px" } };
  const v = variants[variant];
  const s = sizes[size];
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        padding: `${s.py} ${s.px}`, fontSize: s.fs, fontWeight: 600,
        background: hovered ? v.hover : v.bg, color: v.color,
        border: variant === "ghost" ? "1px solid #2a3550" : "none",
        borderRadius: "6px", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "all 0.2s",
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}
    >
      {icon}{children}
    </button>
  );
}

// ============================================
// DATA TABLE COMPONENT
// ============================================
function DataTable({ columns, data, onEdit, onDelete, emptyMessage = "Sin datos", selectable = false, selected = [], onSelectChange = null }) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  
  const handleSort = (colKey) => {
    if (sortCol === colKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(colKey);
      setSortDir("asc");
    }
  };

  let filtered = data.filter(row =>
    columns.some(col => String(row[col.key] || "").toLowerCase().includes(search.toLowerCase()))
  );

  if (sortCol) {
    filtered = [...filtered].sort((a, b) => {
      let va = a[sortCol] || "";
      let vb = b[sortCol] || "";
      // Try numeric sort
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir === "asc" ? na - nb : nb - na;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.includes(r.id));
  const someSelected = selected.length > 0;
  const toggleAll = () => {
    if (allFilteredSelected) onSelectChange([]);
    else onSelectChange(filtered.map(r => r.id));
  };
  const toggleOne = (id) => {
    if (selected.includes(id)) onSelectChange(selected.filter(s => s !== id));
    else onSelectChange([...selected, id]);
  };
  const cbxStyle = { width: "16px", height: "16px", accentColor: "#3b82f6", cursor: "pointer" };
  const sortArrow = (colKey) => {
    if (sortCol !== colKey) return <span style={{ opacity: 0.3, marginLeft: "4px" }}>&#8597;</span>;
    return <span style={{ marginLeft: "4px", color: "#60a5fa" }}>{sortDir === "asc" ? "&#9650;" : "&#9660;"}</span>;
  };
  return (
    <div>
      <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }}>{Icons.search}</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            style={{
              width: "300px", padding: "8px 12px 8px 34px",
              background: "#0f172a", border: "1px solid #2a3550", borderRadius: "6px",
              color: "#e2e8f0", fontSize: "13px", outline: "none",
              fontFamily: "'JetBrains Mono', monospace"
            }}
          />
        </div>
        <span style={{ fontSize: "12px", color: "#64748b" }}>{filtered.length} registros</span>
        {selectable && someSelected && (
          <span style={{ fontSize: "12px", color: "#60a5fa", fontWeight: 600 }}>{selected.length} seleccionados</span>
        )}
      </div>
      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #1e293b" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              {selectable && (
                <th style={{ padding: "10px 10px 10px 14px", borderBottom: "1px solid #1e293b", width: "36px" }}>
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} style={cbxStyle} />
                </th>
              )}
              {columns.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)} style={{
                  padding: "10px 14px", fontSize: "10px", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "1px", color: sortCol === col.key ? "#60a5fa" : "#64748b",
                  textAlign: "left", borderBottom: "1px solid #1e293b", whiteSpace: "nowrap",
                  cursor: "pointer", userSelect: "none", transition: "color 0.15s"
                }}>{col.label}<span style={{ marginLeft: "4px", opacity: sortCol === col.key ? 1 : 0.3, color: sortCol === col.key ? "#60a5fa" : "#64748b", fontSize: "8px" }} dangerouslySetInnerHTML={{ __html: sortCol === col.key ? (sortDir === "asc" ? "&#9650;" : "&#9660;") : "&#8597;" }} /></th>
              ))}
              {(onEdit || onDelete) && (
                <th style={{ padding: "10px 14px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#64748b", textAlign: "right", borderBottom: "1px solid #1e293b" }}>Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={columns.length + (selectable ? 2 : 1)} style={{ padding: "32px", textAlign: "center", color: "#475569", fontSize: "13px" }}>{emptyMessage}</td></tr>
            ) : filtered.map((row, i) => {
              const isSelected = selected.includes(row.id);
              return (
                <tr key={row.id || i}
                  style={{ borderBottom: "1px solid #141c2b", transition: "background 0.15s", cursor: "default", background: isSelected ? "rgba(59,130,246,0.08)" : "transparent" }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#1a2235"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                  {selectable && (
                    <td style={{ padding: "10px 10px 10px 14px" }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(row.id)} style={cbxStyle} />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} style={{
                      padding: "10px 14px", fontSize: "12px", whiteSpace: "nowrap",
                      fontFamily: col.mono ? "'JetBrains Mono', monospace" : "inherit",
                      color: col.accent ? "#22d3ee" : "#cbd5e1"
                    }}>
                      {col.render ? col.render(row[col.key], row) : row[col.key] || "—"}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        {onEdit && <Btn variant="ghost" size="sm" icon={Icons.edit} onClick={() => onEdit(row)}>Editar</Btn>}
                        {onDelete && <Btn variant="danger" size="sm" icon={Icons.trash} onClick={() => onDelete(row)}>Eliminar</Btn>}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================
function StatCard({ label, value, color, icon, onClick }) {
  return (
    <div style={{
      background: "#141c2b", border: "1px solid #1e293b", borderRadius: "10px",
      padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px",
      transition: "border-color 0.2s", flex: "1", minWidth: "160px",
      cursor: onClick ? "pointer" : "default"
    }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}>
      <div style={{
        width: "40px", height: "40px", borderRadius: "8px",
        background: `${color}18`, color, display: "flex", alignItems: "center", justifyContent: "center"
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: "24px", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color }}>{value}</div>
        <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</div>
      </div>
    </div>
  );
}

// ============================================
// ADMIN PANEL — Users, Sites, Access
// ============================================
function AdminPanel({ authToken }) {
  const [users, setUsers] = useState([]);
  const [sites, setSites] = useState([]);
  const [tab, setTab] = useState("users");
  const [editUser, setEditUser] = useState(null);
  const [editSite, setEditSite] = useState(null);
  const [newUser, setNewUser] = useState(null);
  const [newSite, setNewSite] = useState(null);
  const [msg, setMsg] = useState("");

  const hdrs = { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` };

  const load = async () => {
    try {
      const [u, s] = await Promise.all([
        fetch(`${API_BASE}/api/users`, { headers: hdrs }).then(r => r.json()),
        fetch(`${API_BASE}/api/sites`, { headers: hdrs }).then(r => r.json()),
      ]);
      setUsers(u); setSites(s);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const saveUser = async (u) => {
    try {
      if (u.id) {
        const body = { display_name: u.display_name, role: u.role, active: u.active };
        if (u.newPassword) body.password = u.newPassword;
        await fetch(`${API_BASE}/api/users/${u.id}`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
        if (u.site_ids !== undefined) {
          await fetch(`${API_BASE}/api/users/${u.id}/sites`, { method: "PUT", headers: hdrs, body: JSON.stringify({ site_ids: u.site_ids }) });
        }
        flash("Usuario actualizado");
      } else {
        const res = await fetch(`${API_BASE}/api/users`, { method: "POST", headers: hdrs, body: JSON.stringify({ username: u.username, display_name: u.display_name, role: u.role, password: u.password }) });
        if (!res.ok) { const e = await res.json(); flash(e.detail || "Error"); return; }
        const created = await res.json();
        if (u.site_ids?.length) {
          await fetch(`${API_BASE}/api/users/${created.id}/sites`, { method: "PUT", headers: hdrs, body: JSON.stringify({ site_ids: u.site_ids }) });
        }
        flash("Usuario creado");
      }
      setEditUser(null); setNewUser(null); load();
    } catch (e) { flash("Error: " + e.message); }
  };

  const deleteUser = async (uid) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    await fetch(`${API_BASE}/api/users/${uid}`, { method: "DELETE", headers: hdrs });
    flash("Usuario eliminado"); load();
  };

  const saveSite = async (s) => {
    try {
      if (s.id) {
        await fetch(`${API_BASE}/api/sites/${s.id}`, { method: "PUT", headers: hdrs, body: JSON.stringify(s) });
        flash("Sitio actualizado");
      } else {
        const res = await fetch(`${API_BASE}/api/sites`, { method: "POST", headers: hdrs, body: JSON.stringify(s) });
        if (!res.ok) { const e = await res.json(); flash(e.detail || "Error"); return; }
        flash("Sitio creado");
      }
      setEditSite(null); setNewSite(null); load();
    } catch (e) { flash("Error: " + e.message); }
  };

  const deleteSite = async (sid) => {
    if (!confirm("¿Eliminar este sitio y TODOS sus datos?")) return;
    await fetch(`${API_BASE}/api/sites/${sid}`, { method: "DELETE", headers: hdrs });
    flash("Sitio eliminado"); load();
  };

  const cardStyle = { background: "#141c2b", border: "1px solid #1e293b", borderRadius: "10px", padding: "20px", marginBottom: "16px" };
  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{ padding: "8px 20px", background: tab === id ? "#2563eb" : "#1e293b", color: tab === id ? "#fff" : "#94a3b8", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{label}</button>
  );

  return (
    <div style={{ maxWidth: "900px" }}>
      {msg && <div style={{ background: "#0d3320", border: "1px solid #16a34a", borderRadius: "8px", padding: "10px 16px", marginBottom: "12px", fontSize: "12px", color: "#4ade80" }}>{msg}</div>}

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {tabBtn("users", "Usuarios")}
        {tabBtn("sites", "Sitios")}
      </div>

      {/* ---- USERS TAB ---- */}
      {tab === "users" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ fontSize: "13px", color: "#64748b" }}>{users.length} usuarios registrados</div>
            <Btn variant="primary" icon={Icons.plus} onClick={() => setNewUser({ username: "", display_name: "", role: "viewer", password: "", site_ids: [] })}>Nuevo Usuario</Btn>
          </div>

          {/* New user form */}
          {newUser && (
            <div style={cardStyle}>
              <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px" }}>Crear Usuario</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Field label="Username" value={newUser.username} onChange={v => setNewUser({ ...newUser, username: v })} required />
                <Field label="Nombre completo" value={newUser.display_name} onChange={v => setNewUser({ ...newUser, display_name: v })} />
                <Field label="Contraseña" value={newUser.password} onChange={v => setNewUser({ ...newUser, password: v })} type="password" required />
                <Field label="Rol" value={newUser.role} onChange={v => setNewUser({ ...newUser, role: v })} options={[{ value: "admin", label: "Administrador" }, { value: "viewer", label: "Visualizador" }]} />
              </div>
              {newUser.role === "viewer" && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px", textTransform: "uppercase" }}>Acceso a sitios</label>
                  {sites.map(s => (
                    <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#e2e8f0", marginBottom: "4px", cursor: "pointer" }}>
                      <input type="checkbox" checked={newUser.site_ids?.includes(s.id)} onChange={e => {
                        const ids = e.target.checked ? [...(newUser.site_ids || []), s.id] : (newUser.site_ids || []).filter(id => id !== s.id);
                        setNewUser({ ...newUser, site_ids: ids });
                      }} />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: "8px" }}>
                <Btn variant="primary" onClick={() => saveUser(newUser)}>Crear</Btn>
                <Btn variant="secondary" onClick={() => setNewUser(null)}>Cancelar</Btn>
              </div>
            </div>
          )}

          {/* Users list */}
          {users.map(u => (
            <div key={u.id} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {editUser?.id === u.id ? (
                <div style={{ flex: 1 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <Field label="Nombre" value={editUser.display_name} onChange={v => setEditUser({ ...editUser, display_name: v })} />
                    <Field label="Rol" value={editUser.role} onChange={v => setEditUser({ ...editUser, role: v })} options={[{ value: "admin", label: "Administrador" }, { value: "viewer", label: "Visualizador" }]} />
                    <Field label="Nueva contraseña (dejar vacío para no cambiar)" value={editUser.newPassword || ""} onChange={v => setEditUser({ ...editUser, newPassword: v })} type="password" />
                    <Field label="Estado" value={editUser.active ? "true" : "false"} onChange={v => setEditUser({ ...editUser, active: v === "true" })} options={[{ value: "true", label: "Activo" }, { value: "false", label: "Desactivado" }]} />
                  </div>
                  {editUser.role === "viewer" && (
                    <div style={{ marginBottom: "14px" }}>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px", textTransform: "uppercase" }}>Acceso a sitios</label>
                      {sites.map(s => (
                        <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#e2e8f0", marginBottom: "4px", cursor: "pointer" }}>
                          <input type="checkbox" checked={editUser.site_ids?.includes(s.id)} onChange={e => {
                            const ids = e.target.checked ? [...(editUser.site_ids || []), s.id] : (editUser.site_ids || []).filter(id => id !== s.id);
                            setEditUser({ ...editUser, site_ids: ids });
                          }} />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Btn variant="primary" onClick={() => saveUser(editUser)}>Guardar</Btn>
                    <Btn variant="secondary" onClick={() => setEditUser(null)}>Cancelar</Btn>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>{u.display_name || u.username}</div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      @{u.username} · <span style={{ color: u.role === "admin" ? "#f59e0b" : "#3b82f6" }}>{u.role === "admin" ? "Administrador" : "Visualizador"}</span>
                      {!u.active && <span style={{ color: "#ef4444", marginLeft: "8px" }}>(desactivado)</span>}
                    </div>
                    {u.role === "viewer" && u.site_ids?.length > 0 && (
                      <div style={{ fontSize: "10px", color: "#475569", marginTop: "4px" }}>
                        Sitios: {u.site_ids.map(sid => sites.find(s => s.id === sid)?.name || `ID ${sid}`).join(", ")}
                      </div>
                    )}
                    {u.role === "viewer" && (!u.site_ids || u.site_ids.length === 0) && (
                      <div style={{ fontSize: "10px", color: "#ef4444", marginTop: "4px" }}>Sin sitios asignados</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Btn variant="ghost" size="sm" icon={Icons.edit} onClick={() => setEditUser({ ...u })}>Editar</Btn>
                    {u.username !== "admin" && <Btn variant="danger" size="sm" icon={Icons.trash} onClick={() => deleteUser(u.id)}>Eliminar</Btn>}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---- SITES TAB ---- */}
      {tab === "sites" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ fontSize: "13px", color: "#64748b" }}>{sites.length} sitios registrados</div>
            <Btn variant="primary" icon={Icons.plus} onClick={() => setNewSite({ name: "", address: "", contact: "", phone: "", email: "" })}>Nuevo Sitio</Btn>
          </div>

          {newSite && (
            <div style={cardStyle}>
              <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0", marginBottom: "12px" }}>Crear Sitio</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Field label="Nombre" value={newSite.name} onChange={v => setNewSite({ ...newSite, name: v })} required />
                <Field label="Dirección" value={newSite.address} onChange={v => setNewSite({ ...newSite, address: v })} />
                <Field label="Contacto" value={newSite.contact} onChange={v => setNewSite({ ...newSite, contact: v })} />
                <Field label="Teléfono" value={newSite.phone} onChange={v => setNewSite({ ...newSite, phone: v })} />
                <Field label="Email" value={newSite.email} onChange={v => setNewSite({ ...newSite, email: v })} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Btn variant="primary" onClick={() => saveSite(newSite)}>Crear Sitio</Btn>
                <Btn variant="secondary" onClick={() => setNewSite(null)}>Cancelar</Btn>
              </div>
            </div>
          )}

          {sites.map(s => (
            <div key={s.id} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {editSite?.id === s.id ? (
                <div style={{ flex: 1 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <Field label="Nombre" value={editSite.name} onChange={v => setEditSite({ ...editSite, name: v })} />
                    <Field label="Dirección" value={editSite.address} onChange={v => setEditSite({ ...editSite, address: v })} />
                    <Field label="Contacto" value={editSite.contact || ""} onChange={v => setEditSite({ ...editSite, contact: v })} />
                    <Field label="Teléfono" value={editSite.phone || ""} onChange={v => setEditSite({ ...editSite, phone: v })} />
                    <Field label="Email" value={editSite.email || ""} onChange={v => setEditSite({ ...editSite, email: v })} />
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Btn variant="primary" onClick={() => saveSite(editSite)}>Guardar</Btn>
                    <Btn variant="secondary" onClick={() => setEditSite(null)}>Cancelar</Btn>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>{s.name}</div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{s.address} · {s.camera_count} cámaras</div>
                    <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                      Usuarios: {users.filter(u => u.role === "admin" || u.site_ids?.includes(s.id)).map(u => u.username).join(", ") || "solo admins"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Btn variant="ghost" size="sm" icon={Icons.edit} onClick={() => setEditSite({ ...s })}>Editar</Btn>
                    <Btn variant="danger" size="sm" icon={Icons.trash} onClick={() => deleteSite(s.id)}>Eliminar</Btn>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ============================================
// LOGIN SCREEN
// ============================================
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) { setError("Ingresa usuario y contraseña"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.detail || "Error de autenticación");
        return;
      }
      const data = await res.json();
      onLogin(data.token, data.user);
    } catch (e) {
      setError("Error de conexión con el servidor");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0e17", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ width: "360px", background: "#141c2b", border: "1px solid #1e293b", borderRadius: "12px", padding: "32px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "10px", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", marginBottom: "12px", fontSize: "18px", fontWeight: 800, color: "#fff" }}>NM</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#e2e8f0" }}>NetManager</div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>CCTV & Network Infrastructure</div>
        </div>
        <div style={{ marginBottom: "14px" }}>
          <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>Usuario</label>
          <input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{ width: "100%", padding: "10px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", color: "#e2e8f0", fontSize: "13px", outline: "none" }}
            placeholder="admin" autoFocus />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{ width: "100%", padding: "10px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", color: "#e2e8f0", fontSize: "13px", outline: "none" }}
            placeholder="••••••••" />
        </div>
        {error && <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "6px", padding: "8px 12px", marginBottom: "14px", fontSize: "12px", color: "#f87171" }}>{error}</div>}
        <button onClick={handleLogin} disabled={loading}
          style={{ width: "100%", padding: "11px", background: loading ? "#334155" : "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: loading ? "wait" : "pointer" }}>
          {loading ? "Conectando..." : "Ingresar"}
        </button>
      </div>
    </div>
  );
}


// ============================================
// SITE SELECTOR
// ============================================
function SiteSelector({ user, onSelect, onLogout }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/sites").then(s => { setSites(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0e17", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ width: "480px", background: "#141c2b", border: "1px solid #1e293b", borderRadius: "12px", padding: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#e2e8f0" }}>Seleccionar Sitio</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>Hola, {user.display_name || user.username} ({user.role})</div>
          </div>
          <button onClick={onLogout} style={{ padding: "6px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#94a3b8", fontSize: "11px", cursor: "pointer" }}>Cerrar sesión</button>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>Cargando sitios...</div>
        ) : sites.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px" }}>
            <div style={{ color: "#64748b", marginBottom: "12px" }}>No hay sitios disponibles</div>
            {user.role === "admin" && <button onClick={async () => {
              try { await api.post("/api/seed/donbosco"); const s = await api.get("/api/sites"); setSites(s); } catch {}
            }} style={{ padding: "8px 16px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>Cargar datos Don Bosco</button>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sites.map(s => (
              <button key={s.id} onClick={() => onSelect(s.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", cursor: "pointer", textAlign: "left", transition: "border-color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#3b82f6"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>{s.name}</div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{s.address}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#3b82f6" }}>{s.camera_count}</div>
                  <div style={{ fontSize: "9px", color: "#64748b" }}>cámaras</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================
// MAIN APP
// ============================================
function App() {
  // Auth state
  const [authUser, setAuthUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [authScreen, setAuthScreen] = useState("login"); // login, selectSite, app

  const [data, setData] = useState(() => ({ ...DEFAULT_DATA }));
  const [activeSection, setActiveSection] = useState("dashboard");
  const [modal, setModal] = useState({ open: false, type: null, item: null });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedCameras, setSelectedCameras] = useState([]);
  const [bulkModal, setBulkModal] = useState({ open: false, action: null });
  const [topoFullscreen, setTopoFullscreen] = useState(false);
  const [reportHTML, setReportHTML] = useState(null);
  const printFrameRef = useRef(null);
  const [apiMode, setApiMode] = useState(true);
  const [siteId, setSiteId] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = (token, user) => {
    api.setToken(token);
    setAuthToken(token);
    setAuthUser(user);
    setAuthScreen("selectSite");
  };

  const handleSelectSite = async (sid) => {
    setSiteId(sid);
    setLoading(true);
    try {
      const full = await api.get(`/api/sites/${sid}/full`);
      setData({
        site: { name: full.site.name, address: full.site.address, contact: full.site.contact, phone: full.site.phone, email: full.site.email, networkSegments: full.site.network_segments || [] },
        buildings: full.buildings.map(b => toFrontend("buildings", b)),
        racks: full.racks.map(r => toFrontend("racks", r)),
        routers: full.routers.map(r => toFrontend("routers", r)),
        switches: full.switches.map(s => toFrontend("switches", s)),
        nvrs: full.recorders.map(r => toFrontend("nvrs", r)),
        cameras: full.cameras.map(c => toFrontend("cameras", c)),
        patchPanels: full.patch_panels.map(p => toFrontend("patchPanels", p)),
      });
      setAuthScreen("app");
    } catch (e) {
      console.error("Load site failed:", e);
    } finally { setLoading(false); }
  };

  const handleLogout = () => {
    api.setToken(null);
    setAuthToken(null);
    setAuthUser(null);
    setSiteId(null);
    setAuthScreen("login");
    setData({ ...DEFAULT_DATA });
  };

  const update = useCallback((key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  // Show login / site selector / app — AFTER all hooks
  if (authScreen === "login") return <LoginScreen onLogin={handleLogin} />;
  if (authScreen === "selectSite") return <SiteSelector user={authUser} onSelect={handleSelectSite} onLogout={handleLogout} />;
  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0e17", color: "#94a3b8", fontFamily: "'Segoe UI', sans-serif" }}>Cargando sitio...</div>;

  // CRUD Helpers (API-aware)
  const addItem = async (key, item) => {
    if (apiMode && siteId && ENTITY_API[key]) {
      try {
        const body = { ...toBackend(key, item), site_id: siteId };
        const created = await api.post(`/api/${ENTITY_API[key]}`, body);
        update(key, [...data[key], toFrontend(key, created)]);
        return;
      } catch (e) { console.error("API create failed:", e); }
    }
    update(key, [...data[key], { ...item, id: genId() }]);
  };

  const editItem = async (key, id, updates) => {
    if (apiMode && ENTITY_API[key]) {
      try {
        const body = toBackend(key, updates);
        const updated = await api.put(`/api/${ENTITY_API[key]}/${id}`, body);
        update(key, data[key].map(i => i.id === String(id) ? toFrontend(key, updated) : i));
        return;
      } catch (e) { console.error("API update failed:", e); }
    }
    update(key, data[key].map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const deleteItem = async (key, id) => {
    if (!confirm("¿Eliminar este elemento?")) return;
    if (apiMode && ENTITY_API[key]) {
      try {
        await api.del(`/api/${ENTITY_API[key]}/${id}`);
        update(key, data[key].filter(i => i.id !== String(id)));
        return;
      } catch (e) { console.error("API delete failed:", e); }
    }
    update(key, data[key].filter(i => i.id !== id));
  };

  // Bulk update cameras
  const bulkUpdateCameras = async (field, value) => {
    if (apiMode) {
      try {
        const ids = selectedCameras.map(id => parseInt(id));
        await api.put(`/api/cameras/bulk-update?field=${field}&value=${value}`, ids);
      } catch (e) { console.error("Bulk update failed:", e); }
    }
    update("cameras", data.cameras.map(c =>
      selectedCameras.includes(c.id) ? { ...c, [field]: value } : c
    ));
    setSelectedCameras([]);
    setBulkModal({ open: false, action: null });
  };

  const bulkDeleteCameras = async () => {
    if (!confirm(`¿Eliminar ${selectedCameras.length} cámaras seleccionadas?`)) return;
    if (apiMode) {
      try {
        for (const id of selectedCameras) await api.del(`/api/cameras/${id}`);
      } catch (e) { console.error("Bulk delete failed:", e); }
    }
    update("cameras", data.cameras.filter(c => !selectedCameras.includes(c.id)));
    setSelectedCameras([]);
  };

  // CSV Import
  const importCSV = (file, entityType) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split("\n");
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const items = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(",");
        const item = { id: genId() };
        headers.forEach((h, idx) => {
          const key = h === "canal" ? "channel" : h === "ip" ? "ip" : h === "modelo" ? "model" :
            h === "serie" ? "serial" : h === "mac" ? "mac" : h === "version" ? "version" :
              h === "nombre" ? "name" : h;
          item[key] = (values[idx] || "").trim();
        });
        items.push(item);
      }
      if (entityType === "cameras") {
        update("cameras", [...data.cameras, ...items]);
      }
    };
    reader.readAsText(file);
  };

  // CSV Export
  const exportCSV = (entityType) => {
    let csv = "";
    let filename = "";
    if (entityType === "cameras") {
      csv = "Canal,Nombre,IP,Modelo,Serie,MAC,Rack,Switch,Ubicacion,Estado\n";
      data.cameras.forEach(c => {
        csv += `${c.channel || ""},${c.name || ""},${c.ip || ""},${c.model || ""},${c.serial || ""},${c.mac || ""},${c.rackId || ""},${c.switchId || ""},${c.location || ""},${c.status || "online"}\n`;
      });
      filename = `camaras_${data.site.name.replace(/\s+/g, "_")}.csv`;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };


  // ============================================
  // PDF GENERATION (HTML Print)
  // ============================================
  const generatePDF = (reportType) => {
    const date = new Date().toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" });
    const findName = (list, id) => { const item = list.find(i => i.id === id); return item ? item.name : "—"; };
    const camTypes = { "ip-net": "IP Red", "ip-poe-nvr": "IP PoE", "analog": "Analógica" };

    const css = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: A4; margin: 10mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; color: #1e293b; background: #fff; padding: 16px; max-width: 100%; overflow-x: hidden; }
      .header { background: #0f172a; color: #e2e8f0; padding: 20px 24px; margin: -16px -16px 20px; }
      .header h1 { font-size: 18px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.3px; }
      .header .sub { font-size: 11px; color: #cbd5e1; margin-bottom: 2px; }
      .header .meta { font-size: 8.5px; color: #94a3b8; margin-top: 6px; line-height: 1.5; }
      .header .bar { height: 3px; background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4); margin-top: 10px; border-radius: 2px; }
      .section { margin-bottom: 16px; page-break-inside: avoid; }
      .section-title { background: #0f172a; color: #e2e8f0; padding: 7px 14px; font-size: 11px; font-weight: 700; border-radius: 4px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
      .section-title .badge { background: rgba(255,255,255,0.2); padding: 2px 10px; border-radius: 10px; font-size: 9px; font-weight: 400; }
      table { width: 100%; border-collapse: collapse; font-size: 8px; margin-bottom: 10px; table-layout: auto; word-break: break-word; }
      th { background: #1e293b; color: #e2e8f0; padding: 6px 8px; text-align: left; font-weight: 600; font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap; }
      td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 8.5px; }
      tr:nth-child(even) td { background: #f8fafc; }
      .status-on { color: #16a34a; font-weight: 600; }
      .status-off { color: #dc2626; font-weight: 700; background: #fef2f2; padding: 1px 6px; border-radius: 3px; }
      .kv { display: grid; grid-template-columns: 110px 1fr; gap: 3px 12px; font-size: 9px; margin-bottom: 4px; }
      .kv .k { color: #64748b; font-weight: 600; padding: 2px 0; }
      .kv .v { color: #1e293b; padding: 2px 0; }
      .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; }
      .card-title { font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #3b82f6; display: flex; justify-content: space-between; align-items: center; }
      .footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 7px; color: #94a3b8; padding: 6px 16px; display: flex; justify-content: space-between; border-top: 1px solid #e5e7eb; }
      .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
      .summary-card { background: #f8fafc; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px 14px; text-align: center; }
      .summary-card .num { font-size: 20px; font-weight: 800; color: #0f172a; }
      .summary-card .label { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
      .conflict-error { background: #fef2f2; border-left: 3px solid #dc2626; padding: 8px 12px; margin-bottom: 6px; border-radius: 0 4px 4px 0; font-size: 9px; }
      .conflict-warn { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 12px; margin-bottom: 6px; border-radius: 0 4px 4px 0; font-size: 9px; }
      .rack-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9px; }
      .rack-table th { background: #334155; color: #e2e8f0; padding: 5px 10px; text-align: left; font-size: 8px; }
      .rack-table td { padding: 5px 10px; border-bottom: 1px solid #e5e7eb; }
      .rack-table .cat { font-weight: 700; padding: 6px 10px; color: #fff; font-size: 9px; }
      .rack-table .cat-nvr { background: #7c3aed; }
      .rack-table .cat-sw { background: #0891b2; }
      .rack-table .cat-pp { background: #64748b; }
      .cable-route { margin-top: 8px; padding: 8px 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 9px; }
      .cable-route strong { color: #166534; }
      .cable-route span { color: #15803d; }
      @media print { .no-print { display: none !important; } body { padding: 0; } .header { margin: 0 0 20px; } }
    `;

    let body = "";

    // Header
    const makeHeader = (title, subtitle) => `
      <div class="header">
        <h1>${title}</h1>
        <div class="sub">${data.site.name} — ${data.site.address}</div>
        <div class="meta">${date} | Contacto: ${data.site.contact} | ${data.site.phone} | ${data.site.email}</div>
        ${subtitle ? `<div class="meta" style="margin-top:4px">${subtitle}</div>` : ""}
        <div class="bar"></div>
      </div>`;

    const makeTable = (headers, rows) => {
      let h = "<table><thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>";
      rows.forEach(row => { h += "<tr>" + row.map(c => `<td>${c || "—"}</td>`).join("") + "</tr>"; });
      return h + "</tbody></table>";
    };

    // ---- FULL (Executive Summary) ----
    if (reportType === "full") {
      const onlineCams = data.cameras.filter(c => c.status !== "offline").length;
      const offlineCams = data.cameras.length - onlineCams;
      const totalStorage = data.nvrs.reduce((s, n) => s + (n.disks || []).reduce((ss, d) => ss + (parseFloat(d.size) || 0), 0), 0);
      const nvrTypes = {}; data.nvrs.forEach(n => { const t = n.type || "NVR"; nvrTypes[t] = (nvrTypes[t] || 0) + 1; });
      const camByType = {}; data.cameras.forEach(c => { const t = camTypes[c.camType] || "Otro"; camByType[t] = (camByType[t] || 0) + 1; });

      body += makeHeader("RESUMEN EJECUTIVO — SISTEMA CCTV", `Informe generado el ${date}`);

      body += `<div class="summary-grid">
        <div class="summary-card"><div class="num">${data.cameras.length}</div><div class="label">Cámaras</div><div style="font-size:9px;color:#64748b;margin-top:4px">${onlineCams} online / ${offlineCams} offline</div></div>
        <div class="summary-card"><div class="num">${data.nvrs.length}</div><div class="label">Grabadores</div><div style="font-size:9px;color:#64748b;margin-top:4px">${Object.entries(nvrTypes).map(([t,c]) => c + " " + t).join(", ")}</div></div>
        <div class="summary-card"><div class="num">${totalStorage} TB</div><div class="label">Almacenamiento</div><div style="font-size:9px;color:#64748b;margin-top:4px">${data.nvrs.reduce((s, n) => s + (n.disks || []).length, 0)} discos</div></div>
        <div class="summary-card"><div class="num">${data.switches.length}</div><div class="label">Switches</div><div style="font-size:9px;color:#64748b;margin-top:4px">${data.switches.filter(s => s.poe).length} con PoE</div></div>
        <div class="summary-card"><div class="num">${data.racks.length}</div><div class="label">Racks</div></div>
        <div class="summary-card"><div class="num">${data.patchPanels.length}</div><div class="label">Patch Panels</div></div>
      </div>`;

      // Cameras by type
      body += `<div class="section"><div class="section-title">DISTRIBUCIÓN DE CÁMARAS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div><h4 style="font-size:10px;color:#64748b;margin-bottom:6px">Por Tipo</h4>`;
      Object.entries(camByType).forEach(([t, c]) => { body += `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e2e8f0;font-size:9px"><span>${t}</span><strong>${c}</strong></div>`; });
      body += `</div><div><h4 style="font-size:10px;color:#64748b;margin-bottom:6px">Por Rack</h4>`;
      data.racks.forEach(r => { const c = data.cameras.filter(c => c.rackId === r.id).length; body += `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e2e8f0;font-size:9px"><span>${r.name}</span><strong>${c}</strong></div>`; });
      body += `</div></div></div>`;

      // Recorders summary
      body += `<div class="section"><div class="section-title">GRABADORES <span class="badge">${data.nvrs.length}</span></div>`;
      body += makeTable(["Nombre", "Tipo", "Modelo", "Canales", "Usados", "Discos", "Almacenamiento", "Rack"],
        data.nvrs.map(n => {
          const used = data.cameras.filter(c => c.nvrId === n.id).length;
          const disks = (n.disks || []).map(d => d.size).join(" + ");
          const total = (n.disks || []).reduce((s, d) => s + (parseFloat(d.size) || 0), 0);
          return [n.name, n.type || "NVR", n.model, n.channels, `${used}`, disks || "—", `${total} TB`, findName(data.racks, n.rackId)];
        }));
      body += "</div>";

      // Offline cameras
      if (offlineCams > 0) {
        body += `<div class="section"><div class="section-title" style="background:#7f1d1d">CÁMARAS OFFLINE <span class="badge">${offlineCams}</span></div>`;
        const offCams = data.cameras.filter(c => c.status === "offline");
        body += makeTable(["CH", "Nombre", "IP", "Grabador", "Ubicación"],
          offCams.map(c => [c.channel, c.name, c.ip || "N/A", findName(data.nvrs, c.nvrId), c.location]));
        body += "</div>";
      }

      // Network summary
      body += `<div class="section"><div class="section-title">INFRAESTRUCTURA DE RED</div>`;
      body += makeTable(["Equipo", "Modelo", "IP", "Función"],
        [...data.routers.map(r => [r.name, r.model, `LAN: ${r.lanIp} | WAN: ${r.wanIp}`, "Router/Firewall"]),
         ...data.switches.map(s => [s.name, s.model, s.ip, `Switch ${s.ports}p ${s.poe ? "PoE" : ""}`])]);
      body += "</div>";
    }

    // ---- CAMERAS ----
    if (reportType === "cameras") {
      body += makeHeader("LISTADO DE CÁMARAS", `${data.cameras.length} cámaras registradas`);
      body += makeTable(["CH", "Nombre", "Tipo", "IP", "Modelo", "Serie", "MAC", "Grabador", "PP / Puerto", "Estado"],
        data.cameras.map(c => {
          const pp = data.patchPanels.find(p => p.id === c.patchPanelId);
          const ppText = pp ? `${pp.name}${c.patchPanelPort ? " :" + c.patchPanelPort : ""}` : "";
          return [c.channel, c.name, camTypes[c.camType] || "", c.ip, c.model, c.serial, c.mac, findName(data.nvrs, c.nvrId), ppText, c.status === "offline" ? '<span class="status-off">OFFLINE</span>' : '<span class="status-on">Online</span>'];
        }));
    }

    // ---- RACKS ----
    if (reportType === "racks") {
      body += makeHeader("INFORME POR RACK", `${data.racks.length} racks — Detalle de equipos por ubicación`);
      data.racks.forEach(rack => {
        const building = data.buildings.find(b => b.id === rack.buildingId);
        const rackCams = data.cameras.filter(c => c.rackId === rack.id);
        const rackSw = data.switches.filter(s => s.rackId === rack.id);
        const rackNvrs = data.nvrs.filter(n => n.rackId === rack.id);
        const rackPPs = data.patchPanels.filter(p => p.rackId === rack.id);
        const onCams = rackCams.filter(c => c.status !== "offline").length;

        body += `<div class="section"><div class="section-title">${rack.name} <span class="badge">${rack.location || ""}</span> <span class="badge">${rackCams.length} cámaras (${onCams} online)</span></div>`;

        // Rack info table
        body += `<table class="rack-table"><tbody>
          <tr><td style="width:30%;font-weight:600;color:#64748b">Edificio</td><td>${building ? building.name : "—"}</td><td style="width:20%;font-weight:600;color:#64748b">Piso</td><td>${rack.floor || "—"}</td></tr>
          <tr><td style="font-weight:600;color:#64748b">Capacidad</td><td>${rack.capacity || "?"} U</td><td style="font-weight:600;color:#64748b">Equipos</td><td>${rackNvrs.length + rackSw.length + rackPPs.length}</td></tr>
        </tbody></table>`;

        // Equipment by category
        if (rackNvrs.length) {
          body += `<table class="rack-table"><tr><td colspan="4" class="cat cat-nvr">GRABADORES (${rackNvrs.length})</td></tr>
            <tr><th>Nombre</th><th>Tipo</th><th>Modelo</th><th>Canales</th></tr>`;
          rackNvrs.forEach(n => { body += `<tr><td><strong>${n.name}</strong></td><td>${n.type || "NVR"}</td><td>${n.model}</td><td>${n.channels} ch</td></tr>`; });
          body += `</table>`;
        }
        if (rackSw.length) {
          body += `<table class="rack-table"><tr><td colspan="5" class="cat cat-sw">SWITCHES (${rackSw.length})</td></tr>
            <tr><th>Nombre</th><th>Modelo</th><th>IP</th><th>Puertos</th><th>PoE</th></tr>`;
          rackSw.forEach(s => { body += `<tr><td><strong>${s.name}</strong></td><td>${s.model}</td><td style="font-family:monospace">${s.ip}</td><td>${s.ports}</td><td>${s.poe ? "Sí" : "No"}</td></tr>`; });
          body += `</table>`;
        }
        if (rackPPs.length) {
          body += `<table class="rack-table"><tr><td colspan="4" class="cat cat-pp">PATCH PANELS (${rackPPs.length})</td></tr>
            <tr><th>Nombre</th><th>Puertos</th><th>Tipo</th><th>Ruta</th></tr>`;
          rackPPs.forEach(p => { body += `<tr><td><strong>${p.name}</strong></td><td>${p.ports}</td><td>${p.type}</td><td>${p.cableRoute || "—"}</td></tr>`; });
          body += `</table>`;
        }

        // Cameras
        if (rackCams.length) {
          body += makeTable(["CH", "Nombre", "IP", "Modelo", "Grabador", "PP :Puerto", "Estado"],
            rackCams.map(c => {
              const pp = data.patchPanels.find(p => p.id === c.patchPanelId);
              return [c.channel, c.name || "—", c.ip || "N/A", c.model || "—", findName(data.nvrs, c.nvrId),
                pp ? `${pp.name} :${c.patchPanelPort || "?"}` : "—",
                c.status === "offline" ? '<span class="status-off">OFFLINE</span>' : '<span class="status-on">Online</span>'];
            }));
        }
        body += "</div>";
      });
    }

    // ---- NVRs ----
    if (reportType === "nvrs") {
      body += makeHeader("GRABADORES Y ALMACENAMIENTO", `${data.nvrs.length} grabadores`);
      data.nvrs.forEach(n => {
        const ips = (n.nics || []).map(nic => `${nic.label}: ${nic.ip}`).join(" | ");
        const disks = (n.disks || []).map((d, i) => `Disco ${i + 1}: ${d.size} (${d.status})`).join(" | ");
        const total = (n.disks || []).reduce((s, d) => s + (parseFloat(d.size) || 0), 0);
        const nvrCams = data.cameras.filter(c => c.nvrId === n.id);

        body += `<div class="section"><div class="section-title">${n.type || "NVR"}: ${n.name} <span class="badge">${nvrCams.length} / ${n.channels} ch</span></div>`;
        body += `<div class="card"><div class="kv"><span class="k">Modelo</span><span class="v">${n.model}</span><span class="k">IPs</span><span class="v">${ips}</span><span class="k">Discos</span><span class="v">${disks || "Sin discos"}</span><span class="k">Almacenamiento</span><span class="v">${total} TB</span><span class="k">Rack</span><span class="v">${findName(data.racks, n.rackId)}</span></div></div>`;
        if (nvrCams.length) { body += makeTable(["CH", "Nombre", "Tipo", "IP", "Modelo", "PP / Puerto", "Estado"], nvrCams.map(c => { const pp = data.patchPanels.find(p => p.id === c.patchPanelId); return [c.channel, c.name, camTypes[c.camType] || "", c.ip, c.model, pp ? `${pp.name}${c.patchPanelPort ? " :" + c.patchPanelPort : ""}` : "", c.status === "offline" ? '<span class="status-off">OFFLINE</span>' : '<span class="status-on">Online</span>']; })); }
        body += "</div>";
      });
    }

    // ---- NETWORK ----
    if (reportType === "network") {
      body += makeHeader("INFRAESTRUCTURA DE RED", `${data.routers.length} routers | ${data.switches.length} switches | ${data.patchPanels.length} patch panels`);

      body += `<div class="section"><div class="section-title">ROUTERS <span class="badge">${data.routers.length}</span></div>`;
      data.routers.forEach(r => {
        body += `<div class="card"><div class="card-title">${r.name}</div>
          <table class="rack-table"><tbody>
            <tr><td style="width:25%;font-weight:600;color:#64748b">Modelo</td><td>${r.model || "—"}</td></tr>
            <tr><td style="font-weight:600;color:#64748b">LAN IP</td><td style="font-family:monospace;color:#0891b2">${r.lanIp || "—"}</td></tr>
            <tr><td style="font-weight:600;color:#64748b">WAN IP</td><td style="font-family:monospace;color:#dc2626">${r.wanIp || "—"}</td></tr>
            <tr><td style="font-weight:600;color:#64748b">Interfaces</td><td>${r.interfaces || "—"}</td></tr>
            <tr><td style="font-weight:600;color:#64748b">Rack</td><td>${findName(data.racks, r.rackId)}</td></tr>
          </tbody></table></div>`;
      });
      body += "</div>";

      body += `<div class="section"><div class="section-title">SWITCHES <span class="badge">${data.switches.length}</span></div>`;
      body += makeTable(["Nombre", "Modelo", "IP", "Puertos", "PoE", "Rack", "Uplink"], data.switches.map(s => [s.name, s.model, `<span style="font-family:monospace">${s.ip}</span>`, s.ports, s.poe ? "Sí" : "No", findName(data.racks, s.rackId), s.uplink]));
      body += "</div>";

      body += `<div class="section"><div class="section-title">PATCH PANELS <span class="badge">${data.patchPanels.length}</span></div>`;
      body += makeTable(["Nombre", "Puertos", "Tipo", "Rack", "Ruta Cableado"], data.patchPanels.map(p => [p.name, p.ports, p.type, findName(data.racks, p.rackId), p.cableRoute]));
      body += "</div>";
    }

    // ---- CONFLICTS ----
    if (reportType === "conflicts") {
      body += makeHeader("REPORTE DE CONFLICTOS", "Validación de integridad del sistema");
      const conflicts = [];
      const ipMap = {};
      data.cameras.forEach(c => { if (c.ip) { if (!ipMap[c.ip]) ipMap[c.ip] = []; ipMap[c.ip].push(c); } });
      Object.entries(ipMap).forEach(([ip, cams]) => { if (cams.length > 1) { const same = cams.every(c => c.camType === cams[0].camType); conflicts.push({ type: same ? "error" : "warn", msg: `IP ${ip} duplicada: ${cams.map(c => c.name || "CH" + c.channel).join(", ")}${!same ? " (segmentos diferentes)" : ""}` }); } });
      const chMap = {};
      data.cameras.forEach(c => { if (c.channel && c.nvrId) { const k = `${c.nvrId}-${c.channel}`; if (!chMap[k]) chMap[k] = []; chMap[k].push(c); } });
      Object.entries(chMap).forEach(([, cams]) => { if (cams.length > 1) conflicts.push({ type: "error", msg: `Canal ${cams[0].channel} duplicado en grabador: ${cams.map(c => c.name || c.ip).join(", ")}` }); });
      const ppMap = {};
      data.cameras.forEach(c => { if (c.patchPanelId && c.patchPanelPort) { const k = `${c.patchPanelId}-${c.patchPanelPort}`; if (!ppMap[k]) ppMap[k] = []; ppMap[k].push(c); } });
      Object.entries(ppMap).forEach(([, cams]) => { if (cams.length > 1) { const pp = data.patchPanels.find(p => p.id === cams[0].patchPanelId); conflicts.push({ type: "error", msg: `Puerto ${cams[0].patchPanelPort} de ${pp?.name || "PP"} duplicado: ${cams.map(c => c.name || c.ip).join(", ")}` }); } });
      data.switches.forEach(sw => { const c = data.cameras.filter(c => c.switchId === sw.id).length; if (c > parseInt(sw.ports)) conflicts.push({ type: "warn", msg: `${sw.name}: ${c} cámaras exceden ${sw.ports} puertos disponibles` }); });

      if (conflicts.length === 0) {
        body += `<div style="text-align:center;padding:40px;color:#16a34a;font-size:14px;font-weight:700">Sin conflictos detectados</div>`;
      } else {
        body += `<div style="margin-bottom:12px;font-size:11px;color:#64748b">${conflicts.filter(c=>c.type==="error").length} errores, ${conflicts.filter(c=>c.type==="warn").length} advertencias</div>`;
        conflicts.forEach(c => { body += `<div class="conflict-${c.type === "error" ? "error" : "warn"}"><strong>${c.type === "error" ? "ERROR" : "ADVERTENCIA"}:</strong> ${c.msg}</div>`; });
      }
    }

    // ---- CAMERA DETAIL ----
    if (reportType === "cameraDetail") {
      body += makeHeader("FICHA TÉCNICA POR CÁMARA", `${data.cameras.length} cámaras — Detalle individual con ruta de cableado`);
      data.cameras.forEach((c, idx) => {
        const nvr = data.nvrs.find(n => n.id === c.nvrId);
        const rack = data.racks.find(r => r.id === c.rackId);
        const sw = data.switches.find(s => s.id === c.switchId);
        const pp = data.patchPanels.find(p => p.id === c.patchPanelId);
        const statusClass = c.status === "offline" ? "status-off" : "status-on";
        const statusText = c.status === "offline" ? "OFFLINE" : "ONLINE";
        body += `<div class="card" style="page-break-inside:avoid;${c.status === "offline" ? "border-color:#dc2626;" : ""}">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;border-bottom-color:${c.status === "offline" ? "#dc2626" : "#3b82f6"}">
            <span>#${idx + 1} — ${c.name || "Sin nombre"}</span>
            <span class="${statusClass}" style="font-size:10px">${statusText}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">
            <div class="kv">
              <span class="k">Canal</span><span class="v">${c.channel || "—"} (${nvr ? nvr.type || "NVR" : "Sin grabador"})</span>
              <span class="k">Tipo</span><span class="v">${camTypes[c.camType] || "—"}</span>
              <span class="k">IP</span><span class="v" style="font-family:monospace">${c.ip || "N/A (analógica)"}</span>
              <span class="k">Modelo</span><span class="v">${c.model || "—"}</span>
              <span class="k">Serie</span><span class="v" style="font-family:monospace">${c.serial || "—"}</span>
              <span class="k">MAC</span><span class="v" style="font-family:monospace">${c.mac || "—"}</span>
            </div>
            <div class="kv">
              <span class="k">Grabador</span><span class="v">${nvr ? nvr.name + " (" + (nvr.type || "NVR") + ")" : "Individual (sin NVR)"}</span>
              <span class="k">Rack</span><span class="v">${rack ? rack.name : "—"}</span>
              <span class="k">Switch</span><span class="v">${sw ? sw.name + " :" + (c.switchId ? "" : "") : "—"}</span>
              <span class="k">Patch Panel</span><span class="v">${pp ? pp.name + " Puerto :" + (c.patchPanelPort || "?") : "—"}</span>
              <span class="k">Ubicación</span><span class="v">${c.location || "—"}</span>
              <span class="k">Monitoreo</span><span class="v">${c.nvrId ? "Vía grabador" : c.ip ? "Host individual (ping)" : "Sin monitoreo"}</span>
            </div>
          </div>
          ${c.cableRoute ? `<div style="margin-top:8px;padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;font-size:9px"><strong style="color:#166534">Ruta de cableado:</strong> <span style="color:#15803d">${c.cableRoute}</span></div>` : ""}
        </div>`;
      });
    }

    // Set report HTML for preview modal
    const fullHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>NetManager — ${data.site.name}</title><style>${css}</style></head><body>${body}
      <div class="footer"><span>NetManager — ${data.site.name}</span><span>${date}</span></div>
    </body></html>`;
    setReportHTML(fullHTML);
  };

  // NAV ITEMS
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Icons.dashboard },
    { id: "topology", label: "Topología", icon: Icons.topology },
    { id: "cameras", label: "Cámaras", icon: Icons.camera },
    { id: "racks", label: "Racks", icon: Icons.server },
    { id: "switches", label: "Switches", icon: Icons.network },
    { id: "nvrs", label: "Grabadores", icon: Icons.camera },
    { id: "routers", label: "Routers", icon: Icons.router },
    { id: "buildings", label: "Edificios", icon: Icons.building },
    { id: "patchPanels", label: "Patch Panels", icon: Icons.cable },
    { id: "reports", label: "Reportes PDF", icon: Icons.download },
    { id: "settings", label: "Configuración", icon: Icons.settings },
    ...(authUser?.role === "admin" ? [{ id: "admin", label: "Administración", icon: Icons.users }] : []),
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0e17", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#e2e8f0" }}>
      {/* SIDEBAR */}
      <div style={{
        width: sidebarCollapsed ? "56px" : "220px", background: "#0d1320",
        borderRight: "1px solid #1a2235", display: "flex", flexDirection: "column",
        transition: "width 0.3s", overflow: "hidden", flexShrink: 0
      }}>
        {/* Logo */}
        <div style={{
          padding: sidebarCollapsed ? "16px 12px" : "20px 16px",
          borderBottom: "1px solid #1a2235", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer"
        }} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
            background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "13px", fontWeight: 800, color: "white"
          }}>NM</div>
          {!sidebarCollapsed && (
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap" }}>NetManager</div>
              <div style={{ fontSize: "10px", color: "#475569", whiteSpace: "nowrap" }}>CCTV & Network</div>
              <div style={{ fontSize: "8px", marginTop: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#10b981" }} />
                <span style={{ color: "#10b981" }}>{authUser?.username}</span>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px", overflowY: "auto" }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveSection(item.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: "10px",
              padding: sidebarCollapsed ? "10px 12px" : "9px 12px",
              background: activeSection === item.id ? "rgba(59,130,246,0.12)" : "transparent",
              color: activeSection === item.id ? "#60a5fa" : "#64748b",
              border: "none", borderRadius: "6px", cursor: "pointer",
              fontSize: "12px", fontWeight: activeSection === item.id ? 600 : 500,
              marginBottom: "2px", transition: "all 0.15s", textAlign: "left",
              fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap"
            }}>
              {item.icon}
              {!sidebarCollapsed && item.label}
            </button>
          ))}
        </nav>

        {/* Site name footer + user actions */}
        {!sidebarCollapsed && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid #1a2235", fontSize: "10px", color: "#334155", lineHeight: 1.4 }}>
            <div style={{ marginBottom: "8px", color: "#64748b" }}>{data.site.name}</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => setAuthScreen("selectSite")}
                style={{ flex: 1, padding: "5px", background: "#1e293b", border: "1px solid #334155", borderRadius: "4px", color: "#94a3b8", fontSize: "9px", cursor: "pointer" }}>Cambiar sitio</button>
              <button onClick={handleLogout}
                style={{ flex: 1, padding: "5px", background: "#1e293b", border: "1px solid #334155", borderRadius: "4px", color: "#f87171", fontSize: "9px", cursor: "pointer" }}>Salir</button>
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <header style={{
          padding: "14px 24px", borderBottom: "1px solid #1a2235",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(180deg, rgba(13,19,32,0.8) 0%, transparent 100%)"
        }}>
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.3px" }}>
              {navItems.find(n => n.id === activeSection)?.label || "Dashboard"}
            </h1>
            <span style={{ fontSize: "11px", color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>
              {data.site.name} — {data.site.address}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Btn variant="ghost" size="sm" icon={Icons.download} onClick={() => exportCSV("cameras")}>Exportar CSV</Btn>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>

          {/* ============ DASHBOARD ============ */}
          {activeSection === "dashboard" && (
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
                <StatCard label="Cámaras" value={data.cameras.length} color="#10b981" icon={Icons.camera} onClick={() => setActiveSection("cameras")} />
                <StatCard label="Racks" value={data.racks.length} color="#06b6d4" icon={Icons.server} onClick={() => setActiveSection("racks")} />
                <StatCard label="Switches" value={data.switches.length} color="#8b5cf6" icon={Icons.network} onClick={() => setActiveSection("switches")} />
                <StatCard label="Grabadores" value={data.nvrs.length} color="#f59e0b" icon={Icons.camera} onClick={() => setActiveSection("nvrs")} />
                <StatCard label="Routers" value={data.routers.length} color="#3b82f6" icon={Icons.router} onClick={() => setActiveSection("routers")} />
              </div>

              {/* Quick overview */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ background: "#141c2b", border: "1px solid #1e293b", borderRadius: "10px", padding: "20px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px", color: "#94a3b8" }}>Cámaras por Rack</h3>
                  {data.racks.length === 0 ? (
                    <p style={{ color: "#475569", fontSize: "12px" }}>No hay racks configurados. Ve a la sección Racks para crear uno.</p>
                  ) : data.racks.map(rack => {
                    const camCount = data.cameras.filter(c => c.rackId === rack.id).length;
                    return (
                      <div key={rack.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a2235", fontSize: "12px" }}>
                        <span style={{ color: "#cbd5e1" }}>{rack.name}</span>
                        <span style={{ color: "#22d3ee", fontFamily: "'JetBrains Mono', monospace" }}>{camCount} cámaras</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ background: "#141c2b", border: "1px solid #1e293b", borderRadius: "10px", padding: "20px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px", color: "#94a3b8" }}>Cámaras por Grabador</h3>
                  {data.nvrs.length === 0 ? (
                    <p style={{ color: "#475569", fontSize: "12px" }}>No hay grabadores configurados.</p>
                  ) : data.nvrs.map(nvr => {
                    const camCount = data.cameras.filter(c => c.nvrId === nvr.id).length;
                    return (
                      <div key={nvr.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a2235", fontSize: "12px" }}>
                        <span style={{ color: "#cbd5e1" }}><span style={{ color: "#64748b", fontSize: "10px" }}>{nvr.type || "NVR"}</span> {nvr.name}</span>
                        <span style={{ color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace" }}>{camCount} / {nvr.channels || "?"} ch</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ background: "#141c2b", border: "1px solid #1e293b", borderRadius: "10px", padding: "20px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px", color: "#94a3b8" }}>Segmentos de Red</h3>
                  {(() => {
                    // Dynamic: load segments from API or compute from device IPs
                    const [netSegs, setNetSegs] = useState([]);
                    const [netLoading, setNetLoading] = useState(true);
                    useEffect(() => {
                      if (apiMode && siteId) {
                        api.get(`/api/sites/${siteId}/network-segments`)
                          .then(r => { setNetSegs(r.segments || []); setNetLoading(false); })
                          .catch(() => { setNetSegs([]); setNetLoading(false); });
                      } else {
                        // Offline: detect from local device IPs
                        const ipMap = {};
                        const colors = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899"];
                        const allIPs = [
                          ...data.cameras.map(c => c.ip),
                          ...data.switches.map(s => s.ip),
                          ...data.routers.flatMap(r => [r.lanIp, r.wanIp]),
                          ...data.nvrs.flatMap(n => (n.nics || []).map(nic => nic.ip)),
                        ].filter(Boolean);
                        allIPs.forEach(ip => {
                          try {
                            const parts = ip.split(".");
                            if (parts.length === 4) {
                              const subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
                              ipMap[subnet] = (ipMap[subnet] || 0) + 1;
                            }
                          } catch(e) {}
                        });
                        // Merge with manual segments from site
                        const manual = (data.site.networkSegments || []).map(s => ({
                          name: s.name, subnet: s.subnet, color: s.color, auto: false,
                          count: ipMap[s.subnet] || 0,
                        }));
                        const manualSubnets = new Set(manual.map(m => m.subnet));
                        const auto = Object.entries(ipMap)
                          .filter(([sub]) => !manualSubnets.has(sub))
                          .sort((a,b) => b[1] - a[1])
                          .map(([sub, cnt], i) => ({
                            name: `Auto (${cnt} hosts)`, subnet: sub,
                            color: colors[i % colors.length], auto: true,
                          }));
                        // Enrich manual with counts
                        manual.forEach(m => { if (ipMap[m.subnet]) m.name = `${m.name} (${ipMap[m.subnet]} hosts)`; });
                        setNetSegs([...manual, ...auto]);
                        setNetLoading(false);
                      }
                    }, [data.cameras, data.switches, data.routers, data.nvrs, data.site.networkSegments, siteId, apiMode]);

                    if (netLoading) return <p style={{ color: "#475569", fontSize: "12px" }}>Detectando segmentos...</p>;
                    if (netSegs.length === 0) return <p style={{ color: "#475569", fontSize: "12px" }}>No se detectaron segmentos de red.</p>;
                    return netSegs.map((seg, i) => (
                      <div key={seg.subnet + i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a2235" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: seg.color }} />
                          <span style={{ fontSize: "12px", color: "#cbd5e1" }}>{seg.name}{seg.auto ? "" : ""}</span>
                        </div>
                        <span style={{ fontSize: "11px", color: "#22d3ee", fontFamily: "'JetBrains Mono', monospace" }}>{seg.subnet}</span>
                      </div>
                    ));
                  })()}
                </div>

                <div style={{ background: "#141c2b", border: "1px solid #1e293b", borderRadius: "10px", padding: "20px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px", color: "#94a3b8" }}>Grabadores por Tipo</h3>
                  {(() => {
                    const types = {};
                    data.nvrs.forEach(n => { const t = n.type || "NVR"; types[t] = (types[t] || 0) + 1; });
                    const typeColors = { NVR: "#8b5cf6", DVR: "#f59e0b", XVR: "#06b6d4", HCVR: "#10b981" };
                    return Object.keys(types).length === 0 ? (
                      <p style={{ color: "#475569", fontSize: "12px" }}>Sin grabadores.</p>
                    ) : Object.entries(types).map(([type, count]) => (
                      <div key={type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a2235", fontSize: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: typeColors[type] || "#64748b" }} />
                          <span style={{ color: "#cbd5e1" }}>{type}</span>
                        </div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: typeColors[type] || "#94a3b8" }}>{count}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
              {(() => {
                const conflicts = [];
                const ipMap = {};
                data.cameras.forEach(c => {
                  if (c.ip) {
                    if (!ipMap[c.ip]) ipMap[c.ip] = [];
                    ipMap[c.ip].push(c);
                  }
                });
                Object.entries(ipMap).forEach(([ip, cams]) => {
                  if (cams.length > 1) {
                    const sameType = cams.every(c => c.camType === cams[0].camType);
                    conflicts.push({
                      type: sameType ? "error" : "warning",
                      msg: `IP ${ip} duplicada: ${cams.map(c => c.name || 'CH' + c.channel).join(", ")}${!sameType ? " (segmentos diferentes)" : ""}`,
                      resolve: sameType ? { action: "editCamera", ids: cams.map(c => c.id), label: "Editar" } : null
                    });
                  }
                });
                const chMap = {};
                data.cameras.forEach(c => {
                  if (c.channel && c.nvrId) {
                    const key = `${c.nvrId}-${c.channel}`;
                    if (!chMap[key]) chMap[key] = [];
                    chMap[key].push(c);
                  }
                });
                Object.entries(chMap).forEach(([, cams]) => {
                  if (cams.length > 1) conflicts.push({
                    type: "error",
                    msg: `Canal ${cams[0].channel} duplicado en NVR: ${cams.map(c => c.name || c.ip).join(", ")}`,
                    resolve: { action: "editCamera", ids: cams.map(c => c.id), label: "Editar" }
                  });
                });
                const ppMap = {};
                data.cameras.forEach(c => {
                  if (c.patchPanelId && c.patchPanelPort) {
                    const key = `${c.patchPanelId}-${c.patchPanelPort}`;
                    if (!ppMap[key]) ppMap[key] = [];
                    ppMap[key].push(c);
                  }
                });
                Object.entries(ppMap).forEach(([, cams]) => {
                  if (cams.length > 1) {
                    const pp = data.patchPanels.find(p => p.id === cams[0].patchPanelId);
                    conflicts.push({
                      type: "error",
                      msg: `Puerto ${cams[0].patchPanelPort} de ${pp?.name || 'PP'} duplicado: ${cams.map(c => c.name || c.ip).join(", ")}`,
                      resolve: { action: "editCamera", ids: cams.map(c => c.id), label: "Editar" }
                    });
                  }
                });
                data.switches.forEach(sw => {
                  const count = data.cameras.filter(c => c.switchId === sw.id).length;
                  if (count > parseInt(sw.ports)) conflicts.push({
                    type: "warning",
                    msg: `${sw.name}: ${count} cámaras exceden ${sw.ports} puertos`,
                    resolve: { action: "goToSection", section: "cameras", label: "Ver cámaras" }
                  });
                });

                if (conflicts.length === 0) return null;
                return (
                  <div style={{ background: "#141c2b", border: "1px solid #1e293b", borderRadius: "10px", padding: "20px", marginTop: "16px" }}>
                    <h3 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px", color: "#fca5a5" }}>Conflictos y Advertencias ({conflicts.length})</h3>
                    {conflicts.map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid #1a2235", fontSize: "12px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: c.type === "error" ? "#ef4444" : "#f59e0b", flexShrink: 0 }} />
                        <span style={{ color: c.type === "error" ? "#fca5a5" : "#fcd34d", flex: 1 }}>{c.msg}</span>
                        {c.resolve && (
                          <Btn variant="ghost" size="sm" onClick={() => {
                            if (c.resolve.action === "editCamera" && c.resolve.ids.length > 0) {
                              const cam = data.cameras.find(cam => cam.id === c.resolve.ids[0]);
                              if (cam) { setActiveSection("cameras"); setTimeout(() => setModal({ open: true, type: "camera", item: cam }), 100); }
                            } else if (c.resolve.action === "goToSection") {
                              setActiveSection(c.resolve.section);
                            }
                          }}>{c.resolve.label}</Btn>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          {activeSection === "cameras" && (
            <div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
                <Btn icon={Icons.plus} onClick={() => setModal({ open: true, type: "camera", item: null })}>Nueva Cámara</Btn>
                <Btn variant="success" icon={Icons.plus} onClick={() => setModal({ open: true, type: "bulkCreate", item: null })}>Crear Masivo</Btn>
                <Btn variant="secondary" icon={Icons.upload} onClick={() => document.getElementById("csv-import").click()}>Importar CSV</Btn>
                <Btn variant="secondary" icon={Icons.download} onClick={() => exportCSV("cameras")}>Exportar CSV</Btn>
                <input id="csv-import" type="file" accept=".csv" style={{ display: "none" }}
                  onChange={e => { if (e.target.files[0]) importCSV(e.target.files[0], "cameras"); e.target.value = ""; }} />
              </div>

              {/* Bulk Actions Bar */}
              {selectedCameras.length > 0 && (
                <div style={{
                  display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap",
                  padding: "10px 14px", marginBottom: "12px",
                  background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)",
                  borderRadius: "8px"
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#60a5fa" }}>
                    {selectedCameras.length} seleccionadas —
                  </span>
                  <Btn variant="secondary" size="sm" onClick={() => setBulkModal({ open: true, action: "nvr" })}>Asignar Grabador</Btn>
                  <Btn variant="secondary" size="sm" onClick={() => setBulkModal({ open: true, action: "rack" })}>Asignar Rack</Btn>
                  <Btn variant="secondary" size="sm" onClick={() => setBulkModal({ open: true, action: "switch" })}>Asignar Switch</Btn>
                  <Btn variant="secondary" size="sm" onClick={() => setBulkModal({ open: true, action: "patchPanel" })}>Asignar Patch Panel</Btn>
                  <Btn variant="secondary" size="sm" onClick={() => setBulkModal({ open: true, action: "location" })}>Asignar Ubicación</Btn>
                  <Btn variant="secondary" size="sm" onClick={() => setBulkModal({ open: true, action: "cableRoute" })}>Ruta Cableado</Btn>
                  <Btn variant="secondary" size="sm" onClick={() => setBulkModal({ open: true, action: "camType" })}>Cambiar Tipo</Btn>
                  <Btn variant="secondary" size="sm" onClick={() => setBulkModal({ open: true, action: "status" })}>Cambiar Estado</Btn>
                  <div style={{ flex: 1 }} />
                  <Btn variant="danger" size="sm" icon={Icons.trash} onClick={bulkDeleteCameras}>Eliminar</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setSelectedCameras([])}>Deseleccionar</Btn>
                </div>
              )}

              <DataTable
                selectable={true}
                selected={selectedCameras}
                onSelectChange={setSelectedCameras}
                columns={[
                  { key: "channel", label: "Canal", mono: true },
                  { key: "name", label: "Nombre" },
                  { key: "camType", label: "Tipo", render: (v) => {
                    const types = { "ip-net": "IP Red", "ip-poe-nvr": "IP PoE", "analog": "Analógica" };
                    const colors = { "ip-net": "#22d3ee", "ip-poe-nvr": "#a78bfa", "analog": "#f59e0b" };
                    return <span style={{ color: colors[v] || "#94a3b8", fontSize: "11px", fontWeight: 600 }}>{types[v] || v || "—"}</span>;
                  }},
                  { key: "ip", label: "IP", mono: true, accent: true },
                  { key: "model", label: "Modelo", mono: true },
                  { key: "serial", label: "Serie", mono: true },
                  { key: "mac", label: "MAC", mono: true },
                  { key: "nvrId", label: "Grabador", render: (v) => { const n = data.nvrs.find(n => n.id === v); return n ? `${n.name}` : "—"; } },
                  { key: "rackId", label: "Rack", render: (v) => { const r = data.racks.find(r => r.id === v); return r ? r.name : "—"; } },
                  { key: "switchId", label: "Switch", render: (v) => { const s = data.switches.find(s => s.id === v); return s ? s.name : "—"; } },
                  { key: "patchPanelId", label: "Patch Panel", render: (v, row) => {
                    const p = data.patchPanels.find(p => p.id === v);
                    return p ? `${p.name}${row.patchPanelPort ? ` :${row.patchPanelPort}` : ""}` : "—";
                  }},
                  { key: "location", label: "Ubicación" },
                  { key: "status", label: "Estado", render: (v) => (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: v === "offline" ? "#ef4444" : "#10b981" }} />
                      {v === "offline" ? "Offline" : "Online"}
                    </span>
                  )},
                ]}
                data={data.cameras}
                onEdit={(item) => setModal({ open: true, type: "camera", item })}
                onDelete={(item) => deleteItem("cameras", item.id)}
                emptyMessage="No hay cámaras registradas. Importa un CSV o agrega manualmente."
              />
            </div>
          )}

          {/* ============ RACKS ============ */}
          {activeSection === "racks" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <Btn icon={Icons.plus} onClick={() => setModal({ open: true, type: "rack", item: null })}>Nuevo Rack</Btn>
              </div>
              <DataTable
                columns={[
                  { key: "name", label: "Nombre" },
                  { key: "location", label: "Ubicación" },
                  { key: "buildingId", label: "Edificio", render: (v) => { const b = data.buildings.find(b => b.id === v); return b ? b.name : "—"; } },
                  { key: "floor", label: "Piso" },
                  { key: "capacity", label: "Capacidad U", mono: true },
                  { key: "id", label: "Equipos", render: (_, row) => {
                    const cams = data.cameras.filter(c => c.rackId === row.id).length;
                    const sws = data.switches.filter(s => s.rackId === row.id).length;
                    return <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{sws} sw / {cams} cam</span>;
                  }},
                ]}
                data={data.racks}
                onEdit={(item) => setModal({ open: true, type: "rack", item })}
                onDelete={(item) => deleteItem("racks", item.id)}
                emptyMessage="No hay racks configurados."
              />
            </div>
          )}

          {/* ============ SWITCHES ============ */}
          {activeSection === "switches" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <Btn icon={Icons.plus} onClick={() => setModal({ open: true, type: "switch", item: null })}>Nuevo Switch</Btn>
              </div>
              <DataTable
                columns={[
                  { key: "name", label: "Nombre" },
                  { key: "model", label: "Modelo", mono: true },
                  { key: "ip", label: "IP", mono: true, accent: true },
                  { key: "ports", label: "Puertos", mono: true },
                  { key: "poe", label: "PoE", render: (v) => v ? "Sí" : "No" },
                  { key: "rackId", label: "Rack", render: (v) => { const r = data.racks.find(r => r.id === v); return r ? r.name : "—"; } },
                  { key: "uplink", label: "Uplink" },
                ]}
                data={data.switches}
                onEdit={(item) => setModal({ open: true, type: "switch", item })}
                onDelete={(item) => deleteItem("switches", item.id)}
                emptyMessage="No hay switches configurados."
              />
            </div>
          )}

          {/* ============ GRABADORES ============ */}
          {activeSection === "nvrs" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <Btn icon={Icons.plus} onClick={() => setModal({ open: true, type: "nvr", item: null })}>Nuevo Grabador</Btn>
              </div>
              <DataTable
                columns={[
                  { key: "name", label: "Nombre" },
                  { key: "type", label: "Tipo", render: (v) => <span style={{ color: "#a78bfa", fontWeight: 600, fontSize: "11px" }}>{v || "NVR"}</span> },
                  { key: "model", label: "Modelo", mono: true },
                  { key: "nics", label: "IPs", render: (v) => {
                    if (!v || !Array.isArray(v)) return "—";
                    return v.map((n, i) => <span key={i} style={{ display: "block", fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#22d3ee" }}>{n.ip}</span>);
                  }},
                  { key: "channels", label: "Canales", mono: true },
                  { key: "disks", label: "Discos", render: (v) => {
                    if (!v || !Array.isArray(v) || v.length === 0) return "—";
                    return <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>{v.length}x ({v.map(d => d.size).join(", ")})</span>;
                  }},
                  { key: "rackId", label: "Rack", render: (v) => { const r = data.racks.find(r => r.id === v); return r ? r.name : "—"; } },
                ]}
                data={data.nvrs}
                onEdit={(item) => setModal({ open: true, type: "nvr", item })}
                onDelete={(item) => deleteItem("nvrs", item.id)}
                emptyMessage="No hay grabadores configurados."
              />
            </div>
          )}

          {/* ============ ROUTERS ============ */}
          {activeSection === "routers" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <Btn icon={Icons.plus} onClick={() => setModal({ open: true, type: "router", item: null })}>Nuevo Router</Btn>
              </div>
              <DataTable
                columns={[
                  { key: "name", label: "Nombre" },
                  { key: "model", label: "Modelo", mono: true },
                  { key: "lanIp", label: "LAN IP", mono: true, accent: true },
                  { key: "wanIp", label: "WAN IP", mono: true, accent: true },
                  { key: "rackId", label: "Rack", render: (v) => { const r = data.racks.find(r => r.id === v); return r ? r.name : "—"; } },
                  { key: "interfaces", label: "Interfaces" },
                ]}
                data={data.routers}
                onEdit={(item) => setModal({ open: true, type: "router", item })}
                onDelete={(item) => deleteItem("routers", item.id)}
                emptyMessage="No hay routers configurados."
              />
            </div>
          )}

          {/* ============ BUILDINGS ============ */}
          {activeSection === "buildings" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <Btn icon={Icons.plus} onClick={() => setModal({ open: true, type: "building", item: null })}>Nuevo Edificio</Btn>
              </div>
              <DataTable
                columns={[
                  { key: "name", label: "Nombre" },
                  { key: "floors", label: "Pisos", mono: true },
                  { key: "id", label: "Racks", render: (_, row) => {
                    return data.racks.filter(r => r.buildingId === row.id).length;
                  }},
                ]}
                data={data.buildings}
                onEdit={(item) => setModal({ open: true, type: "building", item })}
                onDelete={(item) => deleteItem("buildings", item.id)}
                emptyMessage="No hay edificios configurados."
              />
            </div>
          )}

          {/* ============ PATCH PANELS ============ */}
          {activeSection === "patchPanels" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <Btn icon={Icons.plus} onClick={() => setModal({ open: true, type: "patchPanel", item: null })}>Nuevo Patch Panel</Btn>
              </div>
              <DataTable
                columns={[
                  { key: "name", label: "Nombre" },
                  { key: "ports", label: "Puertos", mono: true },
                  { key: "type", label: "Tipo" },
                  { key: "rackId", label: "Rack", render: (v) => { const r = data.racks.find(r => r.id === v); return r ? r.name : "—"; } },
                  { key: "cableRoute", label: "Ruta Cableado" },
                ]}
                data={data.patchPanels}
                onEdit={(item) => setModal({ open: true, type: "patchPanel", item })}
                onDelete={(item) => deleteItem("patchPanels", item.id)}
                emptyMessage="No hay patch panels configurados."
              />
            </div>
          )}

          {/* ============ TOPOLOGY ============ */}
          {activeSection === "topology" && (() => {
            const getGroupStatus = (cams) => {
              if (cams.length === 0) return "empty";
              const online = cams.filter(c => c.status !== "offline").length;
              if (online === cams.length) return "ok";
              if (online === 0) return "down";
              return "partial";
            };
            const statusBorder = (status) => ({
              ok: "rgba(16,185,129,0.5)", partial: "rgba(245,158,11,0.5)", down: "rgba(239,68,68,0.5)", empty: "rgba(30,41,59,1)"
            }[status] || "#1e293b");
            const statusDot = (status) => ({
              ok: "#10b981", partial: "#f59e0b", down: "#ef4444", empty: "#475569"
            }[status] || "#475569");

            const topoContent = (
              <div style={{ position: "relative", minHeight: "500px" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
                      {[{ label: "Online", color: "#10b981" }, { label: "Parcial", color: "#f59e0b" }, { label: "Offline", color: "#ef4444" }].map(s => (
                        <span key={s.label} style={{ display: "flex", alignItems: "center", gap: "4px", color: "#94a3b8" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: s.color }} />{s.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Btn variant="secondary" size="sm" onClick={() => setTopoFullscreen(!topoFullscreen)}>
                    {topoFullscreen ? "Salir" : "Pantalla completa"}
                  </Btn>
                </div>

                {/* SVG Connection Lines */}
                <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
                  <defs>
                    <linearGradient id="flowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                      <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.6" />
                    </linearGradient>
                    <style>{`
                      @keyframes flowDash { to { stroke-dashoffset: -20; } }
                      .flow-line { stroke-dasharray: 8 4; animation: flowDash 1.5s linear infinite; }
                    `}</style>
                  </defs>
                </svg>

                {/* WAN / Router tier */}
                {data.routers.length > 0 && (
                  <div style={{ marginBottom: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#475569", marginBottom: "8px" }}>WAN / Core</div>
                    <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                      {data.routers.map(r => (
                        <div key={r.id} style={{ background: "#141c2b", border: `2px solid rgba(59,130,246,0.4)`, borderRadius: "10px", padding: "14px 18px", minWidth: "220px", position: "relative", zIndex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(59,130,246,0.15)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800 }}>R</div>
                            <div><div style={{ fontSize: "13px", fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: "10px", color: "#64748b" }}>{r.model}</div></div>
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#94a3b8", lineHeight: 1.6 }}>
                            LAN: <span style={{ color: "#22d3ee" }}>{r.lanIp || "—"}</span><br/>
                            WAN: <span style={{ color: "#f59e0b" }}>{r.wanIp || "—"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Animated connection line */}
                <div style={{ display: "flex", justifyContent: "center", padding: "2px 0", position: "relative", zIndex: 1 }}>
                  <div style={{ width: "3px", height: "28px", background: "linear-gradient(180deg, #3b82f6, #8b5cf6)", borderRadius: "2px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", width: "100%", height: "6px", background: "rgba(255,255,255,0.4)", borderRadius: "3px", animation: "flowDown 1.5s linear infinite" }} />
                  </div>
                </div>
                <style>{`@keyframes flowDown { 0% { top: -6px; } 100% { top: 28px; } }`}</style>

                {/* NVR / Grabadores tier */}
                {data.nvrs.length > 0 && (
                  <div style={{ marginBottom: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#475569", marginBottom: "8px" }}>Grabadores</div>
                    <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                      {data.nvrs.map(n => {
                        const nvrCams = data.cameras.filter(c => c.nvrId === n.id);
                        const status = getGroupStatus(nvrCams);
                        return (
                          <div key={n.id} style={{ background: "#141c2b", border: `2px solid ${statusBorder(status)}`, borderRadius: "10px", padding: "14px 18px", minWidth: "240px", position: "relative", zIndex: 1, transition: "border-color 0.3s" }}>
                            <div style={{ position: "absolute", top: "8px", right: "10px", width: "8px", height: "8px", borderRadius: "50%", background: statusDot(status) }} />
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(139,92,246,0.15)", color: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800 }}>{n.type || "NVR"}</div>
                              <div><div style={{ fontSize: "13px", fontWeight: 700 }}>{n.name}</div><div style={{ fontSize: "10px", color: "#64748b" }}>{n.model}</div></div>
                            </div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#94a3b8", lineHeight: 1.6 }}>
                              {(n.nics || []).map((nic, i) => <div key={i}>{nic.label}: <span style={{ color: "#22d3ee" }}>{nic.ip || "—"}</span></div>)}
                              <span style={{ color: "#10b981" }}>{nvrCams.length} / {n.channels} ch</span>
                              {n.disks && n.disks.length > 0 && <span style={{ color: "#64748b" }}> — {n.disks.length}x HDD</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Animated connection line */}
                <div style={{ display: "flex", justifyContent: "center", padding: "2px 0", position: "relative", zIndex: 1 }}>
                  <div style={{ width: "3px", height: "28px", background: "linear-gradient(180deg, #8b5cf6, #06b6d4)", borderRadius: "2px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", width: "100%", height: "6px", background: "rgba(255,255,255,0.4)", borderRadius: "3px", animation: "flowDown 1.5s linear infinite" }} />
                  </div>
                </div>

                {/* Horizontal bus line for switches */}
                {data.switches.length > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "4px", position: "relative", zIndex: 1 }}>
                    <div style={{ width: `${Math.min(data.switches.length * 220, 900)}px`, height: "3px", background: "linear-gradient(90deg, transparent, #06b6d4, transparent)", borderRadius: "2px", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", width: "20px", height: "100%", background: "rgba(255,255,255,0.5)", borderRadius: "3px", animation: "flowRight 2s linear infinite" }} />
                    </div>
                  </div>
                )}
                <style>{`@keyframes flowRight { 0% { left: -20px; } 100% { left: 100%; } }`}</style>

                {/* Switch tier */}
                {data.switches.length > 0 && (
                  <div style={{ marginBottom: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#475569", marginBottom: "8px" }}>Switches</div>
                    <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                      {data.switches.map(s => {
                        const swCams = data.cameras.filter(c => c.switchId === s.id);
                        const status = getGroupStatus(swCams);
                        return (
                          <div key={s.id} style={{ background: "#141c2b", border: `2px solid ${statusBorder(status)}`, borderRadius: "10px", padding: "12px 16px", minWidth: "180px", position: "relative", zIndex: 1, transition: "border-color 0.3s" }}>
                            <div style={{ position: "absolute", top: "8px", right: "10px", width: "8px", height: "8px", borderRadius: "50%", background: statusDot(status) }} />
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                              <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(6,182,212,0.15)", color: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800 }}>SW</div>
                              <div><div style={{ fontSize: "12px", fontWeight: 700 }}>{s.name}</div><div style={{ fontSize: "10px", color: "#64748b" }}>{s.model}</div></div>
                            </div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#94a3b8" }}>
                              <span style={{ color: "#22d3ee" }}>{s.ip || "—"}</span> — {s.ports}p {s.poe ? "PoE" : ""}
                              <br/><span style={{ color: "#10b981" }}>{swCams.length} cámaras</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Vertical drop lines to cameras */}
                <div style={{ display: "flex", justifyContent: "center", padding: "2px 0", position: "relative", zIndex: 1 }}>
                  <div style={{ width: "3px", height: "28px", background: "linear-gradient(180deg, #06b6d4, #10b981)", borderRadius: "2px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", width: "100%", height: "6px", background: "rgba(255,255,255,0.4)", borderRadius: "3px", animation: "flowDown 1.5s linear infinite" }} />
                  </div>
                </div>

                {/* Camera tier by rack */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#475569", marginBottom: "8px" }}>Cámaras por Rack</div>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                    {data.racks.map(rack => {
                      const cams = data.cameras.filter(c => c.rackId === rack.id);
                      const status = getGroupStatus(cams);
                      return (
                        <div key={rack.id} style={{ background: "#141c2b", border: `2px solid ${statusBorder(status)}`, borderRadius: "10px", padding: "12px 16px", minWidth: "200px", maxWidth: "280px", position: "relative", zIndex: 1, transition: "border-color 0.3s" }}>
                          <div style={{ position: "absolute", top: "8px", right: "10px", width: "8px", height: "8px", borderRadius: "50%", background: statusDot(status) }} />
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#10b981", marginBottom: "6px" }}>
                            {rack.name} <span style={{ fontSize: "10px", fontWeight: 400, color: "#64748b" }}>({cams.length})</span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                            {cams.length === 0 ? (
                              <span style={{ fontSize: "10px", color: "#475569" }}>Sin cámaras</span>
                            ) : cams.slice(0, 16).map(c => (
                              <span key={c.id} style={{
                                fontSize: "9px", padding: "2px 5px", borderRadius: "3px",
                                background: c.status === "offline" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.1)",
                                border: `1px solid ${c.status === "offline" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.2)"}`,
                                color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace"
                              }}>{c.name || c.ip || `CH${c.channel}`}</span>
                            ))}
                            {cams.length > 16 && <span style={{ fontSize: "9px", color: "#475569", padding: "2px" }}>+{cams.length - 16}</span>}
                          </div>
                        </div>
                      );
                    })}
                    {/* Unassigned */}
                    {(() => {
                      const unassigned = data.cameras.filter(c => !c.rackId);
                      if (unassigned.length === 0) return null;
                      const status = getGroupStatus(unassigned);
                      return (
                        <div style={{ background: "#141c2b", border: `2px solid ${statusBorder(status)}`, borderRadius: "10px", padding: "12px 16px", minWidth: "200px", maxWidth: "280px", position: "relative", zIndex: 1 }}>
                          <div style={{ position: "absolute", top: "8px", right: "10px", width: "8px", height: "8px", borderRadius: "50%", background: statusDot(status) }} />
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#f59e0b", marginBottom: "6px" }}>
                            Sin Rack <span style={{ fontSize: "10px", fontWeight: 400, color: "#64748b" }}>({unassigned.length})</span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                            {unassigned.slice(0, 16).map(c => (
                              <span key={c.id} style={{
                                fontSize: "9px", padding: "2px 5px", borderRadius: "3px",
                                background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
                                color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace"
                              }}>{c.name || c.ip || `CH${c.channel}`}</span>
                            ))}
                            {unassigned.length > 16 && <span style={{ fontSize: "9px", color: "#475569", padding: "2px" }}>+{unassigned.length - 16}</span>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );

            if (data.routers.length === 0 && data.nvrs.length === 0 && data.switches.length === 0) {
              return (
                <div style={{ background: "#141c2b", border: "1px solid #1e293b", borderRadius: "12px", padding: "40px", textAlign: "center" }}>
                  <h3 style={{ fontSize: "16px", color: "#94a3b8", marginBottom: "8px" }}>Sin datos para topología</h3>
                  <p style={{ fontSize: "13px", color: "#475569" }}>Agrega routers, grabadores y switches para generar el diagrama.</p>
                </div>
              );
            }

            return topoFullscreen ? (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#0a0e17", zIndex: 9999, overflow: "auto", padding: "24px" }}>
                {topoContent}
              </div>
            ) : topoContent;
          })()}

          {/* ============ REPORTS ============ */}
          {activeSection === "reports" && (
            <div style={{ maxWidth: "700px" }}>
              <div style={{ background: "#141c2b", border: "1px solid #1e293b", borderRadius: "10px", padding: "24px", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px", color: "#94a3b8" }}>Informes PDF</h3>
                <p style={{ fontSize: "12px", color: "#475569", marginBottom: "20px" }}>Genera documentación profesional para entregar a tus clientes.</p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Inventario Completo */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>Inventario Completo</div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Cámaras, grabadores, switches, racks, patch panels</div>
                    </div>
                    <Btn variant="primary" size="sm" icon={Icons.download} onClick={() => generatePDF("full")}>Generar</Btn>
                  </div>

                  {/* Por Rack */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>Informe por Rack</div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Detalle de equipos agrupados por rack</div>
                    </div>
                    <Btn variant="primary" size="sm" icon={Icons.download} onClick={() => generatePDF("racks")}>Generar</Btn>
                  </div>

                  {/* Cámaras */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>Listado de Cámaras</div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Tabla resumida: canal, IP, modelo, grabador</div>
                    </div>
                    <Btn variant="primary" size="sm" icon={Icons.download} onClick={() => generatePDF("cameras")}>Generar</Btn>
                  </div>

                  {/* Detalle por Cámara */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>Ficha Técnica por Cámara</div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Detalle individual: ubicación, ruta cableado, PP, switch, serie, MAC</div>
                    </div>
                    <Btn variant="primary" size="sm" icon={Icons.download} onClick={() => generatePDF("cameraDetail")}>Generar</Btn>
                  </div>

                  {/* Grabadores */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>Grabadores y Almacenamiento</div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Tipo, modelo, IPs, canales, discos</div>
                    </div>
                    <Btn variant="primary" size="sm" icon={Icons.download} onClick={() => generatePDF("nvrs")}>Generar</Btn>
                  </div>

                  {/* Red / Switches */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>Infraestructura de Red</div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Routers, switches, patch panels, cableado</div>
                    </div>
                    <Btn variant="primary" size="sm" icon={Icons.download} onClick={() => generatePDF("network")}>Generar</Btn>
                  </div>

                  {/* Conflictos */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>Reporte de Conflictos</div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>IPs duplicadas, puertos, canales, advertencias</div>
                    </div>
                    <Btn variant="primary" size="sm" icon={Icons.download} onClick={() => generatePDF("conflicts")}>Generar</Btn>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============ SETTINGS ============ */}
          {activeSection === "settings" && (
            <div style={{ maxWidth: "600px" }}>
              <div style={{ background: "#141c2b", border: "1px solid #1e293b", borderRadius: "10px", padding: "24px", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "16px", color: "#94a3b8" }}>Datos del Sitio</h3>
                <Field label="Nombre del sitio" value={data.site.name} onChange={v => update("site", { ...data.site, name: v })} />
                <Field label="Dirección" value={data.site.address} onChange={v => update("site", { ...data.site, address: v })} />
                <Field label="Contacto" value={data.site.contact} onChange={v => update("site", { ...data.site, contact: v })} />
                <Field label="Teléfono" value={data.site.phone} onChange={v => update("site", { ...data.site, phone: v })} />
                <Field label="Email" value={data.site.email} onChange={v => update("site", { ...data.site, email: v })} />
              </div>

              {/* Network Segments Editor */}
              <div style={{ background: "#141c2b", border: "1px solid #1e293b", borderRadius: "10px", padding: "24px", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "16px", color: "#94a3b8" }}>Segmentos de Red</h3>
                <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "16px" }}>
                  Los segmentos se detectan automáticamente desde las IPs de los dispositivos. Puedes agregar segmentos manuales para etiquetar o añadir redes que no tienen dispositivos registrados.
                </p>
                {(() => {
                  const segments = data.site.networkSegments || [];
                  const segColors = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#14b8a6","#f97316","#6366f1"];

                  const addSeg = () => {
                    const newSegs = [...segments, { name: "", subnet: "", color: segColors[segments.length % segColors.length] }];
                    update("site", { ...data.site, networkSegments: newSegs });
                  };
                  const updateSeg = (idx, field, val) => {
                    const newSegs = segments.map((s, i) => i === idx ? { ...s, [field]: val } : s);
                    update("site", { ...data.site, networkSegments: newSegs });
                  };
                  const removeSeg = (idx) => {
                    const newSegs = segments.filter((_, i) => i !== idx);
                    update("site", { ...data.site, networkSegments: newSegs });
                  };
                  const saveSegs = async () => {
                    if (apiMode && siteId) {
                      try {
                        await api.put(`/api/sites/${siteId}/network-segments`, { segments: segments.map(s => ({ ...s, auto: false })) });
                        alert("Segmentos guardados correctamente");
                      } catch (e) { alert("Error al guardar: " + e.message); }
                    }
                  };

                  return (
                    <div>
                      {segments.map((seg, i) => (
                        <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                          <input type="color" value={seg.color || "#3b82f6"} onChange={e => updateSeg(i, "color", e.target.value)}
                            style={{ width: "32px", height: "32px", border: "1px solid #2a3550", borderRadius: "4px", background: "#0f172a", cursor: "pointer", padding: "2px" }} />
                          <input value={seg.name || ""} onChange={e => updateSeg(i, "name", e.target.value)} placeholder="Nombre (ej: LAN)"
                            style={{ flex: 1, padding: "6px 10px", background: "#0f172a", border: "1px solid #2a3550", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", outline: "none" }} />
                          <input value={seg.subnet || ""} onChange={e => updateSeg(i, "subnet", e.target.value)} placeholder="192.168.1.0/24"
                            style={{ width: "180px", padding: "6px 10px", background: "#0f172a", border: "1px solid #2a3550", borderRadius: "6px", color: "#22d3ee", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", outline: "none" }} />
                          <button onClick={() => removeSeg(i)}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}>
                            {Icons.trash}
                          </button>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <Btn variant="ghost" size="sm" icon={Icons.plus} onClick={addSeg}>Agregar Segmento</Btn>
                        <Btn variant="primary" size="sm" onClick={saveSegs}>Guardar Segmentos</Btn>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div style={{ background: "#141c2b", border: "1px solid #1e293b", borderRadius: "10px", padding: "24px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "16px", color: "#94a3b8" }}>Datos y Respaldo</h3>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <Btn variant="success" icon={Icons.download} onClick={() => {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = "netmanager_backup.json"; a.click();
                  }}>Exportar Respaldo</Btn>
                  <Btn variant="secondary" icon={Icons.upload} onClick={() => document.getElementById("json-import").click()}>Importar Respaldo</Btn>
                  <input id="json-import" type="file" accept=".json" style={{ display: "none" }}
                    onChange={e => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          try {
                            const imported = JSON.parse(ev.target.result);
                            setData(imported);
                          } catch { alert("Error al importar archivo"); }
                        };
                        reader.readAsText(file);
                      }
                      e.target.value = "";
                    }} />
                  <Btn variant="danger" onClick={() => {
                    if (confirm("¿Resetear todos los datos?")) setData({ ...DEFAULT_DATA });
                  }}>Resetear Datos</Btn>
                </div>
              </div>
            </div>
          )}

          {/* ============ ADMIN PANEL ============ */}
          {activeSection === "admin" && authUser?.role === "admin" && (
            <AdminPanel authToken={authToken} />
          )}
        </div>
      </div>

      {/* ============ MODALS ============ */}
      {/* Camera Modal */}
      <Modal isOpen={modal.open && modal.type === "camera"} onClose={() => setModal({ open: false })} title={modal.item ? "Editar Cámara" : "Nueva Cámara"}>
        <CameraForm
          item={modal.item}
          racks={data.racks}
          switches={data.switches}
          nvrs={data.nvrs}
          patchPanels={data.patchPanels}
          allCameras={data.cameras}
          onSave={(item) => {
            if (modal.item) editItem("cameras", modal.item.id, item);
            else addItem("cameras", item);
            setModal({ open: false });
          }}
        />
      </Modal>

      {/* Rack Modal */}
      <Modal isOpen={modal.open && modal.type === "rack"} onClose={() => setModal({ open: false })} title={modal.item ? "Editar Rack" : "Nuevo Rack"}>
        <RackForm item={modal.item} buildings={data.buildings} onSave={(item) => {
          if (modal.item) editItem("racks", modal.item.id, item);
          else addItem("racks", item);
          setModal({ open: false });
        }} />
      </Modal>

      {/* Switch Modal */}
      <Modal isOpen={modal.open && modal.type === "switch"} onClose={() => setModal({ open: false })} title={modal.item ? "Editar Switch" : "Nuevo Switch"}>
        <SwitchForm item={modal.item} racks={data.racks} onSave={(item) => {
          if (modal.item) editItem("switches", modal.item.id, item);
          else addItem("switches", item);
          setModal({ open: false });
        }} />
      </Modal>

      {/* NVR Modal */}
      <Modal isOpen={modal.open && modal.type === "nvr"} onClose={() => setModal({ open: false })} title={modal.item ? "Editar Grabador" : "Nuevo Grabador"}>
        <NVRForm item={modal.item} racks={data.racks} onSave={(item) => {
          if (modal.item) editItem("nvrs", modal.item.id, item);
          else addItem("nvrs", item);
          setModal({ open: false });
        }} />
      </Modal>

      {/* Router Modal */}
      <Modal isOpen={modal.open && modal.type === "router"} onClose={() => setModal({ open: false })} title={modal.item ? "Editar Router" : "Nuevo Router"}>
        <RouterForm item={modal.item} racks={data.racks} onSave={(item) => {
          if (modal.item) editItem("routers", modal.item.id, item);
          else addItem("routers", item);
          setModal({ open: false });
        }} />
      </Modal>

      {/* Building Modal */}
      <Modal isOpen={modal.open && modal.type === "building"} onClose={() => setModal({ open: false })} title={modal.item ? "Editar Edificio" : "Nuevo Edificio"}>
        <BuildingForm item={modal.item} onSave={(item) => {
          if (modal.item) editItem("buildings", modal.item.id, item);
          else addItem("buildings", item);
          setModal({ open: false });
        }} />
      </Modal>

      {/* Patch Panel Modal */}
      <Modal isOpen={modal.open && modal.type === "patchPanel"} onClose={() => setModal({ open: false })} title={modal.item ? "Editar Patch Panel" : "Nuevo Patch Panel"}>
        <PatchPanelForm item={modal.item} racks={data.racks} onSave={(item) => {
          if (modal.item) editItem("patchPanels", modal.item.id, item);
          else addItem("patchPanels", item);
          setModal({ open: false });
        }} />
      </Modal>

      {/* Bulk Create Modal */}
      <Modal isOpen={modal.open && modal.type === "bulkCreate"} onClose={() => setModal({ open: false })} title="Crear Cámaras Masivamente" width="560px">
        <BulkCreateForm
          nvrs={data.nvrs} racks={data.racks} switches={data.switches} patchPanels={data.patchPanels} allCameras={data.cameras}
          onSave={async (cameras) => {
            if (apiMode && siteId) {
              try {
                const body = { site_id: siteId, cameras: cameras.map(c => toBackend("cameras", c)) };
                const created = await api.post("/api/cameras/bulk", body);
                update("cameras", [...data.cameras, ...created.map(c => toFrontend("cameras", c))]);
                setModal({ open: false });
                return;
              } catch (e) { console.error("Bulk create API failed:", e); }
            }
            const newCams = cameras.map(c => ({ ...c, id: genId() }));
            update("cameras", [...data.cameras, ...newCams]);
            setModal({ open: false });
          }}
          onCancel={() => setModal({ open: false })}
        />
      </Modal>

      {/* Bulk Action Modal */}
      <Modal isOpen={bulkModal.open} onClose={() => setBulkModal({ open: false })} title={
        bulkModal.action === "nvr" ? `Asignar Grabador a ${selectedCameras.length} cámaras` :
        bulkModal.action === "rack" ? `Asignar Rack a ${selectedCameras.length} cámaras` :
        bulkModal.action === "switch" ? `Asignar Switch a ${selectedCameras.length} cámaras` :
        bulkModal.action === "patchPanel" ? `Asignar Patch Panel a ${selectedCameras.length} cámaras` :
        bulkModal.action === "location" ? `Asignar Ubicación a ${selectedCameras.length} cámaras` :
        bulkModal.action === "cableRoute" ? `Ruta de Cableado para ${selectedCameras.length} cámaras` :
        bulkModal.action === "camType" ? `Cambiar Tipo de ${selectedCameras.length} cámaras` :
        bulkModal.action === "status" ? `Cambiar Estado de ${selectedCameras.length} cámaras` : "Acción masiva"
      }>
        <BulkActionForm
          action={bulkModal.action}
          count={selectedCameras.length}
          nvrs={data.nvrs}
          racks={data.racks}
          switches={data.switches}
          patchPanels={data.patchPanels}
          onApply={(field, value) => bulkUpdateCameras(field, value)}
          onCancel={() => setBulkModal({ open: false })}
        />
      </Modal>

      {/* Report Preview Modal */}
      {reportHTML && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 10000, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", background: "#0f172a", borderBottom: "1px solid #1e293b" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0" }}>Vista previa del informe</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <Btn variant="primary" icon={Icons.download} onClick={() => {
                try {
                  const blob = new Blob([reportHTML], { type: "text/html;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url;
                  a.download = `informe_${data.site.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.html`;
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch(e) { /* fallback: copy to clipboard */ navigator.clipboard && navigator.clipboard.writeText(reportHTML); }
              }}>Descargar HTML</Btn>
              <Btn variant="success" onClick={() => {
                const frame = printFrameRef.current;
                if (frame) { frame.contentWindow.focus(); frame.contentWindow.print(); }
              }}>Imprimir / PDF</Btn>
              <Btn variant="ghost" onClick={() => setReportHTML(null)}>Cerrar</Btn>
            </div>
          </div>
          <div style={{ flex: 1, padding: "16px", display: "flex", justifyContent: "center", overflow: "auto", background: "#1e293b" }}>
            <iframe
              ref={printFrameRef}
              srcDoc={reportHTML}
              style={{ width: "100%", maxWidth: "900px", height: "100%", border: "none", borderRadius: "4px", background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
              title="Informe"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// ENTITY FORMS
// ============================================
function CameraForm({ item, racks, switches, nvrs, patchPanels, allCameras, onSave }) {
  const [form, setForm] = useState(item || { channel: "", name: "", ip: "", model: "", serial: "", mac: "", nvrId: "", rackId: "", switchId: "", patchPanelId: "", patchPanelPort: "", location: "", cableRoute: "", camType: "ip-net", status: "online" });
  const set = (k, v) => setForm({ ...form, [k]: v });

  // Validations
  const warnings = [];
  const errors = [];
  const otherCams = (allCameras || []).filter(c => c.id !== (item?.id));

  // IP duplicate check
  if (form.ip && form.camType !== "analog") {
    const dupes = otherCams.filter(c => c.ip === form.ip);
    if (dupes.length > 0) {
      const sameSegment = dupes.some(c => c.camType === form.camType);
      if (sameSegment) errors.push(`IP ${form.ip} ya asignada a "${dupes[0].name || 'CH' + dupes[0].channel}" en mismo segmento`);
      else warnings.push(`IP ${form.ip} duplicada pero en segmento diferente (${dupes[0].camType})`);
    }
  }

  // Channel duplicate on same NVR
  if (form.channel && form.nvrId) {
    const dupe = otherCams.find(c => c.channel === form.channel && c.nvrId === form.nvrId);
    if (dupe) errors.push(`Canal ${form.channel} ya asignado a "${dupe.name || dupe.ip}" en este NVR`);
  }

  // MAC duplicate
  if (form.mac) {
    const dupe = otherCams.find(c => c.mac && c.mac.toLowerCase() === form.mac.toLowerCase());
    if (dupe) errors.push(`MAC ${form.mac} ya asignada a "${dupe.name || dupe.ip}"`);
  }

  // No NVR and no IP = unmonitorable
  if (!form.nvrId && !form.ip && form.camType !== "analog") {
    warnings.push("Sin NVR ni IP: no se podrá monitorear esta cámara");
  }

  // Smart PP port options
  const selectedPP = patchPanels.find(p => p.id === form.patchPanelId);
  const ppPortOptions = selectedPP ? (() => {
    const totalPorts = parseInt(selectedPP.ports) || 24;
    const usedPorts = otherCams
      .filter(c => c.patchPanelId === form.patchPanelId && c.patchPanelPort)
      .reduce((acc, c) => { acc[c.patchPanelPort] = c.name || c.ip || `CH${c.channel}`; return acc; }, {});
    const options = [];
    for (let i = 1; i <= totalPorts; i++) {
      const portStr = String(i);
      const occupant = usedPorts[portStr];
      options.push({
        value: portStr,
        label: occupant ? `${i} — ${occupant}` : String(i),
        disabled: !!occupant
      });
    }
    return options;
  })() : null;

  return (
    <div>
      {errors.length > 0 && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px" }}>
          {errors.map((e, i) => <div key={i} style={{ fontSize: "12px", color: "#fca5a5", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />{e}
          </div>)}
        </div>
      )}
      {warnings.length > 0 && (
        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px" }}>
          {warnings.map((w, i) => <div key={i} style={{ fontSize: "12px", color: "#fcd34d", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />{w}
          </div>)}
        </div>
      )}
      <Field label="Tipo de cámara" value={form.camType} onChange={v => set("camType", v)} options={[
        { value: "ip-net", label: "IP (Red/Switch)" },
        { value: "ip-poe-nvr", label: "IP (PoE NVR)" },
        { value: "analog", label: "Analógica" },
      ]} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Field label="Canal" value={form.channel} onChange={v => set("channel", v)} />
        <Field label="Nombre" value={form.name} onChange={v => set("name", v)} required />
        {form.camType !== "analog" && (
          <Field label="Dirección IP" value={form.ip} onChange={v => set("ip", v)} placeholder="192.168.1.x" required />
        )}
        <Field label="Modelo" value={form.model} onChange={v => set("model", v)} />
        {form.camType !== "analog" && (
          <>
            <Field label="Número de Serie" value={form.serial} onChange={v => set("serial", v)} />
            <Field label="Dirección MAC" value={form.mac} onChange={v => set("mac", v)} />
          </>
        )}
      </div>
      <Field label="Grabador" value={form.nvrId} onChange={v => set("nvrId", v)} options={nvrs.map(n => ({ value: n.id, label: `${n.type || "NVR"} - ${n.name}` }))} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Field label="Rack" value={form.rackId} onChange={v => { setForm(f => ({ ...f, rackId: v, switchId: "", patchPanelId: "", patchPanelPort: "" })); }} options={racks.map(r => ({ value: r.id, label: r.name }))} />
        <Field label="Switch" value={form.switchId} onChange={v => set("switchId", v)} options={switches.filter(s => !form.rackId || s.rackId === form.rackId).map(s => ({ value: s.id, label: s.name }))} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0 12px" }}>
        <Field label="Patch Panel" value={form.patchPanelId} onChange={v => { set("patchPanelId", v); setForm(f => ({ ...f, patchPanelId: v, patchPanelPort: "" })); }}
          options={patchPanels.filter(p => !form.rackId || p.rackId === form.rackId).map(p => ({ value: p.id, label: p.name }))} />
        {ppPortOptions ? (
          <Field label="Puerto PP" value={form.patchPanelPort} onChange={v => set("patchPanelPort", v)}
            options={ppPortOptions.filter(o => !o.disabled || o.value === form.patchPanelPort).map(o => ({
              value: o.value,
              label: o.disabled && o.value !== form.patchPanelPort ? `${o.label} (ocupado)` : o.label
            }))} />
        ) : (
          <Field label="Puerto PP" value={form.patchPanelPort} onChange={v => set("patchPanelPort", v)} placeholder="Seleccione PP" />
        )}
      </div>
      <Field label="Ubicación física" value={form.location} onChange={v => set("location", v)} placeholder="Ej: Pasillo piso 2, sector norte" />
      <Field label="Ruta de cableado" value={form.cableRoute} onChange={v => set("cableRoute", v)} type="textarea" placeholder="Ej: Cámara → PP-Sala8 :12 → SW-Sala8 :12. O: Cámara → directo NVR NIC1 :3" />
      <Field label="Estado" value={form.status} onChange={v => set("status", v)} options={[{ value: "online", label: "Online" }, { value: "offline", label: "Offline" }]} />
      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        <Btn variant="primary" onClick={() => onSave(form)} disabled={errors.length > 0}>Guardar</Btn>
      </div>
    </div>
  );
}

function RackForm({ item, buildings, onSave }) {
  const [form, setForm] = useState(item || { name: "", location: "", buildingId: "", floor: "", capacity: "42" });
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div>
      <Field label="Nombre" value={form.name} onChange={v => set("name", v)} required />
      <Field label="Ubicación" value={form.location} onChange={v => set("location", v)} placeholder="Ej: Sala Biblioteca" />
      <Field label="Edificio" value={form.buildingId} onChange={v => set("buildingId", v)} options={buildings.map(b => ({ value: b.id, label: b.name }))} />
      <Field label="Piso" value={form.floor} onChange={v => set("floor", v)} />
      <Field label="Capacidad (U)" value={form.capacity} onChange={v => set("capacity", v)} type="number" />
      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={() => onSave(form)}>Guardar</Btn>
      </div>
    </div>
  );
}

function SwitchForm({ item, racks, onSave }) {
  const [form, setForm] = useState(item || { name: "", model: "", ip: "", ports: "24", poe: true, rackId: "", uplink: "" });
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div>
      <Field label="Nombre" value={form.name} onChange={v => set("name", v)} required />
      <Field label="Modelo" value={form.model} onChange={v => set("model", v)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Field label="IP de gestión" value={form.ip} onChange={v => set("ip", v)} />
        <Field label="Puertos" value={form.ports} onChange={v => set("ports", v)} type="number" />
      </div>
      <Field label="PoE" value={form.poe ? "true" : "false"} onChange={v => set("poe", v === "true")} options={[{ value: "true", label: "Sí" }, { value: "false", label: "No" }]} />
      <Field label="Rack" value={form.rackId} onChange={v => set("rackId", v)} options={racks.map(r => ({ value: r.id, label: r.name }))} />
      <Field label="Uplink a" value={form.uplink} onChange={v => set("uplink", v)} placeholder="Ej: SW-Core puerto 48" />
      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={() => onSave(form)}>Guardar</Btn>
      </div>
    </div>
  );
}

function NVRForm({ item, racks, onSave }) {
  const [form, setForm] = useState(item || { name: "", type: "NVR", model: "", nics: [{ label: "NIC1", ip: "" }], channels: "16", disks: [], rackId: "" });
  const set = (k, v) => setForm({ ...form, [k]: v });
  const addNic = () => setForm({ ...form, nics: [...(form.nics || []), { label: `NIC${(form.nics?.length || 0) + 1}`, ip: "" }] });
  const removeNic = (i) => setForm({ ...form, nics: form.nics.filter((_, idx) => idx !== i) });
  const updateNic = (i, field, val) => { const n = [...form.nics]; n[i] = { ...n[i], [field]: val }; setForm({ ...form, nics: n }); };
  const addDisk = () => setForm({ ...form, disks: [...(form.disks || []), { size: "1TB", status: "ok" }] });
  const removeDisk = (i) => setForm({ ...form, disks: form.disks.filter((_, idx) => idx !== i) });
  const updateDisk = (i, field, val) => { const d = [...form.disks]; d[i] = { ...d[i], [field]: val }; setForm({ ...form, disks: d }); };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Field label="Nombre" value={form.name} onChange={v => set("name", v)} required />
        <Field label="Tipo" value={form.type} onChange={v => set("type", v)} options={[
          { value: "NVR", label: "NVR (IP)" },
          { value: "DVR", label: "DVR (Analógico)" },
          { value: "XVR", label: "XVR (Híbrido)" },
          { value: "HCVR", label: "HCVR (HD-CVI)" },
        ]} />
      </div>
      <Field label="Modelo" value={form.model} onChange={v => set("model", v)} />
      <Field label="Canales" value={form.channels} onChange={v => set("channels", v)} type="number" />
      <Field label="Rack" value={form.rackId} onChange={v => set("rackId", v)} options={racks.map(r => ({ value: r.id, label: r.name }))} />

      {/* NICs */}
      <div style={{ marginTop: "12px", marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Interfaces de red</label>
          <Btn variant="ghost" size="sm" icon={Icons.plus} onClick={addNic}>NIC</Btn>
        </div>
        {(form.nics || []).map((nic, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0 8px", alignItems: "end", marginBottom: "6px" }}>
            <Field label="" value={nic.label} onChange={v => updateNic(i, "label", v)} placeholder="Etiqueta" />
            <Field label="" value={nic.ip} onChange={v => updateNic(i, "ip", v)} placeholder="IP" />
            <div style={{ paddingBottom: "14px" }}><Btn variant="danger" size="sm" icon={Icons.trash} onClick={() => removeNic(i)} /></div>
          </div>
        ))}
      </div>

      {/* Disks */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Discos de grabación</label>
          <Btn variant="ghost" size="sm" icon={Icons.plus} onClick={addDisk}>Disco</Btn>
        </div>
        {(form.disks || []).map((disk, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0 8px", alignItems: "end", marginBottom: "6px" }}>
            <Field label="" value={disk.size} onChange={v => updateDisk(i, "size", v)} placeholder="Capacidad" options={[
              { value: "500GB", label: "500 GB" }, { value: "1TB", label: "1 TB" }, { value: "2TB", label: "2 TB" },
              { value: "3TB", label: "3 TB" }, { value: "4TB", label: "4 TB" }, { value: "6TB", label: "6 TB" },
              { value: "8TB", label: "8 TB" }, { value: "10TB", label: "10 TB" }, { value: "12TB", label: "12 TB" },
            ]} />
            <Field label="" value={disk.status} onChange={v => updateDisk(i, "status", v)} options={[
              { value: "ok", label: "OK" }, { value: "degraded", label: "Degradado" }, { value: "failed", label: "Fallido" },
            ]} />
            <div style={{ paddingBottom: "14px" }}><Btn variant="danger" size="sm" icon={Icons.trash} onClick={() => removeDisk(i)} /></div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={() => onSave(form)}>Guardar</Btn>
      </div>
    </div>
  );
}

function RouterForm({ item, racks, onSave }) {
  const [form, setForm] = useState(item || { name: "", model: "", lanIp: "", wanIp: "", rackId: "", interfaces: "" });
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div>
      <Field label="Nombre" value={form.name} onChange={v => set("name", v)} required />
      <Field label="Modelo" value={form.model} onChange={v => set("model", v)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Field label="LAN IP" value={form.lanIp} onChange={v => set("lanIp", v)} />
        <Field label="WAN IP" value={form.wanIp} onChange={v => set("wanIp", v)} />
      </div>
      <Field label="Rack" value={form.rackId} onChange={v => set("rackId", v)} options={racks.map(r => ({ value: r.id, label: r.name }))} />
      <Field label="Interfaces" value={form.interfaces} onChange={v => set("interfaces", v)} placeholder="Ej: ether1-WAN, Bridge Don Bosco" />
      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={() => onSave(form)}>Guardar</Btn>
      </div>
    </div>
  );
}

function BuildingForm({ item, onSave }) {
  const [form, setForm] = useState(item || { name: "", floors: "1" });
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div>
      <Field label="Nombre" value={form.name} onChange={v => set("name", v)} required />
      <Field label="Número de pisos" value={form.floors} onChange={v => set("floors", v)} type="number" />
      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={() => onSave(form)}>Guardar</Btn>
      </div>
    </div>
  );
}

function PatchPanelForm({ item, racks, onSave }) {
  const [form, setForm] = useState(item || { name: "", ports: "24", type: "Cat6", rackId: "", cableRoute: "" });
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div>
      <Field label="Nombre" value={form.name} onChange={v => set("name", v)} required />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Field label="Puertos" value={form.ports} onChange={v => set("ports", v)} type="number" />
        <Field label="Tipo" value={form.type} onChange={v => set("type", v)} options={[
          { value: "Cat5e", label: "Cat5e" }, { value: "Cat6", label: "Cat6" },
          { value: "Cat6a", label: "Cat6a" }, { value: "Fibra", label: "Fibra Óptica" }
        ]} />
      </div>
      <Field label="Rack" value={form.rackId} onChange={v => set("rackId", v)} options={racks.map(r => ({ value: r.id, label: r.name }))} />
      <Field label="Ruta de cableado" value={form.cableRoute} onChange={v => set("cableRoute", v)} type="textarea" placeholder="Describe la ruta física del cableado..." />
      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={() => onSave(form)}>Guardar</Btn>
      </div>
    </div>
  );
}

function BulkActionForm({ action, count, nvrs, racks, switches, patchPanels, onApply, onCancel }) {
  const [value, setValue] = useState("");

  const getConfig = () => {
    switch (action) {
      case "nvr": return { field: "nvrId", label: "Grabador", options: nvrs.map(n => ({ value: n.id, label: `${n.type || "NVR"} - ${n.name}` })) };
      case "rack": return { field: "rackId", label: "Rack", options: racks.map(r => ({ value: r.id, label: r.name })) };
      case "switch": return { field: "switchId", label: "Switch", options: switches.map(s => ({ value: s.id, label: s.name })) };
      case "patchPanel": return { field: "patchPanelId", label: "Patch Panel", options: patchPanels.map(p => ({ value: p.id, label: p.name })) };
      case "location": return { field: "location", label: "Ubicación", options: null };
      case "cableRoute": return { field: "cableRoute", label: "Ruta de Cableado", options: null, textarea: true };
      case "camType": return { field: "camType", label: "Tipo de Cámara", options: [
        { value: "ip-net", label: "IP (Red/Switch)" },
        { value: "ip-poe-nvr", label: "IP (PoE NVR)" },
        { value: "analog", label: "Analógica" },
      ] };
      case "status": return { field: "status", label: "Estado", options: [{ value: "online", label: "Online" }, { value: "offline", label: "Offline" }] };
      default: return { field: "", label: "", options: null };
    }
  };

  const config = getConfig();

  return (
    <div>
      <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "16px" }}>
        Esta acción se aplicará a <strong style={{ color: "#60a5fa" }}>{count} cámaras</strong> seleccionadas.
      </p>
      {config.options ? (
        <Field label={config.label} value={value} onChange={setValue} options={config.options} />
      ) : (
        <Field label={config.label} value={value} onChange={setValue} type={config.textarea ? "textarea" : "text"} placeholder={`Ingrese ${config.label.toLowerCase()}...`} />
      )}
      <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
        <Btn variant="primary" onClick={() => onApply(config.field, value)} disabled={!value}>
          Aplicar a {count} cámaras
        </Btn>
      </div>
    </div>
  );
}

function BulkCreateForm({ nvrs, racks, switches, patchPanels, allCameras, onSave, onCancel }) {
  const [form, setForm] = useState({
    count: "16", camType: "ip-net", nvrId: "", rackId: "", switchId: "", patchPanelId: "",
    model: "", location: "", cableRoute: "", patchPanelPort: "",
    startChannel: "1", ipBase: "192.168.1", ipStart: "100", namePrefix: "CAM-"
  });
  const set = (k, v) => setForm({ ...form, [k]: v });
  const filteredPPs = patchPanels.filter(p => !form.rackId || p.rackId === form.rackId);
  const selectedPP = patchPanels.find(p => p.id === form.patchPanelId);
  const usedPorts = (allCameras || []).filter(c => c.patchPanelId === form.patchPanelId && c.patchPanelPort).map(c => parseInt(c.patchPanelPort));
  const totalPPPorts = selectedPP ? parseInt(selectedPP.ports) || 24 : 0;
  const ppPortOptions = selectedPP ? (() => {
    const opts = [];
    const count = parseInt(form.count) || 1;
    for (let i = 1; i <= totalPPPorts; i++) {
      const rangeAvail = (i + count - 1) <= totalPPPorts && !Array.from({ length: count }, (_, k) => i + k).some(p => usedPorts.includes(p));
      opts.push({ value: String(i), label: rangeAvail ? `${i} → ${i + count - 1} (${count} libres)` : usedPorts.includes(i) ? `${i} (ocupado)` : String(i), available: rangeAvail });
    }
    return opts;
  })() : null;
  const ppConflict = ppPortOptions && form.patchPanelPort && (() => {
    const start = parseInt(form.patchPanelPort);
    const count = parseInt(form.count) || 1;
    const conflicts = Array.from({ length: count }, (_, i) => start + i).filter(p => usedPorts.includes(p));
    return conflicts.length > 0 ? `Puertos ${conflicts.join(", ")} ya ocupados` : null;
  })();
  const handleCreate = () => {
    const count = parseInt(form.count) || 0;
    if (count < 1 || count > 128) return;
    const cameras = [];
    const ppStart = parseInt(form.patchPanelPort) || 0;
    for (let i = 0; i < count; i++) {
      const ch = parseInt(form.startChannel) + i;
      const port = ppStart > 0 ? ppStart + i : 0;
      cameras.push({
        channel: String(ch),
        name: form.namePrefix ? `${form.namePrefix}${String(ch).padStart(2, "0")}` : "",
        ip: form.camType !== "analog" ? `${form.ipBase.replace(/\.+$/, "")}.${parseInt(form.ipStart) + i}` : "",
        model: form.model, serial: "", mac: "",
        nvrId: form.nvrId, rackId: form.rackId, switchId: form.switchId,
        patchPanelId: form.patchPanelId,
        patchPanelPort: port > 0 && port <= totalPPPorts ? String(port) : "",
        location: form.location, cableRoute: form.cableRoute,
        camType: form.camType, status: "online"
      });
    }
    onSave(cameras);
  };
  return (
    <div>
      <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "8px", padding: "12px", marginBottom: "16px", fontSize: "12px", color: "#94a3b8" }}>
        Crea múltiples cámaras. Canales, IPs y puertos PP se asignan secuencialmente.
      </div>
      {ppConflict && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "12px", color: "#fca5a5" }}>{ppConflict}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Field label="Cantidad" value={form.count} onChange={v => set("count", v)} type="number" required />
        <Field label="Tipo" value={form.camType} onChange={v => set("camType", v)} options={[
          { value: "ip-net", label: "IP (Red/Switch)" }, { value: "ip-poe-nvr", label: "IP (PoE NVR)" }, { value: "analog", label: "Analógica" },
        ]} />
        <Field label="Canal inicial" value={form.startChannel} onChange={v => set("startChannel", v)} type="number" />
        <Field label="Prefijo nombre" value={form.namePrefix} onChange={v => set("namePrefix", v)} placeholder="CAM-" />
      </div>
      {form.camType !== "analog" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0 12px" }}>
          <Field label="Base IP (3 octetos)" value={form.ipBase} onChange={v => {
            const cleaned = v.replace(/[^0-9.]/g, "");
            const parts = cleaned.split(".");
            if (parts.length <= 3) set("ipBase", cleaned);
            else set("ipBase", parts.slice(0, 3).join(".") + ".");
          }} placeholder="192.168.1" />
          <Field label="Host inicial" value={form.ipStart} onChange={v => set("ipStart", v)} type="number" />
        </div>
      )}
      <Field label="Modelo" value={form.model} onChange={v => set("model", v)} />
      <Field label="Grabador" value={form.nvrId} onChange={v => set("nvrId", v)} options={nvrs.map(n => ({ value: n.id, label: `${n.type || "NVR"} - ${n.name}` }))} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <Field label="Rack" value={form.rackId} onChange={v => setForm(f => ({ ...f, rackId: v, patchPanelId: "", patchPanelPort: "" }))} options={racks.map(r => ({ value: r.id, label: r.name }))} />
        <Field label="Switch" value={form.switchId} onChange={v => set("switchId", v)} options={switches.map(s => ({ value: s.id, label: s.name }))} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0 12px" }}>
        <Field label="Patch Panel" value={form.patchPanelId} onChange={v => setForm(f => ({ ...f, patchPanelId: v, patchPanelPort: "" }))} options={filteredPPs.map(p => ({ value: p.id, label: p.name }))} />
        {ppPortOptions ? (
          <Field label="Puerto PP inicial" value={form.patchPanelPort} onChange={v => set("patchPanelPort", v)}
            options={ppPortOptions.filter(o => o.available).map(o => ({ value: o.value, label: o.label }))} />
        ) : (
          <Field label="Puerto PP inicial" value={form.patchPanelPort} onChange={v => set("patchPanelPort", v)} placeholder="Seleccione PP" />
        )}
      </div>
      <Field label="Ubicación" value={form.location} onChange={v => set("location", v)} />
      <div style={{ background: "#0f172a", borderRadius: "8px", padding: "12px", marginTop: "12px", marginBottom: "16px" }}>
        <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#64748b", marginBottom: "8px" }}>Vista previa</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#94a3b8", lineHeight: 1.8 }}>
          {(() => {
            const count = Math.min(parseInt(form.count) || 0, 5);
            const ppStart = parseInt(form.patchPanelPort) || 0;
            const lines = [];
            for (let i = 0; i < count; i++) {
              const ch = parseInt(form.startChannel) + i;
              const name = form.namePrefix ? `${form.namePrefix}${String(ch).padStart(2, "0")}` : `CH${ch}`;
              const ip = form.camType !== "analog" ? `${form.ipBase.replace(/\.+$/, "")}.${parseInt(form.ipStart) + i}` : "N/A";
              const port = ppStart > 0 ? ` PP:${ppStart + i}` : "";
              lines.push(<div key={i}>Ch {ch}: <span style={{ color: "#e2e8f0" }}>{name}</span> — <span style={{ color: "#22d3ee" }}>{ip}</span><span style={{ color: "#a78bfa" }}>{port}</span></div>);
            }
            if ((parseInt(form.count) || 0) > 5) lines.push(<div key="more" style={{ color: "#475569" }}>... y {parseInt(form.count) - 5} más</div>);
            return lines;
          })()}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
        <Btn variant="primary" onClick={handleCreate} disabled={!!ppConflict}>Crear {form.count} cámaras</Btn>
      </div>
    </div>
  );
}

window.__NetManagerApp = App;
