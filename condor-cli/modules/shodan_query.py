import requests
import logging
import os
from datetime import datetime

logger = logging.getLogger("condor.shodan")

# ─────────────────────────────────────────────
#  Endpoints de la API de Shodan
# ─────────────────────────────────────────────
SHODAN_API_BASE       = "https://api.shodan.io"
SHODAN_HOST_SEARCH    = f"{SHODAN_API_BASE}/shodan/host/search"
SHODAN_HOST_DETAIL    = f"{SHODAN_API_BASE}/shodan/host/{{ip}}"
SHODAN_DNS_RESOLVE    = f"{SHODAN_API_BASE}/dns/resolve"
SHODAN_DNS_REVERSE    = f"{SHODAN_API_BASE}/dns/reverse"

# ─────────────────────────────────────────────
#  Umbrales de severidad CVSS
# ─────────────────────────────────────────────
# Basado en CVSS v3.1 — mismo estándar que usaste en SEG-261
CVSS_SEVERITY = {
    "CRÍTICO": (9.0, 10.0),
    "ALTO":    (7.0,  8.9),
    "MEDIO":   (4.0,  6.9),
    "BAJO":    (0.1,  3.9),
    "NINGUNO": (0.0,  0.0),
}

def cvss_to_severity(score: float) -> str:
    """Convierte score CVSS 3.1 numérico a etiqueta de severidad."""
    if score >= 9.0: return "CRÍTICO"
    if score >= 7.0: return "ALTO"
    if score >= 4.0: return "MEDIO"
    if score >  0.0: return "BAJO"
    return "NINGUNO"


# ─────────────────────────────────────────────
#  Carga de credenciales
# ─────────────────────────────────────────────
def load_credentials() -> str | None:
    """
    Carga la API key de Shodan desde variables de entorno.
    Retorna el key string o None si no está configurado.
    """
    api_key = os.getenv("SHODAN_API_KEY")

    if not api_key:
        logger.warning(
            "[SHODAN] API key no encontrada. "
            "Configura SHODAN_API_KEY en .env — "
            "gratis en https://account.shodan.io/register"
        )
        return None

    logger.debug(f"[SHODAN] API key cargada: {api_key[:8]}...")
    return api_key


# ─────────────────────────────────────────────
#  Resolución DNS via Shodan
# ─────────────────────────────────────────────
def resolve_domain_to_ips(target: str, api_key: str, timeout: int) -> list:
    """
    Usa la API de resolución DNS de Shodan para obtener
    las IPs del dominio y subdominios conocidos.

    Shodan DNS resolve es diferente a la búsqueda general:
    - Es gratuito (no consume query credits)
    - Retorna IPs actuales del dominio

    También usamos búsqueda por hostname para encontrar
    IPs que Shodan indexó con ese hostname en sus banners.
    """
    ips = set()

    # ── Método 1: DNS resolve directo ────────
    try:
        resp = requests.get(
            SHODAN_DNS_RESOLVE,
            params={"hostnames": target, "key": api_key},
            timeout=timeout
        )
        if resp.status_code == 200:
            data = resp.json()
            for hostname, ip in data.items():
                if ip:
                    ips.add(ip)
                    logger.debug(f"  DNS resolve: {hostname} → {ip}")
    except Exception as e:
        logger.debug(f"  Shodan DNS resolve falló: {e}")

    # ── Método 2: Búsqueda por hostname ──────
    # Consume 1 query credit pero da mucha más información
    try:
        resp = requests.get(
            SHODAN_HOST_SEARCH,
            params={
                "key":   api_key,
                "query": f"hostname:{target}",
                "page":  1,
            },
            timeout=timeout
        )
        if resp.status_code == 200:
            data    = resp.json()
            matches = data.get("matches", [])
            for match in matches:
                ip = match.get("ip_str")
                if ip:
                    ips.add(ip)
            logger.debug(f"  Búsqueda hostname: {len(matches)} resultados")

        elif resp.status_code == 401:
            logger.error("  Shodan: API key inválida (401)")
            return []

        elif resp.status_code == 402:
            logger.warning("  Shodan: Sin query credits disponibles")

    except Exception as e:
        logger.error(f"  Shodan hostname search falló: {e}")

    logger.info(f"  Shodan: {len(ips)} IPs encontradas")
    return list(ips)


# ─────────────────────────────────────────────
#  Detalle de host
# ─────────────────────────────────────────────
def fetch_host_detail(ip: str, api_key: str, timeout: int) -> dict | None:
    """
    Obtiene el detalle completo de un host por IP.

    La respuesta de Shodan incluye:
      - Todos los puertos/servicios escaneados
      - Banners raw de cada servicio
      - Producto y versión detectados
      - CPE (Common Platform Enumeration)
      - Lista de CVEs detectados por Shodan
      - OS, org, ASN, ISP, ciudad, país
      - Tags (cloud, cdn, tor, honeypot, etc.)

    No consume query credits adicionales — el endpoint
    /shodan/host/{ip} es gratuito con cualquier plan.
    """
    url = SHODAN_HOST_DETAIL.format(ip=ip)

    try:
        resp = requests.get(
            url,
            params={"key": api_key},
            timeout=timeout
        )

        if resp.status_code == 404:
            logger.debug(f"  IP {ip} no en índice de Shodan")
            return None

        if resp.status_code == 401:
            logger.error("  Shodan: API key inválida")
            return None

        if resp.status_code != 200:
            logger.warning(f"  Shodan host detail: Status {resp.status_code} para {ip}")
            return None

        return resp.json()

    except requests.Timeout:
        logger.warning(f"  Timeout al obtener detalle de {ip}")
    except Exception as e:
        logger.error(f"  Error al obtener detalle de {ip}: {e}")

    return None


# ─────────────────────────────────────────────
#  Parseo de servicios
# ─────────────────────────────────────────────
def parse_services(raw_data: list) -> list:
    """
    Parsea la lista de servicios del JSON de Shodan.

    Cada entrada en raw_data["data"] representa un servicio
    escaneado en un puerto específico. Extraemos:
      - Puerto y protocolo
      - Producto y versión (si Shodan los detectó)
      - Banner raw (limitado a 500 chars)
      - CPE identifiers
    """
    services = []

    for svc in raw_data:
        port      = svc.get("port", 0)
        transport = svc.get("transport", "tcp").upper()
        product   = svc.get("product", "")
        version   = svc.get("version", "")
        banner    = svc.get("data", "").strip()
        cpe       = svc.get("cpe", []) or []

        # Módulos específicos con más info
        # Shodan tiene módulos para HTTP, SSH, TLS, etc.
        http_data = svc.get("http", {})
        ssh_data  = svc.get("ssh", {})

        # Info adicional de HTTP
        http_server  = ""
        http_title   = ""
        http_status  = None
        if http_data:
            http_server = http_data.get("server", "")
            http_title  = http_data.get("title", "")
            http_status = http_data.get("status")
            if http_server and not product:
                product = http_server

        # Fingerprint de SSH
        ssh_type = ""
        if ssh_data:
            ssh_type = ssh_data.get("type", "")

        service_entry = {
            "port":        port,
            "protocol":    transport,
            "product":     product,
            "version":     version,
            "banner":      banner[:500] if banner else "",
            "cpe":         cpe if isinstance(cpe, list) else [cpe],
        }

        # Agregar info HTTP si existe
        if http_data:
            service_entry["http"] = {
                "status": http_status,
                "title":  http_title,
                "server": http_server,
            }

        # Agregar info SSH si existe
        if ssh_data and ssh_type:
            service_entry["ssh_type"] = ssh_type

        services.append(service_entry)
        logger.debug(f"  Puerto {port}/{transport}: {product} {version}".strip())

    return sorted(services, key=lambda s: s["port"])


# ─────────────────────────────────────────────
#  Parseo de vulnerabilidades CVE
# ─────────────────────────────────────────────
def parse_vulns(vulns_raw: dict) -> list:
    """
    Parsea el dict de vulnerabilidades de Shodan.

    Shodan detecta CVEs comparando los banners/versiones
    con bases de datos de vulnerabilidades conocidas.
    El campo "vulns" del host es un dict:
      {
        "CVE-2021-44228": {
          "cvss": 10.0,
          "summary": "Apache Log4j2...",
          "references": [...]
        }
      }

    Los ordenamos por CVSS score descendente.
    """
    if not vulns_raw or not isinstance(vulns_raw, dict):
        return []

    vulns = []
    for cve_id, data in vulns_raw.items():
        cvss    = float(data.get("cvss", 0.0) or 0.0)
        summary = data.get("summary", "Sin descripción disponible")
        refs    = data.get("references", [])

        severity = cvss_to_severity(cvss)

        vuln_entry = {
            "cve_id":     cve_id,
            "cvss":       cvss,
            "severity":   severity,
            "summary":    summary[:300] if summary else "",
            "references": refs[:3],   # Solo primeras 3 referencias
        }
        vulns.append(vuln_entry)

        if severity in ("CRÍTICO", "ALTO"):
            logger.warning(f"  ⚠ {cve_id} — CVSS {cvss} ({severity}): {summary[:80]}...")

    # Ordenar por CVSS descendente
    return sorted(vulns, key=lambda v: v["cvss"], reverse=True)


# ─────────────────────────────────────────────
#  Parseo de host completo
# ─────────────────────────────────────────────
def parse_host(raw: dict) -> dict:
    """
    Normaliza el JSON crudo de Shodan para un host al
    formato estándar del módulo.
    """
    ip        = raw.get("ip_str", "")
    hostnames = raw.get("hostnames", [])
    os_name   = raw.get("os", "") or ""
    org       = raw.get("org", "") or ""
    asn       = raw.get("asn", "") or ""
    isp       = raw.get("isp", "") or ""
    country   = raw.get("country_name", "") or ""
    city      = raw.get("city", "") or ""
    tags      = raw.get("tags", []) or []

    # Timestamp del último escaneo de Shodan
    last_update = raw.get("last_update", "")

    # Lista de puertos únicos
    ports = sorted(set(raw.get("ports", [])))

    # Servicios
    services_raw = raw.get("data", [])
    services     = parse_services(services_raw)

    # Vulnerabilidades
    vulns_raw = raw.get("vulns", {})
    vulns     = parse_vulns(vulns_raw)

    if vulns:
        logger.info(f"  {ip}: {len(vulns)} CVEs detectados por Shodan")

    # Tags notables
    notable_tags = [t for t in tags if t in ["cloud", "cdn", "tor", "vpn", "honeypot", "scanner"]]
    if notable_tags:
        logger.info(f"  {ip}: Tags notables — {', '.join(notable_tags)}")

    return {
        "ip":          ip,
        "hostnames":   hostnames,
        "os":          os_name,
        "org":         org,
        "asn":         asn,
        "isp":         isp,
        "country":     country,
        "city":        city,
        "ports":       ports,
        "services":    services,
        "vulns":       vulns,
        "tags":        tags,
        "last_update": last_update,
    }


# ─────────────────────────────────────────────
#  Análisis de riesgo global
# ─────────────────────────────────────────────
def analyze_risk(hosts: list) -> dict:
    """
    Evalúa el riesgo global de todos los hosts combinados.

    Prioriza:
      1. CVEs críticos (CVSS >= 9.0) → riesgo CRÍTICO inmediato
      2. CVEs altos (CVSS >= 7.0)    → riesgo ALTO
      3. Software desactualizado      → riesgo MEDIO
      4. Sin CVEs detectados          → riesgo BAJO
    """
    all_ports        = set()
    all_software     = set()
    all_vulns        = []
    critical_cves    = []
    high_cves        = []
    hosting_info     = {"org": "", "asn": "", "isp": ""}

    for host in hosts:
        # Acumular puertos y software
        for port in host.get("ports", []):
            all_ports.add(port)

        for svc in host.get("services", []):
            product = svc.get("product", "")
            version = svc.get("version", "")
            if product:
                label = f"{product} {version}".strip()
                all_software.add(label)

        # Acumular CVEs
        for vuln in host.get("vulns", []):
            all_vulns.append(vuln)
            if vuln["severity"] == "CRÍTICO":
                critical_cves.append(vuln)
            elif vuln["severity"] == "ALTO":
                high_cves.append(vuln)

        # Info de hosting (tomar del primer host con datos)
        if not hosting_info["org"] and host.get("org"):
            hosting_info = {
                "org": host.get("org", ""),
                "asn": host.get("asn", ""),
                "isp": host.get("isp", ""),
            }

    # Top 5 CVEs por CVSS score
    top_vulns = sorted(all_vulns, key=lambda v: v["cvss"], reverse=True)[:5]

    # Nivel de riesgo
    if critical_cves:
        risk = "CRÍTICO"
    elif high_cves:
        risk = "ALTO"
    elif all_vulns:
        risk = "MEDIO"
    elif all_software:
        risk = "BAJO"
    else:
        risk = "DESCONOCIDO"

    return {
        "risk_level":       risk,
        "has_critical_cve": bool(critical_cves),
        "has_high_cve":     bool(high_cves),
        "total_cves":       len(all_vulns),
        "critical_cves":    critical_cves,
        "top_vulns":        top_vulns,
        "exposed_software": sorted(all_software),
        "all_open_ports":   sorted(all_ports),
        "hosting_info":     hosting_info,
    }


# ─────────────────────────────────────────────
#  Función principal — contrato con condor.py
# ─────────────────────────────────────────────
def run(target: str, timeout: int = 10) -> dict:
    """
    Punto de entrada del módulo. Llamado por condor.py así:
      data = mod.run(target=target, timeout=timeout)

    Ejecuta:
      1. Carga API key de Shodan desde .env
      2. Resuelve IPs del dominio via DNS + hostname search
      3. Para cada IP obtiene detalle completo
      4. Parsea servicios, banners, versiones y CVEs
      5. Evalúa riesgo global
      6. Retorna dict estructurado

    Args:
      target  : Dominio limpio, ej: "ejemplo.bo"
      timeout : Segundos máximos por consulta

    Returns:
      dict con hosts, servicios, CVEs y análisis de riesgo
    """
    logger.info(f"[SHODAN] Iniciando reconocimiento para: {target}")

    # ── 1. Credenciales ──────────────────────
    api_key = load_credentials()
    if not api_key:
        return {
            "status":  "skipped",
            "message": "SHODAN_API_KEY no configurada. "
                       "Registrarse gratis en https://account.shodan.io/register"
        }

    # ── 2. Resolver IPs ──────────────────────
    logger.info("[SHODAN] Buscando hosts del dominio...")
    ips = resolve_domain_to_ips(target, api_key, timeout)

    if not ips:
        logger.info("[SHODAN] No se encontraron hosts en Shodan para este dominio")
        return {
            "status":   "ok",
            "hosts":    [],
            "summary":  {"total_hosts": 0, "total_ports": 0, "total_vulns": 0},
            "analysis": {"risk_level": "DESCONOCIDO"}
        }

    # ── 3. Detalle de cada host ──────────────
    logger.info(f"[SHODAN] Obteniendo detalle de {len(ips)} hosts...")
    hosts = []

    for ip in ips:
        logger.debug(f"  Consultando IP: {ip}")
        raw = fetch_host_detail(ip, api_key, timeout)
        if raw:
            parsed = parse_host(raw)
            hosts.append(parsed)
            logger.info(
                f"  ✓ {ip} — "
                f"{len(parsed['ports'])} puertos | "
                f"{len(parsed['vulns'])} CVEs | "
                f"{parsed['org'] or 'org desconocida'}"
            )

    # ── 4. Análisis de riesgo ────────────────
    logger.info("[SHODAN] Evaluando riesgo...")
    analysis = analyze_risk(hosts)

    if analysis["has_critical_cve"]:
        logger.warning(
            f"[SHODAN] ⚠ CVEs CRÍTICOS detectados: "
            f"{[v['cve_id'] for v in analysis['critical_cves']]}"
        )

    logger.info(f"[SHODAN] Riesgo evaluado: {analysis['risk_level']}")

    # ── 5. Resultado final ───────────────────
    total_vulns   = analysis["total_cves"]
    critical_count = len(analysis["critical_cves"])

    result = {
        "status": "ok",
        "hosts":  hosts,
        "summary": {
            "total_hosts":       len(hosts),
            "total_ports":       len(analysis["all_open_ports"]),
            "total_vulns":       total_vulns,
            "critical_vulns":    critical_count,
            "open_ports":        analysis["all_open_ports"],
            "software_detected": analysis["exposed_software"],
        },
        "analysis": analysis,
    }

    logger.info(
        f"[SHODAN] Completado — "
        f"{len(hosts)} hosts | "
        f"{total_vulns} CVEs ({critical_count} críticos) | "
        f"Riesgo: {analysis['risk_level']}"
    )

    return result