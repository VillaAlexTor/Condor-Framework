/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  CÓNDOR FRAMEWORK — condor-report/lib/recommender.js ║
 * ║  Motor de recomendaciones automáticas por categoría  ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * DESCRIPCIÓN:
 *   Genera recomendaciones de remediación para cada
 *   categoría de vulnerabilidad detectada por condor-cli.
 *
 *   Cada recomendación incluye:
 *     - Acción inmediata (remediación directa)
 *     - Acciones de hardening adicionales
 *     - Referencias técnicas (RFC, OWASP, NIST, CVE)
 *     - SLA sugerido según severidad CVSS
 *     - Nivel de dificultad de implementación
 *
 * USO:
 *   const { getRecommendation, enrichFicha } = require("./recommender")
 *
 *   // Obtener recomendación por categoría
 *   const rec = getRecommendation("email_spoofing", { has_spf: true })
 *
 *   // Enriquecer una ficha completa
 *   const fichaEnriquecida = enrichFicha(ficha)
 */

"use strict"

// ─────────────────────────────────────────────
//  Base de conocimiento de recomendaciones
// ─────────────────────────────────────────────

/**
 * Cada categoría tiene:
 *   - immediate   : acción inmediata a tomar
 *   - hardening   : lista de acciones adicionales de hardening
 *   - references  : URLs de documentación técnica
 *   - difficulty  : "baja" | "media" | "alta"
 *   - effort      : tiempo estimado de implementación
 *   - sla         : tiempo máximo recomendado para remediar (por severidad)
 *   - variants    : recomendaciones específicas según contexto (opcional)
 */
const RECOMMENDATIONS = {

  // ── Email Spoofing ───────────────────────────────────────
  email_spoofing: {
    immediate: "Configurar registros SPF, DMARC y DKIM en el DNS del dominio de forma inmediata para prevenir suplantación de identidad por correo electrónico.",
    hardening: [
      "Publicar registro SPF con política estricta: v=spf1 include:_spf.dominio.com -all (usar -all en lugar de ~all para rechazo explícito)",
      "Crear registro DMARC con política 'reject': v=DMARC1; p=reject; rua=mailto:dmarc@dominio.com; ruf=mailto:dmarc@dominio.com; adkim=s; aspf=s",
      "Implementar DKIM con clave de al menos 2048 bits para todos los servidores de correo saliente",
      "Configurar BIMI (Brand Indicators for Message Identification) para reforzar identidad visual",
      "Monitorear informes DMARC semanalmente para detectar intentos de abuso",
      "Usar herramientas como MXToolbox, DMARC Analyzer o Postmark para validar configuración",
      "Revisar todos los servicios de terceros que envían email en nombre del dominio (Mailchimp, SendGrid, etc.) y agregarlos al SPF",
    ],
    references: [
      "https://tools.ietf.org/html/rfc7208",
      "https://tools.ietf.org/html/rfc7489",
      "https://tools.ietf.org/html/rfc6376",
      "https://dmarc.org/overview/",
      "https://mxtoolbox.com/SPFRecordGenerator.aspx",
    ],
    difficulty: "baja",
    effort:     "2-4 horas",
    sla: {
      "CRÍTICO": "24 horas",
      "ALTO":    "7 días",
      "MEDIO":   "30 días",
    },
    variants: {
      no_spf_no_dmarc: "Implementar SPF primero (1-2 horas), luego DMARC en modo p=none para monitoreo (1 semana), y finalmente escalar a p=quarantine y p=reject progresivamente.",
      spf_no_dmarc:    "SPF ya está configurado. Agregar DMARC comenzando con p=none para recopilar datos sin afectar entrega, escalar a p=reject en 2-4 semanas.",
      weak_dmarc:      "Política DMARC en p=none o p=quarantine. Escalar a p=reject para máxima protección.",
    },
  },

  // ── Exposición de servicios ──────────────────────────────
  exposicion_servicio: {
    immediate: "Restringir inmediatamente el acceso al puerto/servicio mediante reglas de firewall. Solo permitir acceso desde IPs autorizadas o a través de VPN.",
    hardening: [
      "Implementar reglas de firewall de entrada (ingress) para bloquear el puerto desde internet",
      "Usar una VPN corporativa (WireGuard, OpenVPN) para acceso remoto seguro en lugar de exponer servicios directamente",
      "Configurar fail2ban o equivalente para bloquear IPs con múltiples intentos fallidos",
      "Implementar autenticación multifactor (MFA) en todos los servicios de acceso remoto",
      "Usar Jump Server / Bastion Host como único punto de entrada a la red interna",
      "Revisar y eliminar reglas de firewall que no sean estrictamente necesarias (principio de menor privilegio)",
      "Implementar Network Segmentation — separar servicios de base de datos de la DMZ",
      "Configurar alertas de acceso no autorizado en el SIEM",
      "Mantener los servicios actualizados con los últimos parches de seguridad",
    ],
    references: [
      "https://owasp.org/www-project-top-ten/",
      "https://nvd.nist.gov/",
      "https://www.cisecurity.org/controls/",
      "https://docs.wireguard.com/",
    ],
    difficulty: "media",
    effort:     "4-8 horas",
    sla: {
      "CRÍTICO": "24-72 horas",
      "ALTO":    "7 días",
      "MEDIO":   "30 días",
    },
    variants: {
      database: "Los puertos de base de datos (MySQL 3306, PostgreSQL 5432, MongoDB 27017, Redis 6379) NUNCA deben estar expuestos en internet. Mover inmediatamente detrás de firewall y usar conexiones desde la aplicación únicamente.",
      rdp:      "RDP (puerto 3389) es uno de los vectores de ataque más explotados. Bloquear inmediatamente, usar VPN + MFA para acceso remoto. Considerar soluciones como Azure Bastion o AWS Session Manager.",
      ssh:      "SSH debe estar en un puerto no estándar (no 22), con autenticación por clave pública únicamente (deshabilitar password auth), y accesible solo desde IPs específicas o VPN.",
      ftp:      "FTP transmite credenciales en texto plano. Migrar a SFTP (SSH File Transfer Protocol) o FTPS (FTP over TLS). Deshabilitar FTP completamente.",
      telnet:   "Telnet es un protocolo obsoleto y completamente inseguro. Deshabilitar inmediatamente y migrar a SSH.",
      smb:      "SMB (445) expuesto en internet es vector de ransomware (WannaCry, NotPetya). Bloquear inmediatamente en el firewall perimetral.",
    },
  },

  // ── CVE Crítico ─────────────────────────────────────────
  cve_critico: {
    immediate: "Aplicar el parche de seguridad del fabricante de forma inmediata. Si no existe parche disponible, implementar mitigaciones temporales y aislar el sistema afectado.",
    hardening: [
      "Aplicar el parche oficial del fabricante o actualizar a la versión no vulnerable",
      "Si no hay parche disponible: implementar WAF rules, deshabilitar el componente vulnerable o aislar el sistema",
      "Verificar si el sistema fue comprometido antes de parchear (análisis forense básico)",
      "Implementar un programa de gestión de vulnerabilidades y patch management",
      "Suscribirse a boletines de seguridad del fabricante (CVE advisories, security bulletins)",
      "Usar un escáner de vulnerabilidades (Nessus, OpenVAS) para verificar el parche",
      "Documentar todos los sistemas afectados y mantener un inventario actualizado",
      "Implementar monitoreo de integridad de archivos (FIM) para detectar explotaciones",
      "Revisar logs del sistema para detectar indicadores de compromiso (IoC) relacionados con el CVE",
    ],
    references: [
      "https://nvd.nist.gov/",
      "https://cve.mitre.org/",
      "https://www.first.org/cvss/",
      "https://attack.mitre.org/",
      "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    ],
    difficulty: "media",
    effort:     "Variable según el CVE y el sistema",
    sla: {
      "CRÍTICO": "24-48 horas (patch inmediato o mitigación)",
      "ALTO":    "7 días",
      "MEDIO":   "30 días",
    },
  },

  // ── TLS Issues ──────────────────────────────────────────
  tls_issue: {
    immediate: "Renovar o reemplazar el certificado TLS inmediatamente. Usar Let's Encrypt para certificados gratuitos con renovación automática.",
    hardening: [
      "Usar Let's Encrypt con Certbot para certificados gratuitos con renovación automática cada 90 días",
      "Configurar renovación automática: certbot renew --quiet (cron diario)",
      "Deshabilitar protocolos obsoletos: SSLv2, SSLv3, TLS 1.0, TLS 1.1 — usar solo TLS 1.2 y TLS 1.3",
      "Configurar cipher suites seguros (ECDHE, AES-GCM, descartar RC4, DES, 3DES)",
      "Implementar HSTS (HTTP Strict Transport Security) con max-age mínimo de 1 año",
      "Configurar OCSP Stapling para validación de revocación eficiente",
      "Activar alertas de expiración de certificados con al menos 30 días de antelación",
      "Usar Mozilla SSL Configuration Generator para configuración óptima del servidor",
      "Verificar la configuración con SSL Labs: https://www.ssllabs.com/ssltest/",
    ],
    references: [
      "https://letsencrypt.org/getting-started/",
      "https://ssl-config.mozilla.org/",
      "https://www.ssllabs.com/ssltest/",
      "https://tools.ietf.org/html/rfc8446",
    ],
    difficulty: "baja",
    effort:     "1-3 horas",
    sla: {
      "CRÍTICO": "24 horas (cert expirado en servicio productivo)",
      "ALTO":    "7 días",
      "MEDIO":   "30 días",
    },
    variants: {
      expired:     "Renovar el certificado inmediatamente. Si es Let's Encrypt: 'certbot renew --force-renewal'. Si es de una CA comercial, generar nuevo CSR y solicitar renovación.",
      self_signed: "Reemplazar el certificado autofirmado por uno emitido por una CA de confianza. Let's Encrypt es gratuito y ampliamente soportado.",
    },
  },

  // ── Archivo sensible en Wayback ─────────────────────────
  archivo_sensible: {
    immediate: "Verificar si el archivo aún existe en el servidor de producción y eliminarlo inmediatamente. Rotar todas las credenciales y claves que pudieran estar expuestas.",
    hardening: [
      "Eliminar el archivo del servidor de producción si aún existe",
      "Rotar TODAS las credenciales, claves API, contraseñas de base de datos y tokens que aparezcan en el archivo",
      "Agregar el archivo a .gitignore y al .htaccess/nginx deny para prevenir futura exposición",
      "Solicitar a Wayback Machine la eliminación del snapshot: https://help.archive.org/help/requesting-removal-of-something-from-the-wayback-machine-or-archive-org/",
      "Auditar el repositorio Git para verificar que el archivo no fue committeado (git log --all --full-history)",
      "Implementar revisión de secretos en el pipeline CI/CD (truffleHog, git-secrets, detect-secrets)",
      "Usar variables de entorno o servicios de gestión de secretos (HashiCorp Vault, AWS Secrets Manager) en lugar de archivos de configuración",
      "Agregar reglas de .htaccess o nginx para bloquear acceso a archivos de configuración",
      "Revisar todos los subdominios y entornos (staging, dev) para el mismo problema",
    ],
    references: [
      "https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure",
      "https://help.archive.org/help/requesting-removal-of-something-from-the-wayback-machine-or-archive-org/",
      "https://github.com/trufflesecurity/trufflehog",
      "https://www.vaultproject.io/",
    ],
    difficulty: "media",
    effort:     "4-8 horas (rotación de credenciales puede llevar más tiempo)",
    sla: {
      "CRÍTICO": "Inmediato — rotar credenciales en las próximas horas",
      "ALTO":    "24-48 horas",
      "MEDIO":   "7 días",
    },
  },

  // ── Backup expuesto ─────────────────────────────────────
  backup_expuesto: {
    immediate: "Eliminar inmediatamente los archivos de backup del directorio web público. Los backups nunca deben ser accesibles vía HTTP.",
    hardening: [
      "Eliminar todos los archivos de backup del directorio raíz web (DocumentRoot)",
      "Mover backups a un directorio fuera del DocumentRoot web o a un servidor dedicado de backups",
      "Implementar acceso con autenticación para el servidor de backups",
      "Cifrar todos los backups en reposo usando AES-256",
      "Solicitar eliminación a Wayback Machine si el archivo fue indexado",
      "Agregar reglas en .htaccess / nginx para bloquear extensiones de backup: .zip, .tar, .sql, .bak",
      "Verificar si el backup contiene datos sensibles y tomar acciones de contención",
      "Implementar política de retención de backups — solo mantener los necesarios y en ubicación segura",
      "Revisar logs de acceso para determinar si el archivo fue descargado por terceros",
    ],
    references: [
      "https://owasp.org/www-community/vulnerabilities/Backup_file_artifact",
      "https://owasp.org/www-project-web-security-testing-guide/",
    ],
    difficulty: "baja",
    effort:     "1-2 horas",
    sla: {
      "CRÍTICO": "Inmediato",
      "ALTO":    "24 horas",
      "MEDIO":   "7 días",
    },
  },

  // ── Panel de administración ─────────────────────────────
  panel_admin: {
    immediate: "Restringir el acceso al panel de administración mediante IP whitelist, autenticación adicional o reubicación a una ruta no predecible.",
    hardening: [
      "Cambiar la ruta del panel admin a una URL no predecible (evitar /admin, /administrator, /wp-admin)",
      "Implementar IP whitelist — solo permitir acceso desde IPs corporativas conocidas",
      "Agregar autenticación HTTP Basic como capa adicional de seguridad antes del formulario de login",
      "Habilitar autenticación multifactor (MFA/2FA) en el panel de administración",
      "Implementar rate limiting en el endpoint de login (máximo 5 intentos por IP en 15 minutos)",
      "Configurar bloqueo automático de IPs con múltiples intentos fallidos (fail2ban)",
      "Habilitar CAPTCHA en el formulario de login para prevenir ataques automatizados",
      "Revisar y eliminar cuentas de administrador innecesarias o con contraseñas débiles",
      "Mantener el CMS/framework actualizado con los últimos parches de seguridad",
      "Habilitar logging de todos los accesos al panel administrativo",
    ],
    references: [
      "https://owasp.org/www-project-top-ten/2021/A07_2021-Identification_and_Authentication_Failures",
      "https://owasp.org/www-community/attacks/Brute_force_attack",
      "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
    ],
    difficulty: "media",
    effort:     "4-8 horas",
    sla: {
      "CRÍTICO": "24 horas",
      "ALTO":    "7 días",
      "MEDIO":   "30 días",
    },
  },

  // ── Expiración de dominio ───────────────────────────────
  whois_expiracion: {
    immediate: "Renovar el dominio inmediatamente a través del registrar. Extender el período de renovación al máximo disponible (generalmente 10 años).",
    hardening: [
      "Renovar el dominio con la mayor anticipación posible",
      "Habilitar Auto-Renovación en el panel del registrar",
      "Configurar múltiples alertas de expiración (90, 60, 30 y 15 días antes)",
      "Actualizar la información de contacto y método de pago en el registrar",
      "Considerar transferir a un registrar más confiable si el actual tiene problemas de servicio",
      "Implementar Registry Lock si el registrar lo ofrece — previene transferencias no autorizadas",
      "Documentar el proceso de renovación y asignar un responsable con recordatorios en el calendario",
      "Considerar registrar variantes del dominio (.com, .net, .org, .bo) para prevenir typosquatting",
      "Habilitar WHOIS Privacy para proteger datos del registrante",
    ],
    references: [
      "https://www.icann.org/resources/pages/renewal-2013-05-03-en",
      "https://www.icann.org/resources/pages/registrar-lock-2013-05-10-en",
    ],
    difficulty: "baja",
    effort:     "30 minutos",
    sla: {
      "CRÍTICO": "Inmediato (dominio expirado o < 7 días)",
      "ALTO":    "24-48 horas (< 30 días)",
      "MEDIO":   "7 días (< 90 días)",
    },
  },

  // ── Emails expuestos ────────────────────────────────────
  email_expuesto: {
    immediate: "Capacitar al personal expuesto en identificación de phishing. Implementar filtros anti-phishing en el servidor de correo corporativo.",
    hardening: [
      "Capacitar a todo el personal en reconocimiento de phishing y spear phishing",
      "Implementar simulaciones de phishing periódicas (GoPhish, KnowBe4) para medir el nivel de riesgo",
      "Configurar filtros anti-spam y anti-phishing avanzados en el gateway de email (Microsoft Defender, Proofpoint, Mimecast)",
      "Habilitar autenticación multifactor (MFA) en todas las cuentas de email corporativo",
      "Solicitar eliminación de emails en Hunter.io: https://hunter.io/opt-out",
      "Revisar y limpiar emails corporativos en directorios públicos, GitHub y LinkedIn",
      "Implementar política de email corporativo que limite la publicación en fuentes externas",
      "Configurar alertas para accesos inusuales a cuentas de correo (desde IPs/países no habituales)",
      "Implementar DMARC, SPF y DKIM para prevenir que terceros suplanten las cuentas expuestas",
      "Monitorear plataformas como Have I Been Pwned para detectar brechas que incluyan los emails",
    ],
    references: [
      "https://hunter.io/opt-out",
      "https://haveibeenpwned.com/",
      "https://getgophish.com/",
      "https://owasp.org/www-community/attacks/Phishing",
      "https://www.ic3.gov/Media/Y2022/PSA220504",
    ],
    difficulty: "media",
    effort:     "Continua — capacitación y monitoreo permanente",
    sla: {
      "CRÍTICO": "48 horas (activar MFA y capacitación urgente)",
      "ALTO":    "7 días",
      "MEDIO":   "30 días",
    },
  },

  // ── API expuesta ────────────────────────────────────────
  api_expuesta: {
    immediate: "Verificar si el endpoint de API requiere autenticación. Si está desprotegido, implementar autenticación JWT o API Key de forma inmediata.",
    hardening: [
      "Implementar autenticación en todos los endpoints de API (JWT, OAuth 2.0, API Keys)",
      "Aplicar autorización a nivel de endpoint — verificar que cada usuario solo acceda a sus recursos",
      "Implementar rate limiting por IP y por usuario para prevenir abuso y scraping",
      "Habilitar CORS restrictivo — solo permitir orígenes de confianza",
      "Agregar el API al inventario y documentarlo en Swagger/OpenAPI",
      "Implementar validación de entrada en todos los parámetros del API",
      "Configurar logging de todas las llamadas al API para auditoría",
      "Revisar si el API expone más datos de los necesarios (over-fetching)",
      "Implementar versionado de API y deprecar versiones antiguas",
    ],
    references: [
      "https://owasp.org/www-project-api-security/",
      "https://owasp.org/API-Security/editions/2023/en/0x11-t10/",
      "https://swagger.io/specification/",
    ],
    difficulty: "media",
    effort:     "8-24 horas",
    sla: {
      "CRÍTICO": "24 horas",
      "ALTO":    "7 días",
      "MEDIO":   "30 días",
    },
  },
}

// ─────────────────────────────────────────────
//  SLA por severidad (fallback global)
// ─────────────────────────────────────────────
const GLOBAL_SLA = {
  "CRÍTICO": "24-72 horas",
  "ALTO":    "7 días",
  "MEDIO":   "30 días",
  "BAJO":    "90 días",
  "NINGUNO": "Sin SLA",
}

// ─────────────────────────────────────────────
//  Funciones públicas
// ─────────────────────────────────────────────

/**
 * Retorna la recomendación para una categoría dada.
 *
 * @param {string} categoria — clave de RECOMMENDATIONS
 * @param {object} [context] — contexto adicional para variantes
 *   Ej: { has_spf: true, has_dmarc: false } para email_spoofing
 * @returns {object} recomendación completa
 */
function getRecommendation(categoria, context = {}) {
  const rec = RECOMMENDATIONS[categoria]

  if (!rec) {
    return {
      immediate:  "Evaluar el hallazgo y aplicar las medidas de remediación apropiadas según la política de seguridad de la organización.",
      hardening:  ["Consultar con el equipo de seguridad para definir el plan de remediación específico."],
      references: ["https://owasp.org/", "https://nvd.nist.gov/"],
      difficulty: "media",
      effort:     "Variable",
      sla:        GLOBAL_SLA,
      variant:    null,
    }
  }

  // Seleccionar variante según contexto
  let variant = null
  if (rec.variants) {
    if (categoria === "email_spoofing") {
      if (context.has_spf === false && context.has_dmarc === false) {
        variant = rec.variants.no_spf_no_dmarc
      } else if (context.has_spf === true && context.has_dmarc === false) {
        variant = rec.variants.spf_no_dmarc
      }
    } else if (categoria === "tls_issue") {
      if (context.expired) {
        variant = rec.variants.expired
      } else if (context.self_signed) {
        variant = rec.variants.self_signed
      }
    } else if (categoria === "exposicion_servicio" && context.port) {
      const portVariants = {
        3306: rec.variants.database,
        5432: rec.variants.database,
        27017: rec.variants.database,
        6379: rec.variants.database,
        1433: rec.variants.database,
        3389: rec.variants.rdp,
        22:   rec.variants.ssh,
        21:   rec.variants.ftp,
        23:   rec.variants.telnet,
        445:  rec.variants.smb,
      }
      variant = portVariants[context.port] || null
    }
  }

  return {
    immediate:  variant ? `${variant}\n\nAdicional: ${rec.immediate}` : rec.immediate,
    hardening:  rec.hardening,
    references: rec.references,
    difficulty: rec.difficulty,
    effort:     rec.effort,
    sla:        rec.sla || GLOBAL_SLA,
    variant,
  }
}

/**
 * Enriquece una ficha con su recomendación automática.
 * Si la ficha ya tiene recomendación, la preserva y agrega
 * las referencias si no las tenía.
 *
 * @param {object} ficha — ficha generada por importer.js
 * @returns {object} ficha enriquecida con recomendación completa
 */
function enrichFicha(ficha) {
  const categoria = ficha.categoria
  const severity  = ficha.cvss?.severity || "MEDIO"

  // Construir contexto desde metadata de la ficha
  const context = {}

  if (categoria === "email_spoofing") {
    const raw = ficha._meta?.raw || {}
    context.has_spf   = raw.has_spf   ?? false
    context.has_dmarc = raw.has_dmarc ?? false
  }

  if (categoria === "tls_issue") {
    const raw = ficha._meta?.raw || {}
    context.expired     = raw.issue?.toLowerCase().includes("expirado")
    context.self_signed = raw.issue?.toLowerCase().includes("autofirmado")
  }

  if (categoria === "exposicion_servicio") {
    const raw = ficha._meta?.raw || {}
    context.port = raw.port
  }

  const rec = getRecommendation(categoria, context)

  // Calcular SLA basado en severidad
  const sla = rec.sla[severity] || GLOBAL_SLA[severity] || "30 días"

  return {
    ...ficha,

    // Solo sobreescribir recomendación si está vacía
    recomendacion: ficha.recomendacion || rec.immediate,

    // Agregar referencias si no las tenía
    referencias: ficha.referencias?.length > 0
      ? ficha.referencias
      : rec.references,

    // Enriquecer con metadata de remediación
    remediacion: {
      immediate:  rec.immediate,
      hardening:  rec.hardening,
      references: rec.references,
      difficulty: rec.difficulty,
      effort:     rec.effort,
      sla,
    },
  }
}

/**
 * Enriquece un array completo de fichas.
 *
 * @param {Array} fichas — array de fichas de importer.js
 * @returns {Array} fichas enriquecidas
 */
function enrichAll(fichas) {
  return fichas.map(enrichFicha)
}

/**
 * Genera el resumen de recomendaciones generales para
 * la sección final del informe.
 *
 * @param {Array} fichas — fichas enriquecidas
 * @returns {Array<string>} lista de recomendaciones generales únicas
 */
function generateGeneralRecommendations(fichas) {
  const general = new Set()

  // Recomendaciones transversales según hallazgos presentes
  const categorias = new Set(fichas.map(f => f.categoria))

  if (categorias.has("cve_critico")) {
    general.add("Implementar un programa formal de gestión de vulnerabilidades y patch management con revisión mensual.")
  }

  if (categorias.has("exposicion_servicio")) {
    general.add("Realizar una auditoría completa de firewall y eliminar todas las reglas de acceso que no sean estrictamente necesarias (principio de menor privilegio).")
    general.add("Implementar segmentación de red — separar DMZ, red interna y zona de datos con controles estrictos entre segmentos.")
  }

  if (categorias.has("email_spoofing") || categorias.has("email_expuesto")) {
    general.add("Implementar un programa de concienciación en ciberseguridad para todo el personal, con énfasis en reconocimiento de phishing y spear phishing.")
    general.add("Configurar SPF, DMARC y DKIM en todos los dominios de la organización, no solo el dominio principal.")
  }

  if (categorias.has("archivo_sensible") || categorias.has("backup_expuesto")) {
    general.add("Implementar revisión automática de secretos en el pipeline de CI/CD para prevenir que credenciales y archivos de configuración lleguen a repositorios o servidores web.")
  }

  if (categorias.has("tls_issue")) {
    general.add("Implementar un inventario de certificados TLS con alertas automáticas de expiración y renovación automática donde sea posible (Let's Encrypt + Certbot).")
  }

  // Recomendaciones siempre presentes
  general.add("Establecer un proceso periódico de reconocimiento pasivo (trimestral) para monitorear la exposición de la organización en fuentes públicas.")
  general.add("Implementar un SIEM (Security Information and Event Management) para centralizar logs y detectar actividad sospechosa en tiempo real.")
  general.add("Mantener un inventario actualizado de todos los activos de la organización (Asset Management) como base para la gestión de seguridad.")

  return [...general]
}

/**
 * Retorna todas las categorías disponibles con sus nombres legibles.
 */
function getCategories() {
  return Object.entries(RECOMMENDATIONS).map(([id, rec]) => ({
    id,
    difficulty: rec.difficulty,
    effort:     rec.effort,
  }))
}

// ─────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────
module.exports = {
  getRecommendation,
  enrichFicha,
  enrichAll,
  generateGeneralRecommendations,
  getCategories,
  RECOMMENDATIONS,
  GLOBAL_SLA,
}