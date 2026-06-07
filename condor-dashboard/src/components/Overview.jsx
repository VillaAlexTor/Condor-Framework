/**
 * ╔══════════════════════════════════════════════════════╗
 * ║   CÓNDOR FRAMEWORK — components/Overview.jsx         ║
 * ║   Vista principal — métricas globales y resumen      ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * DESCRIPCIÓN:
 *   Vista de resumen ejecutivo. Muestra de un vistazo:
 *     - Métricas globales del escaneo
 *     - Tarjeta de riesgo por módulo
 *     - Hallazgos críticos consolidados
 *     - Timeline del objetivo (WHOIS + Wayback)
 *     - Botones de navegación a cada módulo
 *
 * PROPS:
 *   data       → el report completo (meta + results + errors)
 *   onNavigate → función para navegar a otra vista
 */

import { useMemo } from "react"

// ─────────────────────────────────────────────
//  Helpers de color por nivel de riesgo
// ─────────────────────────────────────────────
const RISK_COLORS = {
  "CRÍTICO":     { bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-400",    dot: "bg-red-400",    glow: "shadow-red-500/20"    },
  "ALTO":        { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", dot: "bg-orange-400", glow: "shadow-orange-500/20" },
  "MEDIO":       { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", dot: "bg-yellow-400", glow: "shadow-yellow-500/20" },
  "BAJO":        { bg: "bg-green-500/10",  border: "border-green-500/30",  text: "text-green-400",  dot: "bg-green-400",  glow: "shadow-green-500/20"  },
  "NINGUNO":     { bg: "bg-slate-500/10",  border: "border-slate-500/30",  text: "text-slate-400",  dot: "bg-slate-400",  glow: ""                     },
  "DESCONOCIDO": { bg: "bg-slate-800/40",  border: "border-slate-700",     text: "text-slate-500",  dot: "bg-slate-600",  glow: ""                     },
  "EXPIRADO":    { bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-400",    dot: "bg-red-400",    glow: "shadow-red-500/20"    },
  "skipped":     { bg: "bg-slate-800/40",  border: "border-slate-700",     text: "text-slate-500",  dot: "bg-yellow-500", glow: ""                     },
  "error":       { bg: "bg-red-900/20",    border: "border-red-800/30",    text: "text-red-500",    dot: "bg-red-500",    glow: ""                     },
}

const rc = (risk) => RISK_COLORS[risk] || RISK_COLORS["DESCONOCIDO"]

// ─────────────────────────────────────────────
//  Extraer riesgo de cada módulo
// ─────────────────────────────────────────────
function extractModuleRisk(moduleData) {
  if (!moduleData)                      return "DESCONOCIDO"
  if (moduleData.status === "skipped")  return "skipped"
  if (moduleData.status === "error")    return "error"
  if (moduleData.status === "not_implemented") return "DESCONOCIDO"

  return (
    moduleData?.analysis?.risk_level        ||
    moduleData?.analysis?.expiry_risk       ||
    moduleData?.analysis?.phishing_risk     ||
    "BAJO"
  )
}

// ─────────────────────────────────────────────
//  Riesgo global — el peor de todos
// ─────────────────────────────────────────────
const RISK_ORDER = ["CRÍTICO", "EXPIRADO", "ALTO", "MEDIO", "BAJO", "NINGUNO", "DESCONOCIDO", "skipped", "error"]
function globalRisk(risks) {
  for (const r of RISK_ORDER) {
    if (risks.includes(r)) return r
  }
  return "DESCONOCIDO"
}

// ─────────────────────────────────────────────
//  Componente: métrica individual
// ─────────────────────────────────────────────
function MetricCard({ label, value, sub, color = "text-[#00ff88]" }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
      <div className={`text-2xl font-bold font-mono ${color}`}>{value ?? "—"}</div>
      <div className="text-slate-300 text-xs font-medium">{label}</div>
      {sub && <div className="text-slate-600 text-[10px]">{sub}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: tarjeta de módulo
// ─────────────────────────────────────────────
function ModuleCard({ moduleId, label, risk, summary, onNavigate }) {
  const colors = rc(risk)
  const isClickable = risk !== "DESCONOCIDO" && risk !== "skipped"

  const statusLabel = {
    skipped: "Sin API key",
    error:   "Error",
  }[risk] || risk

  return (
    <button
      onClick={() => isClickable && onNavigate(moduleId)}
      className={`
        w-full text-left p-4 rounded-xl border transition-all duration-200
        ${colors.bg} ${colors.border}
        ${isClickable ? "hover:scale-[1.02] hover:shadow-lg cursor-pointer " + colors.glow : "cursor-default opacity-60"}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-300 text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
        <span className={`
          text-[10px] font-bold px-2 py-0.5 rounded-full border
          ${colors.text} ${colors.border} ${colors.bg}
        `}>
          {statusLabel}
        </span>
      </div>

      {/* Resumen del módulo */}
      {summary && (
        <div className="space-y-0.5 mt-2">
          {summary.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className={`w-1 h-1 rounded-full ${colors.dot} shrink-0`} />
              <span className="text-slate-400">{item}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────
//  Componente: hallazgo crítico
// ─────────────────────────────────────────────
function Finding({ severity, text, source }) {
  const colors = rc(severity)
  return (
    <div className={`flex gap-3 p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
      <div className={`w-1.5 rounded-full shrink-0 ${colors.dot}`} style={{ minHeight: "1.2rem" }} />
      <div className="flex-1 min-w-0">
        <div className="text-slate-200 text-xs leading-relaxed">{text}</div>
        {source && (
          <div className={`text-[10px] mt-0.5 font-mono ${colors.text}`}>{source}</div>
        )}
      </div>
      <span className={`text-[9px] font-bold shrink-0 self-start pt-0.5 ${colors.text}`}>
        {severity}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: barra de progreso simple
// ─────────────────────────────────────────────
function ProgressBar({ value, max, color = "bg-[#00ff88]" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
//  Vista principal: Overview
// ─────────────────────────────────────────────
export default function Overview({ data: report, onNavigate }) {
  const { meta, results = {}, errors = {} } = report || {}

  // ── Extraer datos de cada módulo ──────────
  const dns     = results.dns     || null
  const whois   = results.whois   || null
  const wayback = results.wayback || null
  const censys  = results.censys  || null
  const shodan  = results.shodan  || null
  const hunter  = results.hunter  || null

  // ── Riesgos por módulo ────────────────────
  const risks = useMemo(() => ({
    dns:     extractModuleRisk(dns),
    whois:   extractModuleRisk(whois),
    wayback: extractModuleRisk(wayback),
    censys:  extractModuleRisk(censys),
    shodan:  extractModuleRisk(shodan),
    hunter:  extractModuleRisk(hunter),
  }), [dns, whois, wayback, censys, shodan, hunter])

  const overallRisk = useMemo(() => globalRisk(Object.values(risks)), [risks])

  // ── Métricas globales ─────────────────────
  const metrics = useMemo(() => {
    const subdomains  = dns?.subdomains?.length ?? 0
    const openPorts   = censys?.summary?.total_ports ?? shodan?.summary?.total_ports ?? 0
    const totalCves   = shodan?.summary?.total_vulns ?? 0
    const critCves    = shodan?.summary?.critical_vulns ?? 0
    const emailsExp   = hunter?.summary?.total_returned ?? 0
    const waybackUrls = wayback?.summary?.total_unique_urls ?? 0
    const sensFiles   = wayback?.summary?.sensitive_files_found ?? 0
    const daysExp     = whois?.analysis?.days_to_expire ?? null

    return { subdomains, openPorts, totalCves, critCves, emailsExp, waybackUrls, sensFiles, daysExp }
  }, [dns, whois, wayback, censys, shodan, hunter])

  // ── Hallazgos críticos consolidados ───────
  const findings = useMemo(() => {
    const list = []

    // Shodan CVEs críticos
    const critCves = shodan?.analysis?.critical_cves || []
    critCves.slice(0, 3).forEach(v => {
      list.push({
        severity: "CRÍTICO",
        text: `${v.cve_id} (CVSS ${v.cvss}) — ${v.summary?.slice(0, 100)}...`,
        source: "shodan"
      })
    })

    // Archivos sensibles en Wayback
    const sensFiles = wayback?.findings?.sensitive_files || []
    sensFiles.slice(0, 2).forEach(url => {
      list.push({
        severity: "CRÍTICO",
        text: `Archivo sensible encontrado históricamente: ${url}`,
        source: "wayback"
      })
    })

    // Backups expuestos
    const backups = wayback?.findings?.backup_files || []
    backups.slice(0, 2).forEach(url => {
      list.push({
        severity: "ALTO",
        text: `Backup expuesto históricamente: ${url}`,
        source: "wayback"
      })
    })

    // Puertos peligrosos (Censys)
    const dangerPorts = censys?.analysis?.dangerous_ports_open || []
    if (dangerPorts.length > 0) {
      const descs = censys?.analysis?.port_descriptions || {}
      dangerPorts.forEach(p => {
        list.push({
          severity: "ALTO",
          text: `Puerto peligroso expuesto: ${p} — ${descs[p] || ""}`,
          source: "censys"
        })
      })
    }

    // Email spoofing (DNS)
    const emailRisk = dns?.email_security?.email_spoofing_risk
    if (emailRisk === "ALTO") {
      list.push({
        severity: "ALTO",
        text: "Sin registros SPF ni DMARC — dominio vulnerable a email spoofing",
        source: "dns"
      })
    } else if (emailRisk === "MEDIO") {
      list.push({
        severity: "MEDIO",
        text: "SPF presente pero sin DMARC — protección de email incompleta",
        source: "dns"
      })
    }

    // Paneles admin en Wayback
    const admins = wayback?.findings?.admin_panels || []
    if (admins.length > 0) {
      list.push({
        severity: "MEDIO",
        text: `${admins.length} paneles de administración encontrados históricamente`,
        source: "wayback"
      })
    }

    // Emails IT/ejecutivos expuestos
    const itCount   = hunter?.risk_emails?.it_staff?.length ?? 0
    const execCount = hunter?.risk_emails?.executives?.length ?? 0
    if (itCount > 0) {
      list.push({
        severity: "ALTO",
        text: `${itCount} email(s) de personal IT expuesto(s) — superficie de spear phishing`,
        source: "hunter"
      })
    }
    if (execCount > 0) {
      list.push({
        severity: "ALTO",
        text: `${execCount} email(s) ejecutivo(s) expuesto(s) — riesgo BEC/CEO fraud`,
        source: "hunter"
      })
    }

    // Expiración WHOIS
    const days = whois?.analysis?.days_to_expire
    if (days !== null && days !== undefined && days < 90 && days >= 0) {
      list.push({
        severity: days < 30 ? "CRÍTICO" : "MEDIO",
        text: `Dominio expira en ${days} días — riesgo de caída de servicio`,
        source: "whois"
      })
    }

    // Certs TLS
    const tlsIssues = censys?.summary?.tls_issues || []
    tlsIssues.slice(0, 2).forEach(issue => {
      list.push({ severity: "ALTO", text: issue, source: "censys" })
    })

    return list
  }, [dns, whois, wayback, censys, shodan, hunter])

  // ── Resúmenes por módulo para ModuleCard ─
  const moduleSummaries = useMemo(() => ({
    dns: dns?.status === "ok" ? [
      `${dns.summary?.total_records ?? 0} registros DNS`,
      `${dns.summary?.total_subdomains ?? 0} subdominios (crt.sh)`,
      `Email spoofing: ${dns.email_security?.email_spoofing_risk ?? "—"}`,
    ] : null,

    whois: whois?.status === "ok" ? [
      `Registrar: ${whois.summary?.registrar ?? "N/A"}`,
      `Expira en: ${whois.summary?.days_to_expire ?? "?"} días`,
      `Privacy: ${whois.summary?.privacy_protected ? "Activada" : "Sin protección"}`,
    ] : null,

    wayback: wayback?.status === "ok" ? [
      `${wayback.summary?.total_unique_urls ?? 0} URLs históricas`,
      `${wayback.summary?.sensitive_files_found ?? 0} archivos sensibles`,
      `${wayback.summary?.years_of_history ?? 0} años de historial`,
    ] : null,

    censys: censys?.status === "ok" ? [
      `${censys.summary?.total_hosts ?? 0} hosts encontrados`,
      `${censys.summary?.total_ports ?? 0} puertos abiertos`,
      `TLS issues: ${censys.summary?.tls_issues?.length ?? 0}`,
    ] : null,

    shodan: shodan?.status === "ok" ? [
      `${shodan.summary?.total_hosts ?? 0} hosts indexados`,
      `${shodan.summary?.total_vulns ?? 0} CVEs detectados`,
      `Críticos: ${shodan.summary?.critical_vulns ?? 0}`,
    ] : null,

    hunter: hunter?.status === "ok" ? [
      `${hunter.summary?.total_returned ?? 0} emails encontrados`,
      `IT expuesto: ${hunter.summary?.it_staff_exposed ?? 0}`,
      `Patrón: ${hunter.summary?.pattern ?? "No detectado"}`,
    ] : null,
  }), [dns, whois, wayback, censys, shodan, hunter])

  const overallColors = rc(overallRisk)
  const modulesRun    = meta?.modules_run?.length ?? 0
  const errorsCount   = Object.keys(errors).length
  const duration      = meta?.duration_seconds ?? "—"
  const timestamp     = meta?.timestamp
    ? new Date(meta.timestamp).toLocaleString("es-BO", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
    : "—"

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto font-mono">

      {/* ── Hero: target + riesgo global ── */}
      <div className={`
        rounded-2xl border p-6
        ${overallColors.bg} ${overallColors.border}
        shadow-xl ${overallColors.glow}
      `}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
              Objetivo analizado
            </div>
            <div className="text-[#00d4ff] text-2xl font-bold tracking-tight">
              {meta?.target || "—"}
            </div>
            <div className="text-slate-500 text-xs mt-1">
              {timestamp} · {duration}s · {modulesRun} módulos
              {errorsCount > 0 && (
                <span className="text-red-400 ml-2">· {errorsCount} error(es)</span>
              )}
            </div>
          </div>

          {/* Badge riesgo global */}
          <div className={`
            flex flex-col items-center px-8 py-4 rounded-xl border-2
            ${overallColors.border} ${overallColors.bg}
          `}>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
              Riesgo Global
            </div>
            <div className={`text-3xl font-black tracking-wider ${overallColors.text}`}>
              {overallRisk}
            </div>
            <div className={`w-2 h-2 rounded-full mt-2 ${overallColors.dot} animate-pulse`} />
          </div>
        </div>
      </div>

      {/* ── Métricas globales ── */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
          Métricas del escaneo
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Subdominios"
            value={metrics.subdomains}
            sub="via crt.sh"
            color="text-[#00d4ff]"
          />
          <MetricCard
            label="Puertos abiertos"
            value={metrics.openPorts}
            sub="Censys / Shodan"
            color={metrics.openPorts > 10 ? "text-orange-400" : "text-[#00ff88]"}
          />
          <MetricCard
            label="CVEs detectados"
            value={metrics.totalCves}
            sub={`${metrics.critCves} críticos`}
            color={metrics.critCves > 0 ? "text-red-400" : metrics.totalCves > 0 ? "text-orange-400" : "text-[#00ff88]"}
          />
          <MetricCard
            label="Emails expuestos"
            value={metrics.emailsExp}
            sub="via Hunter.io"
            color={metrics.emailsExp > 5 ? "text-orange-400" : "text-[#00ff88]"}
          />
          <MetricCard
            label="URLs históricas"
            value={metrics.waybackUrls}
            sub="Wayback Machine"
            color="text-[#00d4ff]"
          />
          <MetricCard
            label="Archivos sensibles"
            value={metrics.sensFiles}
            sub="históricos"
            color={metrics.sensFiles > 0 ? "text-red-400" : "text-[#00ff88]"}
          />
          <MetricCard
            label="Días p/ expirar"
            value={metrics.daysExp ?? "N/A"}
            sub="WHOIS dominio"
            color={
              metrics.daysExp === null ? "text-slate-500" :
              metrics.daysExp < 30  ? "text-red-400" :
              metrics.daysExp < 90  ? "text-orange-400" : "text-[#00ff88]"
            }
          />
          <MetricCard
            label="Módulos OK"
            value={`${modulesRun - errorsCount}/${modulesRun}`}
            sub={`${errorsCount} con error`}
            color={errorsCount > 0 ? "text-yellow-400" : "text-[#00ff88]"}
          />
        </div>
      </div>

      {/* ── Módulos: estado y riesgo ── */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
          Estado por módulo — clic para ver detalles
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { id: "dns",     label: "DNS Recon"   },
            { id: "whois",   label: "WHOIS"       },
            { id: "wayback", label: "Wayback"     },
            { id: "censys",  label: "Censys"      },
            { id: "shodan",  label: "Shodan"      },
            { id: "hunter",  label: "Hunter.io"   },
          ].map(({ id, label }) => (
            <ModuleCard
              key={id}
              moduleId={id}
              label={label}
              risk={risks[id]}
              summary={moduleSummaries[id]}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>

      {/* ── Hallazgos críticos ── */}
      {findings.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
            Hallazgos consolidados ({findings.length})
          </div>
          <div className="space-y-2">
            {findings.map((f, i) => (
              <Finding key={i} {...f} />
            ))}
          </div>
        </div>
      )}

      {/* ── Sin hallazgos ── */}
      {findings.length === 0 && (
        <div className="border border-green-500/20 bg-green-500/5 rounded-xl p-6 text-center">
          <div className="text-green-400 text-sm font-medium">
            ✓ Sin hallazgos críticos detectados
          </div>
          <div className="text-slate-500 text-xs mt-1">
            Revisa los módulos individuales para ver el detalle completo
          </div>
        </div>
      )}

      {/* ── Errores de módulos ── */}
      {errorsCount > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
            Módulos con errores
          </div>
          <div className="space-y-2">
            {Object.entries(errors).map(([mod, msg]) => (
              <div key={mod} className="flex gap-3 p-3 rounded-lg border border-red-800/30 bg-red-900/10">
                <span className="text-red-400 text-xs font-bold uppercase">{mod}</span>
                <span className="text-slate-500 text-xs">{msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="text-center text-[10px] text-slate-700 pb-4">
        Cóndor Framework v0.1.0 · github.com/villaalextor/condor-framework · Solo reconocimiento pasivo
      </div>
    </div>
  )
}