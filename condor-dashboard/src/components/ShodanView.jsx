import { useState, useMemo } from "react"

// ─────────────────────────────────────────────
//  Colores por severidad CVSS
// ─────────────────────────────────────────────
const SEV_COLORS = {
  "CRÍTICO": { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    bar: "bg-red-500",    dot: "bg-red-400",    badge: "bg-red-500/20 text-red-300 border-red-500/30"    },
  "ALTO":    { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", bar: "bg-orange-500", dot: "bg-orange-400", badge: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  "MEDIO":   { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", bar: "bg-yellow-500", dot: "bg-yellow-400", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  "BAJO":    { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  bar: "bg-green-500",  dot: "bg-green-400",  badge: "bg-green-500/20 text-green-300 border-green-500/30"  },
  "NINGUNO": { text: "text-slate-400",  bg: "bg-slate-800/40",  border: "border-slate-700",     bar: "bg-slate-500",  dot: "bg-slate-500",  badge: "bg-slate-700 text-slate-400 border-slate-600"        },
}
const sc = (s) => SEV_COLORS[s] || SEV_COLORS["NINGUNO"]

const RISK_COLORS = {
  "CRÍTICO":     { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30"    },
  "ALTO":        { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  "MEDIO":       { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  "BAJO":        { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30"  },
  "DESCONOCIDO": { text: "text-slate-400",  bg: "bg-slate-800/40",  border: "border-slate-700"     },
}
const rc = (r) => RISK_COLORS[r] || RISK_COLORS["DESCONOCIDO"]

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
const cvssColor = (score) => {
  if (score >= 9.0) return "text-red-400"
  if (score >= 7.0) return "text-orange-400"
  if (score >= 4.0) return "text-yellow-400"
  return "text-green-400"
}

const cvssBarColor = (score) => {
  if (score >= 9.0) return "bg-red-500"
  if (score >= 7.0) return "bg-orange-500"
  if (score >= 4.0) return "bg-yellow-500"
  return "bg-green-500"
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
//  Componente: tarjeta CVE individual
// ─────────────────────────────────────────────
function CveCard({ vuln, expanded = false }) {
  const [open, setOpen] = useState(expanded)
  const colors = sc(vuln.severity)
  const score  = vuln.cvss ?? 0

  return (
    <div className={`border rounded-xl overflow-hidden ${colors.border} transition-all duration-200`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-start gap-3 p-3 text-left hover:bg-slate-900/40 transition-colors ${colors.bg}`}
      >
        {/* CVSS score */}
        <div className="shrink-0 text-center w-14">
          <div className={`text-xl font-black font-mono ${cvssColor(score)}`}>
            {score.toFixed(1)}
          </div>
          <div className="h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full ${cvssBarColor(score)}`}
              style={{ width: `${(score / 10) * 100}%` }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-slate-200 font-mono font-bold text-xs">{vuln.cve_id}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${colors.badge}`}>
              {vuln.severity}
            </span>
          </div>
          <div className="text-slate-500 text-[11px] leading-relaxed line-clamp-2">
            {vuln.summary}
          </div>
        </div>

        <span className={`text-slate-600 text-xs shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {/* Expandido: referencias */}
      {open && vuln.references && vuln.references.length > 0 && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-800/60">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">Referencias</div>
          <div className="space-y-1">
            {vuln.references.map((ref, i) => (
              <div key={i} className="text-[10px] font-mono text-slate-500 truncate">{ref}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: distribución de CVEs por severidad
// ─────────────────────────────────────────────
function CvssDistribution({ vulns }) {
  const dist = useMemo(() => {
    const counts = { "CRÍTICO": 0, "ALTO": 0, "MEDIO": 0, "BAJO": 0, "NINGUNO": 0 }
    vulns.forEach(v => { counts[v.severity] = (counts[v.severity] || 0) + 1 })
    return counts
  }, [vulns])

  const total = vulns.length
  if (total === 0) return null

  const severities = ["CRÍTICO", "ALTO", "MEDIO", "BAJO"]

  return (
    <div className="space-y-2">
      {/* Barra apilada */}
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        {severities.map(sev => {
          const count = dist[sev] || 0
          const pct   = (count / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={sev}
              className={`h-full transition-all duration-700 ${sc(sev).bar}`}
              style={{ width: `${pct}%` }}
              title={`${sev}: ${count}`}
            />
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3">
        {severities.map(sev => {
          const count = dist[sev] || 0
          if (count === 0) return null
          const colors = sc(sev)
          return (
            <div key={sev} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
              <span className={`text-[10px] font-bold ${colors.text}`}>{sev}</span>
              <span className="text-slate-500 text-[10px]">{count}</span>
            </div>
          )
        })}
        <span className="text-slate-600 text-[10px] ml-auto">{total} total</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: tarjeta de host
// ─────────────────────────────────────────────
function HostCard({ host, index }) {
  const [expanded, setExpanded] = useState(index === 0)

  const critCves = host.vulns?.filter(v => v.severity === "CRÍTICO") || []
  const altoCves = host.vulns?.filter(v => v.severity === "ALTO")    || []
  const hasVulns = host.vulns?.length > 0

  return (
    <div className={`
      border rounded-xl overflow-hidden
      ${critCves.length > 0 ? "border-red-500/30" :
        altoCves.length > 0 ? "border-orange-500/20" :
        "border-slate-800"}
    `}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 bg-slate-900/60 hover:bg-slate-900 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* IP */}
          <span className="text-[#00d4ff] font-mono font-bold text-sm">{host.ip}</span>

          {/* Hostname */}
          {host.hostnames?.[0] && (
            <span className="text-slate-500 text-xs font-mono">{host.hostnames[0]}</span>
          )}

          {/* OS */}
          {host.os && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
              {host.os}
            </span>
          )}

          {/* CVEs badge */}
          {hasVulns && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              critCves.length > 0
                ? "bg-red-500/20 text-red-300 border-red-500/30"
                : "bg-orange-500/20 text-orange-300 border-orange-500/30"
            }`}>
              {host.vulns.length} CVE{host.vulns.length !== 1 ? "s" : ""}
              {critCves.length > 0 && ` (${critCves.length} crítico${critCves.length !== 1 ? "s" : ""})`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>{host.ports?.length ?? 0} puertos</span>
            {host.org && <span className="hidden md:inline">· {host.org}</span>}
          </div>
          <span className={`text-slate-500 text-xs transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-4 border-t border-slate-800">

          {/* Info del host */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            {[
              { label: "Organización", value: host.org  },
              { label: "ASN",          value: host.asn  },
              { label: "ISP",          value: host.isp  },
              { label: "País",         value: host.country ? `${host.country}${host.city ? ` · ${host.city}` : ""}` : null },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <div className="text-slate-600 uppercase tracking-wider text-[9px] mb-0.5">{label}</div>
                <div className="text-slate-300 font-mono">{value}</div>
              </div>
            ) : null)}
          </div>

          {/* Tags */}
          {host.tags && host.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {host.tags.map((tag, i) => (
                <span key={i} className={`
                  text-[10px] px-2 py-0.5 rounded border font-mono
                  ${["honeypot", "scanner", "tor"].includes(tag)
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : ["cloud", "cdn"].includes(tag)
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                  }
                `}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Puertos */}
          {host.ports && host.ports.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">
                Puertos ({host.ports.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {host.ports.map(p => (
                  <span key={p} className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Servicios con banners */}
          {host.services && host.services.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">
                Servicios y banners
              </div>
              <div className="space-y-2">
                {host.services.map((svc, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[#00d4ff] font-mono font-bold text-xs">:{svc.port}</span>
                      <span className="text-slate-600 text-[10px]">{svc.protocol}</span>
                      {svc.product && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {svc.product}
                          {svc.version && <span className="text-slate-500"> {svc.version}</span>}
                        </span>
                      )}
                    </div>
                    {svc.banner && (
                      <div className="text-[10px] font-mono text-slate-600 mt-1 truncate" title={svc.banner}>
                        {svc.banner}
                      </div>
                    )}
                    {/* CPE */}
                    {svc.cpe && svc.cpe.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {svc.cpe.map((c, ci) => (
                          <span key={ci} className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-900 text-slate-600 border border-slate-800">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* HTTP info */}
                    {svc.http && (
                      <div className="mt-1 text-[10px] text-slate-500">
                        {svc.http.status && <span className="mr-2">HTTP {svc.http.status}</span>}
                        {svc.http.title  && <span className="text-slate-400">"{svc.http.title}"</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CVEs del host */}
          {hasVulns && (
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">
                CVEs detectados en este host ({host.vulns.length})
              </div>
              <CvssDistribution vulns={host.vulns} />
              <div className="mt-3 space-y-2">
                {host.vulns.slice(0, 5).map((v, i) => (
                  <CveCard key={i} vuln={v} expanded={false} />
                ))}
                {host.vulns.length > 5 && (
                  <div className="text-center text-[10px] text-slate-600 py-1">
                    +{host.vulns.length - 5} CVEs más — ver sección "Todas las vulnerabilidades"
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Última actualización */}
          {host.last_update && (
            <div className="text-[10px] text-slate-700 text-right">
              Último escaneo Shodan: {host.last_update}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Vista principal: ShodanView
// ─────────────────────────────────────────────
export default function ShodanView({ data, report }) {
  const target = report?.meta?.target || "—"

  // ── Estados especiales ───────────────────
  if (!data || data.status === "not_implemented") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-slate-500 text-sm">Módulo Shodan no ejecutado en este escaneo</div>
        <div className="text-slate-600 text-xs mt-2">Correr con: <span className="text-[#00ff88]">--modules shodan</span></div>
      </div>
    )
  }
  if (data.status === "skipped") {
    return (
      <div className="p-8 text-center font-mono space-y-2">
        <div className="text-yellow-400 text-sm">Módulo Shodan omitido</div>
        <div className="text-slate-500 text-xs">{data.message}</div>
        <div className="text-slate-600 text-xs">
          Registrarse en <span className="text-[#00d4ff]">account.shodan.io/register</span> y configurar SHODAN_API_KEY en .env
        </div>
      </div>
    )
  }
  if (data.status === "error") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-red-400 text-sm">Error en módulo Shodan</div>
        <div className="text-slate-500 text-xs mt-2">{data.message}</div>
      </div>
    )
  }

  const hosts    = data.hosts    || []
  const summary  = data.summary  || {}
  const analysis = data.analysis || {}

  const riskLevel  = analysis.risk_level || "DESCONOCIDO"
  const riskColors = rc(riskLevel)

  // Todos los CVEs de todos los hosts — agregados
  const allVulns = useMemo(() => {
    const seen = new Set()
    const list = []
    hosts.forEach(h => {
      h.vulns?.forEach(v => {
        if (!seen.has(v.cve_id)) {
          seen.add(v.cve_id)
          list.push(v)
        }
      })
    })
    return list.sort((a, b) => b.cvss - a.cvss)
  }, [hosts])

  const criticalVulns = allVulns.filter(v => v.severity === "CRÍTICO")
  const topVulns      = analysis.top_vulns || allVulns.slice(0, 5)
  const software      = analysis.exposed_software || summary.software_detected || []
  const hosting       = analysis.hosting_info || {}

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto font-mono">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Módulo Shodan</div>
          <div className="text-[#00d4ff] text-xl font-bold">{target}</div>
          <div className="text-slate-500 text-xs mt-1">
            Banners, versiones de software y CVEs via Shodan API
          </div>
        </div>
        <div className={`shrink-0 px-5 py-3 rounded-xl border text-center ${riskColors.bg} ${riskColors.border}`}>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Riesgo</div>
          <div className={`text-2xl font-black ${riskColors.text}`}>{riskLevel}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{allVulns.length} CVEs</div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip label="Hosts"          value={summary.total_hosts    ?? 0} color="text-[#00d4ff]" />
        <StatChip label="CVEs totales"   value={summary.total_vulns    ?? 0} color={allVulns.length > 0 ? "text-orange-400" : "text-[#00ff88]"} />
        <StatChip
          label="CVEs críticos"
          value={summary.critical_vulns ?? criticalVulns.length}
          color={criticalVulns.length > 0 ? "text-red-400" : "text-[#00ff88]"}
          sub={criticalVulns.length > 0 ? "CVSS ≥ 9.0" : "ninguno"}
        />
        <StatChip label="Software detectado" value={software.length} color="text-purple-400" />
      </div>

      {/* ── Alerta CVEs críticos ── */}
      {criticalVulns.length > 0 && (
        <div className="border border-red-500/40 bg-red-500/5 rounded-xl p-5">
          <div className="text-[10px] text-red-400 uppercase tracking-widest font-bold mb-3">
            ⚠ {criticalVulns.length} Vulnerabilidad{criticalVulns.length !== 1 ? "es" : ""} crítica{criticalVulns.length !== 1 ? "s" : ""} detectada{criticalVulns.length !== 1 ? "s" : ""} (CVSS ≥ 9.0)
          </div>
          <div className="space-y-2">
            {criticalVulns.slice(0, 3).map((v, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`text-lg font-black font-mono ${cvssColor(v.cvss)} shrink-0 w-10 text-right`}>
                  {v.cvss.toFixed(1)}
                </span>
                <div>
                  <div className="text-red-300 font-mono font-bold text-xs">{v.cve_id}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                    {v.summary?.slice(0, 120)}...
                  </div>
                </div>
              </div>
            ))}
            {criticalVulns.length > 3 && (
              <div className="text-slate-600 text-[10px] text-center pt-1">
                +{criticalVulns.length - 3} vulnerabilidades críticas más
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sin vulnerabilidades ── */}
      {allVulns.length === 0 && hosts.length > 0 && (
        <div className="border border-green-500/20 bg-green-500/5 rounded-xl p-4 text-center">
          <div className="text-green-400 text-sm">✓ Sin CVEs detectados por Shodan</div>
          <div className="text-slate-500 text-xs mt-1">Shodan no asoció vulnerabilidades conocidas a los servicios encontrados</div>
        </div>
      )}

      {/* ── Distribución global de CVEs ── */}
      {allVulns.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
            Distribución de vulnerabilidades por severidad
          </div>
          <CvssDistribution vulns={allVulns} />
        </div>
      )}

      {/* ── Top vulnerabilidades ── */}
      {topVulns.length > 0 && (
        <Section
          title="Top vulnerabilidades por CVSS score"
          count={topVulns.length}
          badge={criticalVulns.length > 0 ? "CRÍTICO" : undefined}
          badgeColor="text-red-400 bg-red-500/10 border border-red-500/20 rounded px-1.5"
          defaultOpen
        >
          <div className="space-y-2">
            {topVulns.map((v, i) => (
              <CveCard key={i} vuln={v} expanded={i === 0 && v.severity === "CRÍTICO"} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Hosting info ── */}
      {(hosting.org || hosting.asn) && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
            Información de hosting
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {hosting.org && (
              <div>
                <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Organización</div>
                <div className="text-slate-200 font-mono">{hosting.org}</div>
              </div>
            )}
            {hosting.asn && (
              <div>
                <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">ASN</div>
                <div className="text-[#00d4ff] font-mono font-bold">{hosting.asn}</div>
              </div>
            )}
            {hosting.isp && (
              <div>
                <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">ISP</div>
                <div className="text-slate-200 font-mono">{hosting.isp}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Software expuesto ── */}
      {software.length > 0 && (
        <Section title="Software detectado en banners" count={software.length} defaultOpen={false}>
          <div className="flex flex-wrap gap-2">
            {software.map((s, i) => (
              <span key={i} className="text-xs font-mono px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                {s}
              </span>
            ))}
          </div>
          <div className="text-[10px] text-slate-600 mt-3">
            Versiones exactas expuestas en banners — verificar contra CVEs conocidos para cada versión
          </div>
        </Section>
      )}

      {/* ── Hosts detallados ── */}
      {hosts.length > 0 ? (
        <Section title="Hosts indexados en Shodan" count={hosts.length} defaultOpen>
          <div className="space-y-3">
            {hosts.map((host, i) => (
              <HostCard key={i} host={host} index={i} />
            ))}
          </div>
        </Section>
      ) : (
        <div className="border border-slate-700 bg-slate-900/40 rounded-xl p-8 text-center">
          <div className="text-slate-500 text-sm">Sin hosts indexados para este dominio en Shodan</div>
          <div className="text-slate-600 text-xs mt-2">
            El dominio puede estar detrás de un CDN o las IPs no están indexadas aún
          </div>
        </div>
      )}

      {/* ── Todas las vulnerabilidades ── */}
      {allVulns.length > 5 && (
        <Section
          title="Todas las vulnerabilidades"
          count={allVulns.length}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {allVulns.map((v, i) => (
              <CveCard key={i} vuln={v} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Footer ── */}
      <div className="text-[10px] text-slate-700 text-center pb-2">
        Datos obtenidos via Shodan API — sin tráfico directo al objetivo
      </div>
    </div>
  )
}