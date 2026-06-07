"""
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
"""

import whois
import logging
from datetime import datetime, timezone

logger = logging.getLogger("condor.whois")

# ─────────────────────────────────────────────
#  Indicadores de WHOIS Privacy
#  Cuando el registrante usa un servicio proxy,
#  estos strings aparecen en nombre/email/org
# ─────────────────────────────────────────────
PRIVACY_INDICATORS = [
    "privacy",
    "proxy",
    "protect",
    "redacted",
    "withheld",
    "gdpr",
    "whoisguard",
    "privacyguardian",
    "domainsbyproxy",
    "perfect privacy",
    "contact privacy",
    "registrant redacted",
]

# ─────────────────────────────────────────────
#  Helpers de normalización
# ─────────────────────────────────────────────
def normalize_date(value) -> str | None:
    """
    python-whois puede retornar fechas como:
      - datetime object
      - lista de datetimes (toma el primero)
      - string
      - None

    Normaliza todo a string ISO 8601 o None.
    """
    if value is None:
        return None

    if isinstance(value, list):
        value = value[0] if value else None

    if isinstance(value, datetime):
        # Asegurar timezone-aware para comparaciones
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()

    return str(value)


def normalize_list(value) -> list:
    """
    python-whois puede retornar un campo como string o lista.
    Normaliza siempre a lista de strings limpios.
    """
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip().lower() for v in value if v]
    return [str(value).strip().lower()]


def normalize_str(value) -> str | None:
    """
    Normaliza un campo a string limpio o None.
    Si es lista, toma el primero.
    """
    if value is None:
        return None
    if isinstance(value, list):
        value = value[0] if value else None
    if value is None:
        return None
    return str(value).strip() or None


# ─────────────────────────────────────────────
#  Detección de WHOIS Privacy
# ─────────────────────────────────────────────
def detect_privacy(whois_data) -> bool:
    """
    Detecta si el dominio usa un servicio de privacidad WHOIS.

    Revisa nombre, email y organización del registrante
    contra una lista de indicadores conocidos.

    ¿Por qué importa en OSINT?
    Si el propietario usa privacy, no podemos identificar
    al registrante real — es un hallazgo relevante que limita
    el alcance del reconocimiento pasivo.
    """
    fields_to_check = [
        normalize_str(getattr(whois_data, "name", None)),
        normalize_str(getattr(whois_data, "org", None)),
        normalize_str(getattr(whois_data, "emails", None)),
        normalize_str(getattr(whois_data, "registrant_name", None)),
    ]

    for field in fields_to_check:
        if field:
            field_lower = field.lower()
            for indicator in PRIVACY_INDICATORS:
                if indicator in field_lower:
                    logger.debug(f"  Privacy detectada: '{indicator}' en '{field}'")
                    return True

    return False


# ─────────────────────────────────────────────
#  Cálculo de días para expiración
# ─────────────────────────────────────────────
def days_to_expiry(expires_on_str: str | None) -> int | None:
    """
    Calcula cuántos días faltan para que expire el dominio.

    Retorna:
      - int positivo: días restantes
      - int negativo: ya expiró hace N días
      - None: no se pudo calcular
    """
    if not expires_on_str:
        return None

    try:
        # Parsear la fecha ISO que generamos en normalize_date
        expires_dt = datetime.fromisoformat(expires_on_str)

        # Asegurar timezone
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        delta = expires_dt - now
        return delta.days

    except Exception as e:
        logger.debug(f"  No se pudo calcular expiración: {e}")
        return None


# ─────────────────────────────────────────────
#  Análisis de riesgos
# ─────────────────────────────────────────────
def analyze_risks(days: int | None, registered_on: str | None, privacy: bool) -> dict:
    """
    Evalúa riesgos básicos a partir de los datos WHOIS.

    Riesgos evaluados:

    1. Expiración próxima:
       < 30 días  → CRÍTICO (dominio puede caer pronto)
       < 90 días  → ALTO
       < 180 días → MEDIO
       >= 180     → BAJO

    2. Dominio recién creado:
       < 365 días → potencialmente sospechoso en análisis
       de amenazas, aunque para auditoría es solo informativo.

    3. Privacy activada:
       Limita el alcance del OSINT — documentar como hallazgo.
    """
    # Riesgo de expiración
    if days is None:
        expiry_risk = "DESCONOCIDO"
    elif days < 0:
        expiry_risk = "EXPIRADO"
    elif days < 30:
        expiry_risk = "CRÍTICO"
    elif days < 90:
        expiry_risk = "ALTO"
    elif days < 180:
        expiry_risk = "MEDIO"
    else:
        expiry_risk = "BAJO"

    # Dominio recién creado
    recently_created = False
    if registered_on:
        try:
            reg_dt = datetime.fromisoformat(registered_on)
            if reg_dt.tzinfo is None:
                reg_dt = reg_dt.replace(tzinfo=timezone.utc)
            age_days = (datetime.now(timezone.utc) - reg_dt).days
            recently_created = age_days < 365
        except Exception:
            pass

    return {
        "expiring_soon":    days is not None and 0 < days < 90,
        "already_expired":  days is not None and days < 0,
        "recently_created": recently_created,
        "privacy_risk":     "ALTO" if not privacy else "BAJO",
        # Paradoja: sin privacy = info expuesta (riesgo para el dueño)
        # Con privacy = info oculta (riesgo para el analista)
        "expiry_risk":      expiry_risk,
        "days_to_expire":   days,
    }


# ─────────────────────────────────────────────
#  Función principal — contrato con condor.py
# ─────────────────────────────────────────────
def run(target: str, timeout: int = 10) -> dict:
    """
    Punto de entrada del módulo. Llamado por condor.py así:
      data = mod.run(target=target, timeout=timeout)

    Ejecuta:
      1. Consulta WHOIS via python-whois
      2. Normaliza todos los campos
      3. Detecta WHOIS Privacy
      4. Calcula días para expiración
      5. Evalúa riesgos
      6. Retorna dict estructurado

    Args:
      target  : Dominio limpio, ej: "ejemplo.bo"
      timeout : Segundos máximos (python-whois no soporta
                timeout nativo, pero lo guardamos para consistencia)

    Returns:
      dict con toda la información WHOIS normalizada y analizada
    """
    logger.info(f"[WHOIS] Consultando registro para: {target}")

    try:
        w = whois.whois(target)
    except whois.parser.PywhoisError as e:
        logger.error(f"[WHOIS] Error de parsing: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"[WHOIS] Error inesperado: {e}")
        return {"status": "error", "message": str(e)}

    if not w or not w.domain_name:
        logger.warning("[WHOIS] No se encontró información WHOIS para el dominio")
        return {"status": "not_found", "message": "Sin datos WHOIS disponibles"}

    logger.debug(f"[WHOIS] Datos crudos recibidos, normalizando...")

    # ── Normalizar fechas ────────────────────
    registered_on = normalize_date(getattr(w, "creation_date",    None))
    updated_on    = normalize_date(getattr(w, "updated_date",     None))
    expires_on    = normalize_date(getattr(w, "expiration_date",  None))

    # ── Normalizar campos de texto ───────────
    registrar    = normalize_str(getattr(w, "registrar",         None))
    owner_name   = normalize_str(getattr(w, "name",              None))
    owner_org    = normalize_str(getattr(w, "org",               None))
    owner_email  = normalize_str(getattr(w, "emails",            None))
    owner_country= normalize_str(getattr(w, "country",           None))
    owner_city   = normalize_str(getattr(w, "city",              None))
    owner_state  = normalize_str(getattr(w, "state",             None))

    # ── Normalizar listas ────────────────────
    nameservers  = normalize_list(getattr(w, "name_servers",     None))
    domain_status= normalize_list(getattr(w, "status",           None))
    dnssec       = normalize_str(getattr(w, "dnssec",            None))

    # ── Detección de privacy ─────────────────
    privacy = detect_privacy(w)
    logger.debug(f"[WHOIS] Privacy detectada: {privacy}")

    # ── Días para expiración ─────────────────
    days = days_to_expiry(expires_on)
    if days is not None:
        logger.info(f"[WHOIS] El dominio expira en {days} días")
        if days < 90:
            logger.warning(f"[WHOIS] ⚠ Dominio expira pronto: {days} días restantes")

    # ── Análisis de riesgos ──────────────────
    analysis = analyze_risks(days, registered_on, privacy)

    # ── Resultado final ──────────────────────
    result = {
        "status":           "ok",
        "domain":           normalize_str(w.domain_name),
        "registrar":        registrar,
        "registered_on":    registered_on,
        "updated_on":       updated_on,
        "expires_on":       expires_on,
        "domain_status":    domain_status,
        "nameservers":      nameservers,
        "dnssec":           dnssec,
        "owner": {
            "name":         owner_name,
            "org":          owner_org,
            "email":        owner_email,
            "country":      owner_country,
            "city":         owner_city,
            "state":        owner_state,
        },
        "privacy_protected": privacy,
        "analysis":          analysis,
        "summary": {
            "registrar":            registrar,
            "registered_on":        registered_on,
            "expires_on":           expires_on,
            "days_to_expire":       days,
            "privacy_protected":    privacy,
            "expiry_risk":          analysis["expiry_risk"],
            "nameservers_count":    len(nameservers),
        }
    }

    logger.info(
        f"[WHOIS] Completado — Registrar: {registrar or 'N/A'} | "
        f"Expira: {days or '?'} días | Privacy: {privacy}"
    )

    return result