# condor-cli

> **Módulo 1 del Cóndor Framework** — Motor de reconocimiento pasivo OSINT con interfaz de línea de comandos.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](../LICENSE)
[![Status](https://img.shields.io/badge/Status-En%20Desarrollo-orange?style=flat-square)]()

---

## ¿Qué es condor-cli?

`condor-cli` es un script Python que ejecuta reconocimiento pasivo (OSINT) contra un dominio objetivo. Consulta múltiples fuentes públicas y APIs **sin generar tráfico directo al objetivo** — el dominio nunca recibe peticiones.

El output es un JSON estructurado, listo para ser consumido por `condor-dashboard` o exportado como reporte HTML standalone.

---

## Módulos disponibles

| Módulo | Fuente | Descripción | API Key |
|--------|--------|-------------|---------|
| `dns` | dnspython + crt.sh | Registros DNS (A, MX, NS, TXT, CNAME) + subdominios | No |
| `whois` | python-whois | Registrante, fechas, nameservers, expiración | No |
| `crt` | crt.sh | Subdominios via Certificate Transparency Logs | No |
| `wayback` | archive.org CDX API | URLs históricas, archivos sensibles, paneles admin | No |
| `censys` | Censys.io API v2 | Puertos abiertos, servicios, certificados TLS | **Sí** |
| `shodan` | Shodan API | Banners, CVEs, software expuesto | **Sí** |
| `hunter` | Hunter.io API | Emails corporativos, patrón de formato, phishing risk | **Sí** |

**Módulos por defecto:** `dns`, `whois`, `crt`, `wayback` (no necesitan API key).

---

## Instalación

### Requisitos previos

- Python 3.11+
- pip

### Instalar dependencias

```bash
cd condor-cli
pip install -r requirements.txt
```

### Configurar variables de entorno (opcional)

```bash
cp .env.example .env
# Editar .env con tus API keys
```

Los módulos sin API key configurada retornan `status: "skipped"` sin romper el escaneo.

---

## Uso

```bash
# Escaneo básico (dns, whois, crt, wayback)
python condor.py --target ejemplo.com

# Con módulos específicos
python condor.py --target ejemplo.com --modules dns,whois,crt

# Todos los módulos (necesita API keys)
python condor.py --target ejemplo.com --all-modules

# Output HTML standalone
python condor.py --target ejemplo.com --format html -o reporte.html

# Verbose + guardar logs
python condor.py --target ejemplo.com --verbose --log scan.log

# Listar módulos disponibles
python condor.py --list-modules
```

---

## Referencia de comandos

```
condor [--target DOMINIO] [--modules MOD1,MOD2] [opciones]

Argumentos principales:
  --target, -t DOMINIO      Dominio objetivo del reconocimiento
  --modules, -m MOD1,MOD2   Módulos a ejecutar (separados por coma)
  --all-modules             Ejecutar TODOS los módulos

Formato de output:
  --format, -f json|html    Formato del output (default: json)
  --output, -o ARCHIVO      Ruta del archivo de salida

Opciones de ejecución:
  --verbose, -v             Mostrar información detallada (debug)
  --log ARCHIVO             Guardar log completo en archivo
  --timeout SEGUNDOS        Timeout por consulta de red (default: 10)

Utilidades:
  --list-modules            Listar módulos disponibles
  --version                 Mostrar versión
```

---

## Output JSON

El JSON generado tiene esta estructura:

```json
{
  "meta": {
    "target": "ejemplo.com",
    "timestamp": "2024-01-01T14:30:00",
    "modules_run": ["dns", "whois", "crt", "wayback"],
    "tool": "Cóndor Framework v0.1.0",
    "duration_seconds": 45.2
  },
  "results": {
    "dns": {
      "status": "ok",
      "records": { "A": [...], "MX": [...], "NS": [...], "TXT": [...] },
      "subdomains": [...],
      "email_security": { "has_spf": true, "has_dmarc": false, "risk": "MEDIO" }
    },
    "whois": {
      "status": "ok",
      "registrar": "...",
      "owner": { "name": "...", "org": "...", "country": "..." },
      "expires_on": "2025-01-01",
      "days_to_expire": 180
    },
    "crt": {
      "status": "ok",
      "subdomains": [...],
      "wildcards": [...],
      "analysis": { "deepest_subdomain": "...", "interesting": [...] }
    },
    "wayback": {
      "status": "ok",
      "total_snapshots": 1234,
      "urls": { "all": [...], "by_extension": {...} },
      "findings": { "sensitive_files": [...], "admin_panels": [...] }
    }
  },
  "errors": {}
}
```

### Estados de módulo

| Estado | Significado |
|--------|-------------|
| `ok` | Módulo ejecutado correctamente |
| `skipped` | Sin API key configurada |
| `error` | Error durante la ejecución |
| `not_implemented` | Módulo no encontrado o no implementado |

---

## Contrato de módulos

Cada módulo en `modules/` debe exponer una función:

```python
def run(target: str, timeout: int = 10) -> dict
```

- `target`: dominio a escanear (string limpio, sin `http://` ni `www.`)
- `timeout`: segundos máximos por consulta de red
- Retorna: diccionario con clave `"status"` y datos del módulo

---

## Detalle por módulo

### dns_recon.py (291 líneas)

Reconocimiento DNS completo. Consulta registros públicos y analiza seguridad de email.

**Datos retornados:**
- Registros por tipo (A, MX, NS, TXT, CNAME)
- Subdominios descubiertos via crt.sh
- Análisis SPF/DMARC/DKIM con riesgo de email spoofing

**Dependencias:** `dnspython`, `requests`

### whois_lookup.py (317 líneas)

Consulta WHOIS y normaliza toda la información del registro del dominio.

**Datos retornados:**
- Registrante (nombre, organización, email, país)
- Fechas (registro, actualización, expiración)
- Nameservers, estados EPP, DNSSEC
- Detección de WHOIS Privacy
- Días restantes para expiración

**Dependencias:** `python-whois`

### wayback.py (457 líneas)

URLs históricas vía la CDX API de Internet Archive.

**Datos retornados:**
- URLs únicas con distribución por extensión
- Primera y última captura registrada
- Hallazgos: archivos sensibles (.env, .bak, .sql), paneles admin, endpoints API
- Distribución de códigos HTTP históricos

**Dependencias:** `requests`

### crt_sh.py (351 líneas)

Subdominios via Certificate Transparency Logs (crt.sh).

**Datos retornados:**
- Subdominios únicos encontrados
- Certificados wildcard detectados
- Certificate Authorities más frecuentes
- Subdominios "interesantes" (admin, dev, api, vpn, db)

**Dependencias:** `requests`

### censys_query.py (498 líneas)

Puertos, servicios y certificados TLS vía Censys.io API v2.

**Datos retornados:**
- Hosts con IPs, puertos abiertos, servicios y banners
- Certificados TLS (CN, SANs, emisor, expiración)
- Análisis de puertos críticos y problemas TLS

**API keys requeridas:** `CENSYS_API_ID`, `CENSYS_API_SECRET`

**Dependencias:** `requests`

### shodan_query.py (531 líneas)

Banners, versiones de software y CVEs vía Shodan API.

**Datos retornados:**
- Hosts con OS, organización, ASN, geolocalización
- CVEs clasificados por severidad CVSS 3.1
- Software detectado con versiones exactas
- Tags de host (cloud, CDN, tor, honeypot)

**API key requerida:** `SHODAN_API_KEY`

**Dependencias:** `requests`

### hunter_lookup.py (497 líneas)

Emails corporativos expuestos vía Hunter.io API.

**Datos retornados:**
- Patrón de formato de emails corporativos
- Emails clasificados: IT/Seguridad, Ejecutivos, Genéricos
- Confidence score y fuentes de cada email
- Análisis de riesgo de spear phishing

**API key requerida:** `HUNTER_API_KEY`

**Dependencias:** `requests`

---

## Variables de entorno

```env
# Censys (requerido para módulo censys)
CENSYS_API_ID=tu_api_id
CENSYS_API_SECRET=tu_api_secret

# Shodan (requerido para módulo shodan)
SHODAN_API_KEY=tu_api_key

# Hunter.io (requerido para módulo hunter)
HUNTER_API_KEY=tu_api_key

# Configuración general
CONDOR_TIMEOUT=10
CONDOR_OUTPUT_DIR=./output
```

### Obtener API keys

| Servicio | Registro gratuito | Plan free |
|----------|-------------------|-----------|
| Censys | https://accounts.censys.io/register | 250 queries/mes |
| Shodan | https://account.shodan.io/register | 1 query credit/búsqueda |
| Shodan (académico) | https://developer.shodan.io/api/requirements | Ilimitado |
| Hunter.io | https://hunter.io/users/sign_up | 25 búsquedas/mes |

---

## Dependencias

| Paquete | Versión | Uso |
|---------|---------|-----|
| `dnspython` | 2.6.1 | Consultas DNS (A, MX, NS, TXT, CNAME) |
| `python-whois` | 0.9.4 | Parser WHOIS multi-registrar |
| `requests` | 2.32.3 | Cliente HTTP principal |
| `urllib3` | 2.2.1 | Dependencia de requests (fijada por seguridad) |
| `python-dotenv` | 1.0.1 | Carga `.env` automáticamente |
| `rich` | 13.7.1 | Tablas y colores en terminal |
| `jinja2` | 3.1.4 | Templates HTML para `--format html` |
| `python-dateutil` | 2.9.0 | Parsing robusto de fechas WHOIS |

---

## Arquitectura interna

```
condor-cli/
│
├── condor.py               ← Entrypoint: argumentos, orquestador, output
├── requirements.txt        ← Dependencias Python
├── .env.example            ← Plantilla de variables de entorno
└── modules/
    ├── dns_recon.py        ← DNS pasivo + crt.sh + email security
    ├── whois_lookup.py     ← WHOIS + normalización + privacy detection
    ├── wayback.py          ← Wayback Machine CDX API
    ├── crt_sh.py           ← Certificate Transparency Logs
    ├── censys_query.py     ← Censys.io API v2
    ├── shodan_query.py     ← Shodan API
    └── hunter_lookup.py    ← Hunter.io API
```

### Flujo de ejecución

```
1. condor.py parsea argumentos (argparse)
       │
       ▼
2. Validaciones (dominio, módulos, output)
       │
       ▼
3. Importación dinámica de módulos (importlib)
       │
       ▼
4. Ejecución secuencial: módulo.run(target, timeout)
       │
       ├── dns_recon.run()   → results["dns"]
       ├── whois_lookup.run() → results["whois"]
       ├── crt_sh.run()      → results["crt"]
       ├── wayback.run()     → results["wayback"]
       ├── censys.run()      → results["censys"]  (skipped si no hay key)
       ├── shodan.run()      → results["shodan"]  (skipped si no hay key)
       └── hunter.run()      → results["hunter"]  (skipped si no hay key)
       │
       ▼
5. Serialización: JSON o HTML
       │
       ▼
6. Resumen en consola con colores
```

---

## Autor

**Alexander Villarroel Torrico**
Estudiante de Ingeniería Informática — UMSA, La Paz, Bolivia
[![GitHub](https://img.shields.io/badge/GitHub-villaalextor-181717?style=flat-square&logo=github)](https://github.com/villaalextor)

---

*Parte del [Cóndor Framework](../README.md) — Pipeline de reconocimiento pasivo OSINT*
