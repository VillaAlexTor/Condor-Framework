"use strict"

const { calculateFromVector }    = require("../cvss/calculator")
const { suggestPreset, METRICS } = require("../cvss/vectors")

// ─────────────────────────────────────────────
//  Contador de fichas (por request, no global)
// ─────────────────────────────────────────────
function createCounter() {
  let count = 0
  return {
    next() {
      count++
      return `VULN-${String(count).padStart(3, "0")}`
    }
  }
}

// ─────────────────────────────────────────────
//  Factory de ficha base
// ─────────────────────────────────────────────

/**
 * Crea una ficha con todos los campos requeridos.
 * Los campos vacíos los completa el analista en FichaEditor.
 *
 * @param {object} params
 * @param {object} counter - counter creado por createCounter()
 * @returns {object} ficha de vulnerabilidad completa
 */
function createFicha({
  titulo,
  categoria,
  fuente,
  cve_id      = null,
  descripcion = "",
  evidencia   = "",
  impacto     = "",
  vectorString,
  recomendacion = "",
  referencias   = [],
  raw           = {},   // datos brutos del módulo para referencia
}, counter) {
  // Calcular CVSS desde el vector
  let cvssResult = null
  try {
    cvssResult = calculateFromVector(vectorString)
  } catch (e) {
    // Si el vector falla, usar valores por defecto
    cvssResult = {
      score:    0,
      severity: "NINGUNO",
      vector:   vectorString,
      metrics:  {},
    }
  }

  // Prioridad: 1 = más urgente (CRÍTICO), 4 = menos (BAJO)
  const prioridad = {
    "CRÍTICO": 1,
    "ALTO":    2,
    "MEDIO":   3,
    "BAJO":    4,
    "NINGUNO": 5,
  }[cvssResult.severity] || 5

  return {
    id:           counter ? counter.next() : "VULN-000",
    titulo,
    categoria,
    fuente,
    cve_id,

    descripcion,
    evidencia,
    impacto,

    cvss: {
      version:  "3.1",
      vector:   cvssResult.vector,
      score:    cvssResult.score,
      severity: cvssResult.severity,
      metrics:  cvssResult.metrics,
    },

    recomendacion,
    referencias,
    estado:    "abierto",    // abierto | en_remediacion | cerrado
    prioridad,

    // Metadata del import
    _meta: {
      auto_generated: true,
      source_module:  fuente,
      raw,
    },
  }
}

// ─────────────────────────────────────────────
//  Extractores por módulo
// ─────────────────────────────────────────────

/**
 * Extrae hallazgos del módulo DNS.
 * Detecta: ausencia de SPF, DMARC, DKIM — riesgo de email spoofing.
 */
function extractFromDns(dnsData, target, counter) {
  const fichas = []
  if (!dnsData || dnsData.status !== "ok") return fichas

  const emailSec = dnsData.email_security || {}
  const risk     = emailSec.email_spoofing_risk

  if (risk === "ALTO") {
    // Sin SPF ni DMARC
    fichas.push(createFicha({
      titulo:    `Email Spoofing — Sin SPF ni DMARC en ${target}`,
      categoria: "email_spoofing",
      fuente:    "dns",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:H/A:N",
      descripcion: `El dominio ${target} no tiene configurados los registros SPF ni DMARC. ` +
                   `Esto permite que cualquier actor malicioso envíe emails falsificados ` +
                   `haciéndose pasar por ${target}, facilitando ataques de phishing, ` +
                   `fraude por email (BEC) y daño reputacional.`,
      evidencia: `Registro SPF: NO ENCONTRADO\n` +
                 `Registro DMARC (_dmarc.${target}): NO ENCONTRADO\n` +
                 `Registros TXT del dominio: ${(dnsData.records?.TXT || []).join(" | ") || "ninguno"}`,
      impacto:   `Un atacante puede enviar emails desde @${target} sin restricciones. ` +
                 `Los destinatarios no tienen forma de distinguirlos de emails legítimos. ` +
                 `Riesgo de phishing masivo, robo de credenciales y fraude financiero.`,
      referencias: [
        "https://tools.ietf.org/html/rfc7208",   // SPF
        "https://tools.ietf.org/html/rfc7489",   // DMARC
        "https://dmarcian.com/what-is-dmarc/",
      ],
      raw: emailSec,
    }), counter)

  } else if (risk === "MEDIO") {
    // SPF presente pero sin DMARC
    fichas.push(createFicha({
      titulo:    `Email Spoofing — DMARC ausente en ${target}`,
      categoria: "email_spoofing",
      fuente:    "dns",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:M/A:N",
      descripcion: `El dominio ${target} tiene SPF configurado pero carece de registro DMARC. ` +
                   `Sin DMARC, no existe una política formal de qué hacer con emails que fallen ` +
                   `la validación SPF, permitiendo que lleguen a destino.`,
      evidencia: `Registro SPF: PRESENTE (${(dnsData.records?.TXT || []).find(t => t.includes("v=spf1")) || "v=spf1 ..."})\n` +
                 `Registro DMARC: NO ENCONTRADO\n` +
                 `Política DMARC: N/A`,
      impacto:   `Emails no autorizados pueden llegar a la bandeja de entrada de los destinatarios. ` +
                 `Protección parcial — SPF reduce el riesgo pero DMARC es necesario para aplicar políticas.`,
      referencias: [
        "https://tools.ietf.org/html/rfc7489",
        "https://dmarc.org/overview/",
      ],
      raw: emailSec,
    }), counter)
  }

  return fichas
}

/**
 * Extrae hallazgos del módulo WHOIS.
 * Detecta: expiración próxima del dominio.
 */
function extractFromWhois(whoisData, target, counter) {
  const fichas = []
  if (!whoisData || whoisData.status !== "ok") return fichas

  const analysis = whoisData.analysis || {}
  const days     = analysis.days_to_expire

  if (days === null || days === undefined) return fichas

  if (days < 0) {
    // Ya expiró
    fichas.push(createFicha({
      titulo:       `Dominio expirado: ${target}`,
      categoria:    "whois_expiracion",
      fuente:       "whois",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:H",
      descripcion:  `El dominio ${target} ya expiró hace ${Math.abs(days)} días. ` +
                    `Un dominio expirado puede ser registrado por terceros, ` +
                    `resultando en pérdida total de control sobre el mismo.`,
      evidencia:    `Fecha de expiración WHOIS: ${whoisData.expires_on || "N/A"}\n` +
                    `Estado: EXPIRADO (hace ${Math.abs(days)} días)\n` +
                    `Registrar: ${whoisData.registrar || "N/A"}`,
      impacto:      `Pérdida de control del dominio. Posible registro por terceros para ` +
                    `ataques de typosquatting, phishing o daño reputacional.`,
      referencias:  ["https://www.icann.org/resources/pages/domain-expiry-2014-07-02-en"],
      raw: analysis,
    }), counter)

  } else if (days < 30) {
    fichas.push(createFicha({
      titulo:       `Expiración crítica del dominio ${target} (${days} días)`,
      categoria:    "whois_expiracion",
      fuente:       "whois",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:H",
      descripcion:  `El dominio ${target} expira en ${days} días. ` +
                    `Sin renovación inmediata, el dominio quedará disponible para registro por terceros.`,
      evidencia:    `Fecha de expiración: ${whoisData.expires_on || "N/A"}\n` +
                    `Días restantes: ${days}\n` +
                    `Registrar: ${whoisData.registrar || "N/A"}`,
      impacto:      `Caída total del servicio web, email y cualquier subdominio asociado. ` +
                    `Riesgo de secuestro de dominio por terceros.`,
      raw: analysis,
    }), counter)

  } else if (days < 90) {
    fichas.push(createFicha({
      titulo:       `Dominio próximo a expirar: ${target} (${days} días)`,
      categoria:    "whois_expiracion",
      fuente:       "whois",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:M",
      descripcion:  `El dominio ${target} expira en ${days} días. ` +
                    `Se recomienda renovar con anticipación para evitar interrupción de servicios.`,
      evidencia:    `Fecha de expiración: ${whoisData.expires_on || "N/A"}\n` +
                    `Días restantes: ${days}\n` +
                    `Registrar: ${whoisData.registrar || "N/A"}`,
      impacto:      `Riesgo de caída de servicios si no se renueva antes de la fecha de expiración.`,
      raw: analysis,
    }), counter)
  }

  return fichas
}

/**
 * Extrae hallazgos del módulo Wayback.
 * Detecta: archivos sensibles, backups, paneles admin.
 */
function extractFromWayback(waybackData, target, counter) {
  const fichas   = []
  if (!waybackData || waybackData.status !== "ok") return fichas

  const findings = waybackData.findings || {}

  // ── Archivos sensibles ───────────────────
  const sensFiles = findings.sensitive_files || []
  if (sensFiles.length > 0) {
    const examples = sensFiles.slice(0, 3).join("\n")
    fichas.push(createFicha({
      titulo:       `Archivos sensibles en historial Wayback — ${target}`,
      categoria:    "archivo_sensible",
      fuente:       "wayback",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
      descripcion:  `Se encontraron ${sensFiles.length} archivos sensibles en el historial ` +
                    `de Wayback Machine para ${target}. Estos archivos pueden contener ` +
                    `credenciales, configuración de base de datos, claves API o información ` +
                    `confidencial del sistema.`,
      evidencia:    `Archivos encontrados (${sensFiles.length} total):\n${examples}` +
                    (sensFiles.length > 3 ? `\n... y ${sensFiles.length - 3} más` : ""),
      impacto:      `Exposición de credenciales, claves de API, configuración de servidores ` +
                    `o datos sensibles que permitan acceso no autorizado al sistema.`,
      referencias:  ["https://owasp.org/www-project-web-security-testing-guide/"],
      raw: { urls: sensFiles },
    }), counter)
  }

  // ── Archivos de backup ───────────────────
  const backupFiles = findings.backup_files || []
  if (backupFiles.length > 0) {
    const examples = backupFiles.slice(0, 3).join("\n")
    fichas.push(createFicha({
      titulo:       `Archivos de backup expuestos — ${target}`,
      categoria:    "backup_expuesto",
      fuente:       "wayback",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
      descripcion:  `Se encontraron ${backupFiles.length} archivos de backup en el historial ` +
                    `de Wayback Machine. Pueden contener código fuente completo, dumps de base ` +
                    `de datos o configuración del servidor.`,
      evidencia:    `Archivos de backup (${backupFiles.length} total):\n${examples}` +
                    (backupFiles.length > 3 ? `\n... y ${backupFiles.length - 3} más` : ""),
      impacto:      `Exposición del código fuente completo de la aplicación, estructura de ` +
                    `base de datos, contraseñas hasheadas o en texto plano, y configuración ` +
                    `de servidores.`,
      raw: { urls: backupFiles },
    }), counter)
  }

  // ── Paneles de administración ────────────
  const adminPanels = findings.admin_panels || []
  if (adminPanels.length > 0) {
    const examples = adminPanels.slice(0, 5).join("\n")
    fichas.push(createFicha({
      titulo:       `Paneles de administración detectados — ${target}`,
      categoria:    "panel_admin",
      fuente:       "wayback",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N",
      descripcion:  `Se encontraron ${adminPanels.length} rutas de paneles de administración ` +
                    `en el historial de Wayback Machine. Estas rutas son superficie de ataque ` +
                    `para ataques de fuerza bruta, credential stuffing y exploits.`,
      evidencia:    `Rutas detectadas (${adminPanels.length} total):\n${examples}` +
                    (adminPanels.length > 5 ? `\n... y ${adminPanels.length - 5} más` : ""),
      impacto:      `Acceso no autorizado al panel de administración mediante fuerza bruta ` +
                    `o exploits conocidos del CMS/framework detectado.`,
      raw: { urls: adminPanels },
    }), counter)
  }

  return fichas
}

/**
 * Extrae hallazgos del módulo Censys.
 * Detecta: puertos peligrosos, TLS expirado/autofirmado.
 */
function extractFromCensys(censysData, target, counter) {
  const fichas = []
  if (!censysData || censysData.status !== "ok") return fichas

  const analysis = censysData.analysis || {}
  const summary  = censysData.summary  || {}

  // ── Puertos peligrosos ───────────────────
  const dangerPorts = analysis.dangerous_ports_open || []
  const portDescs   = analysis.port_descriptions    || {}

  dangerPorts.forEach(port => {
    const desc    = portDescs[String(port)] || `Puerto ${port}`
    const preset  = suggestPreset("exposicion_servicio", String(port))
    const vector  = preset?.vector || "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"

    // Encontrar el host que tiene este puerto
    const hostsWithPort = (censysData.hosts || [])
      .filter(h => h.ports?.includes(port))
      .map(h => h.ip)

    fichas.push(createFicha({
      titulo:       `${desc} expuesto públicamente — ${target}`,
      categoria:    "exposicion_servicio",
      fuente:       "censys",
      vectorString: vector,
      descripcion:  `El puerto ${port} (${desc.split("—")[0].trim()}) se encuentra abierto ` +
                    `y accesible desde internet en ${hostsWithPort.length > 0 ? hostsWithPort.join(", ") : target}. ` +
                    `Este servicio no debería estar expuesto públicamente.`,
      evidencia:    `Puerto: ${port}\n` +
                    `Protocolo: TCP\n` +
                    `Servicio: ${desc}\n` +
                    `IPs afectadas: ${hostsWithPort.join(", ") || "N/A"}\n` +
                    `Fuente: Censys.io`,
      impacto:      `Exposición directa del servicio a internet aumenta la superficie de ataque. ` +
                    `Riesgo de explotación mediante fuerza bruta, exploits conocidos o acceso no autorizado.`,
      raw: { port, hosts: hostsWithPort },
    }), counter)
  })

  // ── Issues TLS ───────────────────────────
  const tlsIssues = summary.tls_issues || []

  tlsIssues.forEach(issue => {
    const isExpired    = issue.toLowerCase().includes("expirado")
    const isSelfSigned = issue.toLowerCase().includes("autofirmado")

    fichas.push(createFicha({
      titulo:       `Issue de certificado TLS — ${isExpired ? "Expirado" : "Autofirmado"} en ${target}`,
      categoria:    "tls_issue",
      fuente:       "censys",
      vectorString: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N",
      descripcion:  isExpired
        ? `Se detectó un certificado TLS expirado en la infraestructura de ${target}. ` +
          `Los certificados expirados generan advertencias en los navegadores y son ` +
          `vulnerables a ataques Man-in-the-Middle.`
        : `Se detectó un certificado TLS autofirmado en la infraestructura de ${target}. ` +
          `Los certificados autofirmados no son validados por ninguna CA de confianza, ` +
          `permitiendo ataques MitM sin advertencias para usuarios que acepten el cert.`,
      evidencia:    issue,
      impacto:      `Pérdida de confianza de usuarios, posibles ataques Man-in-the-Middle, ` +
                    `interceptación de credenciales y datos en tránsito.`,
      referencias:  ["https://letsencrypt.org/", "https://crt.sh/"],
      raw: { issue },
    }), counter)
  })

  return fichas
}

/**
 * Extrae hallazgos del módulo Shodan.
 * Detecta: CVEs críticos y altos, puertos peligrosos.
 */
function extractFromShodan(shodanData, target, counter) {
  const fichas = []
  if (!shodanData || shodanData.status !== "ok") return fichas

  const analysis = shodanData.analysis || {}

  // ── CVEs críticos y altos ────────────────
  const allVulns  = []
  const seenCves  = new Set()

  ;(shodanData.hosts || []).forEach(host => {
    ;(host.vulns || []).forEach(vuln => {
      if (!seenCves.has(vuln.cve_id) &&
          (vuln.severity === "CRÍTICO" || vuln.severity === "ALTO")) {
        seenCves.add(vuln.cve_id)
        allVulns.push({ ...vuln, host_ip: host.ip })
      }
    })
  })

  allVulns.forEach(vuln => {
    // Construir vector desde el score (aproximación si no tenemos el vector oficial)
    // Para CVEs reales usamos el score de Shodan y mapeamos a un vector base
    const vectorString = vuln.cvss >= 9.0
      ? "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"  // 9.8
      : vuln.cvss >= 7.0
      ? "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:L"  // 7.3
      : "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N"  // 5.4

    fichas.push(createFicha({
      titulo:       `${vuln.cve_id} — ${vuln.severity} (CVSS ${vuln.cvss}) en ${target}`,
      categoria:    "cve_critico",
      fuente:       "shodan",
      cve_id:       vuln.cve_id,
      vectorString,
      descripcion:  vuln.summary ||
                    `Vulnerabilidad ${vuln.cve_id} con CVSS ${vuln.cvss} detectada por Shodan ` +
                    `en la infraestructura de ${target}.`,
      evidencia:    `CVE ID: ${vuln.cve_id}\n` +
                    `CVSS Score: ${vuln.cvss}\n` +
                    `Severidad: ${vuln.severity}\n` +
                    `Host afectado: ${vuln.host_ip}\n` +
                    `Fuente: Shodan.io`,
      impacto:      `Explotación de esta vulnerabilidad puede resultar en ` +
                    `${vuln.cvss >= 9.0
                      ? "compromiso total del sistema (RCE, pérdida de control completa)"
                      : "acceso no autorizado, robo de datos o denegación de servicio"
                    }.`,
      referencias:  [
        `https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`,
        `https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vuln.cve_id}`,
        ...(vuln.references || []).slice(0, 2),
      ],
      raw: vuln,
    }), counter)
  })

  return fichas
}

/**
 * Extrae hallazgos del módulo Hunter.
 * Detecta: emails IT/ejecutivos expuestos, patrón de email.
 */
function extractFromHunter(hunterData, target, counter) {
  const fichas     = []
  if (!hunterData || hunterData.status !== "ok") return fichas

  const riskEmails = hunterData.risk_emails || {}
  const analysis   = hunterData.analysis    || {}
  const itStaff    = riskEmails.it_staff    || []
  const executives = riskEmails.executives  || []
  const pattern    = hunterData.pattern

  // ── Emails IT expuestos ──────────────────
  if (itStaff.length > 0) {
    fichas.push(createFicha({
      titulo:       `Emails de personal IT expuestos — ${target} (${itStaff.length} emails)`,
      categoria:    "email_expuesto",
      fuente:       "hunter",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N",
      descripcion:  `Se encontraron ${itStaff.length} emails de personal IT y seguridad de ` +
                    `${target} indexados en Hunter.io. El personal IT es objetivo de alto ` +
                    `valor para spear phishing por su acceso privilegiado a sistemas.`,
      evidencia:    `Emails IT detectados (${itStaff.length}):\n` +
                    itStaff.slice(0, 5).join("\n") +
                    (itStaff.length > 5 ? `\n... y ${itStaff.length - 5} más` : "") +
                    `\n\nFuente: Hunter.io`,
      impacto:      `Campañas de spear phishing dirigidas a personal con acceso privilegiado. ` +
                    `Un ataque exitoso puede resultar en acceso a sistemas internos, ` +
                    `credenciales VPN, o infraestructura crítica.`,
      raw: { emails: itStaff },
    }), counter)
  }

  // ── Emails ejecutivos expuestos ──────────
  if (executives.length > 0) {
    fichas.push(createFicha({
      titulo:       `Emails ejecutivos expuestos — ${target} (${executives.length} emails)`,
      categoria:    "email_expuesto",
      fuente:       "hunter",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N",
      descripcion:  `Se encontraron ${executives.length} emails de directivos y ejecutivos de ` +
                    `${target} indexados en Hunter.io. Los ejecutivos son objetivo principal ` +
                    `de ataques BEC (Business Email Compromise) y CEO Fraud.`,
      evidencia:    `Emails ejecutivos detectados (${executives.length}):\n` +
                    executives.slice(0, 5).join("\n") +
                    (executives.length > 5 ? `\n... y ${executives.length - 5} más` : "") +
                    `\n\nFuente: Hunter.io`,
      impacto:      `Ataques de Business Email Compromise (BEC), CEO Fraud y spear phishing ` +
                    `dirigido. Potencial de fraude financiero y robo de información confidencial.`,
      referencias:  ["https://www.ic3.gov/Media/Y2022/PSA220504"],
      raw: { emails: executives },
    }), counter)
  }

  // ── Patrón de email corporativo ──────────
  if (pattern && analysis.has_pattern) {
    fichas.push(createFicha({
      titulo:       `Patrón de email corporativo expuesto — ${target} (${pattern})`,
      categoria:    "email_expuesto",
      fuente:       "hunter",
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N",
      descripcion:  `Hunter.io detectó que ${target} usa el patrón de email '${pattern}'. ` +
                    `Con este patrón y una lista de empleados (LinkedIn, directorios web), ` +
                    `un atacante puede construir listas de emails corporativos válidos ` +
                    `para campañas de phishing masivo o password spraying.`,
      evidencia:    `Patrón detectado: ${pattern}\n` +
                    `Ejemplo: ${pattern.replace("{first}", "juan").replace("{last}", "perez").replace("{f}", "j").replace("{l}", "p")}@${target}\n` +
                    `Total emails indexados: ${hunterData.total_emails || "N/A"}\n` +
                    `Fuente: Hunter.io domain-search API`,
      impacto:      `Permite generar listas de emails de todos los empleados de la organización ` +
                    `para campañas de spear phishing personalizadas o ataques de password ` +
                    `spraying contra servicios expuestos (OWA, VPN, Office 365).`,
      raw: { pattern, total: hunterData.total_emails },
    }), counter)
  }

  return fichas
}

// ─────────────────────────────────────────────
//  Función principal de importación
// ─────────────────────────────────────────────

/**
 * Importa un reporte JSON de condor-cli y genera
 * fichas de vulnerabilidad automáticamente.
 *
 * @param {object} reportJson — JSON completo de condor-cli
 * @returns {object} resultado con fichas y metadata
 */
function importFromJson(reportJson) {
  if (!reportJson || typeof reportJson !== "object") {
    throw new Error("JSON inválido: debe ser un objeto con keys 'meta' y 'results'")
  }
  if (!reportJson.meta || !reportJson.results) {
    throw new Error("Estructura inválida: el JSON debe tener 'meta' y 'results'")
  }

  // Crear counter local para IDs consistentes (thread-safe)
  const counter = createCounter()

  const target  = reportJson.meta.target  || "objetivo"
  const results = reportJson.results      || {}
  const errors  = reportJson.errors       || {}
  const fichas  = []

  // ── Procesar cada módulo ─────────────────
  const extractors = [
    { key: "dns",     fn: extractFromDns     },
    { key: "whois",   fn: extractFromWhois   },
    { key: "wayback", fn: extractFromWayback },
    { key: "censys",  fn: extractFromCensys  },
    { key: "shodan",  fn: extractFromShodan  },
    { key: "hunter",  fn: extractFromHunter  },
  ]

  const moduleStats = {}

  extractors.forEach(({ key, fn }) => {
    const moduleData = results[key]
    if (!moduleData) {
      moduleStats[key] = { fichas: 0, status: "not_run" }
      return
    }
    if (moduleData.status === "skipped") {
      moduleStats[key] = { fichas: 0, status: "skipped" }
      return
    }
    if (moduleData.status === "error") {
      moduleStats[key] = { fichas: 0, status: "error" }
      return
    }

    try {
      const extracted = fn(moduleData, target, counter)
      fichas.push(...extracted)
      moduleStats[key] = { fichas: extracted.length, status: "ok" }
    } catch (e) {
      console.error(`[importer] Error extrayendo ${key}:`, e.message)
      moduleStats[key] = { fichas: 0, status: "error", error: e.message }
    }
  })

  // ── Ordenar fichas por prioridad (CVSS desc) ──
  fichas.sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad
    return b.cvss.score - a.cvss.score
  })

  // ── Estadísticas del import ──────────────
  const stats = {
    total:    fichas.length,
    critico:  fichas.filter(f => f.cvss.severity === "CRÍTICO").length,
    alto:     fichas.filter(f => f.cvss.severity === "ALTO").length,
    medio:    fichas.filter(f => f.cvss.severity === "MEDIO").length,
    bajo:     fichas.filter(f => f.cvss.severity === "BAJO").length,
    by_module: moduleStats,
  }

  return {
    // Metadata del reporte original
    report_meta: {
      target:    reportJson.meta.target,
      timestamp: reportJson.meta.timestamp,
      tool:      reportJson.meta.tool,
      modules:   reportJson.meta.modules_run,
    },

    // Fichas generadas
    fichas,

    // Estadísticas
    stats,

    // Template de metadata para el informe final
    informe_meta: {
      titulo:        `Informe de Auditoría OSINT — ${target}`,
      target,
      analista:      "",        // Completar en FichaEditor
      clasificacion: "CONFIDENCIAL",
      fecha:         new Date().toISOString().split("T")[0],
      version:       "1.0",
    },
  }
}

// ─────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────
module.exports = {
  importFromJson,
  // Exportar extractores individuales para testing
  extractFromDns,
  extractFromWhois,
  extractFromWayback,
  extractFromCensys,
  extractFromShodan,
  extractFromHunter,
  createFicha,
  createCounter,
}