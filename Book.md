# Cóndor Framework — Book

Libro técnico que documenta el funcionamiento completo del sistema, archivo por archivo.

---

## condor.py — Entrypoint principal del CLI de OSINT

> **Uso:** `python condor.py --target ejemplo.com`

### Descripción

Es el programa principal. Recibe argumentos del usuario, ejecuta los módulos de reconocimiento seleccionados, agrega los resultados y genera el output (JSON o HTML).

### Módulos disponibles

| Módulo | Descripción |
|--------|-------------|
| `dns` | Registros DNS (A, MX, NS, TXT, CNAME) |
| `whois` | Información WHOIS del dominio |
| `crt` | Subdominios via Certificate Transparency (crt.sh) |
| `censys` | Puertos y servicios via Censys.io API |
| `shodan` | Banners y tecnologías via Shodan API |
| `wayback` | URLs históricas via Wayback Machine |
| `hunter` | Emails corporativos via Hunter.io API |

### Uso

```bash
python condor.py --target ejemplo.com
python condor.py --target ejemplo.com --modules dns,whois,crt
python condor.py --target ejemplo.com --format html --output reporte.html
python condor.py --target ejemplo.com --verbose --log condor.log
```

---

## docker-compose.yml — Orquestación de servicios

Levanta el dashboard y el report generator juntos. `condor-cli` no se incluye aquí porque es un CLI que se ejecuta puntualmente, no un servicio de larga duración.

### Uso

```bash
docker-compose up -d              # Levantar todo
docker-compose up dashboard       # Solo el dashboard
docker-compose logs -f report-backend
docker-compose down
```

### URLs después de levantar

| Servicio | URL |
|----------|-----|
| Dashboard | http://localhost:5173 |
| Report Frontend | http://localhost:5174 |
| Report Backend | http://localhost:3001 |

---

## condor-cli/.env.example — Variables de entorno

### Instrucciones

1. Copiar este archivo: `cp .env.example .env`
2. Completar los valores reales en `.env`
3. **NUNCA** subir `.env` a GitHub — ya está en `.gitignore`

Los módulos que no tengan API key configurada retornarán `status: "skipped"` sin romper el escaneo. Los módulos sin API key (dns, whois, wayback, crt) funcionan sin configuración adicional.

---

## condor-cli/requirements.txt — Dependencias Python

```bash
pip install -r requirements.txt
```

Probado con Python 3.11+.

---

## modules/censys_query.py — Reconocimiento de puertos y servicios via Censys

### Descripción

Módulo de reconocimiento de infraestructura. Consulta la API v2 de Censys.io para obtener información sobre los hosts asociados al dominio objetivo.

Censys escanea periódicamente todo el espacio IPv4 público y almacena los resultados. Nosotros solo consultamos su base de datos — el objetivo nunca recibe tráfico.

**Descubre:**
- IPs públicas asociadas al dominio
- Puertos abiertos por IP
- Servicios corriendo (HTTP, HTTPS, SSH, FTP, etc.)
- Versiones de software expuestas (banners)
- Certificados TLS (CN, SANs, emisor, expiración)
- Tecnologías web detectadas por Censys

### Dependencias

```bash
pip install requests
```

### Contrato con condor.py

Debe exponer: `run(target: str, timeout: int) -> dict`

El dict retornado se almacena en `report["results"]["censys"]`.

### Estructura del output

```json
{
  "hosts": [
    {
      "ip": "str",
      "hostname": "str",
      "ports": [0],
      "services": [
        {
          "port": 0,
          "protocol": "str",
          "service_name": "str",
          "banner": "str",
          "tls": {
            "certificate_cn": "str",
            "sans": ["str"],
            "issuer": "str",
            "valid_from": "str",
            "valid_to": "str",
            "days_to_expire": 0,
            "self_signed": false
          }
        }
      ]
    }
  ],
  "summary": {
    "total_hosts": 0,
    "total_ports": 0,
    "open_ports": [0],
    "services_found": ["str"],
    "tls_issues": ["str"]
  },
  "analysis": {
    "risk_level": "str",
    "exposed_services": ["str"],
    "critical_ports_open": [0],
    "has_expired_certs": false,
    "has_self_signed_certs": false
  }
}
```

---

## modules/crt_sh.py — Subdominios via Certificate Transparency Logs

### Descripción

Módulo dedicado a la consulta de crt.sh. Descubre subdominios registrados históricamente en certificados TLS/SSL públicos (CT Logs).

> **Nota:** `dns_recon.py` ya incluye crt.sh como parte de su pipeline. Este módulo independiente permite ejecutar SOLO crt.sh con mayor control: paginación, filtros de wildcards, deduplicación avanzada y análisis de proveedores de certificados.

### Dependencias

```bash
pip install requests
```

### Contrato con condor.py

Debe exponer: `run(target: str, timeout: int) -> dict`

El dict retornado se almacena en `report["results"]["crt"]`.

### Estructura del output

```json
{
  "subdomains": ["str"],
  "total": 0,
  "unique": 0,
  "wildcards": ["str"],
  "issuers": {"str": 0},
  "analysis": {
    "deepest_subdomain": "str",
    "max_depth": 0,
    "interesting": ["str"]
  }
}
```

---

## modules/dns_recon.py — Reconocimiento DNS pasivo + crt.sh subdomains

### Descripción

Módulo de reconocimiento DNS. Consulta registros públicos del dominio objetivo sin generar tráfico directo hacia él. También consulta crt.sh (Certificate Transparency Logs) para descubrir subdominios registrados históricamente en certificados TLS/SSL públicos.

### Dependencias

```bash
pip install dnspython requests
```

### Contrato con condor.py

Debe exponer: `run(target: str, timeout: int) -> dict`

El dict retornado se almacena en `report["results"]["dns"]`.

### Estructura del output

```json
{
  "records": {
    "A": [],
    "MX": [],
    "NS": [],
    "TXT": [],
    "CNAME": []
  },
  "subdomains": [],
  "summary": {
    "total_records": 0,
    "total_subdomains": 0,
    "has_spf": false,
    "has_dmarc": false,
    "has_dkim": false
  }
}
```

---

## modules/hunter_lookup.py — Reconocimiento de emails corporativos via Hunter

### Descripción

Módulo de reconocimiento de emails. Consulta la API de Hunter.io para descubrir emails corporativos asociados al dominio objetivo, el patrón de formato que usan y las fuentes públicas donde fueron encontrados.

Hunter.io agrega emails de fuentes públicas: sitios web, documentos PDF, GitHub, LinkedIn, etc. Nosotros consultamos su índice — no hacemos scraping directo del objetivo.

**Descubre:**
- Emails corporativos verificados y no verificados
- Patrón de formato: `{first}.{last}@empresa.com`
- Nombres y cargos de empleados (si están disponibles)
- Fuentes donde fue encontrado cada email
- Confianza del email (score 0-100)
- Departamentos de la organización
- Total de emails indexados por Hunter

### Relevancia para OSINT

- Superficie de ataque para phishing dirigido (spear phishing)
- Identificación de personal clave (IT, RRHH, Dirección)
- El patrón permite construir listas de emails probables
- Emails + LinkedIn = perfil completo de empleado

### Dependencias

```bash
pip install requests
```

### API Key (gratuita con limitaciones)

1. Registrarse en https://hunter.io/users/sign_up
2. Ir a https://hunter.io/api-keys
3. Copiar la API key
4. Guardar en `condor-cli/.env`:

```
HUNTER_API_KEY=tu_api_key
```

Plan gratuito: 25 búsquedas/mes — suficiente para uso académico.

### Contrato con condor.py

Debe exponer: `run(target: str, timeout: int) -> dict`

El dict retornado se almacena en `report["results"]["hunter"]`.

### Estructura del output

```json
{
  "domain": "str",
  "organization": "str",
  "pattern": "str",
  "total_emails": 0,
  "emails": [
    {
      "value": "str",
      "type": "str",
      "confidence": 0,
      "verified": false,
      "first_name": "str",
      "last_name": "str",
      "position": "str",
      "department": "str",
      "sources": ["str"],
      "last_found": "str"
    }
  ],
  "departments": {"str": 0},
  "risk_emails": {
    "it_staff": ["str"],
    "executives": ["str"],
    "generic": ["str"]
  },
  "analysis": {
    "risk_level": "str",
    "has_pattern": false,
    "pattern_description": "str",
    "total_exposed": 0,
    "high_value_targets": 0,
    "phishing_risk": "str",
    "recommended_actions": ["str"]
  }
}
```

---

## modules/shodan_query.py — Reconocimiento de servicios y CVEs via Shodan API

### Descripción

Módulo de reconocimiento de servicios. Consulta la API de Shodan para obtener banners de servicios, versiones exactas de software y vulnerabilidades CVE asociadas a los hosts del dominio objetivo.

Shodan escanea el internet continuamente y almacena banners de todos los servicios que encuentra. Nosotros consultamos su índice — el objetivo nunca recibe tráfico directo.

**Diferencia con Censys:**
- Shodan tiene mejor cobertura de banners (más raw data)
- Censys tiene mejor estructuración de datos TLS
- Shodan mapea CVEs directamente a hosts
- Usarlos juntos maximiza la cobertura

**Descubre:**
- IPs asociadas al dominio (via búsqueda por hostname)
- Banners de servicios con versiones exactas de software
- Vulnerabilidades CVE detectadas automáticamente por Shodan
- Sistema operativo del servidor (si es detectable)
- Organización y ASN del proveedor de hosting
- Geolocalización de los hosts
- Tecnologías web (via Shodan tags)

### Dependencias

```bash
pip install requests
```

### API Key (gratuita con limitaciones)

1. Registrarse en https://account.shodan.io/register
2. Ir a https://account.shodan.io → ver API Key
3. Guardar en `condor-cli/.env`:

```
SHODAN_API_KEY=tu_api_key
```

**Plan gratuito:**
- 1 query credit por búsqueda
- 100 resultados por query
- Sin acceso a búsqueda histórica
- Suficiente para uso académico con dominios pequeños/medianos

Plan académico (gratuito): https://developer.shodan.io/api/requirements

### Contrato con condor.py

Debe exponer: `run(target: str, timeout: int) -> dict`

El dict retornado se almacena en `report["results"]["shodan"]`.

### Estructura del output

```json
{
  "hosts": [
    {
      "ip": "str",
      "hostnames": ["str"],
      "os": "str",
      "org": "str",
      "asn": "str",
      "isp": "str",
      "country": "str",
      "city": "str",
      "ports": [0],
      "services": [
        {
          "port": 0,
          "protocol": "str",
          "product": "str",
          "version": "str",
          "banner": "str",
          "cpe": ["str"]
        }
      ],
      "vulns": [
        {
          "cve_id": "str",
          "cvss": 0.0,
          "severity": "str",
          "summary": "str"
        }
      ],
      "tags": ["str"]
    }
  ],
  "summary": {
    "total_hosts": 0,
    "total_ports": 0,
    "total_vulns": 0,
    "critical_vulns": 0,
    "open_ports": [0],
    "software_detected": ["str"]
  },
  "analysis": {
    "risk_level": "str",
    "has_critical_cve": false,
    "top_vulns": [{}],
    "exposed_software": ["str"],
    "hosting_info": {
      "org": "str",
      "asn": "str",
      "isp": "str"
    }
  }
}
```

---

## modules/wayback.py — Reconocimiento histórico via Wayback Machine

### Descripción

Módulo de reconocimiento histórico. Consulta la CDX API de la Wayback Machine (archive.org) para descubrir URLs históricas del dominio objetivo.

Esto puede revelar:
- Rutas y endpoints que ya no existen en el sitio actual
- Paneles de administración expuestos en el pasado
- Archivos sensibles (.env, .bak, .sql, config.php, etc.)
- Tecnologías y frameworks usados históricamente
- Subdominios activos en el pasado

Todo sin generar tráfico al objetivo — solo consultas a archive.org que ya tiene los datos indexados.

### Dependencias

```bash
pip install requests
```

### Contrato con condor.py

Debe exponer: `run(target: str, timeout: int) -> dict`

El dict retornado se almacena en `report["results"]["wayback"]`.

### Estructura del output

```json
{
  "total_snapshots": 0,
  "first_seen": "str",
  "last_seen": "str",
  "urls": {
    "all": ["str"],
    "interesting": ["str"],
    "by_extension": {
      "php": ["str"],
      "js": ["str"]
    }
  },
  "status_codes": {
    "200": 0,
    "404": 0
  },
  "findings": {
    "sensitive_files": ["str"],
    "admin_panels": ["str"],
    "api_endpoints": ["str"],
    "backup_files": ["str"]
  },
  "analysis": {
    "has_sensitive_exposure": false,
    "risk_level": "str",
    "years_of_history": 0
  }
}
```

---

## modules/whois_lookup.py — Reconocimiento WHOIS del dominio objetivo

### Descripción

Módulo de consulta WHOIS. Extrae información pública sobre el registro del dominio: propietario, organización, fechas, registrar, nameservers y estado del dominio.

También detecta si el dominio usa WHOIS Privacy (proxy), calcula días para expiración, y evalúa riesgos básicos.

### Dependencias

```bash
pip install python-whois
```

### Contrato con condor.py

Debe exponer: `run(target: str, timeout: int) -> dict`

El dict retornado se almacena en `report["results"]["whois"]`.

### Estructura del output

```json
{
  "registrar": "str",
  "registered_on": "str",
  "updated_on": "str",
  "expires_on": "str",
  "days_to_expire": 0,
  "status": ["str"],
  "nameservers": ["str"],
  "owner": {
    "name": "str",
    "org": "str",
    "email": "str",
    "country": "str",
    "city": "str"
  },
  "privacy_protected": false,
  "analysis": {
    "expiring_soon": false,
    "recently_created": false,
    "privacy_risk": "str",
    "expiry_risk": "str"
  }
}
```

---

## condor-dashboard/src/main.jsx — Entrypoint de la aplicación React

Monta `App.jsx` en el DOM e importa los estilos globales (Tailwind + fuentes).

---

## condor-dashboard/postcss.config.js

PostCSS procesa el CSS antes de que Vite lo sirva. Tailwind necesita este archivo para inyectar sus utilidades.

---

## condor-dashboard/vite.config.js

Configuración Vite para el dashboard React. Puerto 5173 (default de Vite) — consume JSON local, no necesita proxy a ningún backend.

---

## condor-dashboard/App.jsx — Componente raíz

### Descripción

Componente principal del dashboard. Maneja:
1. Carga del JSON generado por condor-cli
2. Estado global del reporte
3. Layout principal (sidebar + contenido)
4. Navegación entre vistas (Overview, DNS, WHOIS, etc.)

### Estética

Dark terminal — inspirado en interfaces de seguridad reales.
- **Paleta:** fondo casi negro (`#0a0e17`), verde neón (`#00ff88`), cyan (`#00d4ff`), rojo alerta (`#ff3b3b`)
- **Tipografía:** JetBrains Mono (monospace) para datos técnicos, Syne para headers

---

## condor-dashboard/components/CensysView.jsx — Vista detallada del módulo Censys

### Descripción

Visualización completa de los resultados del módulo `censys_query`. Muestra:
- Hosts descubiertos con sus IPs y hostnames
- Puertos abiertos por host con servicios detectados
- Certificados TLS (CN, SANs, emisor, expiración)
- Puertos peligrosos expuestos
- Issues de TLS (expirados, autofirmados)
- Mapa visual de puertos por host

### Props

| Prop | Descripción |
|------|-------------|
| `data` | `results.censys` del reporte condor-cli |
| `report` | reporte completo |

---

## condor-dashboard/components/DnsView.jsx — Vista detallada del módulo DNS

### Descripción

Visualización completa de los resultados del módulo `dns_recon`. Muestra:
- Registros DNS por tipo (A, MX, NS, TXT, CNAME)
- Subdominios descubiertos via crt.sh
- Análisis visual de seguridad de email (SPF/DMARC/DKIM)
- Evaluación de riesgo de email spoofing

### Props

| Prop | Descripción |
|------|-------------|
| `data` | `results.dns` del reporte condor-cli |
| `report` | reporte completo (para acceder a `meta.target`) |

---

## condor-dashboard/components/HunterView.jsx — Vista detallada del módulo Hunter.io

### Descripción

Visualización completa de los resultados del módulo `hunter_lookup`. Muestra:
- Patrón de formato de emails corporativos
- Clasificación: IT staff / Ejecutivos / Genéricos
- Lista de emails con cargo, departamento y confianza
- Distribución por departamento
- Fuentes donde fueron encontrados
- Análisis de riesgo de phishing y recomendaciones

### Props

| Prop | Descripción |
|------|-------------|
| `data` | `results.hunter` del reporte condor-cli |
| `report` | reporte completo |

---

## condor-dashboard/components/Overview.jsx — Vista principal

### Descripción

Vista de resumen ejecutivo. Muestra de un vistazo:
- Métricas globales del escaneo
- Tarjeta de riesgo por módulo
- Hallazgos críticos consolidados
- Timeline del objetivo (WHOIS + Wayback)
- Botones de navegación a cada módulo

### Props

| Prop | Descripción |
|------|-------------|
| `data` | el report completo (meta + results + errors) |
| `onNavigate` | función para navegar a otra vista |

---

## condor-dashboard/components/ShodanView.jsx — Vista detallada del módulo Shodan

### Descripción

Visualización completa de los resultados del módulo `shodan_query`. Muestra:
- Hosts indexados con OS, org, ASN, geolocalización
- CVEs detectados por Shodan con CVSS 3.1 y severidad
- Banners de servicios con versiones de software
- Gráfico de distribución de CVEs por severidad
- Top vulnerabilidades ordenadas por CVSS score
- Software expuesto con versiones

### Props

| Prop | Descripción |
|------|-------------|
| `data` | `results.shodan` del reporte condor-cli |
| `report` | reporte completo |

---

## condor-dashboard/components/WaybackView.jsx — Vista detallada del módulo Wayback Machine

### Descripción

Visualización completa de los resultados del módulo `wayback`. Muestra:
- Resumen temporal (primera/última captura, años de historial)
- Hallazgos críticos: archivos sensibles, backups, paneles admin, APIs
- Distribución de URLs por extensión (gráfico de barras)
- Lista completa de URLs con buscador y filtros
- Distribución de códigos HTTP históricos

### Props

| Prop | Descripción |
|------|-------------|
| `data` | `results.wayback` del reporte condor-cli |
| `report` | reporte completo |

---

## condor-dashboard/components/WhoisView.jsx — Vista detallada del módulo WHOIS

### Descripción

Visualización completa de los resultados del módulo `whois_lookup`. Muestra:
- Datos del registrante (nombre, org, email, país)
- Fechas de registro, actualización y expiración
- Barra visual de vida útil del dominio
- Estado del dominio y nameservers
- Detección de WHOIS Privacy
- Análisis de riesgo (expiración, privacidad)

### Props

| Prop | Descripción |
|------|-------------|
| `data` | `results.whois` del reporte condor-cli |
| `report` | reporte completo |

---

## condor-report/cvss/calculator.js — Motor matemático CVSS 3.1

### Descripción

Implementación completa del estándar CVSS 3.1 (Common Vulnerability Scoring System) según la especificación oficial del FIRST (Forum of Incident Response and Security Teams).

> Referencia: https://www.first.org/cvss/v3.1/specification-document

**Calcula:**
- Base Score (ISS, Impact, Exploitability)
- Severity label (CRÍTICO / ALTO / MEDIO / BAJO / NINGUNO)
- Vector string canónico (`CVSS:3.1/AV:N/AC:L/...`)
- Desglose de sub-scores para UI de la calculadora

### Uso

```javascript
const { calculate } = require("./calculator")

// Desde métricas individuales
const result = calculate({ AV:"N", AC:"L", PR:"N", UI:"N", S:"U", C:"H", I:"H", A:"H" })
// → { score: 9.8, severity: "CRÍTICO", vector: "CVSS:3.1/AV:N/..." }

// Desde vector string
const result = calculateFromVector("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")
// → { score: 9.8, severity: "CRÍTICO", ... }
```

---

## condor-report/cvss/vectors.js — Definiciones de métricas CVSS 3.1

### Descripción

Definiciones completas de cada métrica del vector CVSS 3.1:
- Labels cortos y largos para botones y tooltips
- Descripciones técnicas para mostrar al analista
- Ejemplos concretos de situaciones reales
- Colores por severidad para la UI
- Orden canónico del vector string

> Este archivo NO hace cálculos — solo define metadata. El cálculo está en `calculator.js`.

### Uso

```javascript
const { METRICS, SEVERITY_DISPLAY, getVectorDescription } = require("./vectors")

// Obtener opciones para el select de AV
METRICS.AV.options  // → [{ value: "N", label: "Network", ... }, ...]

// Describir un vector completo
getVectorDescription({ AV:"N", AC:"L", PR:"N", UI:"N", S:"U", C:"H", I:"H", A:"H" })
```

---

## condor-report/generators/pdf.js — Generador de informes PDF

### Descripción

Genera el informe de auditoría en formato PDF usando Puppeteer para renderizar HTML a PDF con calidad de impresión profesional.

**Proceso:**
1. Construye el HTML completo del informe en memoria
2. Lanza Puppeteer (headless Chromium)
3. Renderiza el HTML con CSS completo
4. Exporta a PDF con márgenes y cabeceras profesionales
5. Guarda el archivo y retorna la ruta

**Secciones del informe generado:**
- Portada (target, analista, fecha, clasificación)
- Índice automático
- Resumen ejecutivo (métricas, distribución CVSS)
- Metodología (OSINT pasivo, herramientas)
- Fichas de vulnerabilidad (una por hallazgo)
- Recomendaciones generales
- Conclusiones

### Dependencias

```bash
npm install puppeteer
```

### Uso

```javascript
const { generatePDF } = require("./pdf")
const pdfPath = await generatePDF({ meta, fichas, outputDir })
```

---

## condor-report/lib/importer.js — Parser de JSON condor-cli a fichas automáticas

### Descripción

Toma el JSON generado por condor-cli y extrae automáticamente todos los hallazgos de seguridad, convirtiéndolos en fichas de vulnerabilidad listas para editar en el `FichaEditor`.

**Procesa todos los módulos:**

| Módulo | Hallazgos extraídos |
|--------|---------------------|
| `dns` | email spoofing (SPF/DMARC/DKIM) |
| `whois` | expiración de dominio |
| `wayback` | archivos sensibles, backups, paneles admin |
| `censys` | puertos peligrosos, TLS issues |
| `shodan` | CVEs detectados, servicios peligrosos |
| `hunter` | emails IT/ejecutivos expuestos, patrón |

Cada hallazgo genera una ficha con:
- ID único (VULN-001, VULN-002, ...)
- Vector CVSS 3.1 sugerido (desde `vectors.js` presets)
- Descripción y evidencia pre-completadas
- Recomendación base (completada por `recommender.js`)
- Prioridad calculada desde el CVSS score

### Uso

```javascript
const { importFromJson } = require("./importer")
const fichas = importFromJson(reportJson)
// → [{ id: "VULN-001", titulo: "...", cvss: {...}, ... }]
```

---

## condor-report/lib/recommender.js — Motor de recomendaciones automáticas

### Descripción

Genera recomendaciones de remediación para cada categoría de vulnerabilidad detectada por condor-cli.

Cada recomendación incluye:
- Acción inmediata (remediación directa)
- Acciones de hardening adicionales
- Referencias técnicas (RFC, OWASP, NIST, CVE)
- SLA sugerido según severidad CVSS
- Nivel de dificultad de implementación

### Uso

```javascript
const { getRecommendation, enrichFicha } = require("./recommender")

// Obtener recomendación por categoría
const rec = getRecommendation("email_spoofing", { has_spf: true })

// Enriquecer una ficha completa
const fichaEnriquecida = enrichFicha(ficha)
```

---

## backend/src/routes/cvss.js — Rutas: calculadora CVSS 3.1 y presets

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/cvss/calculate?vector=CVSS:3.1/...` | Desde vector string |
| `POST` | `/api/cvss/calculate` | Desde métricas individuales |
| `GET` | `/api/cvss/presets` | Lista de vectores predefinidos |
| `GET` | `/api/cvss/presets/:id` | Preset específico |
| `GET` | `/api/cvss/suggest` | Sugiere preset por categoría |
| `GET` | `/api/cvss/metrics` | Definiciones de métricas (para UI) |
| `GET` | `/api/cvss/self-test` | Corre tests contra casos del FIRST |

---

## backend/src/routes/ficha.js — Rutas: recomendaciones y utilidades para fichas

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/ficha/categories` | Categorías disponibles |
| `POST` | `/api/ficha/recommend` | Recomendación por categoría + contexto |
| `POST` | `/api/ficha/enrich` | Enriquece una ficha individual |
| `POST` | `/api/ficha/enrich-all` | Enriquece un array de fichas |
| `POST` | `/api/ficha/general-recommendations` | Recomendaciones generales del informe |
| `POST` | `/api/ficha/new` | Crea ficha vacía lista para editar |

---

## backend/src/routes/report.js — Rutas: importar JSON + generar PDF

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/report/import` | Importa JSON de condor-cli, genera fichas |
| `POST` | `/api/report/generate` | Genera PDF desde fichas + metadata |
| `GET` | `/api/report/download/:filename` | Servido como estático en `server.js` |

---

## CvssCalculator.vue — Calculadora CVSS 3.1 interactiva

### Descripción

Componente Vue 3 que implementa la calculadora CVSS 3.1 interactiva. El analista selecciona el valor de cada métrica con botones y el score se calcula en tiempo real.

**Funcionalidades:**
- 8 métricas con botones de selección
- Score calculado en tiempo real (fórmula CVSS 3.1)
- Vector string generado automáticamente
- Descripción de cada opción al hacer hover
- Presets de vectores comunes
- Emit del vector seleccionado al componente padre

### Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `initialVector` | `String` | Vector CVSS inicial (opcional) |
| `compact` | `Boolean` | Modo compacto para el FichaEditor |

### Emits

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `update:vector` | `{ vector, score, severity, metrics }` | Vector seleccionado |

---

## FichaEditor.vue — Editor completo de fichas de vulnerabilidad

### Descripción

Editor principal de fichas de vulnerabilidad. Permite crear y editar cada campo de una ficha, con la calculadora CVSS 3.1 integrada.

**Campos editables:**
- Título, categoría, fuente, CVE ID
- Descripción, evidencia, impacto
- Vector CVSS 3.1 (via CvssCalculator)
- Recomendación de remediación
- Referencias, estado, prioridad

### Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `ficha` | `Object` | Ficha a editar (objeto completo) |
| `index` | `Number` | Índice en la lista de fichas |

### Emits

| Evento | Descripción |
|--------|-------------|
| `update` | Ficha actualizada |
| `delete` | Eliminar esta ficha |
| `duplicate` | Duplicar esta ficha |

---

## ImportPanel.vue — Panel de importación de JSON condor-cli

### Descripción

Pantalla inicial de condor-report. Permite:
- Drag & drop o selección de archivo JSON de condor-cli
- Envío a `POST /api/report/import` → genera fichas
- Validación básica del JSON antes de enviar
- Alternativa: empezar desde cero con fichas manuales

### Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `apiBase` | `String` | URL base del backend (ej: `http://localhost:3001`) |

### Emits

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `imported` | `{ fichas, report_meta, informe_meta, stats }` | Importación exitosa |
| `manual-start` | `target (String)` | Usuario eligió empezar manualmente |

---

## ReportPreview.vue — Preview del informe + exportación PDF

### Descripción

Vista final del flujo condor-report. Muestra un preview completo del informe antes de exportar y permite:
- Editar la metadata del informe (título, analista, etc.)
- Ver resumen de fichas con distribución CVSS
- Preview de la portada del informe
- Exportar a PDF via API backend
- Descargar el PDF generado

### Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `fichas` | `Array` | Array de fichas enriquecidas |
| `reportMeta` | `Object` | Metadata del reporte original de condor-cli |

### Emits

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `export-success` | `String` | Ruta del PDF generado |
| `edit-ficha` | `Number` | Navegar a editar una ficha específica |

---

## condor-report/frontend/App.vue — Componente raíz

### Descripción

Componente raíz de condor-report. Maneja el flujo completo:

1. **IMPORT** — cargar JSON de condor-cli → `POST /api/report/import`
2. **EDIT** — lista de fichas editables (`FichaEditor.vue`)
3. **PREVIEW** — preview + export PDF (`ReportPreview.vue`)

**Estados (steps):**

| Estado | Descripción |
|--------|-------------|
| `"import"` | Pantalla de carga de JSON / crear fichas manualmente |
| `"edit"` | Lista de FichaEditor para cada hallazgo |
| `"preview"` | ReportPreview con export final |

El estado global (fichas, meta) vive aquí y se pasa a los componentes hijos via props/emits.

---

## condor-report/frontend/main.js — Entrypoint de la aplicación Vue 3

Monta `App.vue` en el DOM.

---

## condor-report/frontend/vite.config.js

Configuración Vite para el frontend Vue de condor-report. Puerto 5174 (distinto al dashboard, que usa 5173).

Incluye proxy `/api` → backend Express (puerto 3001) para evitar problemas de CORS en desarrollo, aunque el backend ya tiene CORS habilitado por si se accede directo.
