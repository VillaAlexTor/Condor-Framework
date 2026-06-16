import dns.resolver
import dns.exception
import requests
import logging
import time

logger = logging.getLogger("condor.dns")

# ─────────────────────────────────────────────
#  Tipos de registros DNS a consultar
# ─────────────────────────────────────────────
DNS_RECORD_TYPES = ["A", "MX", "NS", "TXT", "CNAME"]

# URL de la API pública de crt.sh
CRT_SH_URL = "https://crt.sh/?q={domain}&output=json"


# ─────────────────────────────────────────────
#  Consulta de registros DNS
# ─────────────────────────────────────────────
def query_dns_records(target: str, timeout: int) -> dict:
    """
    Consulta todos los tipos de registros DNS definidos en
    DNS_RECORD_TYPES para el dominio objetivo.

    Usa dnspython (dns.resolver) que hace consultas reales
    a los servidores DNS públicos — no toca el servidor web
    del objetivo directamente.

    Manejo de errores por tipo:
      - NXDOMAIN   → el dominio no existe
      - NoAnswer   → el tipo de registro no tiene datos
      - Timeout    → el servidor DNS no respondió a tiempo
      - NoNameservers → no hay NS disponibles
    
    Retorna dict con listas de strings por tipo de registro.
    Los registros que fallan retornan lista vacía (no crashea).
    """
    records = {rtype: [] for rtype in DNS_RECORD_TYPES}

    # Configurar resolver con timeout personalizado
    resolver = dns.resolver.Resolver()
    resolver.timeout  = timeout
    resolver.lifetime = timeout

    for rtype in DNS_RECORD_TYPES:
        try:
            logger.debug(f"  Consultando registro {rtype} para {target}...")
            answers = resolver.resolve(target, rtype)

            for rdata in answers:
                # Cada tipo de registro tiene distinto formato de texto
                if rtype == "MX":
                    # MX tiene prioridad + exchange: "10 mail.ejemplo.bo."
                    value = f"{rdata.preference} {rdata.exchange.to_text()}"
                elif rtype == "SOA":
                    value = rdata.to_text()
                else:
                    # A, NS, TXT, CNAME → to_text() es suficiente
                    value = rdata.to_text().strip('"')  # TXT tiene comillas extra

                records[rtype].append(value)
                logger.debug(f"    {rtype}: {value}")

        except dns.resolver.NXDOMAIN:
            logger.warning(f"  {rtype}: NXDOMAIN — dominio no existe en DNS")
            break  # Si no existe el dominio, no tiene caso seguir

        except dns.resolver.NoAnswer:
            # Normal — no todos los dominios tienen todos los tipos de registros
            logger.debug(f"  {rtype}: Sin registros (NoAnswer)")

        except dns.resolver.Timeout:
            logger.warning(f"  {rtype}: Timeout al consultar DNS")

        except dns.resolver.NoNameservers:
            logger.warning(f"  {rtype}: No hay nameservers disponibles")

        except Exception as e:
            logger.error(f"  {rtype}: Error inesperado — {e}")

        # Pequeña pausa entre consultas para no parecer agresivo
        time.sleep(0.3)

    return records


# ─────────────────────────────────────────────
#  Consulta de subdominios via crt.sh
# ─────────────────────────────────────────────
def query_crt_sh(target: str, timeout: int) -> list:
    """
    Consulta la API de crt.sh para descubrir subdominios
    registrados en Certificate Transparency Logs.

    ¿Por qué funciona esto?
    Cuando una CA emite un certificado TLS para *.ejemplo.bo
    o subdominio.ejemplo.bo, queda registrado públicamente
    en los CT Logs. crt.sh agrega todos esos registros y
    los expone via API JSON — completamente pasivo.

    Deduplicación:
      crt.sh puede retornar el mismo subdominio varias veces
      (un cert por cada renovación anual). Retornamos set()
      convertido a lista ordenada.

    Filtramos:
      - Entradas con "*" (wildcard certs) — no son subdominios concretos
      - El dominio raíz mismo
    """
    url = CRT_SH_URL.format(domain=f"%.{target}")
    subdomains = set()

    logger.debug(f"  Consultando crt.sh: {url}")

    try:
        response = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "condor-framework/0.1 (github.com/villaalextor)"}
        )

        if response.status_code != 200:
            logger.warning(f"  crt.sh respondió con status {response.status_code}")
            return []

        entries = response.json()
        logger.debug(f"  crt.sh retornó {len(entries)} entradas brutas")

        for entry in entries:
            # Cada entry tiene "name_value" que puede tener múltiples
            # subdominios separados por \n (SANs del certificado)
            name_value = entry.get("name_value", "")
            for name in name_value.split("\n"):
                name = name.strip().lower()

                # Filtrar wildcards y el dominio raíz
                if name.startswith("*") or name == target:
                    continue

                # Solo incluir subdominios del dominio objetivo
                if name.endswith(f".{target}") or name == target:
                    subdomains.add(name)

        logger.debug(f"  Subdominios únicos encontrados: {len(subdomains)}")

    except requests.Timeout:
        logger.warning("  crt.sh: Timeout en la consulta")
    except requests.ConnectionError:
        logger.warning("  crt.sh: Error de conexión")
    except ValueError:
        # json() falla si la respuesta no es JSON válido
        logger.warning("  crt.sh: Respuesta no es JSON válido")
    except Exception as e:
        logger.error(f"  crt.sh: Error inesperado — {e}")

    return sorted(list(subdomains))


# ─────────────────────────────────────────────
#  Análisis de registros TXT (SPF/DMARC/DKIM)
# ─────────────────────────────────────────────
def analyze_email_security(records: dict, target: str, timeout: int) -> dict:
    """
    Analiza la configuración de seguridad de email del dominio.
    
    SPF  (Sender Policy Framework): registro TXT en la raíz
         Previene spoofing — define qué IPs pueden enviar email
         
    DMARC (Domain-based Message Auth): registro TXT en _dmarc.<domain>
         Define política si SPF/DKIM fallan (none/quarantine/reject)
         
    DKIM  (DomainKeys Identified Mail): registro TXT en <selector>._domainkey.<domain>
         Firma criptográfica — difícil de detectar sin el selector exacto
         (solo verificamos si existe algún registro en _domainkey)

    Relevancia para OSINT:
      Ausencia de SPF/DMARC = dominio vulnerable a email spoofing
      Esto es un hallazgo de seguridad documentable en fichas de vulnerabilidad.
    """
    txt_records  = records.get("TXT", [])
    has_spf      = any("v=spf1" in r.lower() for r in txt_records)
    has_dmarc    = False
    has_dkim     = False
    dmarc_policy = None

    # DMARC está en _dmarc.<dominio>
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = timeout
        dmarc_answers = resolver.resolve(f"_dmarc.{target}", "TXT")
        for rdata in dmarc_answers:
            txt = rdata.to_text().strip('"')
            if "v=dmarc1" in txt.lower():
                has_dmarc = True
                # Extraer política: p=none / p=quarantine / p=reject
                for part in txt.split(";"):
                    part = part.strip()
                    if part.lower().startswith("p="):
                        dmarc_policy = part.split("=")[1].strip()
    except Exception:
        pass  # Sin DMARC es el resultado esperado para muchos dominios

    # DKIM — intentamos selector genérico "default"
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = timeout
        resolver.resolve(f"default._domainkey.{target}", "TXT")
        has_dkim = True
    except Exception:
        pass

    return {
        "has_spf":      has_spf,
        "has_dmarc":    has_dmarc,
        "has_dkim":     has_dkim,
        "dmarc_policy": dmarc_policy,
        # Evaluación de riesgo básica
        "email_spoofing_risk": (
            "ALTO"   if not has_spf and not has_dmarc else
            "MEDIO"  if not has_dmarc else
            "BAJO"
        )
    }


# ─────────────────────────────────────────────
#  Función principal — contrato con condor.py
# ─────────────────────────────────────────────
def run(target: str, timeout: int = 10) -> dict:
    """
    Punto de entrada del módulo. Llamado por condor.py así:
      data = mod.run(target=target, timeout=timeout)

    Ejecuta en orden:
      1. Consulta registros DNS (A, MX, NS, TXT, CNAME)
      2. Consulta subdominios via crt.sh
      3. Analiza seguridad de email (SPF/DMARC/DKIM)
      4. Construye y retorna el dict de resultados

    Args:
      target  : Dominio limpio, ej: "ejemplo.bo"
      timeout : Segundos máximos por consulta de red

    Returns:
      dict con keys: records, subdomains, email_security, summary
    """
    logger.info(f"[DNS] Iniciando reconocimiento para: {target}")

    # ── 1. Registros DNS ─────────────────────
    logger.info("[DNS] Consultando registros DNS...")
    records = query_dns_records(target, timeout)

    total_records = sum(len(v) for v in records.values())
    logger.info(f"[DNS] {total_records} registros DNS encontrados")

    # ── 2. Subdominios via crt.sh ─────────────
    logger.info("[DNS] Consultando crt.sh para subdominios...")
    subdomains = query_crt_sh(target, timeout)
    logger.info(f"[DNS] {len(subdomains)} subdominios únicos encontrados")

    # ── 3. Seguridad de email ─────────────────
    logger.info("[DNS] Analizando configuración SPF/DMARC/DKIM...")
    email_security = analyze_email_security(records, target, timeout)

    # Loguear hallazgo relevante
    risk = email_security["email_spoofing_risk"]
    if risk in ("ALTO", "MEDIO"):
        logger.warning(f"[DNS] Riesgo de email spoofing: {risk}")

    # ── 4. Resultado final ────────────────────
    result = {
        "status":   "ok",
        "records":  records,
        "subdomains": subdomains,
        "email_security": email_security,
        "summary": {
            "total_records":    total_records,
            "total_subdomains": len(subdomains),
            "ips_found":        records.get("A", []),
            "nameservers":      records.get("NS", []),
            "mail_servers":     records.get("MX", []),
            "has_spf":          email_security["has_spf"],
            "has_dmarc":        email_security["has_dmarc"],
            "has_dkim":         email_security["has_dkim"],
            "email_spoofing_risk": email_security["email_spoofing_risk"],
        }
    }

    logger.info(f"[DNS] Módulo completado — {total_records} registros, {len(subdomains)} subdominios")
    return result