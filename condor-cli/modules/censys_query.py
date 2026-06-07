"""
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

API KEY (gratuita):
  1. Registrarse en https://accounts.censys.io/register
  2. Ir a https://search.censys.io/account/api
  3. Copiar API ID y API Secret
  4. Guardar en condor-cli/.env:
       CENSYS_API_ID=tu_api_id
       CENSYS_API_SECRET=tu_api_secret

  Plan gratuito: 250 queries/mes — suficiente para uso académico.

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
"""

import requests
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger("condor.censys")

# ─────────────────────────────────────────────
#  Endpoints de la API v2 de Censys
# ─────────────────────────────────────────────
CENSYS_API_BASE    = "https://search.censys.io/api/v2"
CENSYS_HOSTS_SEARCH = f"{CENSYS_API_BASE}/hosts/search"
CENSYS_HOST_DETAIL  = f"{CENSYS_API_BASE}/hosts/{{ip}}"

# ─────────────────────────────────────────────
#  Puertos críticos — su exposición es hallazgo
# ─────────────────────────────────────────────
CRITICAL_PORTS = {
    21:   "FTP — transferencia de archivos sin cifrado",
    22:   "SSH — acceso remoto",
    23:   "Telnet — acceso remoto SIN cifrado",
    25:   "SMTP — servidor de correo",
    53:   "DNS — servidor DNS expuesto",
    80:   "HTTP — web sin cifrado",
    110:  "POP3 — correo sin cifrado",
    143:  "IMAP — correo sin cifrado",
    443:  "HTTPS — web con TLS",
    445:  "SMB — compartición de archivos Windows",
    1433: "MSSQL — base de datos Microsoft SQL Server",
    1521: "Oracle DB — base de datos Oracle",
    3306: "MySQL — base de datos MySQL",
    3389: "RDP — escritorio remoto Windows",
    5432: "PostgreSQL — base de datos PostgreSQL",
    5900: "VNC — escritorio remoto",
    6379: "Redis — base de datos en memoria",
    8080: "HTTP alternativo — frecuente en dev/proxies",
    8443: "HTTPS alternativo",
    9200: "Elasticsearch — motor de búsqueda",
    27017:"MongoDB — base de datos NoSQL",
}

# Puertos que NO deberían estar expuestos públicamente
DANGEROUS_PORTS = [23, 445, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 9200, 27017]


# ─────────────────────────────────────────────
#  Carga de credenciales
# ─────────────────────────────────────────────
def load_credentials() -> tuple[str, str] | tuple[None, None]:
    """
    Carga las credenciales de Censys desde variables de entorno.

    Orden de búsqueda:
      1. Variables de entorno del sistema (export CENSYS_API_ID=...)
      2. Archivo .env en el directorio actual (cargado por condor.py)

    Retorna (api_id, api_secret) o (None, None) si no están configuradas.
    """
    api_id     = os.getenv("CENSYS_API_ID")
    api_secret = os.getenv("CENSYS_API_SECRET")

    if not api_id or not api_secret:
        logger.warning(
            "[CENSYS] Credenciales no encontradas. "
            "Configura CENSYS_API_ID y CENSYS_API_SECRET en .env"
        )
        return None, None

    logger.debug(f"[CENSYS] Credenciales cargadas — API ID: {api_id[:8]}...")
    return api_id, api_secret


# ─────────────────────────────────────────────
#  Búsqueda de hosts por dominio
# ─────────────────────────────────────────────
def search_hosts_by_domain(target: str, api_id: str, api_secret: str, timeout: int) -> list:
    """
    Busca en Censys todos los hosts asociados al dominio.

    Usa la query de Censys Search Language (CSL):
      dns.reverse_dns.reverse_dns: "ejemplo.bo"
    
    Esto encuentra IPs cuyo reverse DNS apunta al dominio
    o subdominios del mismo.

    También busca por certificados TLS que contengan el dominio:
      services.tls.certificates.leaf_data.subject.common_name: "ejemplo.bo"

    Retorna lista de IPs encontradas.
    """
    ips = set()

    # Query 1: Reverse DNS
    queries = [
        f'dns.reverse_dns.reverse_dns: "{target}"',
        f'services.tls.certificates.leaf_data.subject.common_name: "*.{target}"',
        f'services.tls.certificates.leaf_data.names: "{target}"',
    ]

    for query in queries:
        try:
            logger.debug(f"  Censys query: {query}")
            response = requests.get(
                CENSYS_HOSTS_SEARCH,
                params={"q": query, "per_page": 25},
                auth=(api_id, api_secret),
                timeout=timeout,
                headers={"Accept": "application/json"}
            )

            if response.status_code == 401:
                logger.error("  Censys: Credenciales inválidas (401 Unauthorized)")
                return []

            if response.status_code == 429:
                logger.warning("  Censys: Rate limit alcanzado")
                break

            if response.status_code != 200:
                logger.warning(f"  Censys: Status {response.status_code} para query: {query}")
                continue

            data = response.json()
            hits = data.get("result", {}).get("hits", [])

            for hit in hits:
                ip = hit.get("ip")
                if ip:
                    ips.add(ip)

            logger.debug(f"  Query retornó {len(hits)} hits")

        except requests.Timeout:
            logger.warning(f"  Censys: Timeout en query: {query[:50]}...")
        except Exception as e:
            logger.error(f"  Censys: Error en query — {e}")

    logger.info(f"  Censys: {len(ips)} IPs encontradas")
    return list(ips)


# ─────────────────────────────────────────────
#  Detalle de host por IP
# ─────────────────────────────────────────────
def fetch_host_detail(ip: str, api_id: str, api_secret: str, timeout: int) -> dict | None:
    """
    Consulta el detalle completo de un host por IP.
    
    La respuesta incluye todos los servicios detectados por Censys
    en el último escaneo, con sus puertos, protocolos, banners y TLS.

    Estructura de la respuesta de Censys v2:
    {
      "result": {
        "ip": "1.2.3.4",
        "services": [
          {
            "port": 443,
            "transport_protocol": "TCP",
            "service_name": "HTTPS",
            "banner": "...",
            "tls": { ... }
          }
        ],
        "dns": { "reverse_dns": { "reverse_dns": ["host.ejemplo.bo"] } }
      }
    }
    """
    url = CENSYS_HOST_DETAIL.format(ip=ip)

    try:
        response = requests.get(
            url,
            auth=(api_id, api_secret),
            timeout=timeout,
            headers={"Accept": "application/json"}
        )

        if response.status_code == 404:
            logger.debug(f"  IP {ip} no encontrada en Censys")
            return None

        if response.status_code != 200:
            logger.warning(f"  Censys host detail: Status {response.status_code} para {ip}")
            return None

        return response.json().get("result", {})

    except requests.Timeout:
        logger.warning(f"  Timeout al obtener detalle de {ip}")
    except Exception as e:
        logger.error(f"  Error al obtener detalle de {ip}: {e}")

    return None


# ─────────────────────────────────────────────
#  Parseo de certificados TLS
# ─────────────────────────────────────────────
def parse_tls(service: dict) -> dict | None:
    """
    Extrae información del certificado TLS de un servicio.

    Analiza:
      - Common Name (CN) del certificado
      - Subject Alternative Names (SANs) — subdominios cubiertos
      - Emisor (CA) — Let's Encrypt, DigiCert, self-signed, etc.
      - Fechas de validez
      - Si está autofirmado (self-signed)
      - Días restantes para expiración
    """
    tls_data = service.get("tls", {})
    if not tls_data:
        return None

    cert = (
        tls_data.get("certificates", {})
                .get("leaf_data", {})
    )
    if not cert:
        return None

    # Extraer campos
    subject     = cert.get("subject", {})
    issuer_data = cert.get("issuer", {})
    cn          = subject.get("common_name", [])
    cn          = cn[0] if isinstance(cn, list) and cn else cn or ""

    # SANs (Subject Alternative Names)
    names = cert.get("names", [])
    sans  = names if isinstance(names, list) else []

    # Emisor
    issuer_org = issuer_data.get("organization", [])
    issuer     = issuer_org[0] if isinstance(issuer_org, list) and issuer_org else str(issuer_org)

    # Fechas de validez
    validity     = cert.get("validity", {})
    valid_from   = validity.get("start", "")
    valid_to     = validity.get("end", "")

    # Días para expiración
    days_to_expire = None
    expired        = False
    if valid_to:
        try:
            # Formato ISO de Censys: "2025-06-01T00:00:00Z"
            exp_dt = datetime.fromisoformat(valid_to.replace("Z", "+00:00"))
            now    = datetime.now(timezone.utc)
            days_to_expire = (exp_dt - now).days
            expired = days_to_expire < 0
        except Exception:
            pass

    # Self-signed: el emisor y el subject son la misma org
    subject_org = subject.get("organization", [])
    subject_org = subject_org[0] if isinstance(subject_org, list) and subject_org else ""
    self_signed = bool(issuer and subject_org and issuer.lower() == subject_org.lower())

    if expired:
        logger.warning(f"  ⚠ Certificado EXPIRADO: CN={cn} (hace {abs(days_to_expire)} días)")
    elif days_to_expire is not None and days_to_expire < 30:
        logger.warning(f"  ⚠ Certificado por expirar: CN={cn} ({days_to_expire} días)")
    if self_signed:
        logger.warning(f"  ⚠ Certificado autofirmado: CN={cn}")

    return {
        "certificate_cn":   cn,
        "sans":             sans,
        "issuer":           issuer,
        "valid_from":       valid_from,
        "valid_to":         valid_to,
        "days_to_expire":   days_to_expire,
        "expired":          expired,
        "self_signed":      self_signed,
    }


# ─────────────────────────────────────────────
#  Parseo de host completo
# ─────────────────────────────────────────────
def parse_host(host_data: dict) -> dict:
    """
    Toma el JSON crudo de Censys para un host y lo normaliza
    al formato estándar del módulo.

    Extrae todos los servicios con sus puertos, protocolos,
    banners y datos TLS.
    """
    ip       = host_data.get("ip", "")
    services = host_data.get("services", [])

    # Hostname via reverse DNS
    dns_data  = host_data.get("dns", {})
    rev_dns   = dns_data.get("reverse_dns", {}).get("reverse_dns", [])
    hostname  = rev_dns[0] if rev_dns else ""

    parsed_services = []
    ports = []

    for svc in services:
        port          = svc.get("port", 0)
        protocol      = svc.get("transport_protocol", "TCP")
        service_name  = svc.get("service_name", "UNKNOWN")
        banner        = svc.get("banner", "") or svc.get("software", {}).get("product", "")

        ports.append(port)

        # TLS si el servicio lo usa
        tls = parse_tls(svc)

        service_entry = {
            "port":         port,
            "protocol":     protocol,
            "service_name": service_name,
            "banner":       banner[:200] if banner else "",  # Limitar longitud
        }
        if tls:
            service_entry["tls"] = tls

        # Alerta si el puerto es crítico
        if port in DANGEROUS_PORTS:
            logger.warning(f"  ⚠ Puerto peligroso expuesto: {port} ({CRITICAL_PORTS.get(port, '')})")

        parsed_services.append(service_entry)

    return {
        "ip":       ip,
        "hostname": hostname,
        "ports":    sorted(set(ports)),
        "services": sorted(parsed_services, key=lambda s: s["port"]),
    }


# ─────────────────────────────────────────────
#  Análisis de riesgo global
# ─────────────────────────────────────────────
def analyze_risk(hosts: list) -> dict:
    """
    Evalúa el nivel de riesgo de la infraestructura completa.

    Agrega hallazgos de todos los hosts y determina:
      - Puertos críticos expuestos
      - Servicios únicos detectados
      - Problemas con certificados TLS
      - Nivel de riesgo global
    """
    all_ports      = set()
    all_services   = set()
    critical_open  = []
    dangerous_open = []
    expired_certs  = []
    self_signed    = []
    tls_issues     = []

    for host in hosts:
        for port in host.get("ports", []):
            all_ports.add(port)
            if port in CRITICAL_PORTS:
                critical_open.append(port)
            if port in DANGEROUS_PORTS:
                dangerous_open.append(port)

        for svc in host.get("services", []):
            all_services.add(svc.get("service_name", "UNKNOWN"))
            tls = svc.get("tls")
            if tls:
                if tls.get("expired"):
                    msg = f"{host['ip']}:{svc['port']} — Certificado EXPIRADO (CN: {tls['certificate_cn']})"
                    expired_certs.append(msg)
                    tls_issues.append(msg)
                elif tls.get("days_to_expire") is not None and tls["days_to_expire"] < 30:
                    msg = f"{host['ip']}:{svc['port']} — Expira en {tls['days_to_expire']} días"
                    tls_issues.append(msg)
                if tls.get("self_signed"):
                    msg = f"{host['ip']}:{svc['port']} — Certificado AUTOFIRMADO (CN: {tls['certificate_cn']})"
                    self_signed.append(msg)
                    tls_issues.append(msg)

    # Nivel de riesgo
    if dangerous_open or expired_certs:
        risk = "CRÍTICO"
    elif self_signed or len(critical_open) > 5:
        risk = "ALTO"
    elif critical_open:
        risk = "MEDIO"
    else:
        risk = "BAJO"

    return {
        "risk_level":            risk,
        "exposed_services":      sorted(all_services),
        "all_open_ports":        sorted(all_ports),
        "critical_ports_open":   sorted(set(critical_open)),
        "dangerous_ports_open":  sorted(set(dangerous_open)),
        "has_expired_certs":     bool(expired_certs),
        "has_self_signed_certs": bool(self_signed),
        "tls_issues":            tls_issues,
        "port_descriptions": {
            str(p): CRITICAL_PORTS[p]
            for p in sorted(set(critical_open))
            if p in CRITICAL_PORTS
        }
    }


# ─────────────────────────────────────────────
#  Función principal — contrato con condor.py
# ─────────────────────────────────────────────
def run(target: str, timeout: int = 10) -> dict:
    """
    Punto de entrada del módulo. Llamado por condor.py así:
      data = mod.run(target=target, timeout=timeout)

    Ejecuta:
      1. Carga credenciales de Censys desde .env
      2. Busca IPs asociadas al dominio (3 queries CSL)
      3. Para cada IP, obtiene detalle completo de servicios
      4. Parsea hosts, puertos, banners y TLS
      5. Evalúa riesgo global
      6. Retorna dict estructurado

    Args:
      target  : Dominio limpio, ej: "ejemplo.bo"
      timeout : Segundos máximos por consulta

    Returns:
      dict con hosts, servicios, puertos y análisis de riesgo
    """
    logger.info(f"[CENSYS] Iniciando reconocimiento para: {target}")

    # ── 1. Credenciales ──────────────────────
    api_id, api_secret = load_credentials()
    if not api_id:
        return {
            "status":  "skipped",
            "message": "Credenciales CENSYS_API_ID/CENSYS_API_SECRET no configuradas. "
                       "Registrarse gratis en https://accounts.censys.io/register"
        }

    # ── 2. Buscar IPs ────────────────────────
    logger.info("[CENSYS] Buscando hosts asociados al dominio...")
    ips = search_hosts_by_domain(target, api_id, api_secret, timeout)

    if not ips:
        logger.info("[CENSYS] No se encontraron hosts en Censys para este dominio")
        return {
            "status":  "ok",
            "hosts":   [],
            "summary": {"total_hosts": 0, "total_ports": 0},
            "analysis": {"risk_level": "DESCONOCIDO"}
        }

    # ── 3. Detalle de cada host ──────────────
    logger.info(f"[CENSYS] Obteniendo detalle de {len(ips)} hosts...")
    hosts = []

    for ip in ips:
        logger.debug(f"  Consultando detalle para IP: {ip}")
        host_data = fetch_host_detail(ip, api_id, api_secret, timeout)
        if host_data:
            parsed = parse_host(host_data)
            hosts.append(parsed)
            logger.info(
                f"  ✓ {ip} — {len(parsed['ports'])} puertos | "
                f"{len(parsed['services'])} servicios"
            )

    # ── 4. Análisis de riesgo ────────────────
    logger.info("[CENSYS] Evaluando riesgo de infraestructura...")
    analysis = analyze_risk(hosts)
    logger.info(f"[CENSYS] Riesgo evaluado: {analysis['risk_level']}")

    # ── 5. Resultado final ───────────────────
    all_ports    = analysis["all_open_ports"]
    all_services = analysis["exposed_services"]

    result = {
        "status":  "ok",
        "hosts":   hosts,
        "summary": {
            "total_hosts":    len(hosts),
            "total_ports":    len(all_ports),
            "open_ports":     all_ports,
            "services_found": all_services,
            "tls_issues":     analysis["tls_issues"],
        },
        "analysis": analysis,
    }

    logger.info(
        f"[CENSYS] Completado — "
        f"{len(hosts)} hosts | "
        f"{len(all_ports)} puertos únicos | "
        f"Riesgo: {analysis['risk_level']}"
    )

    return result