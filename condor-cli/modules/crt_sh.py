"""
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
"""

import requests
import logging
import time
from collections import defaultdict

logger = logging.getLogger("condor.crt")

# ─────────────────────────────────────────────
#  URL de la API de crt.sh
# ─────────────────────────────────────────────
CRT_SH_URL = "https://crt.sh/?output=json"

# Nombres de subdominios que merecen atención especial
INTERESTING_KEYWORDS = [
    "admin", "administrator", "panel", "dashboard",
    "dev", "development", "staging", "stage", "test",
    "api", "rest", "graphql", "ws", "websocket",
    "mail", "smtp", "imap", "pop",
    "vpn", "remote", "rdp", "ssh",
    "ftp", "sftp", "files", "backup",
    "db", "database", "mysql", "mongo", "redis",
    "internal", "intranet", "private",
    "old", "legacy", "v1", "v2",
    "login", "auth", "sso", "oauth",
    "monitor", "metrics", "grafana", "kibana",
    "git", "gitlab", "github", "jira", "jenkins",
    "cloud", "cdn", "static", "assets",
]


# ─────────────────────────────────────────────
#  Consulta a crt.sh
# ─────────────────────────────────────────────
def query_crt_sh(target: str, timeout: int, retries: int = 2) -> list:
    """
    Consulta la API JSON de crt.sh para el dominio objetivo.

    Usa el parámetro q=%.dominio para buscar cualquier
    subdominio — el % es el wildcard de crt.sh.

    Implementa reintentos simples en caso de timeout,
    ya que crt.sh puede ser lento en dominios con muchos
    certificados históricos.

    Retorna lista de entradas crudas de crt.sh.
    """
    params = {
        "q":      f"%.{target}",
        "output": "json",
    }

    for attempt in range(1, retries + 1):
        try:
            logger.debug(f"  crt.sh query intento {attempt}/{retries}: %.{target}")

            resp = requests.get(
                CRT_SH_URL,
                params=params,
                timeout=timeout,
                headers={
                    "User-Agent": "condor-framework/0.1 (github.com/villaalextor)",
                    "Accept":     "application/json",
                }
            )

            if resp.status_code == 200:
                data = resp.json()
                logger.debug(f"  crt.sh retornó {len(data)} entradas brutas")
                return data

            elif resp.status_code == 429:
                logger.warning("  crt.sh: Rate limit — esperando 10s...")
                time.sleep(10)

            else:
                logger.warning(f"  crt.sh: Status {resp.status_code}")

        except requests.Timeout:
            logger.warning(f"  crt.sh: Timeout (intento {attempt}/{retries})")
            if attempt < retries:
                time.sleep(3)

        except requests.ConnectionError:
            logger.warning(f"  crt.sh: Error de conexión (intento {attempt}/{retries})")
            if attempt < retries:
                time.sleep(3)

        except ValueError:
            logger.warning("  crt.sh: Respuesta no es JSON válido")
            break

        except Exception as e:
            logger.error(f"  crt.sh: Error inesperado — {e}")
            break

    return []


# ─────────────────────────────────────────────
#  Parseo y deduplicación
# ─────────────────────────────────────────────
def parse_entries(entries: list, target: str) -> dict:
    """
    Procesa las entradas crudas de crt.sh y extrae:
      - Subdominios únicos (sin wildcards, sin el dominio raíz)
      - Certificados wildcard detectados
      - Emisores (CAs) que firmaron los certificados

    Cada entry de crt.sh tiene:
      {
        "id":           int,
        "logged_at":    "2024-01-15T...",
        "not_before":   "2024-01-15T...",
        "not_after":    "2025-01-15T...",
        "common_name":  "sub.ejemplo.bo",
        "name_value":   "sub.ejemplo.bo\nanother.ejemplo.bo",
        "issuer_name":  "C=US, O=Let's Encrypt, CN=R3",
        "issuer_ca_id": 12345,
      }

    name_value puede contener múltiples nombres separados
    por \\n (SANs del certificado).
    """
    subdomains = set()
    wildcards  = set()
    issuers    = defaultdict(int)

    for entry in entries:
        # ── Extraer emisor ───────────────────
        issuer_raw = entry.get("issuer_name", "")
        issuer_cn  = _extract_cn(issuer_raw)
        if issuer_cn:
            issuers[issuer_cn] += 1

        # ── Extraer subdominios de name_value ─
        name_value = entry.get("name_value", "") or ""

        for name in name_value.split("\n"):
            name = name.strip().lower()

            if not name:
                continue

            # Wildcard cert — guardar aparte pero no como subdominio
            if name.startswith("*."):
                wildcards.add(name)
                # El dominio base del wildcard sí es un subdominio válido
                base = name[2:]  # quitar "*."
                if _is_valid_subdomain(base, target):
                    subdomains.add(base)
                continue

            # Filtrar el dominio raíz mismo
            if name == target:
                continue

            # Solo incluir subdominios del dominio objetivo
            if _is_valid_subdomain(name, target):
                subdomains.add(name)

    return {
        "subdomains": sorted(subdomains),
        "wildcards":  sorted(wildcards),
        "issuers":    dict(issuers),
    }


def _is_valid_subdomain(name: str, target: str) -> bool:
    """
    Verifica que 'name' sea un subdominio válido de 'target'.
    Descarta IPs, nombres sin puntos y dominios de otros TLDs.
    """
    # Debe terminar con .target
    if not name.endswith(f".{target}"):
        return False

    # No debe ser solo .target
    if name == f".{target}":
        return False

    # No debe contener espacios u otros caracteres inválidos
    invalid_chars = [" ", "/", "\\", "@", "!", "#", "$"]
    if any(c in name for c in invalid_chars):
        return False

    return True


def _extract_cn(issuer_string: str) -> str:
    """
    Extrae el CN (Common Name) del string de emisor LDAP.
    Ej: "C=US, O=Let's Encrypt, CN=R3" → "Let's Encrypt"
    """
    if not issuer_string:
        return "Desconocido"

    # Intentar extraer la Organización (O=)
    for part in issuer_string.split(","):
        part = part.strip()
        if part.startswith("O="):
            return part[2:].strip()

    # Fallback: CN=
    for part in issuer_string.split(","):
        part = part.strip()
        if part.startswith("CN="):
            return part[3:].strip()

    return issuer_string[:50]


# ─────────────────────────────────────────────
#  Análisis de subdominios
# ─────────────────────────────────────────────
def analyze_subdomains(subdomains: list, target: str) -> dict:
    """
    Analiza los subdominios encontrados para detectar:
      - El subdominio con más niveles (más profundo)
      - Subdominios con nombres sensibles (admin, dev, api, etc.)

    El nivel de profundidad se calcula restando los niveles
    del dominio raíz. Ej:
      umsa.bo → 2 niveles (raíz)
      api.umsa.bo → nivel 1 de profundidad
      v2.api.umsa.bo → nivel 2 de profundidad
    """
    root_levels = len(target.split("."))

    deepest = ""
    max_depth = 0
    interesting = []

    for sub in subdomains:
        # Profundidad relativa
        depth = len(sub.split(".")) - root_levels
        if depth > max_depth:
            max_depth = depth
            deepest   = sub

        # Nombres sensibles
        sub_prefix = sub.replace(f".{target}", "").lower()
        for keyword in INTERESTING_KEYWORDS:
            if keyword in sub_prefix.split("."):
                interesting.append(sub)
                break

    return {
        "deepest_subdomain": deepest,
        "max_depth":         max_depth,
        "interesting":       sorted(set(interesting)),
    }


# ─────────────────────────────────────────────
#  Función principal — contrato con condor.py
# ─────────────────────────────────────────────
def run(target: str, timeout: int = 10) -> dict:
    """
    Punto de entrada del módulo. Llamado por condor.py así:
      data = mod.run(target=target, timeout=timeout)

    Ejecuta:
      1. Consulta crt.sh con reintentos
      2. Parsea entradas — extrae subdominios, wildcards, issuers
      3. Analiza subdominios interesantes y profundidad
      4. Retorna dict estructurado

    Args:
      target  : Dominio limpio, ej: "umsa.bo"
      timeout : Segundos máximos por consulta

    Returns:
      dict con subdominios, wildcards, emisores y análisis
    """
    logger.info(f"[CRT] Consultando Certificate Transparency Logs para: {target}")

    # ── 1. Consultar crt.sh ──────────────────
    entries = query_crt_sh(target, timeout)

    if not entries:
        logger.warning("[CRT] Sin resultados de crt.sh — timeout o dominio sin certs públicos")
        return {
            "status":     "ok",
            "subdomains": [],
            "total":      0,
            "unique":     0,
            "wildcards":  [],
            "issuers":    {},
            "analysis": {
                "deepest_subdomain": "",
                "max_depth":         0,
                "interesting":       [],
            },
            "summary": {
                "total_subdomains": 0,
                "wildcards_found":  0,
                "interesting_found": 0,
            }
        }

    total_entries = len(entries)
    logger.info(f"[CRT] {total_entries} entradas brutas de crt.sh")

    # ── 2. Parsear ───────────────────────────
    parsed = parse_entries(entries, target)
    subdomains = parsed["subdomains"]
    wildcards  = parsed["wildcards"]
    issuers    = parsed["issuers"]

    logger.info(f"[CRT] {len(subdomains)} subdominios únicos (de {total_entries} entradas)")
    logger.info(f"[CRT] {len(wildcards)} certificados wildcard")

    if issuers:
        top_issuer = max(issuers, key=issuers.get)
        logger.info(f"[CRT] CA más usada: {top_issuer} ({issuers[top_issuer]} certs)")

    # ── 3. Análisis ──────────────────────────
    analysis = analyze_subdomains(subdomains, target)

    if analysis["interesting"]:
        logger.warning(
            f"[CRT] ⚠ {len(analysis['interesting'])} subdominios con nombres sensibles: "
            f"{', '.join(analysis['interesting'][:5])}"
        )

    # ── 4. Resultado final ───────────────────
    result = {
        "status":     "ok",
        "subdomains": subdomains,
        "total":      total_entries,   # Entradas brutas (con duplicados)
        "unique":     len(subdomains), # Subdominios únicos
        "wildcards":  wildcards,
        "issuers":    issuers,
        "analysis":   analysis,
        "summary": {
            "total_subdomains":  len(subdomains),
            "wildcards_found":   len(wildcards),
            "interesting_found": len(analysis["interesting"]),
            "top_issuer":        max(issuers, key=issuers.get) if issuers else None,
            "deepest_subdomain": analysis["deepest_subdomain"],
        }
    }

    logger.info(
        f"[CRT] Completado — "
        f"{len(subdomains)} subdominios | "
        f"{len(wildcards)} wildcards | "
        f"{len(analysis['interesting'])} interesantes"
    )

    return result