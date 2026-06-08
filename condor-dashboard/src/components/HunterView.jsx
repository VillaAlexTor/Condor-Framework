/**
 * ╔══════════════════════════════════════════════════════╗
 * ║   CÓNDOR FRAMEWORK — components/HunterView.jsx       ║
 * ║   Vista detallada del módulo Hunter.io               ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * DESCRIPCIÓN:
 *   Visualización completa de los resultados del módulo hunter_lookup.
 *   Muestra:
 *     - Patrón de formato de emails corporativos
 *     - Clasificación: IT staff / Ejecutivos / Genéricos
 *     - Lista de emails con cargo, departamento y confianza
 *     - Distribución por departamento
 *     - Fuentes donde fueron encontrados
 *     - Análisis de riesgo de phishing y recomendaciones
 *
 * PROPS:
 *   data   → results.hunter del reporte condor-cli
 *   report → reporte completo
 */

import { useState, useMemo } from "react"

// ─────────────────────────────────────────────
//  Colores
// ─────────────────────────────────────────────
const RISK_COLORS = {
  "CRÍTICO": { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    dot: "bg-red-400"    },
  "ALTO":    { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-400" },
  "MEDIO":   { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", dot: "bg-yellow-400" },
  "BAJO":    { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  dot: "bg-green-400"  },
  "NINGUNO": { text: "text-slate-400",  bg: "bg-slate-800/40",  border: "border-slate-700",     dot: "bg-slate-600"  },
}
const rc = (r) => RISK_COLORS[r] || RISK_COLORS["NINGUNO"]

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function confidenceColor(score) {
  if (score >= 90) return "text-green-400"
  if (score >= 70) return "text-yellow-400"
  if (score >= 50) return "text-orange-400"
  return "text-slate-500"
}

function confidenceBar(score) {
  if (score >= 90) return "bg-green-500"
  if (score >= 70) return "bg-yellow-500"
  if (score >= 50) return "bg-orange-500"
  return "bg-slate-600"
}

function formatDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString("es-BO", {
      day: "2-digit", month: "short", year: "numeric"
    })
  } catch { return iso }
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
//  Componente: sección colapsable
// ─────────────────────────────────────────────
function Section({ title, count, badge, badgeColor, children, defaultOpen = true }) {
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
            <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-mono">{count}</span>
          )}
          {badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badgeColor}`}>{badge}</span>
          )}
        </div>
        <span className={`text-slate-500 text-xs transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: patrón de email visual
// ─────────────────────────────────────────────
function PatternDisplay({ pattern, domain, organization }) {
  if (!pattern) return null

  // Generar ejemplo visual con el patrón
  const example = pattern
    .replace("{first}",  "juan")
    .replace("{last}",   "perez")
    .replace("{f}",      "j")
    .replace("{l}",      "p")

  const exampleEmail = `${example}@${domain}`

  // Colorear partes del patrón
  const coloredPattern = pattern
    .replace(/\{first\}/g,  '<span class="text-[#00ff88]">{first}</span>')
    .replace(/\{last\}/g,   '<span class="text-[#00d4ff]">{last}</span>')
    .replace(/\{f\}/g,      '<span class="text-[#00ff88]">{f}</span>')
    .replace(/\{l\}/g,      '<span class="text-[#00d4ff]">{l}</span>')

  return (
    <div className="border border-orange-500/30 bg-orange-500/5 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[10px] text-orange-400 uppercase tracking-widest font-bold">
          Patrón de email corporativo detectado
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
          ALTO RIESGO
        </span>
      </div>

      {/* Patrón visual */}
      <div className="bg-slate-950 rounded-lg p-4 font-mono">
        <div className="text-[10px] text-slate-600 mb-2">Patrón detectado:</div>
        <div
          className="text-lg font-bold"
          dangerouslySetInnerHTML={{ __html: `${coloredPattern}<span class="text-slate-500">@${domain}</span>` }}
        />
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#00ff88]/30 border border-[#00ff88]/40 inline-block" />
          <span className="text-slate-400"><span className="text-[#00ff88] font-mono">{"{first}"}</span> = nombre</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#00d4ff]/30 border border-[#00d4ff]/40 inline-block" />
          <span className="text-slate-400"><span className="text-[#00d4ff] font-mono">{"{last}"}</span> = apellido</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#00ff88]/30 border border-[#00ff88]/40 inline-block" />
          <span className="text-slate-400"><span className="text-[#00ff88] font-mono">{"{f}"}</span> = inicial nombre</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#00d4ff]/30 border border-[#00d4ff]/40 inline-block" />
          <span className="text-slate-400"><span className="text-[#00d4ff] font-mono">{"{l}"}</span> = inicial apellido</span>
        </div>
      </div>

      {/* Ejemplo */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
        <span className="text-[10px] text-slate-600">Ejemplo:</span>
        <span className="text-orange-300 font-mono text-sm font-bold">{exampleEmail}</span>
      </div>

      {/* Impacto */}
      <div className="text-[11px] text-slate-400 leading-relaxed">
        ⚠ Con este patrón y una lista de empleados (LinkedIn, directorios públicos), es posible
        construir una lista de emails corporativos válidos — superficie de ataque directa para
        campañas de spear phishing o password spraying.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: tarjeta de email individual
// ─────────────────────────────────────────────
function EmailCard({ email, category }) {
  const [expanded, setExpanded] = useState(false)

  const categoryColors = {
    it:       { bg: "bg-red-500/10",    border: "border-red-500/20",    badge: "bg-red-500/20 text-red-300 border-red-500/30"       },
    exec:     { bg: "bg-orange-500/10", border: "border-orange-500/20", badge: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
    generic:  { bg: "bg-slate-900/40",  border: "border-slate-800",     badge: "bg-slate-700 text-slate-400 border-slate-600"        },
    default:  { bg: "bg-slate-900/40",  border: "border-slate-800",     badge: "bg-slate-700 text-slate-400 border-slate-600"        },
  }
  const catLabel = { it: "IT/Seguridad", exec: "Ejecutivo", generic: "Genérico", default: "" }
  const colors = categoryColors[category] || categoryColors.default

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${colors.border} ${colors.bg}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-900/30 transition-colors"
      >
        {/* Confidence bar vertical */}
        <div className="w-1 h-10 bg-slate-800 rounded-full overflow-hidden shrink-0">
          <div
            className={`w-full rounded-full transition-all duration-700 ${confidenceBar(email.confidence)}`}
            style={{ height: `${email.confidence}%` }}
          />
        </div>

        {/* Email + nombre */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-200 font-mono text-xs font-bold truncate">
              {email.value}
            </span>
            {email.verified && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                verificado
              </span>
            )}
            {category && category !== "default" && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${colors.badge}`}>
                {catLabel[category]}
              </span>
            )}
          </div>
          {(email.first_name || email.last_name || email.position) && (
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              {[email.first_name, email.last_name].filter(Boolean).join(" ")}
              {email.position && <span className="text-slate-600"> · {email.position}</span>}
            </div>
          )}
        </div>

        {/* Confidence score */}
        <div className="text-right shrink-0">
          <div className={`text-sm font-bold font-mono ${confidenceColor(email.confidence)}`}>
            {email.confidence}%
          </div>
          <div className="text-[9px] text-slate-600">confianza</div>
        </div>

        {(email.sources?.length > 0 || email.department) && (
          <span className={`text-slate-600 text-xs shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
        )}
      </button>

      {/* Detalle expandido */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-800/60 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            {email.department && (
              <div>
                <div className="text-slate-600 text-[9px] uppercase tracking-wider mb-0.5">Departamento</div>
                <div className="text-slate-300">{email.department}</div>
              </div>
            )}
            {email.type && (
              <div>
                <div className="text-slate-600 text-[9px] uppercase tracking-wider mb-0.5">Tipo</div>
                <div className="text-slate-300">{email.type}</div>
              </div>
            )}
            {email.last_found && (
              <div>
                <div className="text-slate-600 text-[9px] uppercase tracking-wider mb-0.5">Última aparición</div>
                <div className="text-slate-300">{formatDate(email.last_found)}</div>
              </div>
            )}
          </div>

          {/* Fuentes */}
          {email.sources && email.sources.length > 0 && (
            <div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">
                Encontrado en ({email.sources.length})
              </div>
              <div className="space-y-1">
                {email.sources.map((src, i) => (
                  <div key={i} className="text-[10px] font-mono text-slate-500 truncate" title={src}>
                    {src}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: distribución por departamento
// ─────────────────────────────────────────────
function DepartmentChart({ departments }) {
  const entries = Object.entries(departments)
    .sort((a, b) => b[1] - a[1])

  if (entries.length === 0) return null

  const max = entries[0]?.[1] || 1

  const DEPT_COLORS = [
    "bg-[#00d4ff]", "bg-[#00ff88]", "bg-purple-500",
    "bg-orange-500", "bg-yellow-500", "bg-pink-500",
    "bg-cyan-500", "bg-indigo-500",
  ]

  return (
    <div className="space-y-2">
      {entries.map(([dept, count], i) => (
        <div key={dept} className="flex items-center gap-3">
          <div className="w-28 text-right text-[10px] text-slate-400 truncate shrink-0" title={dept}>
            {dept}
          </div>
          <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden relative">
            <div
              className={`h-full rounded transition-all duration-700 ${DEPT_COLORS[i % DEPT_COLORS.length]} opacity-70`}
              style={{ width: `${(count / max) * 100}%` }}
            />
            <span className="absolute inset-0 flex items-center pl-2 text-[10px] text-white/70 font-mono">
              {count} email{count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: lista de emails de alto valor
// ─────────────────────────────────────────────
function HighValueList({ title, emails, category, color, emptyMsg }) {
  if (emails.length === 0) return null
  return (
    <div className="space-y-2">
      <div className={`text-[10px] uppercase tracking-widest font-bold ${color}`}>
        {title} ({emails.length})
      </div>
      <div className="space-y-1">
        {emails.map((email, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800 group">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              category === "it"   ? "bg-red-400" :
              category === "exec" ? "bg-orange-400" :
              "bg-slate-500"
            }`} />
            <span className="text-slate-200 font-mono text-xs flex-1 truncate">{email}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Vista principal: HunterView
// ─────────────────────────────────────────────
export default function HunterView({ data, report }) {
  const target = report?.meta?.target || "—"
  const [emailFilter, setEmailFilter] = useState("all")
  const [search, setSearch]           = useState("")

  // ── Estados especiales ───────────────────
  if (!data || data.status === "not_implemented") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-slate-500 text-sm">Módulo Hunter no ejecutado en este escaneo</div>
        <div className="text-slate-600 text-xs mt-2">Correr con: <span className="text-[#00ff88]">--modules hunter</span></div>
      </div>
    )
  }
  if (data.status === "skipped") {
    return (
      <div className="p-8 text-center font-mono space-y-2">
        <div className="text-yellow-400 text-sm">Módulo Hunter omitido</div>
        <div className="text-slate-500 text-xs">{data.message}</div>
        <div className="text-slate-600 text-xs">
          Registrarse en <span className="text-[#00d4ff]">hunter.io/users/sign_up</span> y configurar HUNTER_API_KEY en .env
        </div>
      </div>
    )
  }
  if (data.status === "error") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-red-400 text-sm">Error en módulo Hunter</div>
        <div className="text-slate-500 text-xs mt-2">{data.message}</div>
      </div>
    )
  }

  const emails      = data.emails      || []
  const riskEmails  = data.risk_emails || {}
  const analysis    = data.analysis    || {}
  const summary     = data.summary     || {}
  const departments = data.departments || {}

  const riskLevel  = analysis.risk_level    || "NINGUNO"
  const phishRisk  = analysis.phishing_risk || "BAJO"
  const riskColors = rc(riskLevel)

  const itStaff   = riskEmails.it_staff   || []
  const execs     = riskEmails.executives || []
  const generic   = riskEmails.generic    || []

  // Categoría de cada email
  const emailCategory = useMemo(() => {
    const map = {}
    itStaff.forEach(e  => { map[e] = "it"      })
    execs.forEach(e    => { map[e] = "exec"    })
    generic.forEach(e  => { map[e] = "generic" })
    return map
  }, [itStaff, execs, generic])

  // Filtrado de emails
  const FILTERS = [
    { id: "all",     label: `Todos (${emails.length})`      },
    { id: "it",      label: `IT (${itStaff.length})`        },
    { id: "exec",    label: `Ejecutivos (${execs.length})`  },
    { id: "generic", label: `Genéricos (${generic.length})` },
    { id: "verified",label: "Verificados"                   },
  ]

  const filteredEmails = useMemo(() => {
    return emails.filter(e => {
      const matchSearch = !search || e.value.toLowerCase().includes(search.toLowerCase()) ||
        (e.first_name + " " + e.last_name).toLowerCase().includes(search.toLowerCase()) ||
        (e.position || "").toLowerCase().includes(search.toLowerCase())

      const matchFilter = (() => {
        if (emailFilter === "all")      return true
        if (emailFilter === "it")       return emailCategory[e.value] === "it"
        if (emailFilter === "exec")     return emailCategory[e.value] === "exec"
        if (emailFilter === "generic")  return emailCategory[e.value] === "generic"
        if (emailFilter === "verified") return e.verified
        return true
      })()

      return matchSearch && matchFilter
    })
  }, [emails, emailFilter, search, emailCategory])

  const hasHighValue = itStaff.length > 0 || execs.length > 0

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto font-mono">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Módulo Hunter.io</div>
          <div className="text-[#00d4ff] text-xl font-bold">{target}</div>
          {data.organization && (
            <div className="text-slate-400 text-sm mt-0.5">{data.organization}</div>
          )}
          <div className="text-slate-500 text-xs mt-1">
            Emails corporativos indexados via Hunter.io API
          </div>
        </div>
        <div className={`shrink-0 px-5 py-3 rounded-xl border text-center ${riskColors.bg} ${riskColors.border}`}>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Riesgo phishing</div>
          <div className={`text-2xl font-black ${riskColors.text}`}>{riskLevel}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{emails.length} emails</div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip
          label="Total Hunter"
          value={summary.total_indexed_hunter ?? data.total_emails ?? 0}
          sub="indexados"
          color="text-[#00d4ff]"
        />
        <StatChip
          label="Emails obtenidos"
          value={emails.length}
          sub="en este escaneo"
          color="text-[#00ff88]"
        />
        <StatChip
          label="Alto valor"
          value={itStaff.length + execs.length}
          sub="IT + ejecutivos"
          color={hasHighValue ? "text-red-400" : "text-[#00ff88]"}
        />
        <StatChip
          label="Patrón"
          value={data.pattern ? "Detectado" : "N/A"}
          sub={data.pattern || "No encontrado"}
          color={data.pattern ? "text-orange-400" : "text-slate-500"}
        />
      </div>

      {/* ── Patrón de email ── */}
      {data.pattern && (
        <PatternDisplay
          pattern={data.pattern}
          domain={target}
          organization={data.organization}
        />
      )}

      {/* ── Emails de alto valor ── */}
      {hasHighValue && (
        <div className={`border rounded-xl p-5 space-y-4 ${
          itStaff.length > 0 ? "border-red-500/30 bg-red-500/5" : "border-orange-500/20 bg-orange-500/5"
        }`}>
          <div className="text-[10px] uppercase tracking-widest font-bold text-red-400">
            ⚠ Emails de alto valor expuestos — superficie de spear phishing
          </div>
          <HighValueList
            title="Personal IT y Seguridad"
            emails={itStaff}
            category="it"
            color="text-red-400"
          />
          <HighValueList
            title="Ejecutivos y Dirección"
            emails={execs}
            category="exec"
            color="text-orange-400"
          />
        </div>
      )}

      {/* ── Sin emails de alto valor ── */}
      {!hasHighValue && emails.length > 0 && (
        <div className="border border-green-500/20 bg-green-500/5 rounded-xl p-4 text-center">
          <div className="text-green-400 text-sm">✓ Sin emails IT ni ejecutivos identificados</div>
          <div className="text-slate-500 text-xs mt-1">No se detectaron cargos de alto valor en los emails encontrados</div>
        </div>
      )}

      {/* ── Lista completa de emails ── */}
      {emails.length > 0 && (
        <Section title="Emails encontrados" count={emails.length} defaultOpen>
          {/* Controles */}
          <div className="flex flex-col md:flex-row gap-2 mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por email, nombre o cargo..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-[#00d4ff]/50"
            />
            <div className="flex gap-1 flex-wrap">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setEmailFilter(f.id)}
                  className={`
                    px-2 py-1 rounded text-[10px] font-mono transition-colors border
                    ${emailFilter === f.id
                      ? "bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/30"
                      : "bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300"
                    }
                  `}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {filteredEmails.length === 0 ? (
              <div className="text-slate-600 text-xs text-center py-6">Sin resultados para este filtro</div>
            ) : filteredEmails.map((email, i) => (
              <EmailCard
                key={i}
                email={email}
                category={emailCategory[email.value] || "default"}
              />
            ))}
          </div>

          {filteredEmails.length !== emails.length && (
            <div className="text-center text-[10px] text-slate-600 mt-3">
              Mostrando {filteredEmails.length} de {emails.length} emails
            </div>
          )}
        </Section>
      )}

      {/* ── Sin emails ── */}
      {emails.length === 0 && (
        <div className="border border-slate-700 bg-slate-900/40 rounded-xl p-8 text-center">
          <div className="text-slate-500 text-sm">Sin emails encontrados para este dominio</div>
          <div className="text-slate-600 text-xs mt-2">
            Hunter.io no tiene emails indexados — buscar manualmente en LinkedIn y directorios web
          </div>
        </div>
      )}

      {/* ── Distribución por departamento ── */}
      {Object.keys(departments).length > 0 && (
        <Section title="Distribución por departamento" defaultOpen={false}>
          <DepartmentChart departments={departments} />
        </Section>
      )}

      {/* ── Análisis de riesgo ── */}
      <Section
        title="Análisis de riesgo de phishing"
        badge={phishRisk}
        badgeColor={`${rc(phishRisk).text} ${rc(phishRisk).bg} border ${rc(phishRisk).border} rounded px-1.5`}
        defaultOpen
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className={`p-3 rounded-lg border ${rc(riskLevel).bg} ${rc(riskLevel).border}`}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Riesgo general</div>
            <div className={`text-sm font-bold ${rc(riskLevel).text}`}>{riskLevel}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {riskLevel === "CRÍTICO" && "Emails IT/ejecutivos + patrón detectado — superficie de ataque máxima."}
              {riskLevel === "ALTO"    && "Emails de alto valor expuestos — riesgo significativo de spear phishing."}
              {riskLevel === "MEDIO"   && "Emails corporativos expuestos — riesgo moderado."}
              {riskLevel === "BAJO"    && "Pocos emails expuestos — riesgo bajo."}
              {riskLevel === "NINGUNO" && "Sin emails encontrados — sin riesgo detectado."}
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${
            analysis.has_pattern
              ? "bg-orange-500/5 border-orange-500/20"
              : "bg-slate-900/40 border-slate-800"
          }`}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Patrón de email</div>
            <div className={`text-sm font-bold ${analysis.has_pattern ? "text-orange-400" : "text-green-400"}`}>
              {analysis.has_pattern ? "DETECTADO" : "NO DETECTADO"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {analysis.pattern_description}
            </div>
          </div>
        </div>

        {/* Recomendaciones */}
        {analysis.recommended_actions && analysis.recommended_actions.length > 0 && (
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">
              Recomendaciones
            </div>
            <div className="space-y-2">
              {analysis.recommended_actions.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-[#00ff88] text-xs shrink-0 mt-0.5">→</span>
                  <span className="text-slate-400 text-[11px] leading-relaxed">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Emails genéricos ── */}
      {generic.length > 0 && (
        <Section title="Emails genéricos" count={generic.length} defaultOpen={false}>
          <div className="flex flex-wrap gap-2">
            {generic.map((email, i) => (
              <span key={i} className="text-xs font-mono px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400">
                {email}
              </span>
            ))}
          </div>
          <div className="text-[10px] text-slate-600 mt-3">
            Emails genéricos (info@, contact@, etc.) — bajo valor para spear phishing pero útiles para mapear áreas organizacionales
          </div>
        </Section>
      )}

      {/* ── Footer ── */}
      <div className="text-[10px] text-slate-700 text-center pb-2">
        Datos obtenidos via Hunter.io API — fuentes públicas indexadas · Para opt-out: hunter.io/opt-out
      </div>
    </div>
  )
}