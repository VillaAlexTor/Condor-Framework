import requests
import logging
from datetime import datetime
from urllib.parse import urlparse
from collections import defaultdict

logger = logging.getLogger("condor.wayback")

# ─────────────────────────────────────────────
#  CDX API de la Wayback Machine
#  Documentación: https://github.com/internetarchive/wayback/tree/master/wayback-cdx-server
#
#  Parámetros clave:
#    output=json    → respuesta en JSON
#    fl=...         → campos a incluir
#    collapse=urlkey→ deduplica URLs (una entrada por URL única)
#    limit=N        → máximo de resultados
#    matchType=domain → incluye subdominios
# ─────────────────────────────────────────────
CDX_API_URL = "http://web.archive.org/cdx/search/cdx"

CDX_PARAMS_BASE = {
    "output":      "json",
    "fl":          "original,statuscode,timestamp,mimetype",
    "collapse":    "urlkey",       # Una entrada por URL única
    "matchType":   "domain",       # Incluye subdominios del dominio
    "limit":       "500",          # Tope razonable para no saturar
    "filter":      "statuscode:200", # Solo URLs que respondieron 200
}

CDX_PARAMS_SUMMARY = {
    "output":      "json",
    "fl":          "timestamp",
    "matchType":   "domain",
    "limit":       "1",
    "from":        "",             # Primera captura
}

# ─────────────────────────────────────────────
#  Clasificadores de URLs interesantes
# ─────────────────────────────────────────────

# Extensiones a clasificar por tipo
EXTENSION_GROUPS = {
    "php":        [".php"],
    "asp":        [".asp", ".aspx"],
    "config":     [".config", ".cfg", ".conf", ".ini"],
    "javascript": [".js"],
    "data":       [".json", ".xml", ".csv"],
    "documents":  [".pdf", ".doc", ".docx", ".xls", ".xlsx"],
    "archives":   [".zip", ".tar", ".gz", ".rar", ".7z", ".bak", ".sql"],
    "logs":       [".log", ".txt"],
    "env":        [".env", ".env.local", ".env.production"],
}

# Archivos sensibles — hallazgo de seguridad directo
SENSITIVE_EXTENSIONS = [
    ".env", ".bak", ".sql", ".config", ".cfg", ".ini",
    ".log", ".tar", ".gz", ".zip", ".rar", ".7z",
    ".pem", ".key", ".p12", ".pfx",
]

SENSITIVE_FILENAMES = [
    "config.php", "configuration.php", "settings.php",
    "wp-config.php", "database.php", "db.php",
    ".htaccess", ".htpasswd",
    "phpinfo.php", "info.php", "test.php",
    "backup", "dump", "install",
    "web.config", "app.config",
    "docker-compose.yml", "dockerfile",
    "id_rsa", "id_dsa", "private.key",
]

# Rutas de paneles de administración
ADMIN_PATHS = [
    "/admin", "/administrator", "/admin.php", "/admin/login",
    "/wp-admin", "/wp-login.php",
    "/panel", "/cpanel", "/dashboard",
    "/login", "/signin", "/auth",
    "/manager", "/management",
    "/phpmyadmin", "/pma",
    "/backend", "/backoffice",
    "/console", "/control",
]

# Rutas de APIs
API_PATHS = [
    "/api/", "/api/v1/", "/api/v2/", "/api/v3/",
    "/rest/", "/graphql", "/swagger",
    "/v1/", "/v2/", "/v3/",
    "/endpoint", "/service", "/ws/",
    "/json/", "/xml/",
]


# ─────────────────────────────────────────────
#  Consulta a CDX API
# ─────────────────────────────────────────────
def fetch_cdx(target: str, timeout: int) -> list:
    """
    Consulta la CDX API de archive.org y retorna lista de entradas.

    La CDX API retorna una lista de listas donde el primer elemento
    son los headers de campos:
      [["original", "statuscode", "timestamp", "mimetype"],
       ["https://ejemplo.bo/login.php", "200", "20190315120000", "text/html"],
       ...]

    Convertimos a lista de dicts para facilitar el procesamiento.
    Manejamos rate limiting con reintento básico.
    """
    params = {**CDX_PARAMS_BASE, "url": f"*.{target}"}

    logger.debug(f"  CDX API query: {target} (limit={CDX_PARAMS_BASE['limit']})")

    try:
        response = requests.get(
            CDX_API_URL,
            params=params,
            timeout=timeout,
            headers={"User-Agent": "condor-framework/0.1 (github.com/villaalextor)"}
        )

        if response.status_code == 429:
            logger.warning("  Wayback: Rate limit alcanzado, esperando 5s...")
            import time; time.sleep(5)
            response = requests.get(CDX_API_URL, params=params, timeout=timeout)

        if response.status_code != 200:
            logger.warning(f"  CDX API respondió con status {response.status_code}")
            return []

        data = response.json()

        if not data or len(data) < 2:
            # Solo headers o vacío
            logger.debug("  CDX API: Sin resultados")
            return []

        # Primera fila = headers, resto = datos
        headers = data[0]
        rows    = data[1:]

        # Convertir a lista de dicts
        entries = []
        for row in rows:
            entry = dict(zip(headers, row))
            entries.append(entry)

        logger.debug(f"  CDX API: {len(entries)} entradas recibidas")
        return entries

    except requests.Timeout:
        logger.warning("  Wayback: Timeout en CDX API")
    except requests.ConnectionError:
        logger.warning("  Wayback: Error de conexión a archive.org")
    except ValueError:
        logger.warning("  Wayback: Respuesta no es JSON válido")
    except Exception as e:
        logger.error(f"  Wayback: Error inesperado — {e}")

    return []


def fetch_first_last_snapshot(target: str, timeout: int) -> tuple:
    """
    Consulta la primera y última captura del dominio en Wayback.
    Hace dos consultas: una con order=asc (primera) y otra desc (última).
    Retorna (first_seen_str, last_seen_str) o (None, None)
    """
    first_seen = None
    last_seen  = None

    for order, label in [("asc", "primera"), ("desc", "última")]:
        try:
            params = {
                "url":       f"*.{target}",
                "output":    "json",
                "fl":        "timestamp",
                "matchType": "domain",
                "limit":     "1",
                "order":     f"timestamp:{order}",
            }
            resp = requests.get(
                CDX_API_URL, params=params, timeout=timeout,
                headers={"User-Agent": "condor-framework/0.1"}
            )
            data = resp.json()
            if data and len(data) >= 2:
                ts = data[1][0]  # "20050312143022"
                dt = datetime.strptime(ts, "%Y%m%d%H%M%S")
                iso = dt.isoformat()
                if order == "asc":
                    first_seen = iso
                else:
                    last_seen = iso
                logger.debug(f"  Wayback {label} captura: {iso}")
        except Exception as e:
            logger.debug(f"  No se pudo obtener {label} captura: {e}")

    return first_seen, last_seen


def fetch_total_snapshots(target: str, timeout: int) -> int:
    """
    Consulta el total de snapshots del dominio (sin collapse).
    Usa showNumPages=true para obtener solo el conteo.
    """
    try:
        params = {
            "url":         f"*.{target}",
            "output":      "json",
            "matchType":   "domain",
            "showNumPages": "true",
        }
        resp = requests.get(
            CDX_API_URL, params=params, timeout=timeout,
            headers={"User-Agent": "condor-framework/0.1"}
        )
        # Retorna un número como texto: "42\n"
        total = int(resp.text.strip()) if resp.text.strip().isdigit() else 0
        logger.debug(f"  Total de páginas CDX (aprox snapshots/50): {total}")
        return total * 50  # Cada página tiene ~50 snapshots
    except Exception:
        return 0


# ─────────────────────────────────────────────
#  Clasificación de URLs
# ─────────────────────────────────────────────
def classify_urls(entries: list) -> dict:
    """
    Toma las entradas CDX y las clasifica en categorías.

    Para cada URL:
      1. Extrae la ruta y extensión
      2. Verifica contra listas de sensibles/admin/api
      3. Agrupa por extensión

    Retorna dict con todas las clasificaciones.
    """
    all_urls        = []
    by_extension    = defaultdict(list)
    sensitive_files = []
    admin_panels    = []
    api_endpoints   = []
    backup_files    = []
    status_codes    = defaultdict(int)

    for entry in entries:
        url        = entry.get("original", "")
        statuscode = entry.get("statuscode", "")
        timestamp  = entry.get("timestamp", "")

        if not url:
            continue

        all_urls.append(url)
        status_codes[statuscode] += 1

        # Parsear URL para extraer path y extensión
        try:
            parsed = urlparse(url)
            path   = parsed.path.lower()
        except Exception:
            continue

        # ── Extensión del archivo ────────────
        ext = ""
        if "." in path.split("/")[-1]:
            ext = "." + path.split("/")[-1].rsplit(".", 1)[-1]

        # Clasificar por grupo de extensión
        for group, extensions in EXTENSION_GROUPS.items():
            if ext in extensions:
                by_extension[group].append(url)
                break

        # ── Archivos sensibles ───────────────
        is_sensitive = (
            ext in SENSITIVE_EXTENSIONS or
            any(fname in path for fname in SENSITIVE_FILENAMES)
        )
        if is_sensitive:
            sensitive_files.append(url)
            logger.debug(f"  Archivo sensible encontrado: {url}")

        # ── Paneles de administración ────────
        for admin_path in ADMIN_PATHS:
            if path.startswith(admin_path) or f"{admin_path}." in path:
                admin_panels.append(url)
                logger.debug(f"  Panel admin encontrado: {url}")
                break

        # ── Endpoints de API ─────────────────
        for api_path in API_PATHS:
            if api_path in path:
                api_endpoints.append(url)
                break

        # ── Archivos de backup ───────────────
        if ext in [".zip", ".tar", ".gz", ".rar", ".7z", ".bak", ".sql"]:
            backup_files.append(url)

    return {
        "all":          sorted(set(all_urls)),
        "by_extension": dict(by_extension),
        "status_codes": dict(status_codes),
        "findings": {
            "sensitive_files": sorted(set(sensitive_files)),
            "admin_panels":    sorted(set(admin_panels)),
            "api_endpoints":   sorted(set(api_endpoints)),
            "backup_files":    sorted(set(backup_files)),
        }
    }


# ─────────────────────────────────────────────
#  Análisis de riesgo
# ─────────────────────────────────────────────
def analyze_risk(classified: dict, first_seen: str | None, last_seen: str | None) -> dict:
    """
    Evalúa el nivel de riesgo basado en los hallazgos.

    CRÍTICO : archivos sensibles (.env, .bak, .sql) o backups expuestos
    ALTO    : paneles de admin o APIs sin autenticación aparente
    MEDIO   : archivos PHP/config sin hallazgos críticos
    BAJO    : solo URLs estáticas sin hallazgos relevantes
    """
    findings       = classified.get("findings", {})
    sensitive      = findings.get("sensitive_files", [])
    admin          = findings.get("admin_panels", [])
    backup         = findings.get("backup_files", [])
    api            = findings.get("api_endpoints", [])
    has_sensitive  = bool(sensitive or backup)

    if sensitive or backup:
        risk = "CRÍTICO"
    elif admin or api:
        risk = "ALTO"
    elif classified.get("by_extension", {}).get("php"):
        risk = "MEDIO"
    else:
        risk = "BAJO"

    # Años de historial
    years = 0
    if first_seen and last_seen:
        try:
            f = datetime.fromisoformat(first_seen)
            l = datetime.fromisoformat(last_seen)
            years = max(0, (l - f).days // 365)
        except Exception:
            pass

    return {
        "has_sensitive_exposure": has_sensitive,
        "risk_level":             risk,
        "years_of_history":       years,
        "findings_count": {
            "sensitive_files": len(sensitive),
            "admin_panels":    len(admin),
            "api_endpoints":   len(api),
            "backup_files":    len(backup),
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
      1. Consulta CDX API — URLs históricas con status 200
      2. Consulta primera y última captura
      3. Consulta total de snapshots (aproximado)
      4. Clasifica URLs por tipo y sensibilidad
      5. Evalúa riesgo
      6. Retorna dict estructurado

    Args:
      target  : Dominio limpio, ej: "ejemplo.bo"
      timeout : Segundos máximos por consulta

    Returns:
      dict con historial de URLs, clasificación y análisis de riesgo
    """
    logger.info(f"[WAYBACK] Consultando historial para: {target}")

    # ── 1. URLs históricas ───────────────────
    logger.info("[WAYBACK] Consultando CDX API (URLs con status 200)...")
    entries = fetch_cdx(target, timeout)
    logger.info(f"[WAYBACK] {len(entries)} URLs únicas encontradas")

    # ── 2. Primera y última captura ──────────
    logger.info("[WAYBACK] Obteniendo rango temporal de capturas...")
    first_seen, last_seen = fetch_first_last_snapshot(target, timeout)

    # ── 3. Total de snapshots ────────────────
    logger.info("[WAYBACK] Estimando total de snapshots...")
    total_snapshots = fetch_total_snapshots(target, timeout)

    # ── 4. Clasificar URLs ───────────────────
    logger.info("[WAYBACK] Clasificando URLs por tipo y sensibilidad...")
    classified = classify_urls(entries)

    findings = classified["findings"]
    if findings["sensitive_files"]:
        logger.warning(f"[WAYBACK] ⚠ {len(findings['sensitive_files'])} archivos sensibles encontrados")
    if findings["admin_panels"]:
        logger.warning(f"[WAYBACK] ⚠ {len(findings['admin_panels'])} paneles de admin encontrados")
    if findings["backup_files"]:
        logger.warning(f"[WAYBACK] ⚠ {len(findings['backup_files'])} archivos de backup encontrados")

    # ── 5. Análisis de riesgo ────────────────
    analysis = analyze_risk(classified, first_seen, last_seen)
    logger.info(f"[WAYBACK] Riesgo evaluado: {analysis['risk_level']}")

    # ── 6. Resultado final ───────────────────
    result = {
        "status":           "ok",
        "total_snapshots":  total_snapshots,
        "first_seen":       first_seen,
        "last_seen":        last_seen,
        "urls": {
            "all":          classified["all"],
            "by_extension": classified["by_extension"],
        },
        "status_codes":     classified["status_codes"],
        "findings":         findings,
        "analysis":         analysis,
        "summary": {
            "total_unique_urls":      len(classified["all"]),
            "total_snapshots":        total_snapshots,
            "first_seen":             first_seen,
            "last_seen":              last_seen,
            "years_of_history":       analysis["years_of_history"],
            "sensitive_files_found":  len(findings["sensitive_files"]),
            "admin_panels_found":     len(findings["admin_panels"]),
            "api_endpoints_found":    len(findings["api_endpoints"]),
            "backup_files_found":     len(findings["backup_files"]),
            "risk_level":             analysis["risk_level"],
        }
    }

    logger.info(
        f"[WAYBACK] Completado — "
        f"{len(classified['all'])} URLs | "
        f"Riesgo: {analysis['risk_level']} | "
        f"Historial: {analysis['years_of_history']} años"
    )

    return result