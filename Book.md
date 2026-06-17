Es un libro que nos ayuda a entender el funcionamiento completo de lo que es el sistema, archivo por archivo
╔══════════════════════════════════════════════════════╗
║        Entrypoint principal del CLI de OSINT         ║
║  Uso   : python condor.py --target ejemplo.com       ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Es el programa principal. Recibe argumentos del usuario,
  ejecuta los módulos de reconocimiento seleccionados,
  agrega los resultados y genera el output (JSON o HTML).

MÓDULOS DISPONIBLES:
  dns     → Registros DNS (A, MX, NS, TXT, CNAME)
  whois   → Información WHOIS del dominio
  crt     → Subdominios via Certificate Transparency (crt.sh)
  censys  → Puertos y servicios via Censys.io API
  shodan  → Banners y tecnologías via Shodan API
  wayback → URLs históricas via Wayback Machine
  hunter  → Emails corporativos via Hunter.io API

USO:
  python condor.py --target ejemplo.com
  python condor.py --target ejemplo.com --modules dns,whois,crt
  python condor.py --target ejemplo.com --format html --output reporte.html
  python condor.py --target ejemplo.com --verbose --log condor.log


╔══════════════════════════════════════════════════════╗
║   CÓNDOR FRAMEWORK — docker-compose.yml (raíz)       ║
╚══════════════════════════════════════════════════════╝

Levanta el dashboard y el report generator juntos.
condor-cli NO se incluye aquí porque es un CLI que se
ejecuta puntualmente (python condor.py --target ...),
no un servicio de larga duración.

USO:
   docker-compose up -d          # Levantar todo
   docker-compose up dashboard   # Solo el dashboard
   docker-compose logs -f report-backend
   docker-compose down

 URLs después de levantar:
   Dashboard:        http://localhost:5173
   Report Frontend:  http://localhost:5174
   Report Backend:   http://localhost:3001

╔══════════════════════════════════════════════════════╗
║      CÓNDOR FRAMEWORK — condor-cli/.env.example      ║
╚══════════════════════════════════════════════════════╝

INSTRUCCIONES:
  1. Copiar este archivo: cp .env.example .env#
  2. Completar los valores reales en .env
  3. NUNCA subir .env a GitHub — ya está en .gitignore

Los módulos que no tengan API key configurada
retornarán status: "skipped" sin romper el escaneo.#
Los módulos sin API key (dns, whois, wayback, crt)
funcionan sin configuración adicional.
 ────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════╗
║       CÓNDOR FRAMEWORK — condor-cli/requirements.txt ║
╚══════════════════════════════════════════════════════╝
Instalación:
  pip install -r requirements.txt
Versiones fijadas para reproducibilidad.
  Probado con Python 3.11+

╔══════════════════════════════════════════════════════╗
║      CÓNDOR FRAMEWORK — modules/censys_query.py      ║
║    Reconocimiento de puertos y servicios via Censys  ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Módulo de reconocimiento de infraestructura. Consulta la
  API v2 de Censys.io para obtener información sobre los
  hosts asociados al dominio objetivo.

  Censys escanea periódicamente todo el espacio IPv4 público
  y almacena los resultados. Nosotros solo consultamos su
  base de datos — el objetivo nunca recibe tráfico.

  Descubre:
    - IPs públicas asociadas al dominio
    - Puertos abiertos por IP
    - Servicios corriendo (HTTP, HTTPS, SSH, FTP, etc.)
    - Versiones de software expuestas (banners)
    - Certificados TLS (CN, SANs, emisor, expiración)
    - Tecnologías web detectadas por Censys

DEPENDENCIAS:
  pip install requests

CONTRATO CON condor.py:
  Debe exponer: run(target: str, timeout: int) -> dict
  El dict retornado se almacena en report["results"]["censys"]

ESTRUCTURA DEL OUTPUT:
  {
    "hosts": [
      {
        "ip":       str,
        "hostname": str,
        "ports":    [int, ...],
        "services": [
          {
            "port":        int,
            "protocol":    str,   # TCP/UDP
            "service_name": str,  # HTTP, SSH, FTP, etc.
            "banner":      str,   # Software + versión si disponible
            "tls": {              # Solo si el servicio usa TLS
              "certificate_cn":   str,
              "sans":             [str],
              "issuer":           str,
              "valid_from":       str,
              "valid_to":         str,
              "days_to_expire":   int,
              "self_signed":      bool,
            }
          }
        ]
      }
    ],
    "summary": {
      "total_hosts":    int,
      "total_ports":    int,
      "open_ports":     [int,...],  # Todos los puertos únicos
      "services_found": [str,...],  # Servicios únicos
      "tls_issues":     [str,...],  # Certs expirados o self-signed
    },
    "analysis": {
      "risk_level":              str,
      "exposed_services":        [str,...],
      "critical_ports_open":     [int,...],
      "has_expired_certs":       bool,
      "has_self_signed_certs":   bool,
    }
  }

╔══════════════════════════════════════════════════════╗
║      CÓNDOR FRAMEWORK — modules/crt_sh.py            ║
║   Subdominios via Certificate Transparency Logs      ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Módulo dedicado a la consulta de crt.sh.
  Descubre subdominios registrados históricamente en
  certificados TLS/SSL públicos (CT Logs).

  Nota: dns_recon.py ya incluye crt.sh como parte de su
  pipeline. Este módulo independiente permite ejecutar
  SOLO crt.sh con mayor control: paginación, filtros
  de wildcards, deduplicación avanzada y análisis de
  proveedores de certificados.

DEPENDENCIAS:
  pip install requests

CONTRATO CON condor.py:
  Debe exponer: run(target: str, timeout: int) -> dict
  El dict retornado se almacena en report["results"]["crt"]

ESTRUCTURA DEL OUTPUT:
  {
    "subdomains":   [str, ...],   # Subdominios únicos encontrados
    "total":        int,          # Total antes de deduplicar
    "unique":       int,          # Total después de deduplicar
    "wildcards":    [str, ...],   # Certificados wildcard detectados
    "issuers":      {str: int},   # CAs que emitieron los certs
    "analysis": {
      "deepest_subdomain": str,   # El subdominio con más niveles
      "max_depth":         int,   # Nivel más profundo encontrado
      "interesting":       [str], # Subdominios con nombres sensibles
    }
  }

╔══════════════════════════════════════════════════════╗
║       CÓNDOR FRAMEWORK — modules/dns_recon.py        ║
║     Reconocimiento DNS pasivo + crt.sh subdomains    ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Módulo de reconocimiento DNS. Consulta registros públicos
  del dominio objetivo sin generar tráfico directo hacia él.
  
  También consulta crt.sh (Certificate Transparency Logs)
  para descubrir subdominios registrados históricamente
  en certificados TLS/SSL públicos.

DEPENDENCIAS:
  pip install dnspython requests

CONTRATO CON condor.py:
  Debe exponer: run(target: str, timeout: int) -> dict
  El dict retornado se almacena en report["results"]["dns"]

ESTRUCTURA DEL OUTPUT:
  {
    "records": {
      "A":     [...],   # IPs del dominio
      "MX":    [...],   # Servidores de correo
      "NS":    [...],   # Nameservers autoritativos
      "TXT":   [...],   # SPF, DMARC, DKIM, verificaciones
      "CNAME": [...]    # Alias (si aplica)
    },
    "subdomains": [...],  # Descubiertos via crt.sh
    "summary": {
      "total_records": N,
      "total_subdomains": N,
      "has_spf": bool,
      "has_dmarc": bool,
      "has_dkim": bool
    }
  }

╔══════════════════════════════════════════════════════╗
║      CÓNDOR FRAMEWORK — modules/hunter_lookup.py     ║
║    Reconocimiento de emails corporativos via Hunter  ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Módulo de reconocimiento de emails. Consulta la API de
  Hunter.io para descubrir emails corporativos asociados
  al dominio objetivo, el patrón de formato que usan y
  las fuentes públicas donde fueron encontrados.

  Hunter.io agrega emails de fuentes públicas: sitios web,
  documentos PDF, GitHub, LinkedIn, etc. Nosotros consultamos
  su índice — no hacemos scraping directo del objetivo.

  Descubre:
    - Emails corporativos verificados y no verificados
    - Patrón de formato: {first}.{last}@empresa.com
    - Nombres y cargos de empleados (si están disponibles)
    - Fuentes donde fue encontrado cada email
    - Confianza del email (score 0-100)
    - Departamentos de la organización
    - Total de emails indexados por Hunter

  Relevancia para OSINT:
    - Superficie de ataque para phishing dirigido (spear phishing)
    - Identificación de personal clave (IT, RRHH, Dirección)
    - El patrón permite construir listas de emails probables
    - Emails + LinkedIn = perfil completo de empleado

DEPENDENCIAS:
  pip install requests

API KEY (gratuita con limitaciones):
  1. Registrarse en https://hunter.io/users/sign_up
  2. Ir a https://hunter.io/api-keys
  3. Copiar la API key
  4. Guardar en condor-cli/.env:
       HUNTER_API_KEY=tu_api_key

  Plan gratuito: 25 búsquedas/mes — suficiente para uso académico.

CONTRATO CON condor.py:
  Debe exponer: run(target: str, timeout: int) -> dict
  El dict retornado se almacena en report["results"]["hunter"]

ESTRUCTURA DEL OUTPUT:
  {
    "domain":          str,
    "organization":    str,       # Nombre de la empresa
    "pattern":         str,       # Ej: "{first}.{last}"
    "total_emails":    int,       # Total indexado por Hunter
    "emails": [
      {
        "value":        str,      # email@dominio.com
        "type":         str,      # personal / generic
        "confidence":   int,      # 0-100
        "verified":     bool,
        "first_name":   str,
        "last_name":    str,
        "position":     str,      # Cargo/título
        "department":   str,
        "sources":      [str],    # URLs donde fue encontrado
        "last_found":   str,      # Fecha última aparición
      }
    ],
    "departments":     {str: int},# Conteo por departamento
    "risk_emails": {
      "it_staff":       [str],    # IT y seguridad — alto valor
      "executives":     [str],    # Dirección — alto valor
      "generic":        [str],    # info@, contact@ — bajo valor
    },
    "analysis": {
      "risk_level":           str,
      "has_pattern":          bool,
      "pattern_description":  str,
      "total_exposed":        int,
      "high_value_targets":   int,
      "phishing_risk":        str,
      "recommended_actions":  [str],
    }
  }

╔══════════════════════════════════════════════════════╗
║      CÓNDOR FRAMEWORK — modules/shodan_query.py      ║
║   Reconocimiento de servicios y CVEs via Shodan API  ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Módulo de reconocimiento de servicios. Consulta la API de
  Shodan para obtener banners de servicios, versiones exactas
  de software y vulnerabilidades CVE asociadas a los hosts
  del dominio objetivo.

  Shodan escanea el internet continuamente y almacena banners
  de todos los servicios que encuentra. Nosotros consultamos
  su índice — el objetivo nunca recibe tráfico directo.

  Diferencia con Censys:
    - Shodan tiene mejor cobertura de banners (más raw data)
    - Censys tiene mejor estructuración de datos TLS
    - Shodan mapea CVEs directamente a hosts
    - Usarlos juntos maximiza la cobertura

  Descubre:
    - IPs asociadas al dominio (via búsqueda por hostname)
    - Banners de servicios con versiones exactas de software
    - Vulnerabilidades CVE detectadas automáticamente por Shodan
    - Sistema operativo del servidor (si es detectable)
    - Organización y ASN del proveedor de hosting
    - Geolocalización de los hosts
    - Tecnologías web (via Shodan tags)

DEPENDENCIAS:
  pip install requests

API KEY (gratuita con limitaciones):
  1. Registrarse en https://account.shodan.io/register
  2. Ir a https://account.shodan.io → ver API Key
  3. Guardar en condor-cli/.env:
       SHODAN_API_KEY=tu_api_key

  Plan gratuito:
    - 1 query credit por búsqueda
    - 100 resultados por query
    - Sin acceso a búsqueda histórica
    - Suficiente para uso académico con dominios pequeños/medianos

  Plan académico (gratuito): https://developer.shodan.io/api/requirements

CONTRATO CON condor.py:
  Debe exponer: run(target: str, timeout: int) -> dict
  El dict retornado se almacena en report["results"]["shodan"]

ESTRUCTURA DEL OUTPUT:
  {
    "hosts": [
      {
        "ip":           str,
        "hostnames":    [str,...],
        "os":           str,
        "org":          str,
        "asn":          str,
        "isp":          str,
        "country":      str,
        "city":         str,
        "ports":        [int,...],
        "services": [
          {
            "port":     int,
            "protocol": str,
            "product":  str,    # Nombre del software
            "version":  str,    # Versión exacta
            "banner":   str,    # Raw banner del servicio
            "cpe":      [str],  # Common Platform Enumeration
          }
        ],
        "vulns": [
          {
            "cve_id":   str,    # CVE-2021-44228
            "cvss":     float,  # Score CVSS
            "severity": str,    # CRÍTICO/ALTO/MEDIO/BAJO
            "summary":  str,    # Descripción corta
          }
        ],
        "tags":         [str],  # cloud, cdn, tor, vpn, etc.
      }
    ],
    "summary": {
      "total_hosts":       int,
      "total_ports":       int,
      "total_vulns":       int,
      "critical_vulns":    int,
      "open_ports":        [int,...],
      "software_detected": [str,...],
    },
    "analysis": {
      "risk_level":        str,
      "has_critical_cve":  bool,
      "top_vulns":         [dict,...],  # Top 5 por CVSS score
      "exposed_software":  [str,...],
      "hosting_info": {
        "org": str,
        "asn": str,
        "isp": str,
      }
    }
  }

╔══════════════════════════════════════════════════════╗
║       CÓNDOR FRAMEWORK — modules/wayback.py          ║
║     Reconocimiento histórico via Wayback Machine     ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Módulo de reconocimiento histórico. Consulta la CDX API
  de la Wayback Machine (archive.org) para descubrir URLs
  históricas del dominio objetivo.

  Esto puede revelar:
    - Rutas y endpoints que ya no existen en el sitio actual
    - Paneles de administración expuestos en el pasado
    - Archivos sensibles (.env, .bak, .sql, config.php, etc.)
    - Tecnologías y frameworks usados históricamente
    - Subdominios activos en el pasado

  Todo sin generar tráfico al objetivo — solo consultas a
  archive.org que ya tiene los datos indexados.

DEPENDENCIAS:
  pip install requests

CONTRATO CON condor.py:
  Debe exponer: run(target: str, timeout: int) -> dict
  El dict retornado se almacena en report["results"]["wayback"]

ESTRUCTURA DEL OUTPUT:
  {
    "total_snapshots": int,       # Total de capturas en Wayback
    "first_seen":      str,       # Primera captura registrada
    "last_seen":       str,       # Última captura registrada
    "urls": {
      "all":           [str,...], # Todas las URLs únicas encontradas
      "interesting":   [str,...], # URLs con extensiones/rutas sensibles
      "by_extension":  {          # Agrupadas por tipo de archivo
        "php":  [str,...],
        "js":   [str,...],
        ...
      }
    },
    "status_codes":    {          # Distribución de códigos HTTP históricos
      "200": int,
      "404": int,
      ...
    },
    "findings": {
      "sensitive_files":  [str,...], # .env, .bak, config.*, etc.
      "admin_panels":     [str,...], # /admin, /wp-admin, /panel, etc.
      "api_endpoints":    [str,...], # /api/, /v1/, /rest/, etc.
      "backup_files":     [str,...], # .sql, .zip, .tar.gz, etc.
    },
    "analysis": {
      "has_sensitive_exposure": bool,
      "risk_level":             str,
      "years_of_history":       int,
    }
  }


╔══════════════════════════════════════════════════════╗
║      CÓNDOR FRAMEWORK — modules/whois_lookup.py      ║
║         Reconocimiento WHOIS del dominio objetivo    ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Módulo de consulta WHOIS. Extrae información pública sobre
  el registro del dominio: propietario, organización, fechas,
  registrar, nameservers y estado del dominio.

  También detecta si el dominio usa WHOIS Privacy (proxy),
  calcula días para expiración, y evalúa riesgos básicos.

DEPENDENCIAS:
  pip install python-whois

CONTRATO CON condor.py:
  Debe exponer: run(target: str, timeout: int) -> dict
  El dict retornado se almacena en report["results"]["whois"]

ESTRUCTURA DEL OUTPUT:
  {
    "registrar":       str,        # Empresa registradora
    "registered_on":  str,         # Fecha de creación
    "updated_on":     str,         # Última actualización
    "expires_on":     str,         # Fecha de expiración
    "days_to_expire": int,         # Días restantes
    "status":         [str, ...],  # clientTransferProhibited, etc.
    "nameservers":    [str, ...],  # NS del registro WHOIS
    "owner": {
      "name":         str,
      "org":          str,
      "email":        str,
      "country":      str,
      "city":         str,
    },
    "privacy_protected": bool,     # ¿Usa WHOIS Privacy?
    "analysis": {
      "expiring_soon":     bool,   # < 90 días para expirar
      "recently_created":  bool,   # < 1 año de antigüedad
      "privacy_risk":      str,    # ALTO/BAJO
      "expiry_risk":       str,    # ALTO/MEDIO/BAJO
    }
  }

╔══════════════════════════════════════════════════════╗
║   CÓNDOR FRAMEWORK — condor-dashboard/src/main.jsx   ║
║   Entrypoint de la aplicación React                  ║
╚══════════════════════════════════════════════════════╝
Monta App.jsx en el DOM e importa los estilos globales
(Tailwind + fuentes).

╔══════════════════════════════════════════════════════╗
║  CÓNDOR FRAMEWORK — condor-dashboard/postcss.config.js║
╚══════════════════════════════════════════════════════╝
  PostCSS procesa el CSS antes de que Vite lo sirva.
  Tailwind necesita este archivo para inyectar sus utilidades.

╔══════════════════════════════════════════════════════╗
║   CÓNDOR FRAMEWORK — condor-dashboard/vite.config.js ║
╚══════════════════════════════════════════════════════╝
  Configuración Vite para el dashboard React.
  Puerto 5173 (default de Vite) — consume JSON local,
  no necesita proxy a ningún backend.


 ╔══════════════════════════════════════════════════════╗
 ║      CÓNDOR FRAMEWORK — condor-dashboard/App.jsx     ║
 ║         Componente raíz — layout y navegación        ║
 ╚══════════════════════════════════════════════════════╝
 
 DESCRIPCIÓN:
  Componente principal del dashboard. Maneja:
      1. Carga del JSON generado por condor-cli
      2. Estado global del reporte
      3. Layout principal (sidebar + contenido)
      4. Navegación entre vistas (Overview, DNS, WHOIS, etc.)
  ESTÉTICA:
    Dark terminal — inspirado en interfaces de seguridad reales.
    Paleta: fondo casi negro (#0a0e17), verde neón (#00ff88),
    cyan (#00d4ff), rojo alerta (#ff3b3b).
    Tipografía: JetBrains Mono (monospace) para datos técnicos,
    Syne para headers — contraste legible/display.

 ╔══════════════════════════════════════════════════════╗
 ║   CÓNDOR FRAMEWORK — components/CensysView.jsx       ║
 ║   Vista detallada del módulo Censys                  ║
 ╚══════════════════════════════════════════════════════╝
 
 DESCRIPCIÓN:
  Visualización completa de los resultados del módulo censys_query.
  Muestra:
    - Hosts descubiertos con sus IPs y hostnames
    - Puertos abiertos por host con servicios detectados
    - Certificados TLS (CN, SANs, emisor, expiración)
    - Puertos peligrosos expuestos
    - Issues de TLS (expirados, autofirmados)
    - Mapa visual de puertos por host
  PROPS:
    data   → results.censys del reporte condor-cli
    report → reporte completo

 ╔══════════════════════════════════════════════════════╗
 ║   CÓNDOR FRAMEWORK — components/DnsView.jsx          ║
 ║   Vista detallada del módulo DNS                     ║
 ╚══════════════════════════════════════════════════════╝
 DESCRIPCIÓN:
  Visualización completa de los resultados del módulo dns_recon.
   Muestra:
     - Registros DNS por tipo (A, MX, NS, TXT, CNAME)
     - Subdominios descubiertos via crt.sh
     - Análisis visual de seguridad de email (SPF/DMARC/DKIM)
     - Evaluación de riesgo de email spoofing

 PROPS:
    data   → results.dns del reporte condor-cli
    report → reporte completo (para acceder a meta.target)

 ╔══════════════════════════════════════════════════════╗
 ║   CÓNDOR FRAMEWORK — components/HunterView.jsx       ║
 ║   Vista detallada del módulo Hunter.io               ║
 ╚══════════════════════════════════════════════════════╝
 
 DESCRIPCIÓN:
  Visualización completa de los resultados del módulo hunter_lookup.
    Muestra:
      - Patrón de formato de emails corporativos
      - Clasificación: IT staff / Ejecutivos / Genéricos
      - Lista de emails con cargo, departamento y confianza
      - Distribución por departamento
      - Fuentes donde fueron encontrados
      - Análisis de riesgo de phishing y recomendaciones
 
  PROPS:
    data   → results.hunter del reporte condor-cli
    report → reporte completo

 ╔══════════════════════════════════════════════════════╗
 ║   CÓNDOR FRAMEWORK — components/Overview.jsx         ║
 ║   Vista principal — métricas globales y resumen      ║
 ╚══════════════════════════════════════════════════════╝
 
 DESCRIPCIÓN:
    Vista de resumen ejecutivo. Muestra de un vistazo:
      - Métricas globales del escaneo
      - Tarjeta de riesgo por módulo
      - Hallazgos críticos consolidados
      - Timeline del objetivo (WHOIS + Wayback)
      - Botones de navegación a cada módulo
 
  PROPS:
    data       → el report completo (meta + results + errors)
    onNavigate → función para navegar a otra vista

 ╔══════════════════════════════════════════════════════╗
 ║   CÓNDOR FRAMEWORK — components/ShodanView.jsx       ║
 ║   Vista detallada del módulo Shodan                  ║
 ╚══════════════════════════════════════════════════════╝
 
  DESCRIPCIÓN:
    Visualización completa de los resultados del módulo shodan_query.
    Muestra:
      - Hosts indexados con OS, org, ASN, geolocalización
      - CVEs detectados por Shodan con CVSS 3.1 y severidad
      - Banners de servicios con versiones de software
      - Gráfico de distribución de CVEs por severidad
      - Top vulnerabilidades ordenadas por CVSS score
      - Software expuesto con versiones
 
  PROPS:
    data   → results.shodan del reporte condor-cli
    report → reporte completo

 ╔══════════════════════════════════════════════════════╗
 ║   CÓNDOR FRAMEWORK — components/WaybackView.jsx      ║
 ║   Vista detallada del módulo Wayback Machine         ║
 ╚══════════════════════════════════════════════════════╝
 
  DESCRIPCIÓN:
    Visualización completa de los resultados del módulo wayback.
    Muestra:
      - Resumen temporal (primera/última captura, años de historial)
      - Hallazgos críticos: archivos sensibles, backups, paneles admin, APIs
      - Distribución de URLs por extensión (gráfico de barras)
      - Lista completa de URLs con buscador y filtros
      - Distribución de códigos HTTP históricos
 
  PROPS:
    data   → results.wayback del reporte condor-cli
    report → reporte completo

╔══════════════════════════════════════════════════════╗
║ CÓNDOR FRAMEWORK — components/WhoisView.jsx        ║
║   Vista detallada del módulo WHOIS                   ║
╚══════════════════════════════════════════════════════╝
 
  DESCRIPCIÓN:
   Visualización completa de los resultados del módulo whois_lookup.
    Muestra:
      - Datos del registrante (nombre, org, email, país)
      - Fechas de registro, actualización y expiración
      - Barra visual de vida útil del dominio
      - Estado del dominio y nameservers
      - Detección de WHOIS Privacy
      - Análisis de riesgo (expiración, privacidad)
 
  PROPS:
    data   → results.whois del reporte condor-cli
    report → reporte completo


 ╔══════════════════════════════════════════════════════╗
 ║   CÓNDOR FRAMEWORK — condor-report/cvss/calculator.js║
 ║   Motor matemático CVSS 3.1 — especificación FIRST   ║
 ╚══════════════════════════════════════════════════════╝

 DESCRIPCIÓN:
   Implementación completa del estándar CVSS 3.1 (Common
    Vulnerability Scoring System) según la especificación
    oficial del FIRST (Forum of Incident Response and
    Security Teams).
 
    Referencia: https://www.first.org/cvss/v3.1/specification-document
 
    Calcula:
      - Base Score (ISS, Impact, Exploitability)
      - Severity label (CRÍTICO / ALTO / MEDIO / BAJO / NINGUNO)
      - Vector string canónico (CVSS:3.1/AV:N/AC:L/...)
      - Desglose de sub-scores para UI de la calculadora
 
  USO:
    const { calculate } = require("./calculator")
 
    // Desde métricas individuales
    const result = calculate({ AV:"N", AC:"L", PR:"N", UI:"N", S:"U", C:"H", I:"H", A:"H" })
    // → { score: 9.8, severity: "CRÍTICO", vector: "CVSS:3.1/AV:N/..." }
 
    // Desde vector string
    const result = calculateFromVector("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")
    // → { score: 9.8, severity: "CRÍTICO", ... }


 ╔══════════════════════════════════════════════════════╗
 ║   CÓNDOR FRAMEWORK — condor-report/cvss/vectors.js   ║
 ║   Definiciones de métricas CVSS 3.1 para la UI       ║
 ╚══════════════════════════════════════════════════════╝
 
  DESCRIPCIÓN:
   Definiciones completas de cada métrica del vector CVSS 3.1:
      - Labels cortos y largos para botones y tooltips
      - Descripciones técnicas para mostrar al analista
      - Ejemplos concretos de situaciones reales
      - Colores por severidad para la UI
      - Orden canónico del vector string
 
    Este archivo NO hace cálculos — solo define metadata.
    El cálculo está en calculator.js.
 
  USO:
    const { METRICS, SEVERITY_DISPLAY, getVectorDescription } = require("./vectors")
 
    // Obtener opciones para el select de AV
    METRICS.AV.options  // → [{ value: "N", label: "Network", ... }, ...]
 
    // Describir un vector completo
    getVectorDescription({ AV:"N", AC:"L", PR:"N", UI:"N", S:"U", C:"H", I:"H", A:"H" })


 ╔══════════════════════════════════════════════════════╗
 ║  CÓNDOR FRAMEWORK — condor-report/generators/pdf.js  ║
 ║  Generador de informes PDF con Puppeteer             ║
 ╚══════════════════════════════════════════════════════╝
 
  DESCRIPCIÓN:
    Genera el informe de auditoría en formato PDF usando
    Puppeteer para renderizar HTML a PDF con calidad
    de impresión profesional.
 
    El proceso:
      1. Construye el HTML completo del informe en memoria
      2. Lanza Puppeteer (headless Chromium)
      3. Renderiza el HTML con CSS completo
      4. Exporta a PDF con márgenes y cabeceras profesionales
      5. Guarda el archivo y retorna la ruta
 
    Secciones del informe generado:
      - Portada (target, analista, fecha, clasificación)
      - Índice automático
      - Resumen ejecutivo (métricas, distribución CVSS)
      - Metodología (OSINT pasivo, herramientas)
      - Fichas de vulnerabilidad (una por hallazgo)
      - Recomendaciones generales
      - Conclusiones
 
  DEPENDENCIAS:
    npm install puppeteer
 
  USO:
    const { generatePDF } = require("./pdf")
    const pdfPath = await generatePDF({ meta, fichas, outputDir })

 ╔══════════════════════════════════════════════════════╗
 ║   CÓNDOR FRAMEWORK — condor-report/lib/importer.js   ║
 ║   Parser de JSON condor-cli → fichas automáticas     ║
 ╚══════════════════════════════════════════════════════╝
 
  DESCRIPCIÓN:
    Toma el JSON generado por condor-cli y extrae
    automáticamente todos los hallazgos de seguridad,
    convirtiéndolos en fichas de vulnerabilidad listas
    para editar en el FichaEditor.
 
    Procesa todos los módulos:
      - dns     → email spoofing (SPF/DMARC/DKIM)
      - whois   → expiración de dominio
      - wayback → archivos sensibles, backups, paneles admin
      - censys  → puertos peligrosos, TLS issues
      - shodan  → CVEs detectados, servicios peligrosos
      - hunter  → emails IT/ejecutivos expuestos, patrón
 
    Cada hallazgo genera una ficha con:
      - ID único (VULN-001, VULN-002, ...)
      - Vector CVSS 3.1 sugerido (desde vectors.js presets)
      - Descripción y evidencia pre-completadas
      - Recomendación base (completada por recommender.js)
      - Prioridad calculada desde el CVSS score
 
  USO:
    const { importFromJson } = require("./importer")
    const fichas = importFromJson(reportJson)
    // → [{ id: "VULN-001", titulo: "...", cvss: {...}, ... }]

 ╔══════════════════════════════════════════════════════╗
 ║  CÓNDOR FRAMEWORK — condor-report/lib/recommender.js ║
 ║  Motor de recomendaciones automáticas por categoría  ║
 ╚══════════════════════════════════════════════════════╝
 
  DESCRIPCIÓN:
    Genera recomendaciones de remediación para cada
    categoría de vulnerabilidad detectada por condor-cli.
 
    Cada recomendación incluye:
      - Acción inmediata (remediación directa)
      - Acciones de hardening adicionales
      - Referencias técnicas (RFC, OWASP, NIST, CVE)
      - SLA sugerido según severidad CVSS
      - Nivel de dificultad de implementación
 
  USO:
    const { getRecommendation, enrichFicha } = require("./recommender")
 
    // Obtener recomendación por categoría
    const rec = getRecommendation("email_spoofing", { has_spf: true })
 
    // Enriquecer una ficha completa
    const fichaEnriquecida = enrichFicha(ficha)

╔══════════════════════════════════════════════════════╗
║  CÓNDOR FRAMEWORK — backend/src/routes/cvss.js       ║
║  Rutas: calculadora CVSS 3.1 y presets               ║
╚══════════════════════════════════════════════════════╝
 
  ENDPOINTS:
    GET  /api/cvss/calculate?vector=CVSS:3.1/...   — desde vector string
    POST /api/cvss/calculate                        — desde métricas individuales
    GET  /api/cvss/presets                          — lista de vectores predefinidos
    GET  /api/cvss/presets/:id                      — preset específico
    GET  /api/cvss/suggest                          — sugiere preset por categoría
    GET  /api/cvss/metrics                          — definiciones de métricas (para UI)
    GET  /api/cvss/self-test                        — corre tests contra casos del FIRST

 ╔══════════════════════════════════════════════════════╗
 ║  CÓNDOR FRAMEWORK — backend/src/routes/ficha.js      ║
 ║  Rutas: recomendaciones y utilidades para fichas     ║
 ╚══════════════════════════════════════════════════════╝
 
  ENDPOINTS:
    GET  /api/ficha/categories               — categorías disponibles
    POST /api/ficha/recommend                — recomendación por categoría + contexto
    POST /api/ficha/enrich                   — enriquece una ficha individual
    POST /api/ficha/enrich-all               — enriquece un array de fichas
    POST /api/ficha/general-recommendations  — recomendaciones generales del informe
    POST /api/ficha/new                      — crea ficha vacía lista para editar

 ╔══════════════════════════════════════════════════════╗
 ║  CÓNDOR FRAMEWORK — backend/src/routes/report.js     ║
 ║  Rutas: importar JSON condor-cli + generar PDF       ║
 ╚══════════════════════════════════════════════════════╝
 
  ENDPOINTS:
    POST /api/report/import    — Importa JSON de condor-cli, genera fichas
    POST /api/report/generate  — Genera PDF desde fichas + metadata
    GET  /api/report/download/:filename — (servido como estático en server.js)

╔══════════════════════════════════════════════════════╗
║  CÓNDOR FRAMEWORK — CvssCalculator.vue               ║
║  Calculadora CVSS 3.1 interactiva                    ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Componente Vue 3 que implementa la calculadora CVSS 3.1
  interactiva. El analista selecciona el valor de cada
  métrica con botones y el score se calcula en tiempo real.

  Funcionalidades:
    - 8 métricas con botones de selección
    - Score calculado en tiempo real (fórmula CVSS 3.1)
    - Vector string generado automáticamente
    - Descripción de cada opción al hacer hover
    - Presets de vectores comunes
    - Emit del vector seleccionado al componente padre

PROPS:
  initialVector  — vector CVSS inicial (opcional)
  compact        — modo compacto para el FichaEditor

EMITS:
  update:vector  — { vector, score, severity, metrics }

╔══════════════════════════════════════════════════════╗
║  CÓNDOR FRAMEWORK — FichaEditor.vue                  ║
║  Editor completo de fichas de vulnerabilidad         ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Editor principal de fichas de vulnerabilidad.
  Permite crear y editar cada campo de una ficha,
  con la calculadora CVSS 3.1 integrada.

  Campos editables:
    - Título, categoría, fuente, CVE ID
    - Descripción, evidencia, impacto
    - Vector CVSS 3.1 (via CvssCalculator)
    - Recomendación de remediación
    - Referencias, estado, prioridad

PROPS:
  ficha    — ficha a editar (objeto completo)
  index    — índice en la lista de fichas

EMITS:
  update   — ficha actualizada
  delete   — eliminar esta ficha
  duplicate — duplicar esta ficha
