# NetManager — Guía de Despliegue en Easypanel

## Resumen

Vamos a:
1. Subir el código a un repositorio Git (GitHub)
2. Crear un proyecto en Easypanel
3. Configurar el servicio con Dockerfile
4. Montar volumen para persistir la base de datos SQLite
5. Asignar dominio `netmanager.redesycctv.cl`
6. SSL automático con Let's Encrypt

---

## PASO 1 — Subir código a GitHub

### 1.1 Crear repositorio

En GitHub, crear repositorio nuevo:
- Nombre: `netmanager`
- Visibilidad: Private (recomendado)
- No inicializar con README (ya tenemos archivos)

### 1.2 Subir archivos

Desde tu PC, en la carpeta donde descargaste los archivos del backend:

```bash
cd netmanager-backend

git init
git add .
git commit -m "NetManager backend v1.0"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/netmanager.git
git push -u origin main
```

Los archivos que deben estar en el repositorio:

```
netmanager/
├── Dockerfile
├── .dockerignore
├── requirements.txt
├── main.py
├── database.py
├── schemas.py
└── README.md
```

---

## PASO 2 — Crear proyecto en Easypanel

### 2.1 Acceder a Easypanel

Abrir tu panel en `https://TU_VPS_IP:3000` o el dominio que tengas configurado.

### 2.2 Crear proyecto

1. Click en **"+ New Project"**
2. Nombre del proyecto: `netmanager`
3. Click **"Create"**

---

## PASO 3 — Crear servicio App

### 3.1 Agregar servicio

Dentro del proyecto `netmanager`:

1. Click en **"+ Service"**
2. Seleccionar **"App"**
3. Nombre del servicio: `api`

### 3.2 Configurar fuente (Source)

En la pestaña **"Source"**:

1. Seleccionar **"GitHub"**
2. Si no has conectado GitHub:
   - Click en "Connect GitHub"
   - Autorizar Easypanel en tu cuenta de GitHub
3. Seleccionar repositorio: `TU_USUARIO/netmanager`
4. Branch: `main`
5. Build method: **"Dockerfile"** (lo detecta automáticamente)

### 3.3 Configurar puerto (Domains)

En la pestaña **"Domains"**:

1. El proxy port debe ser: **8000**
   - Este es el puerto en el que uvicorn escucha dentro del container
2. Por ahora Easypanel asigna un dominio temporal tipo `api-netmanager.TU_VPS.easypanel.host`
   - Lo usaremos para verificar que funciona antes de poner el dominio real

---

## PASO 4 — Montar volumen para SQLite

**Esto es CRÍTICO.** Sin volumen, la base de datos se pierde cada vez que el container se reinicia.

### 4.1 Configurar mount

En la pestaña **"Mounts"** (o "Advanced" según versión):

1. Click **"+ Add Mount"**
2. Configurar:
   - **Type**: Volume
   - **Name**: `netmanager-data`
   - **Mount Path**: `/app/data`
3. Click **"Save"**

Esto hace que la carpeta `/app/data` dentro del container persista entre reinicios.
El `DATABASE_URL` en el Dockerfile ya apunta a `/app/data/netmanager.db`.

---

## PASO 5 — Deploy

### 5.1 Primer deploy

1. Click en **"Deploy"** (botón azul)
2. Easypanel va a:
   - Clonar tu repositorio
   - Construir la imagen Docker usando el Dockerfile
   - Iniciar el container
3. Esperar a que el status cambie a **"Running"** (verde)
4. Ver los logs para verificar que no hay errores

### 5.2 Verificar que funciona

Abrir en el navegador:

```
https://api-netmanager.TU_VPS.easypanel.host/docs
```

Deberías ver la documentación Swagger de la API.

### 5.3 Cargar datos de prueba

En la documentación Swagger (`/docs`):

1. Buscar el endpoint `POST /api/seed/donbosco`
2. Click en **"Try it out"**
3. Click en **"Execute"**
4. Deberías recibir: `{"ok": true, "site_id": 1, "msg": "Don Bosco seeded successfully"}`

### 5.4 Verificar datos

Probar: `GET /api/sites/1/full`

Deberías ver todo el inventario de Don Bosco en formato JSON.

---

## PASO 6 — Configurar dominio `netmanager.redesycctv.cl`

### 6.1 Crear registro DNS

En tu proveedor de DNS (donde manejas redesycctv.cl):

1. Agregar un registro **A** (recomendado):
   - **Nombre**: `netmanager`
   - **Tipo**: A
   - **Valor**: `IP_DE_TU_VPS` (la IP pública del servidor)
   - **TTL**: 300 (o automático)

   O si prefieres un **CNAME** (solo si el VPS tiene dominio fijo):
   - **Nombre**: `netmanager`
   - **Tipo**: CNAME
   - **Valor**: `tu-vps.easypanel.host`

   **Recomiendo el registro A** porque es más directo y no depende del dominio de Easypanel.

2. Esperar propagación DNS (generalmente 5-15 minutos, máximo 24 horas)

### 6.2 Verificar propagación

```bash
# Desde tu terminal
nslookup netmanager.redesycctv.cl

# O desde cualquier navegador
ping netmanager.redesycctv.cl
```

Debería resolver a la IP de tu VPS.

### 6.3 Agregar dominio en Easypanel

Una vez que el DNS propague:

1. En Easypanel, ir al servicio `api` del proyecto `netmanager`
2. Pestaña **"Domains"**
3. Click **"+ Add Domain"**
4. Escribir: `netmanager.redesycctv.cl`
5. Puerto: **8000**
6. Activar **HTTPS** (checkbox o toggle)
   - Easypanel obtiene el certificado Let's Encrypt automáticamente
7. Click **"Save"**
8. Re-deploy si es necesario

### 6.4 Verificar

Abrir: `https://netmanager.redesycctv.cl/docs`

Deberías ver la API con SSL funcionando.

---

## PASO 7 — Conectar el frontend

Para que el frontend (NetManager.jsx) se conecte al backend:

### Opción A: Mismo servidor (recomendada para producción)

Cuando migremos el frontend a Vite/React, se puede servir como archivos estáticos
desde FastAPI o como otro servicio en Easypanel.

### Opción B: Frontend en Claude, API remota (desarrollo)

En el frontend, configurar la URL de la API.
En el archivo `NetManager.jsx`, cambiar:

```javascript
const API_BASE = window.NETMANAGER_API || "";
```

A:

```javascript
const API_BASE = window.NETMANAGER_API || "https://netmanager.redesycctv.cl";
```

Nota: en el artifact de Claude esto no funcionará porque el sandbox bloquea
fetch a dominios externos. Pero en producción (Vite) funciona perfecto.

---

## Resumen de URLs finales

| Recurso | URL |
|---------|-----|
| API Backend | `https://netmanager.redesycctv.cl` |
| Swagger Docs | `https://netmanager.redesycctv.cl/docs` |
| ReDoc | `https://netmanager.redesycctv.cl/redoc` |
| Health Check | `https://netmanager.redesycctv.cl/api/health` |
| Frontend (futuro) | `https://netmanager.redesycctv.cl` (cuando integremos) |

---

## Troubleshooting

### El container no inicia
- Revisar logs en Easypanel (pestaña "Logs")
- Verificar que el Dockerfile no tiene errores de sintaxis
- Verificar que `requirements.txt` tiene las dependencias correctas

### Error de permisos en SQLite
- Verificar que el mount está en `/app/data`
- El container crea la DB automáticamente al iniciar

### El dominio no carga
- Verificar que el DNS propagó: `nslookup netmanager.redesycctv.cl`
- Verificar que el puerto 8000 está configurado en Domains
- Verificar que HTTPS está activado
- Verificar que puertos 80/443 están abiertos en el firewall del VPS

### Error 502 Bad Gateway
- El container puede estar reiniciando — revisar logs
- Verificar que el puerto proxy es 8000 (no 3000 ni 80)

### La base de datos se pierde al reiniciar
- Verificar que el mount/volume está configurado
- El path debe ser `/app/data` (donde el Dockerfile guarda la DB)
