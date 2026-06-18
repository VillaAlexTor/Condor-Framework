# AGENTS.md — Cóndor Framework

## Estado del repo

Monorepo con tres módulos funcionales:
- **`condor-cli/`** — Motor OSINT (Python)
- **`condor-dashboard/`** — Visualización (React + Vite)
- **`condor-report/`** — Informes con CVSS 3.1 (Node.js + Vue.js)

## Entrypoint y ejecución

```bash
# condor-cli
python condor-cli/condor.py --target ejemplo.bo              # default: dns,whois,crt,wayback
python condor-cli/condor.py --target ej.com --all-modules     # necesita todas las API keys
python condor-cli/condor.py --target ej.com --format html -o report.html
python condor-cli/condor.py --list-modules

# condor-dashboard (puerto 5173)
cd condor-dashboard && npm install && npm run dev

# condor-report backend (puerto 3001)
cd condor-report/backend && npm install && npm run dev

# condor-report frontend (puerto 5174)
cd condor-report/frontend && npm install && npm run dev
```

Versión: `--version` → v0.1.0

## Dependencias

### condor-cli (Python)
```bash
cd condor-cli
pip install -r requirements.txt
cp .env.example .env  # Opcional: agregar API keys
```

### condor-dashboard (Node.js)
```bash
cd condor-dashboard
npm install
```

### condor-report (Node.js)
```bash
# Backend
cd condor-report/backend
npm install

# Frontend
cd condor-report/frontend
npm install
```

## Módulos de condor-cli

| Módulo | Archivo | API Key requerida |
|--------|---------|-------------------|
| dns | `modules/dns_recon.py` | No |
| whois | `modules/whois_lookup.py` | No |
| crt | `modules/crt_sh.py` | No |
| wayback | `modules/wayback.py` | No |
| censys | `modules/censys_query.py` | `CENSYS_API_ID`, `CENSYS_API_SECRET` |
| shodan | `modules/shodan_query.py` | `SHODAN_API_KEY` |
| hunter | `modules/hunter_lookup.py` | `HUNTER_API_KEY` |

Módulos por defecto (sin API keys): dns, whois, crt, wayback.

## Contrato de módulos

Todo módulo en `condor-cli/modules/` expone `run(target, timeout)` que retorna un `dict`.

## API keys

Las API keys se cargan automáticamente desde `condor-cli/.env` via `python-dotenv`.

| Módulo | Variable(s) de entorno |
|--------|------------------------|
| censys | `CENSYS_API_ID`, `CENSYS_API_SECRET` |
| shodan | `SHODAN_API_KEY` |
| hunter | `HUNTER_API_KEY` |

## Docker

```bash
docker compose up -d          # Levantar todo
docker compose up dashboard   # Solo el dashboard
docker compose down           # Detener
```

## Git

El autor firma como `VillaAlexTor <153693343+VillaAlexTor@users.noreply.github.com>`. Remote: solo `origin/main`.
