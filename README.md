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
