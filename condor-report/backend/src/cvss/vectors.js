"use strict"

// ─────────────────────────────────────────────
//  Definición completa de métricas CVSS 3.1
// ─────────────────────────────────────────────

/**
 * Cada métrica tiene:
 *   - id          : código del vector (AV, AC, etc.)
 *   - name        : nombre completo
 *   - shortName   : nombre corto para badges
 *   - description : qué mide esta métrica
 *   - order       : posición en el vector canónico
 *   - options     : array de valores posibles con metadata
 *     - value       : código de un carácter (N, L, H, etc.)
 *     - label       : nombre del valor
 *     - shortLabel  : abreviación para botones compactos
 *     - description : qué significa este valor
 *     - example     : ejemplo concreto de una vulnerabilidad real
 *     - weight      : peso numérico (referencia a calculator.js)
 *     - color       : clase Tailwind para el color del botón en UI
 */
const METRICS = {

  // ── AV — Attack Vector ─────────────────────
  AV: {
    id:          "AV",
    name:        "Attack Vector",
    shortName:   "Vector de Ataque",
    description: "Define desde dónde puede el atacante lanzar el ataque. A mayor distancia, mayor riesgo.",
    order:       1,
    options: [
      {
        value:       "N",
        label:       "Network",
        shortLabel:  "Red",
        description: "La vulnerabilidad es explotable de forma remota vía red (internet). No requiere acceso físico ni adyacencia de red.",
        example:     "CVE-2021-44228 (Log4Shell) — explotable desde internet sin autenticación",
        weight:      0.85,
        color:       "red",
      },
      {
        value:       "A",
        label:       "Adjacent",
        shortLabel:  "Adyacente",
        description: "El atacante debe estar en la misma red local, segmento de red o dominio de broadcast.",
        example:     "Vulnerabilidades en protocolos ARP, DHCP o Bonjour — requieren estar en la misma LAN",
        weight:      0.62,
        color:       "orange",
      },
      {
        value:       "L",
        label:       "Local",
        shortLabel:  "Local",
        description: "El atacante necesita acceso local al sistema (sesión interactiva, SSH, etc.) o ejecutar un archivo malicioso.",
        example:     "Escalación de privilegios local — el atacante ya tiene acceso como usuario estándar",
        weight:      0.55,
        color:       "yellow",
      },
      {
        value:       "P",
        label:       "Physical",
        shortLabel:  "Físico",
        description: "El atacante debe tener acceso físico al hardware del sistema afectado.",
        example:     "Ataque Cold Boot, Evil Maid Attack — requieren tocar el dispositivo",
        weight:      0.20,
        color:       "green",
      },
    ],
  },

  // ── AC — Attack Complexity ─────────────────
  AC: {
    id:          "AC",
    name:        "Attack Complexity",
    shortName:   "Complejidad",
    description: "Condiciones fuera del control del atacante que deben existir para explotar la vulnerabilidad.",
    order:       2,
    options: [
      {
        value:       "L",
        label:       "Low",
        shortLabel:  "Baja",
        description: "Sin condiciones especiales. El ataque puede repetirse a voluntad sin limitaciones.",
        example:     "SQL Injection básico — no requiere condiciones específicas del entorno",
        weight:      0.77,
        color:       "red",
      },
      {
        value:       "H",
        label:       "High",
        shortLabel:  "Alta",
        description: "El atacante debe invertir en inteligencia del objetivo, estar en una posición de red específica, o esperar condiciones poco frecuentes.",
        example:     "Race condition — el atacante debe sincronizar el ataque con una ventana de tiempo precisa",
        weight:      0.44,
        color:       "green",
      },
    ],
  },

  // ── PR — Privileges Required ───────────────
  PR: {
    id:          "PR",
    name:        "Privileges Required",
    shortName:   "Privilegios",
    description: "Nivel de privilegios que el atacante necesita tener en el sistema antes de explotar la vulnerabilidad.",
    order:       3,
    options: [
      {
        value:       "N",
        label:       "None",
        shortLabel:  "Ninguno",
        description: "No se requieren privilegios previos. El atacante puede actuar como usuario anónimo.",
        example:     "RCE pre-autenticación — cualquiera en internet puede atacar sin credenciales",
        weight:      0.85,
        color:       "red",
      },
      {
        value:       "L",
        label:       "Low",
        shortLabel:  "Bajo",
        description: "El atacante necesita privilegios básicos — una cuenta de usuario estándar sin permisos especiales.",
        example:     "IDOR — un usuario autenticado puede acceder a recursos de otros usuarios",
        weight:      0.62,
        color:       "orange",
      },
      {
        value:       "H",
        label:       "High",
        shortLabel:  "Alto",
        description: "El atacante necesita privilegios administrativos o de sistema sobre el componente vulnerable.",
        example:     "Vulnerabilidad que solo puede ser explotada siendo administrador del sistema",
        weight:      0.27,
        color:       "green",
      },
    ],
  },

  // ── UI — User Interaction ──────────────────
  UI: {
    id:          "UI",
    name:        "User Interaction",
    shortName:   "Interacción",
    description: "Si la explotación requiere que un usuario (diferente al atacante) tome alguna acción.",
    order:       4,
    options: [
      {
        value:       "N",
        label:       "None",
        shortLabel:  "Ninguna",
        description: "No requiere que ningún usuario interactúe. El atacante puede explotar de forma completamente autónoma.",
        example:     "WannaCry — se propaga automáticamente sin que ningún usuario haga clic en nada",
        weight:      0.85,
        color:       "red",
      },
      {
        value:       "R",
        label:       "Required",
        shortLabel:  "Requerida",
        description: "Requiere que un usuario tome una acción específica (abrir archivo, visitar URL, hacer clic en enlace).",
        example:     "Phishing con macro maliciosa — la víctima debe abrir el documento y habilitar macros",
        weight:      0.62,
        color:       "green",
      },
    ],
  },

  // ── S — Scope ──────────────────────────────
  S: {
    id:          "S",
    name:        "Scope",
    shortName:   "Alcance",
    description: "Si la vulnerabilidad puede afectar recursos más allá del componente vulnerable original.",
    order:       5,
    options: [
      {
        value:       "U",
        label:       "Unchanged",
        shortLabel:  "Sin cambio",
        description: "El impacto se limita al componente vulnerable. No hay efecto en otros sistemas o contextos de seguridad.",
        example:     "Vulnerabilidad en una aplicación que solo afecta esa aplicación, no al SO ni a otros servicios",
        color:       "slate",
      },
      {
        value:       "C",
        label:       "Changed",
        shortLabel:  "Cambiado",
        description: "La vulnerabilidad permite impactar recursos más allá del componente original — otros sistemas, el hipervisor, otros contenedores, etc.",
        example:     "VM escape — un atacante dentro de una VM puede comprometer el hipervisor y otras VMs",
        color:       "red",
      },
    ],
  },

  // ── C — Confidentiality ────────────────────
  C: {
    id:          "C",
    name:        "Confidentiality Impact",
    shortName:   "Confidencialidad",
    description: "Impacto sobre la confidencialidad de la información del componente afectado.",
    order:       6,
    options: [
      {
        value:       "N",
        label:       "None",
        shortLabel:  "Ninguno",
        description: "Sin impacto en confidencialidad. El atacante no puede obtener información del sistema.",
        weight:      0.00,
        color:       "green",
      },
      {
        value:       "L",
        label:       "Low",
        shortLabel:  "Bajo",
        description: "Acceso a información limitada. El atacante puede obtener algunos datos pero no todos, o solo información de bajo impacto.",
        example:     "Lectura de archivos de configuración no críticos",
        weight:      0.22,
        color:       "yellow",
      },
      {
        value:       "H",
        label:       "High",
        shortLabel:  "Alto",
        description: "Pérdida total de confidencialidad. El atacante puede leer todos los datos del componente afectado.",
        example:     "Dump completo de base de datos con credenciales y datos de usuarios",
        weight:      0.56,
        color:       "red",
      },
    ],
  },

  // ── I — Integrity ──────────────────────────
  I: {
    id:          "I",
    name:        "Integrity Impact",
    shortName:   "Integridad",
    description: "Impacto sobre la integridad de la información — capacidad de modificar datos.",
    order:       7,
    options: [
      {
        value:       "N",
        label:       "None",
        shortLabel:  "Ninguno",
        description: "Sin impacto en integridad. El atacante no puede modificar información del sistema.",
        weight:      0.00,
        color:       "green",
      },
      {
        value:       "L",
        label:       "Low",
        shortLabel:  "Bajo",
        description: "Modificación limitada de datos. El atacante puede modificar algunos archivos o datos, pero sin control total.",
        example:     "Modificar archivos en un directorio específico pero no datos críticos del sistema",
        weight:      0.22,
        color:       "yellow",
      },
      {
        value:       "H",
        label:       "High",
        shortLabel:  "Alto",
        description: "Pérdida total de integridad. El atacante puede modificar cualquier archivo o dato del componente afectado.",
        example:     "RCE — el atacante puede escribir y ejecutar código arbitrario en el sistema",
        weight:      0.56,
        color:       "red",
      },
    ],
  },

  // ── A — Availability ───────────────────────
  A: {
    id:          "A",
    name:        "Availability Impact",
    shortName:   "Disponibilidad",
    description: "Impacto sobre la disponibilidad del componente afectado — capacidad de causar denegación de servicio.",
    order:       8,
    options: [
      {
        value:       "N",
        label:       "None",
        shortLabel:  "Ninguno",
        description: "Sin impacto en disponibilidad. El sistema sigue funcionando normalmente.",
        weight:      0.00,
        color:       "green",
      },
      {
        value:       "L",
        label:       "Low",
        shortLabel:  "Bajo",
        description: "Impacto reducido en disponibilidad. El atacante puede degradar el rendimiento pero no detener el servicio completamente.",
        example:     "Aumento del consumo de CPU que degrada el rendimiento pero no tumba el servicio",
        weight:      0.22,
        color:       "yellow",
      },
      {
        value:       "H",
        label:       "High",
        shortLabel:  "Alto",
        description: "Pérdida total de disponibilidad. El atacante puede hacer el componente completamente inaccesible.",
        example:     "DoS que consume todos los recursos y hace caer el servicio completamente",
        weight:      0.56,
        color:       "red",
      },
    ],
  },
}

// ─────────────────────────────────────────────
//  Display de severidades para la UI
// ─────────────────────────────────────────────

/**
 * Metadata de cada nivel de severidad para mostrar en la UI.
 * Incluye colores, descripciones y tiempos de respuesta recomendados.
 */
const SEVERITY_DISPLAY = {
  "CRÍTICO": {
    label:       "CRÍTICO",
    score_range: "9.0 – 10.0",
    color:       "red",
    bg:          "bg-red-500/10",
    border:      "border-red-500/30",
    text:        "text-red-400",
    dot:         "bg-red-400",
    emoji:       "🔴",
    description: "Vulnerabilidad de máxima severidad. Requiere atención y remediación inmediata.",
    sla:         "Remediación en 24-72 horas",
    cvss_example: "9.8 — RCE remoto sin autenticación (Log4Shell, EternalBlue)",
  },
  "ALTO": {
    label:       "ALTO",
    score_range: "7.0 – 8.9",
    color:       "orange",
    bg:          "bg-orange-500/10",
    border:      "border-orange-500/30",
    text:        "text-orange-400",
    dot:         "bg-orange-400",
    emoji:       "🟠",
    description: "Vulnerabilidad de alta severidad. Puede ser explotada con impacto significativo.",
    sla:         "Remediación en 7 días",
    cvss_example: "7.5 — Autenticación bypass en aplicación web",
  },
  "MEDIO": {
    label:       "MEDIO",
    score_range: "4.0 – 6.9",
    color:       "yellow",
    bg:          "bg-yellow-500/10",
    border:      "border-yellow-500/30",
    text:        "text-yellow-400",
    dot:         "bg-yellow-400",
    emoji:       "🟡",
    description: "Vulnerabilidad de severidad media. Requiere privilegios o condiciones específicas.",
    sla:         "Remediación en 30 días",
    cvss_example: "5.4 — XSS almacenado con autenticación requerida",
  },
  "BAJO": {
    label:       "BAJO",
    score_range: "0.1 – 3.9",
    color:       "green",
    bg:          "bg-green-500/10",
    border:      "border-green-500/30",
    text:        "text-green-400",
    dot:         "bg-green-400",
    emoji:       "🟢",
    description: "Vulnerabilidad de baja severidad. Impacto limitado o muy difícil de explotar.",
    sla:         "Remediación en 90 días",
    cvss_example: "2.7 — Information disclosure local con acceso físico",
  },
  "NINGUNO": {
    label:       "NINGUNO",
    score_range: "0.0",
    color:       "slate",
    bg:          "bg-slate-800/40",
    border:      "border-slate-700",
    text:        "text-slate-400",
    dot:         "bg-slate-500",
    emoji:       "⚪",
    description: "Sin impacto en CIA. No representa riesgo de seguridad.",
    sla:         "Sin SLA de remediación",
    cvss_example: "0.0 — Vulnerabilidad sin impacto en Confidencialidad, Integridad ni Disponibilidad",
  },
}

// ─────────────────────────────────────────────
//  Orden canónico del vector
// ─────────────────────────────────────────────

/** Orden oficial de métricas en el vector string */
const VECTOR_ORDER = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"]

// ─────────────────────────────────────────────
//  Vectores predefinidos para hallazgos comunes
// ─────────────────────────────────────────────

/**
 * Vectores CVSS predefinidos para los tipos de hallazgos
 * más comunes en reconocimiento pasivo.
 *
 * El analista puede seleccionar uno como punto de partida
 * y ajustar según el caso específico.
 */
const PRESET_VECTORS = [
  {
    id:       "db_exposed",
    name:     "Base de datos expuesta públicamente",
    category: "exposicion_servicio",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    score:    9.8,
    severity: "CRÍTICO",
    description: "Puerto de base de datos (MySQL 3306, MongoDB 27017, Redis 6379, etc.) accesible desde internet sin autenticación.",
    applies_to: ["Puerto 3306 expuesto", "Puerto 27017 expuesto", "Puerto 6379 expuesto"],
  },
  {
    id:       "rdp_exposed",
    name:     "RDP expuesto públicamente",
    category: "exposicion_servicio",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    score:    9.8,
    severity: "CRÍTICO",
    description: "Puerto 3389 (RDP) accesible desde internet — superficie de ataque directa para ataques de fuerza bruta y exploits RDP.",
    applies_to: ["Puerto 3389 expuesto"],
  },
  {
    id:       "cve_critical_rce",
    name:     "CVE Crítico con RCE",
    category: "cve_critico",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    score:    9.8,
    severity: "CRÍTICO",
    description: "CVE con CVSS ≥ 9.0 que permite ejecución remota de código sin autenticación.",
    applies_to: ["CVE CVSS ≥ 9.0"],
  },
  {
    id:       "email_spoofing_no_spf_dmarc",
    name:     "Email spoofing — Sin SPF ni DMARC",
    category: "email_spoofing",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:H/A:N",
    score:    6.5,
    severity: "MEDIO",
    description: "Dominio sin registros SPF ni DMARC — cualquiera puede enviar emails falsificados desde el dominio.",
    applies_to: ["Sin SPF", "Sin DMARC"],
  },
  {
    id:       "email_spoofing_no_dmarc",
    name:     "Email spoofing — Sin DMARC (SPF presente)",
    category: "email_spoofing",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:M/A:N",
    score:    5.4,
    severity: "MEDIO",
    description: "Dominio con SPF pero sin DMARC — protección parcial, emails no autorizados pueden llegar a destino.",
    applies_to: ["SPF presente", "Sin DMARC"],
  },
  {
    id:       "sensitive_file_historical",
    name:     "Archivo sensible en historial Wayback",
    category: "archivo_sensible",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    score:    7.5,
    severity: "ALTO",
    description: "Archivo sensible (.env, .bak, config.php, etc.) accesible en historial de Wayback Machine — puede contener credenciales o configuración.",
    applies_to: [".env expuesto", ".bak expuesto", "config.php expuesto"],
  },
  {
    id:       "backup_exposed",
    name:     "Archivo de backup expuesto",
    category: "backup_expuesto",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    score:    7.5,
    severity: "ALTO",
    description: "Archivo de backup (.zip, .sql, .tar.gz) con código fuente o base de datos accesible históricamente.",
    applies_to: [".zip expuesto", ".sql expuesto", ".tar expuesto"],
  },
  {
    id:       "admin_panel_exposed",
    name:     "Panel de administración expuesto",
    category: "panel_admin",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N",
    score:    6.5,
    severity: "MEDIO",
    description: "Panel de administración (/admin, /wp-admin, /cpanel) accesible desde internet — superficie de ataque para fuerza bruta.",
    applies_to: ["/admin", "/wp-admin", "/cpanel", "/phpmyadmin"],
  },
  {
    id:       "tls_expired",
    name:     "Certificado TLS expirado",
    category: "tls_issue",
    vector:   "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N",
    score:    4.2,
    severity: "MEDIO",
    description: "Certificado TLS expirado — usuarios reciben advertencia de seguridad y pueden ser vulnerables a ataques MitM.",
    applies_to: ["Cert expirado"],
  },
  {
    id:       "tls_self_signed",
    name:     "Certificado TLS autofirmado",
    category: "tls_issue",
    vector:   "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N",
    score:    4.2,
    severity: "MEDIO",
    description: "Certificado TLS autofirmado — no validado por CA de confianza, vulnerable a ataques MitM.",
    applies_to: ["Cert autofirmado"],
  },
  {
    id:       "domain_expiring",
    name:     "Dominio próximo a expirar",
    category: "whois_expiracion",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:H",
    score:    8.2,
    severity: "ALTO",
    description: "El dominio expira en menos de 30 días — riesgo de caída de servicio y potencial secuestro de dominio si no se renueva.",
    applies_to: ["Expiración < 30 días"],
  },
  {
    id:       "emails_it_exposed",
    name:     "Emails de personal IT expuestos",
    category: "email_expuesto",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N",
    score:    5.4,
    severity: "MEDIO",
    description: "Emails de personal IT y seguridad indexados en Hunter.io — superficie de ataque directa para spear phishing.",
    applies_to: ["Emails IT expuestos"],
  },
  {
    id:       "ssh_exposed",
    name:     "SSH expuesto públicamente",
    category: "exposicion_servicio",
    vector:   "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
    score:    8.1,
    severity: "ALTO",
    description: "Puerto 22 (SSH) expuesto en internet — superficie de ataque para fuerza bruta y exploits SSH.",
    applies_to: ["Puerto 22 expuesto"],
  },
  {
    id:       "ftp_exposed",
    name:     "FTP expuesto públicamente",
    category: "exposicion_servicio",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
    score:    9.1,
    severity: "CRÍTICO",
    description: "Puerto 21 (FTP) expuesto — protocolo sin cifrado, credenciales transmitidas en texto plano.",
    applies_to: ["Puerto 21 expuesto"],
  },
  {
    id:       "telnet_exposed",
    name:     "Telnet expuesto públicamente",
    category: "exposicion_servicio",
    vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    score:    9.8,
    severity: "CRÍTICO",
    description: "Puerto 23 (Telnet) expuesto — protocolo obsoleto sin cifrado, todo el tráfico incluyendo credenciales viaja en texto plano.",
    applies_to: ["Puerto 23 expuesto"],
  },
]

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/**
 * Retorna la opción de una métrica dado su valor.
 *
 * @param {string} metricId — "AV", "AC", etc.
 * @param {string} value    — "N", "L", "H", etc.
 * @returns {object|null} la opción correspondiente
 */
function getOption(metricId, value) {
  const metric = METRICS[metricId]
  if (!metric) return null
  return metric.options.find(o => o.value === String(value).toUpperCase()) || null
}

/**
 * Genera una descripción legible de un vector completo.
 * Útil para el resumen textual en el informe.
 *
 * @param {object} metrics — { AV, AC, PR, UI, S, C, I, A }
 * @returns {string} descripción en lenguaje natural
 */
function getVectorDescription(metrics) {
  const parts = []

  const av = getOption("AV", metrics.AV)
  const ac = getOption("AC", metrics.AC)
  const pr = getOption("PR", metrics.PR)
  const ui = getOption("UI", metrics.UI)
  const s  = getOption("S",  metrics.S)
  const c  = getOption("C",  metrics.C)
  const i  = getOption("I",  metrics.I)
  const a  = getOption("A",  metrics.A)

  if (av) parts.push(`Explotable vía ${av.label.toLowerCase()}`)
  if (ac) parts.push(`complejidad ${ac.label.toLowerCase()}`)
  if (pr) parts.push(`sin privilegios previos requeridos` === pr.label ? "sin privilegios previos" : `requiere privilegios ${pr.shortLabel.toLowerCase()}`)
  if (ui && ui.value === "R") parts.push("requiere interacción del usuario")
  if (s  && s.value  === "C") parts.push("con impacto en componentes adyacentes (scope changed)")

  const impacts = []
  if (c && c.value !== "N") impacts.push(`confidencialidad ${c.shortLabel.toLowerCase()}`)
  if (i && i.value !== "N") impacts.push(`integridad ${i.shortLabel.toLowerCase()}`)
  if (a && a.value !== "N") impacts.push(`disponibilidad ${a.shortLabel.toLowerCase()}`)

  if (impacts.length > 0) {
    parts.push(`impacto en ${impacts.join(", ")}`)
  } else {
    parts.push("sin impacto en CIA")
  }

  return parts.join(", ") + "."
}

/**
 * Busca el preset más apropiado para un hallazgo dado
 * su categoría o palabras clave.
 *
 * @param {string} category — categoría del hallazgo
 * @param {string} [keyword] — palabra clave adicional
 * @returns {object|null} preset recomendado
 */
function suggestPreset(category, keyword) {
  // Buscar por categoría exacta
  const byCategory = PRESET_VECTORS.filter(p => p.category === category)

  if (byCategory.length === 1) return byCategory[0]

  // Si hay varios, buscar por keyword
  if (keyword && byCategory.length > 1) {
    const kw = keyword.toLowerCase()
    const match = byCategory.find(p =>
      p.applies_to.some(k => k.toLowerCase().includes(kw)) ||
      p.name.toLowerCase().includes(kw)
    )
    if (match) return match
  }

  // Retornar el primero de la categoría o null
  return byCategory[0] || null
}

/**
 * Retorna todos los presets ordenados por score descendente.
 */
function getPresetsOrdered() {
  return [...PRESET_VECTORS].sort((a, b) => b.score - a.score)
}

// ─────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────
module.exports = {
  METRICS,
  SEVERITY_DISPLAY,
  VECTOR_ORDER,
  PRESET_VECTORS,
  getOption,
  getVectorDescription,
  suggestPreset,
  getPresetsOrdered,
}