# NetManager — Backend API

Backend FastAPI + SQLite para gestión de infraestructura CCTV y red.

## Setup rápido

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Seed data (Don Bosco)

```bash
curl -X POST http://localhost:8000/api/seed/donbosco
```

## Documentación API

Con el servidor corriendo, abrir:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Estructura de archivos

```
backend/
├── main.py           # FastAPI app, routes, endpoints
├── database.py       # SQLAlchemy models, engine, session
├── schemas.py        # Pydantic request/response schemas
├── requirements.txt  # Dependencias Python
└── netmanager.db     # SQLite database (auto-creada)
```

## Endpoints principales

### Sites
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/sites` | Listar sitios |
| POST | `/api/sites` | Crear sitio |
| GET | `/api/sites/{id}` | Obtener sitio |
| GET | `/api/sites/{id}/full` | Todo el sitio (hidratación frontend) |
| GET | `/api/sites/{id}/dashboard` | Stats del dashboard |
| GET | `/api/sites/{id}/validate` | Validar conflictos |

### CRUD por entidad
Cada entidad sigue el patrón:
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/{entity}` | Crear (body: `{...data, site_id}`) |
| GET | `/api/sites/{id}/{entity}` | Listar por sitio |
| PUT | `/api/{entity}/{eid}` | Actualizar |
| DELETE | `/api/{entity}/{eid}` | Eliminar |

Entidades: `cameras`, `recorders`, `switches`, `racks`, `routers`, `buildings`, `patch-panels`

### Cámaras extra
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/cameras/bulk` | Crear múltiples cámaras |
| PUT | `/api/cameras/bulk-update` | Actualizar campo masivo |
| GET | `/api/sites/{id}/cameras?status=offline` | Filtros opcionales |

## Modelo de datos

```
Site (1) ──┬── Building (N)
           ├── Rack (N) ──── Building (FK optional)
           ├── Router (N) ── Rack (FK optional)
           ├── Switch (N) ── Rack (FK optional)
           ├── Recorder (N) ── Rack (FK optional)
           ├── PatchPanel (N) ── Rack (FK optional)
           └── Camera (N) ── Recorder, Rack, Switch, PatchPanel (FKs optional)
```

## Producción

Para producción con VPS:
```bash
# Con gunicorn
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# O con systemd service
sudo systemctl enable netmanager
sudo systemctl start netmanager
```

La base de datos SQLite es un solo archivo `netmanager.db`. Para respaldo:
```bash
cp netmanager.db netmanager_backup_$(date +%Y%m%d).db
```

## Migración automática de schema (SQLite)

### ¿Qué problema resuelve?
SQLAlchemy's `create_all()` crea tablas nuevas, pero **NO agrega columnas**
a tablas existentes. En producción (EasyPanel/Docker) la DB SQLite persiste
entre deploys, así que columnas nuevas en el código causan:
```
OperationalError: no such column: sites.cctv_subnet
```

### ¿Cómo funciona?
Al iniciar el servidor (`on_startup`), se ejecuta `run_migrations()` que:

1. Detecta con `PRAGMA table_info()` si cada columna nueva ya existe
2. Si falta, ejecuta `ALTER TABLE ... ADD COLUMN ...` de forma **idempotente**
3. Luego llama `create_all()` para tablas completamente nuevas
4. Loguea cada ALTER aplicado

Columnas migradas automáticamente:
- `sites.cctv_subnet`
- `cameras.configured`, `cameras.status_config`, `cameras.status_real`,
  `cameras.last_seen_at`, `cameras.offline_streak`

Tablas creadas si no existen:
- `camera_snapshots`, `camera_events`

### Despliegue en EasyPanel
**No se requiere ningún paso manual.** Al hacer redeploy:

1. EasyPanel reconstruye el container con la nueva imagen
2. El container arranca `uvicorn main:app`
3. `on_startup()` ejecuta `run_migrations()` automáticamente
4. La DB existente (en el volumen persistente) se actualiza in-place

```bash
# Verificar estado post-deploy:
curl https://tu-dominio.easypanel.host/api/health
# Respuesta esperada:
# {"api":"ok","version":"1.1.0","db":"ok","schema":"ok"}
```

### Health Check
```bash
GET /api/health
```
Respuestas:
- `200` — `{"api":"ok","db":"ok","schema":"ok"}` — todo OK
- `503` — `{"api":"ok","db":"error",...}` — DB no conecta
- `200` con `"schema":"drift"` — faltan columnas (migración no corrió)

### Protección contra 500
Si por cualquier razón la migración no corre y queda schema drift,
**todas** las queries SQLite que fallen con `OperationalError` devuelven
HTTP `503` (no 500) con un mensaje genérico al cliente. El traceback
completo se loguea solo en el servidor.
