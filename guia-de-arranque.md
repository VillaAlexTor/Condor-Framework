# Guía de arranque — Cóndor Framework

Instrucciones para levantar el entorno de desarrollo completo.

---

## Requisitos previos

| Herramienta | Versión mínima | Verificar |
|-------------|----------------|-----------|
| Python | 3.11+ | `python --version` |
| Node.js | 20+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | 2.30+ | `git --version` |
| Docker | 24+ (opcional) | `docker --version` |
| Docker Compose | 2.20+ (opcional) | `docker compose version` |

---

## Opción 1 — Instalación manual

### 1. Clonar el repositorio

```bash
git clone https://github.com/villaalextor/condor-framework.git
cd condor-framework
```

### 2. condor-cli (Python)

```bash
cd condor-cli
pip install -r requirements.txt
cp .env.example .env
```

Editar `.env` con tus API keys (opcional pero recomendado):

```env
CENSYS_API_ID=tu_api_id
CENSYS_API_SECRET=tu_api_secret
SHODAN_API_KEY=tu_api_key
HUNTER_API_KEY=tu_api_key
```

Probar que funciona:

```bash
python condor.py --list-modules
python condor.py --target ejemplo.com --output scan.json
```

### 3. condor-dashboard (React + Vite)

```bash
cd ../condor-dashboard
npm install
npm run dev
```

Arranca en **http://localhost:5173**.

### 4. condor-report

#### Backend (Express + Puppeteer)

```bash
cd ../condor-report/backend
npm install
npx puppeteer browsers install chrome
npm run dev
```

Arranca en **http://localhost:3001**.

#### Frontend (Vue + Vite)

En otra terminal:

```bash
cd condor-report/frontend
npm install
npm run dev
```

Arranca en **http://localhost:5174**.

---

## Opción 2 — Docker

### Prerrequisitos

- Docker Desktop instalado y corriendo
- Docker Compose v2+

### Levantar todo el stack

Desde la raíz del repositorio:

```bash
docker compose up -d
```

Esto levanta 3 servicios:

| Servicio | Container | Puerto | URL |
|----------|-----------|--------|-----|
| Dashboard | `condor-dashboard` | 5173 | http://localhost:5173 |
| Report Backend | `condor-report-backend` | 3001 | http://localhost:3001 |
| Report Frontend | `condor-report-frontend` | 5174 | http://localhost:5174 |

### Comandos útiles

```bash
# Levantar todo
docker compose up -d

# Levantar solo el dashboard
docker compose up -d dashboard

# Levantar solo condor-report (backend + frontend)
docker compose up -d report-backend report-frontend

# Ver logs en tiempo real
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f report-backend

# Detener todo
docker compose down

# Detener y eliminar volúmenes
docker compose down -v
```

### Reconstruir contenedores

Si modificas dependencias o Dockerfiles:

```bash
docker compose up -d --build
```

### Nota importante sobre Dockerfiles

El `docker-compose.yml` actual referencia Dockerfiles que aún no existen:

- `condor-dashboard/Dockerfile`
- `condor-report/backend/Dockerfile`
- `condor-report/frontend/Dockerfile`

**Mientras se crean these archivos, usa la instalación manual (Opción 1).**

### Variables de entorno en Docker

Las variables están configuradas en `docker-compose.yml`. Para personalizarlas, crea un archivo `docker-compose.override.yml`:

```yaml
services:
  report-backend:
    environment:
      - PORT=3001
      - PDF_TIMEOUT=60000
      - OUTPUT_DIR=/app/output
```

---

## Flujo de trabajo completo

Una vez levantado el entorno:

```
1. Generar escaneo con condor-cli
   ┌──────────────────────────────────────────────┐
   │  cd condor-cli                               │
   │  python condor.py --target objetivo.com      │
   │  # Genera: objetivo_com_20260617_143022.json  │
   └──────────────────────────────────────────────┘
                       │
                       ▼
2. Visualizar en condor-dashboard
   ┌──────────────────────────────────────────────┐
   │  Abrir http://localhost:5173                 │
   │  Arrastrar el archivo .json sobre el dashboard│
   │  Navegar entre módulos (DNS, WHOIS, etc.)    │
   └──────────────────────────────────────────────┘
                       │
                       ▼
3. Generar informe con condor-report
   ┌──────────────────────────────────────────────┐
   │  Abrir http://localhost:5174                 │
   │  Arrastrar el mismo archivo .json            │
   │  Editar fichas de vulnerabilidad             │
   │  Configurar metadata del informe             │
   │  Exportar a PDF                              │
   └──────────────────────────────────────────────┘
```

---

## URLs de referencia

| Servicio | URL | Descripción |
|----------|-----|-------------|
| Dashboard | http://localhost:5173 | Visualización de resultados OSINT |
| Report Frontend | http://localhost:5174 | Editor de fichas y export PDF |
| Report Backend | http://localhost:3001 | API para CVSS, fichas y generación de PDF |

### API Backend (condor-report)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/cvss/calculate` | GET/POST | Calculadora CVSS 3.1 |
| `/api/cvss/presets` | GET | Vectores predefinidos |
| `/api/cvss/metrics` | GET | Definiciones de métricas |
| `/api/report/import` | POST | Importar JSON de condor-cli |
| `/api/report/generate` | POST | Generar PDF |
| `/api/ficha/categories` | GET | Categorías de vulnerabilidad |
| `/api/ficha/recommend` | POST | Recomendación por categoría |

---

## Solución de problemas

### `python: command not found`

Asegúrate de tener Python 3.11+ instalado y en el PATH:

```bash
python --version   # Debe mostrar 3.11 o superior
# O en algunos sistemas:
python3 --version
```

### `pip install` falla con permisos

Usa un entorno virtual:

```bash
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
# .venv\Scripts\activate    # Windows
pip install -r requirements.txt
```

### `npm install` tarda mucho

Elimina `node_modules` y vuelve a instalar:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Puppeteer no instala Chromium

En Linux puede faltar dependencias del sistema:

```bash
# Ubuntu/Debian
sudo apt-get install -y chromium-browser

# O forzar instalación de Puppeteer
npx puppeteer browsers install chrome
```

### Puerto 5173 o 5174 ya en uso

Cambia el puerto en la configuración de Vite:

```bash
# condor-dashboard
npm run dev -- --port 5180

# condor-report/frontend
npm run dev -- --port 5181
```

### Docker: `Cannot connect to the Docker daemon`

Asegúrate de que Docker Desktop esté corriendo.

### Docker: `port is already allocated`

Cambia los puertos en `docker-compose.yml` o detén el servicio que usa ese puerto:

```bash
# En Windows, find y kill el proceso
netstat -ano | findstr :5173
taskkill /PID <pid> /F
```

### `condor.py` no encuentra módulos

Verifica que estés en el directorio `condor-cli/`:

```bash
cd condor-cli
python condor.py --list-modules
```

---

## Estructura del proyecto

```
condor-framework/
├── .gitignore
├── docker-compose.yml
├── README.md
├── guia-de-arranque.md
├── Book.md
├── AGENTS.md
│
├── condor-cli/              ← Motor OSINT (Python)
│   ├── condor.py
│   ├── requirements.txt
│   ├── .env.example
│   └── modules/
│
├── condor-dashboard/        ← Visualización (React + Vite)
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│
└── condor-report/           ← Informes (Node + Vue)
    ├── backend/
    │   ├── package.json
    │   └── src/
    └── frontend/
        ├── package.json
        ├── vite.config.js
        └── components/
```

---

## Ayuda

- **Issues:** https://github.com/villaalextor/condor-framework/issues
- **Documentación:** Ver `README.md` de cada módulo
- **Book:** Ver `Book.md` para documentación técnica detallada
