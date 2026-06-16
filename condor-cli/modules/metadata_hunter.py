import requests
import logging
import os
from collections import defaultdict

logger = logging.getLogger("condor.hunter")

# ─────────────────────────────────────────────
#  Endpoints de Hunter.io API v2
# ─────────────────────────────────────────────
HUNTER_API_BASE      = "https://api.hunter.io/v2"
HUNTER_DOMAIN_SEARCH = f"{HUNTER_API_BASE}/domain-search"
HUNTER_EMAIL_COUNT   = f"{HUNTER_API_BASE}/email-count"
HUNTER_ACCOUNT       = f"{HUNTER_API_BASE}/account"

# ─────────────────────────────────────────────
#  Clasificadores de emails de alto valor
# ─────────────────────────────────────────────

# Palabras clave en cargo/posición que indican IT o seguridad
IT_KEYWORDS = [
    "it", "tech", "tecnología", "technology", "systems", "sistemas",
    "developer", "desarrollo", "engineer", "ingeniero",
    "security", "seguridad", "network", "red", "infraestructura",
    "admin", "administrator", "administrador", "sysadmin",
    "devops", "cloud", "database", "data", "soporte", "support",
    "cto", "ciso", "chief technology", "chief information",
]

# Palabras clave en cargo que indican ejecutivos
EXECUTIVE_KEYWORDS = [
    "ceo", "cfo", "coo", "cto", "ciso", "director", "gerente",
    "manager", "jefe", "head", "vp", "vice president", "vicepresidente",
    "presidente", "president", "rector", "decano", "coordinador",
    "founder", "co-founder", "owner", "propietario",
]

# Prefijos de emails genéricos (bajo valor para spear phishing
# pero útiles para saber qué áreas existen)
GENERIC_PREFIXES = [
    "info", "contact", "contacto", "hello", "hola",
    "support", "soporte", "help", "ayuda",
    "admin", "webmaster", "postmaster",
    "sales", "ventas", "marketing",
    "hr", "rrhh", "recursos",
    "legal", "finance", "finanzas",
    "press", "prensa", "media",
    "noreply", "no-reply", "donotreply",
]

# Patrones de formato Hunter detecta
PATTERN_DESCRIPTIONS = {
    "{first}":                   "Solo nombre (ej: juan@empresa.com)",
    "{last}":                    "Solo apellido (ej: perez@empresa.com)",
    "{first}.{last}":            "Nombre.Apellido (ej: juan.perez@empresa.com)",
    "{first}{last}":             "NombreApellido (ej: juanperez@empresa.com)",
    "{f}{last}":                 "InicialApellido (ej: jperez@empresa.com)",
    "{first}_{last}":            "Nombre_Apellido (ej: juan_perez@empresa.com)",
    "{first}.{l}":               "Nombre.Inicial (ej: juan.p@empresa.com)",
    "{first}-{last}":            "Nombre-Apellido (ej: juan-perez@empresa.com)",
    "{last}.{first}":            "Apellido.Nombre (ej: perez.juan@empresa.com)",
    "{last}{f}":                 "ApellidoInicial (ej: perezj@empresa.com)",
}


# ─────────────────────────────────────────────
#  Carga de credenciales
# ─────────────────────────────────────────────
def load_credentials() -> str | None:
    """
    Carga la API key de Hunter.io desde variables de entorno.
    Retorna el key string o None si no está configurada.
    """
    api_key = os.getenv("HUNTER_API_KEY")

    if not api_key:
        logger.warning(
            "[HUNTER] API key no encontrada. "
            "Configura HUNTER_API_KEY en .env — "
            "gratis en https://hunter.io/users/sign_up"
        )
        return None

    logger.debug(f"[HUNTER] API key cargada: {api_key[:8]}...")
    return api_key


# ─────────────────────────────────────────────
#  Consulta de conteo (sin consumir búsqueda)
# ─────────────────────────────────────────────
def fetch_email_count(target: str, api_key: str, timeout: int) -> int:
    """
    Consulta el total de emails que Hunter tiene indexados
    para el dominio. Este endpoint NO consume búsquedas del
    plan gratuito — es informativo.

    Útil para saber si vale la pena gastar una búsqueda:
      0 emails → Hunter no tiene datos de este dominio
      > 0      → proceder con domain-search
    """
    try:
        resp = requests.get(
            HUNTER_EMAIL_COUNT,
            params={"domain": target},
            timeout=timeout
        )
        if resp.status_code == 200:
            data  = resp.json()
            total = data.get("data", {}).get("total", 0)
            logger.debug(f"  Hunter email count: {total} emails indexados")
            return total
    except Exception as e:
        logger.debug(f"  No se pudo obtener conteo de Hunter: {e}")

    return 0


# ─────────────────────────────────────────────
#  Consulta principal domain-search
# ─────────────────────────────────────────────
def fetch_domain_search(target: str, api_key: str, timeout: int) -> dict | None:
    """
    Consulta el endpoint domain-search de Hunter.io.

    Retorna hasta 100 emails por búsqueda (plan gratuito: 10).
    La respuesta incluye:
      - Lista de emails con metadatos
      - Patrón de formato detectado
      - Nombre de la organización
      - Total de emails en la base de Hunter

    Consume 1 búsqueda del plan gratuito.
    """
    try:
        params = {
            "domain":   target,
            "api_key":  api_key,
            "limit":    100,       # Máximo disponible
            "offset":   0,
        }

        resp = requests.get(
            HUNTER_DOMAIN_SEARCH,
            params=params,
            timeout=timeout,
            headers={"Accept": "application/json"}
        )

        if resp.status_code == 401:
            logger.error("  Hunter: API key inválida (401)")
            return None

        if resp.status_code == 403:
            logger.warning("  Hunter: Sin búsquedas disponibles en el plan actual")
            return None

        if resp.status_code == 429:
            logger.warning("  Hunter: Rate limit alcanzado")
            return None

        if resp.status_code != 200:
            logger.warning(f"  Hunter: Status {resp.status_code}")
            return None

        data = resp.json()
        return data.get("data", {})

    except requests.Timeout:
        logger.warning("  Hunter: Timeout en domain-search")
    except Exception as e:
        logger.error(f"  Hunter: Error inesperado — {e}")

    return None


# ─────────────────────────────────────────────
#  Parseo de emails individuales
# ─────────────────────────────────────────────
def parse_email(raw: dict) -> dict:
    """
    Normaliza un email crudo de Hunter al formato estándar.

    Hunter retorna por email:
      value, type, confidence, first_name, last_name,
      position, department, linkedin, twitter,
      sources: [{uri, extracted_on, last_seen_on, ...}]
    """
    value      = raw.get("value", "").lower().strip()
    email_type = raw.get("type", "personal")      # personal / generic
    confidence = int(raw.get("confidence", 0))
    verified   = raw.get("verified", False)

    first_name = raw.get("first_name", "") or ""
    last_name  = raw.get("last_name", "")  or ""
    position   = raw.get("position", "")   or ""
    department = raw.get("department", "") or ""

    # Extraer URLs de fuentes
    sources_raw = raw.get("sources", []) or []
    sources = []
    last_found = ""
    for src in sources_raw[:5]:  # Máximo 5 fuentes por email
        uri = src.get("uri", "")
        if uri:
            sources.append(uri)
        # Fecha más reciente de aparición
        seen = src.get("last_seen_on", "")
        if seen and seen > last_found:
            last_found = seen

    return {
        "value":      value,
        "type":       email_type,
        "confidence": confidence,
        "verified":   verified,
        "first_name": first_name.strip(),
        "last_name":  last_name.strip(),
        "position":   position.strip(),
        "department": department.strip(),
        "sources":    sources,
        "last_found": last_found,
    }


# ─────────────────────────────────────────────
#  Clasificación de emails por valor
# ─────────────────────────────────────────────
def classify_emails(emails: list) -> dict:
    """
    Clasifica los emails en categorías según su valor
    para un análisis de riesgo de phishing.

    Categorías:
      it_staff   : Personal de IT y seguridad — alto valor
                   (tienen acceso a sistemas críticos)
      executives : Dirección y gerencia — alto valor
                   (CEO fraud, BEC attacks)
      generic    : Emails genéricos (info@, contact@)
                   (menos útiles para spear phishing)

    También agrupa por departamento para el resumen.
    """
    it_staff   = []
    executives = []
    generic    = []
    by_dept    = defaultdict(int)

    for email in emails:
        value    = email["value"]
        position = email["position"].lower()
        dept     = email["department"].lower()
        prefix   = value.split("@")[0].lower() if "@" in value else ""

        # Conteo por departamento
        if email["department"]:
            by_dept[email["department"]] += 1

        # Email genérico
        if prefix in GENERIC_PREFIXES or email["type"] == "generic":
            generic.append(value)
            continue

        # IT y seguridad
        is_it = any(kw in position or kw in dept for kw in IT_KEYWORDS)
        if is_it:
            it_staff.append(value)
            logger.debug(f"  Email IT encontrado: {value} ({email['position']})")

        # Ejecutivos
        is_exec = any(kw in position for kw in EXECUTIVE_KEYWORDS)
        if is_exec:
            executives.append(value)
            logger.debug(f"  Email ejecutivo encontrado: {value} ({email['position']})")

    return {
        "it_staff":   sorted(set(it_staff)),
        "executives": sorted(set(executives)),
        "generic":    sorted(set(generic)),
        "by_department": dict(by_dept),
    }


# ─────────────────────────────────────────────
#  Análisis de riesgo
# ─────────────────────────────────────────────
def analyze_risk(emails: list, pattern: str, classified: dict, total_hunter: int) -> dict:
    """
    Evalúa el riesgo de exposición de emails corporativos.

    Nivel de riesgo:
      CRÍTICO : emails de IT o ejecutivos expuestos + patrón conocido
      ALTO    : emails de IT o ejecutivos expuestos sin patrón
      MEDIO   : emails genéricos o de empleados sin clasificar
      BAJO    : muy pocos emails o sin datos relevantes

    El patrón es especialmente peligroso porque permite
    construir listas de emails probables para toda la org,
    incluso sin que Hunter tenga todos los registros.
    """
    it_count   = len(classified["it_staff"])
    exec_count = len(classified["executives"])
    total      = len(emails)
    has_pattern = bool(pattern)

    high_value = it_count + exec_count

    if high_value > 0 and has_pattern:
        risk = "CRÍTICO"
    elif high_value > 0:
        risk = "ALTO"
    elif total > 5:
        risk = "MEDIO"
    elif total > 0:
        risk = "BAJO"
    else:
        risk = "NINGUNO"

    # Descripción del patrón
    pattern_desc = PATTERN_DESCRIPTIONS.get(pattern, f"Patrón personalizado: {pattern}")

    # Recomendaciones
    recommendations = []
    if has_pattern:
        recommendations.append(
            f"El patrón '{pattern}' permite generar listas de emails de toda la organización — "
            "implementar monitoreo de intentos de phishing masivo."
        )
    if it_count > 0:
        recommendations.append(
            f"{it_count} emails de personal IT expuestos — "
            "estos son objetivos de alto valor para ataques de spear phishing y acceso a sistemas."
        )
    if exec_count > 0:
        recommendations.append(
            f"{exec_count} emails de ejecutivos expuestos — "
            "riesgo de BEC (Business Email Compromise) y CEO fraud."
        )
    if total > 10:
        recommendations.append(
            "Considerar solicitar a Hunter.io la eliminación de emails "
            "via https://hunter.io/opt-out"
        )
    if not recommendations:
        recommendations.append(
            "Exposición baja — monitorear periódicamente con esta herramienta."
        )

    return {
        "risk_level":           risk,
        "has_pattern":          has_pattern,
        "pattern_description":  pattern_desc if has_pattern else "No detectado",
        "total_exposed":        total,
        "total_indexed_hunter": total_hunter,
        "high_value_targets":   high_value,
        "phishing_risk":        "ALTO" if high_value > 0 else "MEDIO" if total > 0 else "BAJO",
        "recommended_actions":  recommendations,
    }


# ─────────────────────────────────────────────
#  Función principal — contrato con condor.py
# ─────────────────────────────────────────────
def run(target: str, timeout: int = 10) -> dict:
    """
    Punto de entrada del módulo. Llamado por condor.py así:
      data = mod.run(target=target, timeout=timeout)

    Ejecuta:
      1. Carga API key de Hunter desde .env
      2. Consulta conteo de emails (sin consumir búsqueda)
      3. Si hay emails → consulta domain-search completo
      4. Parsea y normaliza cada email
      5. Clasifica por valor (IT, ejecutivos, genéricos)
      6. Evalúa riesgo de phishing
      7. Retorna dict estructurado

    Args:
      target  : Dominio limpio, ej: "ejemplo.bo"
      timeout : Segundos máximos por consulta

    Returns:
      dict con emails, clasificación y análisis de riesgo
    """
    logger.info(f"[HUNTER] Iniciando búsqueda de emails para: {target}")

    # ── 1. Credenciales ──────────────────────
    api_key = load_credentials()
    if not api_key:
        return {
            "status":  "skipped",
            "message": "HUNTER_API_KEY no configurada. "
                       "Registrarse gratis en https://hunter.io/users/sign_up"
        }

    # ── 2. Conteo previo (sin consumir búsqueda) ──
    logger.info("[HUNTER] Verificando disponibilidad de datos...")
    total_indexed = fetch_email_count(target, api_key, timeout)
    logger.info(f"[HUNTER] Hunter tiene {total_indexed} emails indexados para {target}")

    if total_indexed == 0:
        logger.info("[HUNTER] Sin datos disponibles — omitiendo búsqueda")
        return {
            "status":       "ok",
            "domain":       target,
            "total_emails": 0,
            "emails":       [],
            "analysis": {
                "risk_level":    "NINGUNO",
                "total_exposed": 0,
                "phishing_risk": "BAJO",
                "recommended_actions": [
                    "Hunter.io no tiene emails indexados para este dominio. "
                    "Verificar manualmente en LinkedIn y el sitio web del objetivo."
                ]
            }
        }

    # ── 3. Domain search ─────────────────────
    logger.info("[HUNTER] Ejecutando domain-search (consume 1 búsqueda del plan)...")
    raw_data = fetch_domain_search(target, api_key, timeout)

    if not raw_data:
        return {
            "status":  "error",
            "message": "No se pudo obtener datos de Hunter.io"
        }

    # ── 4. Parsear emails ────────────────────
    organization = raw_data.get("organization", "")
    pattern      = raw_data.get("pattern", "")
    total        = raw_data.get("total", 0)
    emails_raw   = raw_data.get("emails", [])

    logger.info(
        f"[HUNTER] Organización: {organization or 'N/A'} | "
        f"Patrón: {pattern or 'No detectado'} | "
        f"Emails: {len(emails_raw)} retornados de {total} totales"
    )

    emails = [parse_email(e) for e in emails_raw]

    # Log de emails encontrados
    for email in emails:
        conf = email["confidence"]
        pos  = email["position"] or "Sin cargo"
        logger.debug(f"  {email['value']} — {pos} (confianza: {conf}%)")

    # ── 5. Clasificar emails ─────────────────
    logger.info("[HUNTER] Clasificando emails por valor de riesgo...")
    classified = classify_emails(emails)

    if classified["it_staff"]:
        logger.warning(f"[HUNTER] ⚠ {len(classified['it_staff'])} emails de IT expuestos")
    if classified["executives"]:
        logger.warning(f"[HUNTER] ⚠ {len(classified['executives'])} emails ejecutivos expuestos")

    # ── 6. Análisis de riesgo ────────────────
    analysis = analyze_risk(emails, pattern, classified, total_indexed)
    logger.info(f"[HUNTER] Riesgo de phishing: {analysis['risk_level']}")

    # ── 7. Resultado final ───────────────────
    result = {
        "status":       "ok",
        "domain":       target,
        "organization": organization,
        "pattern":      pattern,
        "total_emails": total,
        "emails":       emails,
        "departments":  classified["by_department"],
        "risk_emails": {
            "it_staff":   classified["it_staff"],
            "executives": classified["executives"],
            "generic":    classified["generic"],
        },
        "analysis": analysis,
        "summary": {
            "organization":         organization,
            "pattern":              pattern or "No detectado",
            "total_indexed_hunter": total_indexed,
            "total_returned":       len(emails),
            "it_staff_exposed":     len(classified["it_staff"]),
            "executives_exposed":   len(classified["executives"]),
            "generic_emails":       len(classified["generic"]),
            "risk_level":           analysis["risk_level"],
            "phishing_risk":        analysis["phishing_risk"],
        }
    }

    logger.info(
        f"[HUNTER] Completado — "
        f"{len(emails)} emails | "
        f"IT: {len(classified['it_staff'])} | "
        f"Ejecutivos: {len(classified['executives'])} | "
        f"Riesgo: {analysis['risk_level']}"
    )

    return result