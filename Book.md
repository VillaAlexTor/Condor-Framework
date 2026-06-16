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