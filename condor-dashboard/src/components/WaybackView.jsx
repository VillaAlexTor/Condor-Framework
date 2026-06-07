/**
 * ╔══════════════════════════════════════════════════════╗
 * ║   CÓNDOR FRAMEWORK — components/WaybackView.jsx      ║
 * ║   Vista detallada del módulo Wayback Machine         ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * DESCRIPCIÓN:
 *   Visualización completa de los resultados del módulo wayback.
 *   Muestra:
 *     - Resumen temporal (primera/última captura, años de historial)
 *     - Hallazgos críticos: archivos sensibles, backups, paneles admin, APIs
 *     - Distribución de URLs por extensión (gráfico de barras)
 *     - Lista completa de URLs con buscador y filtros
 *     - Distribución de códigos HTTP históricos
 *
 * PROPS:
 *   data   → results.wayback del reporte condor-cli
 *   report → reporte completo
 */

import { useState, useMemo } from "react"

// ─────────────────────────────────────────────
//  Colores por severidad
// ─────────────────────────────────────────────
const RISK_COLORS = {
  "CRÍTICO": { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    dot: "bg-red-400",    bar: "bg-red-400"    },
  "ALTO":    { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-400", bar: "bg-orange-400" },
  "MEDIO":   { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", dot: "bg-yellow-400", bar: "bg-yellow-400" },
  "BAJO":    { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  dot: "bg-green-400",  bar: "bg-green-400"  },
}
const rc = (r) => RISK_COLORS[r] || RISK_COLORS["BAJO"]

// Colores por extensión de archivo
const EXT_COLORS = {
  php:        "bg-blue-500",
  asp:        "bg-purple-500",
  javascript: "bg-yellow-400",
  data:       "bg-cyan-400",
  documents:  "bg-green-500",
  archives:   "bg-red-500",
  config:     "bg-orange-500",
  logs:       "bg-slate-400",
  env:        "bg-red-600",
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("es-BO", {
      day: "2-digit", month: "short", year: "numeric"
    })
  } catch { return iso }
}

function truncateUrl(url, max = 70) {
  if (!url) return ""
  if (url.length <= max) return url
  return url.slice(0, max - 3) + "..."
}

// Detectar severidad de una URL por su contenido
function urlSeverity(url) {
  const u = url.toLowerCase()
  const critExts = [".env", ".bak", ".sql", ".pem", ".key", ".p12", ".pfx"]
  const critNames = ["config.php", "wp-config", ".htpasswd", "phpinfo", "id_rsa"]
  if (critExts.some(e => u.includes(e)) || critNames.some(n => u.includes(n))) return "CRÍTICO"
  if (u.includes("/admin") || u.includes("/wp-admin") || u.includes("/cpanel")) return "ALTO"
  if (u.includes("/api/") || u.includes(".zip") || u.includes(".tar")) return "ALTO"
  if (u.includes(".php") || u.includes(".asp")) return "MEDIO"
  return "BAJO"
}

// ─────────────────────────────────────────────
//  Componente: stat chip
// ─────────────────────────────────────────────
function StatChip({ label, value, sub, color = "text-[#00ff88]" }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center">
      <div className={`text-2xl font-bold font-mono ${color}`}>{value ?? "—"}</div>
      <div className="text-slate-400 text-xs mt-0.5">{label}</div>
      {sub && <div className="text-slate-600 text-[10px] mt-0.5">{sub}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: hallazgo individual
// ─────────────────────────────────────────────
function FindingRow({ url, severity, category }) {
  const colors = rc(severity)
  return (
    <div className={`
      flex items-start gap-3 p-3 rounded-lg border group
      transition-all duration-150 hover:scale-[1.005]
      ${colors.bg} ${colors.border}
    `}>
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${colors.dot}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-mono break-all leading-relaxed ${colors.text}`}>
          {url}
        </div>
        <div className="text-[10px] text-slate-600 mt-0.5">{category}</div>
      </div>
      <span className={`
        text-[9px] font-bold shrink-0 self-start pt-0.5 px-1.5 py-0.5 rounded
        ${colors.text} ${colors.bg} border ${colors.border}
      `}>
        {severity}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: sección colapsable
// ─────────────────────────────────────────────
function Section({ title, count, badge, badgeColor = "text-slate-400", children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 hover:bg-slate-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-300 text-sm font-medium">{title}</span>
          {count !== undefined && (
            <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-mono">
              {count}
            </span>
          )}
          {badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>
        <span className={`text-slate-500 text-xs transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: gráfico de barras por extensión
// ─────────────────────────────────────────────
function ExtensionChart({ byExtension }) {
  const entries = useMemo(() => {
    return Object.entries(byExtension)
      .map(([ext, urls]) => ({ ext, count: urls.length }))
      .sort((a, b) => b.count - a.count)
  }, [byExtension])

  if (entries.length === 0) {
    return <div className="text-slate-600 text-xs text-center py-4">Sin datos de extensiones</div>
  }

  const max = entries[0]?.count || 1

  return (
    <div className="space-y-2">
      {entries.map(({ ext, count }) => {
        const pct   = Math.round((count / max) * 100)
        const color = EXT_COLORS[ext] || "bg-slate-500"
        return (
          <div key={ext} className="flex items-center gap-3">
            <div className="w-20 text-right text-[10px] text-slate-400 font-mono shrink-0">{ext}</div>
            <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden relative">
              <div
                className={`h-full rounded transition-all duration-700 ${color} opacity-80`}
                style={{ width: `${pct}%` }}
              />
              <span className="absolute inset-0 flex items-center pl-2 text-[10px] text-white/70 font-mono">
                {count} URL{count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: distribución de status codes
// ─────────────────────────────────────────────
function StatusCodeChart({ statusCodes }) {
  const entries = Object.entries(statusCodes).sort((a, b) => b[1] - a[1])
  const total   = entries.reduce((s, [, v]) => s + v, 0)

  const codeColor = (code) => {
    if (code.startsWith("2")) return "bg-green-500"
    if (code.startsWith("3")) return "bg-blue-400"
    if (code.startsWith("4")) return "bg-yellow-500"
    if (code.startsWith("5")) return "bg-red-500"
    return "bg-slate-500"
  }

  if (entries.length === 0) return null

  return (
    <div className="space-y-2">
      {entries.map(([code, count]) => {
        const pct = Math.round((count / total) * 100)
        return (
          <div key={code} className="flex items-center gap-3">
            <span className="w-10 text-right text-xs font-mono text-slate-400 shrink-0">{code}</span>
            <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden relative">
              <div
                className={`h-full rounded transition-all duration-700 ${codeColor(code)} opacity-70`}
                style={{ width: `${pct}%` }}
              />
              <span className="absolute inset-0 flex items-center pl-2 text-[9px] text-white/60 font-mono">
                {count} ({pct}%)
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: lista completa de URLs
// ─────────────────────────────────────────────
function UrlList({ urls }) {
  const [search,  setSearch]  = useState("")
  const [filter,  setFilter]  = useState("all") // all | sensitive | admin | api
  const [page,    setPage]    = useState(0)
  const PER_PAGE = 20

  const FILTERS = [
    { id: "all",       label: "Todas"     },
    { id: "php",       label: ".php"      },
    { id: "config",    label: "Config"    },
    { id: "admin",     label: "Admin"     },
    { id: "sensitive", label: "Sensibles" },
  ]

  const filtered = useMemo(() => {
    return urls.filter(url => {
      const u = url.toLowerCase()
      const matchSearch = !search || u.includes(search.toLowerCase())
      const matchFilter = (() => {
        if (filter === "all")       return true
        if (filter === "php")       return u.includes(".php") || u.includes(".asp")
        if (filter === "config")    return u.includes("config") || u.includes(".env") || u.includes(".cfg")
        if (filter === "admin")     return u.includes("/admin") || u.includes("/panel") || u.includes("/dashboard")
        if (filter === "sensitive") return urlSeverity(url) === "CRÍTICO"
        return true
      })()
      return matchSearch && matchFilter
    })
  }, [urls, search, filter])

  const pages     = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div className="flex flex-col md:flex-row gap-2">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder="Buscar en URLs..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-[#00d4ff]/50"
        />
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setPage(0) }}
              className={`
                px-2 py-1 rounded text-[10px] font-mono transition-colors
                ${filter === f.id
                  ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30"
                  : "bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300"
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
        {paginated.length === 0 ? (
          <div className="text-slate-600 text-xs text-center py-6">
            Sin resultados para este filtro
          </div>
        ) : paginated.map((url, i) => {
          const sev = urlSeverity(url)
          const colors = rc(sev)
          return (
            <div
              key={i}
              className={`
                flex items-start gap-2 px-3 py-2 rounded-lg
                border border-transparent hover:border-slate-800
                hover:bg-slate-900/40 transition-all group
              `}
            >
              <div className={`w-1 h-1 rounded-full mt-2 shrink-0 ${colors.dot}`} />
              <span className={`text-[11px] font-mono break-all flex-1 ${
                sev === "CRÍTICO" ? "text-red-400" :
                sev === "ALTO"    ? "text-orange-400" :
                sev === "MEDIO"   ? "text-yellow-400/80" :
                "text-slate-500"
              }`}>
                {url}
              </span>
            </div>
          )
        })}
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
          <span>{filtered.length} URLs{search || filter !== "all" ? " filtradas" : ""}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
            >‹</button>
            <span className="px-2">{page + 1} / {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
              disabled={page === pages - 1}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
            >›</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Vista principal: WaybackView
// ─────────────────────────────────────────────
export default function WaybackView({ data, report }) {
  const target = report?.meta?.target || "—"

  // ── Estados de error ─────────────────────
  if (!data || data.status === "not_implemented") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-slate-500 text-sm">Módulo Wayback no ejecutado en este escaneo</div>
        <div className="text-slate-600 text-xs mt-2">Correr con: <span className="text-[#00ff88]">--modules wayback</span></div>
      </div>
    )
  }
  if (data.status === "error") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-red-400 text-sm">Error en módulo Wayback</div>
        <div className="text-slate-500 text-xs mt-2">{data.message}</div>
      </div>
    )
  }

  const findings     = data.findings     || {}
  const analysis     = data.analysis     || {}
  const urls         = data.urls         || {}
  const statusCodes  = data.status_codes || {}
  const summary      = data.summary      || {}

  const riskLevel   = analysis.risk_level || "BAJO"
  const riskColors  = rc(riskLevel)

  const allUrls      = urls.all         || []
  const byExtension  = urls.by_extension || {}
  const sensFiles    = findings.sensitive_files || []
  const adminPanels  = findings.admin_panels    || []
  const apiEndpoints = findings.api_endpoints   || []
  const backupFiles  = findings.backup_files    || []

  const totalFindings = sensFiles.length + adminPanels.length + backupFiles.length

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto font-mono">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Módulo Wayback Machine</div>
          <div className="text-[#00d4ff] text-xl font-bold">{target}</div>
          <div className="text-slate-500 text-xs mt-1">
            URLs históricas via archive.org CDX API — sin tráfico al objetivo
          </div>
        </div>

        {/* Badge riesgo */}
        <div className={`shrink-0 px-5 py-3 rounded-xl border text-center ${riskColors.bg} ${riskColors.border}`}>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Riesgo</div>
          <div className={`text-2xl font-black ${riskColors.text}`}>{riskLevel}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{totalFindings} hallazgos</div>
        </div>
      </div>

      {/* ── Stats rápidas ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip
          label="URLs únicas"
          value={summary.total_unique_urls ?? allUrls.length}
          sub="con status 200"
          color="text-[#00d4ff]"
        />
        <StatChip
          label="Snapshots totales"
          value={summary.total_snapshots ?? "—"}
          sub="estimado"
          color="text-[#00ff88]"
        />
        <StatChip
          label="Años de historial"
          value={analysis.years_of_history ?? "—"}
          sub={`${formatDate(data.first_seen)} — ${formatDate(data.last_seen)}`}
          color="text-purple-400"
        />
        <StatChip
          label="Archivos sensibles"
          value={sensFiles.length + backupFiles.length}
          sub="críticos encontrados"
          color={sensFiles.length + backupFiles.length > 0 ? "text-red-400" : "text-[#00ff88]"}
        />
      </div>

      {/* ── Timeline ── */}
      {(data.first_seen || data.last_seen) && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
            Rango temporal de capturas en Wayback Machine
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[10px] text-slate-600 mb-1">Primera captura</div>
              <div className="text-[#00ff88] text-sm font-mono font-bold">{formatDate(data.first_seen)}</div>
            </div>
            <div className="flex-1 relative h-2 mx-2">
              <div className="absolute inset-0 bg-slate-800 rounded-full" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#00ff88] to-[#00d4ff] rounded-full opacity-60" />
              {/* Marcador de años */}
              {analysis.years_of_history > 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="text-[10px] text-white/60 font-mono whitespace-nowrap">
                    {analysis.years_of_history} años
                  </span>
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-[10px] text-slate-600 mb-1">Última captura</div>
              <div className="text-[#00d4ff] text-sm font-mono font-bold">{formatDate(data.last_seen)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Hallazgos críticos ── */}
      {totalFindings > 0 && (
        <Section
          title="Hallazgos críticos"
          count={totalFindings}
          badge="REVISAR"
          badgeColor="text-red-400 bg-red-500/10 border border-red-500/20 rounded"
          defaultOpen
        >
          <div className="space-y-2">
            {sensFiles.map((url, i) => (
              <FindingRow key={`s${i}`} url={url} severity="CRÍTICO" category="Archivo sensible" />
            ))}
            {backupFiles.map((url, i) => (
              <FindingRow key={`b${i}`} url={url} severity="CRÍTICO" category="Archivo de backup" />
            ))}
            {adminPanels.map((url, i) => (
              <FindingRow key={`a${i}`} url={url} severity="ALTO" category="Panel de administración" />
            ))}
            {apiEndpoints.slice(0, 10).map((url, i) => (
              <FindingRow key={`api${i}`} url={url} severity="MEDIO" category="Endpoint de API" />
            ))}
          </div>
        </Section>
      )}

      {/* ── Sin hallazgos ── */}
      {totalFindings === 0 && (
        <div className="border border-green-500/20 bg-green-500/5 rounded-xl p-5 text-center">
          <div className="text-green-400 text-sm font-medium">✓ Sin hallazgos críticos en historial</div>
          <div className="text-slate-500 text-xs mt-1">No se encontraron archivos sensibles ni paneles de admin en el historial</div>
        </div>
      )}

      {/* ── Distribución por extensión ── */}
      {Object.keys(byExtension).length > 0 && (
        <Section title="Distribución por tipo de archivo" defaultOpen={false}>
          <ExtensionChart byExtension={byExtension} />
        </Section>
      )}

      {/* ── Códigos HTTP históricos ── */}
      {Object.keys(statusCodes).length > 0 && (
        <Section title="Distribución de códigos HTTP históricos" defaultOpen={false}>
          <StatusCodeChart statusCodes={statusCodes} />
          <div className="mt-3 text-[10px] text-slate-600">
            Solo se indexaron URLs con status 200 en la búsqueda principal. Los otros códigos son de capturas históricas adicionales.
          </div>
        </Section>
      )}

      {/* ── Lista completa de URLs ── */}
      {allUrls.length > 0 && (
        <Section
          title="URLs históricas completas"
          count={allUrls.length}
          defaultOpen={false}
        >
          <UrlList urls={allUrls} />
        </Section>
      )}

      {/* ── Paneles admin detalle ── */}
      {adminPanels.length > 0 && (
        <Section
          title="Paneles de administración detectados"
          count={adminPanels.length}
          defaultOpen={false}
          badge="ALTO"
          badgeColor="text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded"
        >
          <div className="space-y-2">
            {adminPanels.map((url, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                <span className="text-orange-300 text-xs font-mono break-all">{url}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── API Endpoints detalle ── */}
      {apiEndpoints.length > 0 && (
        <Section
          title="Endpoints de API detectados"
          count={apiEndpoints.length}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {apiEndpoints.map((url, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" />
                <span className="text-yellow-300 text-xs font-mono break-all">{url}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Footer ── */}
      <div className="text-[10px] text-slate-700 text-center pb-2">
        Datos históricos obtenidos via Wayback Machine CDX API (archive.org) — sin tráfico al objetivo
      </div>
    </div>
  )
}