/**
 * ╔══════════════════════════════════════════════════════╗
 * ║   CÓNDOR FRAMEWORK — components/CensysView.jsx       ║
 * ║   Vista detallada del módulo Censys                  ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * DESCRIPCIÓN:
 *   Visualización completa de los resultados del módulo censys_query.
 *   Muestra:
 *     - Hosts descubiertos con sus IPs y hostnames
 *     - Puertos abiertos por host con servicios detectados
 *     - Certificados TLS (CN, SANs, emisor, expiración)
 *     - Puertos peligrosos expuestos
 *     - Issues de TLS (expirados, autofirmados)
 *     - Mapa visual de puertos por host
 *
 * PROPS:
 *   data   → results.censys del reporte condor-cli
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
  "DESCONOCIDO": { text: "text-slate-400", bg: "bg-slate-800/40", border: "border-slate-700",   dot: "bg-slate-600"  },
}
const rc = (r) => RISK_COLORS[r] || RISK_COLORS["DESCONOCIDO"]

// Color por número de puerto — semántico
const portColor = (port) => {
  if ([21,23,3389,5900].includes(port))                return { bg: "bg-red-500/20",    text: "text-red-300",    border: "border-red-500/30"    } // Peligrosos
  if ([22,25,110,143].includes(port))                  return { bg: "bg-orange-500/20", text: "text-orange-300", border: "border-orange-500/30" } // Sensibles
  if ([80,8080].includes(port))                        return { bg: "bg-yellow-500/20", text: "text-yellow-300", border: "border-yellow-500/30" } // HTTP sin TLS
  if ([443,8443].includes(port))                       return { bg: "bg-green-500/20",  text: "text-green-300",  border: "border-green-500/30"  } // HTTPS
  if ([1433,1521,3306,5432,6379,9200,27017].includes(port)) return { bg: "bg-red-600/20", text: "text-red-200", border: "border-red-600/30"    } // DBs
  return { bg: "bg-slate-700/40", text: "text-slate-300", border: "border-slate-700" }
}

// Descripciones conocidas de puertos
const PORT_DESC = {
  21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
  80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 445: "SMB",
  1433: "MSSQL", 1521: "Oracle", 3306: "MySQL", 3389: "RDP",
  5432: "PostgreSQL", 5900: "VNC", 6379: "Redis", 8080: "HTTP-Alt",
  8443: "HTTPS-Alt", 9200: "Elasticsearch", 27017: "MongoDB",
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

// ─────────────────────────────────────────────
//  Componente: stat chip
// ─────────────────────────────────────────────
function StatChip({ label, value, color = "text-[#00ff88]" }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center">
      <div className={`text-2xl font-bold font-mono ${color}`}>{value ?? "—"}</div>
      <div className="text-slate-400 text-xs mt-0.5">{label}</div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: badge de puerto
// ─────────────────────────────────────────────
function PortBadge({ port, showDesc = true }) {
  const colors = portColor(port)
  const desc   = PORT_DESC[port]
  return (
    <div className={`
      inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border font-mono text-xs
      ${colors.bg} ${colors.text} ${colors.border}
    `}>
      <span className="font-bold">{port}</span>
      {showDesc && desc && <span className="text-[10px] opacity-70">{desc}</span>}
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
//  Componente: tarjeta de certificado TLS
// ─────────────────────────────────────────────
function TlsCertCard({ tls, port }) {
  if (!tls) return null

  const daysLeft   = tls.days_to_expire
  const isExpired  = tls.expired || daysLeft < 0
  const isCritical = !isExpired && daysLeft !== null && daysLeft < 30
  const isWarning  = !isExpired && !isCritical && daysLeft !== null && daysLeft < 90

  const certColor =
    isExpired  ? "border-red-500/40 bg-red-500/5" :
    isCritical ? "border-orange-500/40 bg-orange-500/5" :
    isWarning  ? "border-yellow-500/40 bg-yellow-500/5" :
    tls.self_signed ? "border-yellow-500/40 bg-yellow-500/5" :
    "border-green-500/20 bg-green-500/5"

  return (
    <div className={`p-3 rounded-lg border ${certColor} space-y-2`}>
      {/* Header cert */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">Puerto</span>
          <PortBadge port={port} showDesc={false} />
          <span className="text-[10px] text-slate-500">TLS</span>
        </div>
        <div className="flex gap-1">
          {isExpired     && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">EXPIRADO</span>}
          {isCritical    && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">EXPIRA PRONTO</span>}
          {tls.self_signed && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">AUTOFIRMADO</span>}
          {!isExpired && !isCritical && !tls.self_signed && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">VÁLIDO</span>
          )}
        </div>
      </div>

      {/* Datos del cert */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="text-slate-600">CN: </span>
          <span className="text-slate-300 font-mono">{tls.certificate_cn || "—"}</span>
        </div>
        <div>
          <span className="text-slate-600">Emisor: </span>
          <span className="text-slate-300">{tls.issuer || "—"}</span>
        </div>
        <div>
          <span className="text-slate-600">Válido desde: </span>
          <span className="text-slate-300 font-mono">{formatDate(tls.valid_from)}</span>
        </div>
        <div>
          <span className="text-slate-600">Expira: </span>
          <span className={`font-mono font-bold ${isExpired ? "text-red-400" : isCritical ? "text-orange-400" : "text-slate-300"}`}>
            {formatDate(tls.valid_to)}
            {daysLeft !== null && (
              <span className="text-slate-600 font-normal ml-1">
                ({isExpired ? `hace ${Math.abs(daysLeft)}d` : `en ${daysLeft}d`})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* SANs */}
      {tls.sans && tls.sans.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-600 mb-1">SANs ({tls.sans.length})</div>
          <div className="flex flex-wrap gap-1">
            {tls.sans.slice(0, 8).map((san, i) => (
              <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {san}
              </span>
            ))}
            {tls.sans.length > 8 && (
              <span className="text-[10px] text-slate-600">+{tls.sans.length - 8} más</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: tarjeta de host
// ─────────────────────────────────────────────
function HostCard({ host, index }) {
  const [expanded, setExpanded] = useState(index === 0)

  const hasDangerPorts = host.ports?.some(p =>
    [21,23,445,1433,1521,3306,3389,5432,5900,6379,9200,27017].includes(p)
  )
  const tlsServices = host.services?.filter(s => s.tls) || []

  return (
    <div className={`
      border rounded-xl overflow-hidden transition-all duration-200
      ${hasDangerPorts ? "border-red-500/30" : "border-slate-800"}
    `}>
      {/* Header host */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 bg-slate-900/60 hover:bg-slate-900 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* IP */}
          <span className="text-[#00d4ff] font-mono font-bold text-sm">{host.ip}</span>

          {/* Hostname */}
          {host.hostname && (
            <span className="text-slate-500 text-xs font-mono">{host.hostname}</span>
          )}

          {/* Alerta puertos peligrosos */}
          {hasDangerPorts && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
              PUERTOS PELIGROSOS
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Resumen rápido */}
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>{host.ports?.length ?? 0} puertos</span>
            {tlsServices.length > 0 && <span>· {tlsServices.length} TLS</span>}
          </div>
          <span className={`text-slate-500 text-xs transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-4 border-t border-slate-800">

          {/* Puertos abiertos */}
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">
              Puertos abiertos ({host.ports?.length ?? 0})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(host.ports || []).map(port => (
                <PortBadge key={port} port={port} />
              ))}
            </div>
          </div>

          {/* Servicios detallados */}
          {host.services && host.services.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">
                Servicios detectados
              </div>
              <div className="space-y-2">
                {host.services.map((svc, i) => {
                  const colors = portColor(svc.port)
                  return (
                    <div key={i} className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`font-mono font-bold text-xs ${colors.text}`}>
                          :{svc.port}
                        </span>
                        <span className="text-slate-500 text-[10px]">{svc.protocol}</span>
                        {svc.service_name && svc.service_name !== "UNKNOWN" && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 ${colors.text}`}>
                            {svc.service_name}
                          </span>
                        )}
                      </div>
                      {svc.banner && (
                        <div className="text-[10px] font-mono text-slate-500 mt-1 truncate" title={svc.banner}>
                          {svc.banner}
                        </div>
                      )}
                      {/* TLS inline */}
                      {svc.tls && (
                        <div className="mt-2">
                          <TlsCertCard tls={svc.tls} port={svc.port} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: mapa de puertos (heatmap visual)
// ─────────────────────────────────────────────
function PortHeatmap({ hosts }) {
  // Todos los puertos únicos ordenados
  const allPorts = useMemo(() => {
    const ports = new Set()
    hosts.forEach(h => h.ports?.forEach(p => ports.add(p)))
    return [...ports].sort((a, b) => a - b)
  }, [hosts])

  if (allPorts.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] font-mono border-collapse">
        <thead>
          <tr>
            <th className="text-left text-slate-600 pb-2 pr-4 font-normal w-32">Host / Puerto</th>
            {allPorts.map(p => (
              <th key={p} className="pb-2 px-0.5 font-normal text-center" style={{ minWidth: "36px" }}>
                <div className={`${portColor(p).text} text-[9px]`}>{p}</div>
                <div className="text-slate-700 text-[8px]">{PORT_DESC[p] || ""}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hosts.map((host, i) => (
            <tr key={i} className="border-t border-slate-800/50">
              <td className="py-1.5 pr-4 text-[#00d4ff] truncate max-w-[120px]" title={host.ip}>
                {host.ip}
              </td>
              {allPorts.map(p => {
                const hasPort = host.ports?.includes(p)
                const colors  = portColor(p)
                return (
                  <td key={p} className="py-1.5 px-0.5 text-center">
                    {hasPort ? (
                      <div className={`
                        w-7 h-5 rounded mx-auto flex items-center justify-center
                        text-[8px] font-bold cursor-default
                        ${colors.bg} ${colors.text} ${colors.border} border
                      `} title={`${host.ip}:${p} — ${PORT_DESC[p] || ""}`}>
                        ●
                      </div>
                    ) : (
                      <div className="w-7 h-5 rounded mx-auto bg-slate-900/40" />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Vista principal: CensysView
// ─────────────────────────────────────────────
export default function CensysView({ data, report }) {
  const target = report?.meta?.target || "—"

  // ── Estados especiales ───────────────────
  if (!data || data.status === "not_implemented") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-slate-500 text-sm">Módulo Censys no ejecutado en este escaneo</div>
        <div className="text-slate-600 text-xs mt-2">Correr con: <span className="text-[#00ff88]">--modules censys</span></div>
      </div>
    )
  }
  if (data.status === "skipped") {
    return (
      <div className="p-8 text-center font-mono space-y-2">
        <div className="text-yellow-400 text-sm">Módulo Censys omitido</div>
        <div className="text-slate-500 text-xs">{data.message}</div>
        <div className="text-slate-600 text-xs mt-2">
          Registrarse gratis en{" "}
          <span className="text-[#00d4ff]">accounts.censys.io/register</span>
          {" "}y configurar CENSYS_API_ID + CENSYS_API_SECRET en .env
        </div>
      </div>
    )
  }
  if (data.status === "error") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-red-400 text-sm">Error en módulo Censys</div>
        <div className="text-slate-500 text-xs mt-2">{data.message}</div>
      </div>
    )
  }

  const hosts    = data.hosts    || []
  const summary  = data.summary  || {}
  const analysis = data.analysis || {}

  const riskLevel  = analysis.risk_level || "DESCONOCIDO"
  const riskColors = rc(riskLevel)

  // TLS issues globales
  const tlsIssues       = summary.tls_issues       || []
  const dangerPorts     = analysis.dangerous_ports_open || []
  const exposedServices = analysis.exposed_services || []

  // Todos los certs TLS de todos los hosts
  const allCerts = useMemo(() => {
    const certs = []
    hosts.forEach(host => {
      host.services?.forEach(svc => {
        if (svc.tls) certs.push({ tls: svc.tls, port: svc.port, ip: host.ip })
      })
    })
    return certs
  }, [hosts])

  const hasIssues = tlsIssues.length > 0 || dangerPorts.length > 0

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto font-mono">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Módulo Censys</div>
          <div className="text-[#00d4ff] text-xl font-bold">{target}</div>
          <div className="text-slate-500 text-xs mt-1">
            Puertos, servicios y certificados TLS via Censys.io API v2
          </div>
        </div>
        <div className={`shrink-0 px-5 py-3 rounded-xl border text-center ${riskColors.bg} ${riskColors.border}`}>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Riesgo</div>
          <div className={`text-2xl font-black ${riskColors.text}`}>{riskLevel}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{hosts.length} host{hosts.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip label="Hosts"          value={summary.total_hosts ?? 0}                   color="text-[#00d4ff]" />
        <StatChip label="Puertos únicos" value={summary.total_ports ?? 0}                   color={summary.total_ports > 10 ? "text-orange-400" : "text-[#00ff88]"} />
        <StatChip label="Servicios"      value={exposedServices.length}                     color="text-purple-400" />
        <StatChip label="Issues TLS"     value={tlsIssues.length}                           color={tlsIssues.length > 0 ? "text-red-400" : "text-[#00ff88]"} />
      </div>

      {/* ── Puertos peligrosos ── */}
      {dangerPorts.length > 0 && (
        <div className="border border-red-500/30 bg-red-500/5 rounded-xl p-5">
          <div className="text-[10px] text-red-400 uppercase tracking-widest mb-3 font-bold">
            ⚠ Puertos peligrosos expuestos públicamente
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {dangerPorts.map(p => (
              <PortBadge key={p} port={p} />
            ))}
          </div>
          <div className="space-y-1">
            {dangerPorts.map(p => {
              const desc = analysis.port_descriptions?.[String(p)]
              return desc ? (
                <div key={p} className="flex items-center gap-2 text-[11px]">
                  <span className="text-red-400 font-mono">{p}</span>
                  <span className="text-slate-500">—</span>
                  <span className="text-slate-400">{desc}</span>
                </div>
              ) : null
            })}
          </div>
        </div>
      )}

      {/* ── Issues TLS ── */}
      {tlsIssues.length > 0 && (
        <Section
          title="Issues de certificados TLS"
          count={tlsIssues.length}
          badge="REVISAR"
          badgeColor="text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-1.5"
          defaultOpen
        >
          <div className="space-y-2">
            {tlsIssues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                <span className="text-orange-300 text-xs font-mono">{issue}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Sin hallazgos ── */}
      {!hasIssues && hosts.length > 0 && (
        <div className="border border-green-500/20 bg-green-500/5 rounded-xl p-4 text-center">
          <div className="text-green-400 text-sm">✓ Sin puertos peligrosos ni issues TLS detectados</div>
        </div>
      )}

      {/* ── Mapa de puertos ── */}
      {hosts.length > 0 && (
        <Section title="Mapa de puertos por host" defaultOpen={hosts.length <= 5}>
          <PortHeatmap hosts={hosts} />
          <div className="mt-3 flex flex-wrap gap-3 text-[10px]">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500/40 border border-red-500/30" /><span className="text-slate-500">Peligroso</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-500/40 border border-yellow-500/30" /><span className="text-slate-500">HTTP</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500/40 border border-green-500/30" /><span className="text-slate-500">HTTPS</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-slate-700 border border-slate-600" /><span className="text-slate-500">Otro</span></div>
          </div>
        </Section>
      )}

      {/* ── Hosts detallados ── */}
      {hosts.length > 0 ? (
        <Section title="Hosts descubiertos" count={hosts.length} defaultOpen>
          <div className="space-y-3">
            {hosts.map((host, i) => (
              <HostCard key={i} host={host} index={i} />
            ))}
          </div>
        </Section>
      ) : (
        <div className="border border-slate-700 bg-slate-900/40 rounded-xl p-8 text-center">
          <div className="text-slate-500 text-sm">Sin hosts encontrados para este dominio en Censys</div>
          <div className="text-slate-600 text-xs mt-2">
            El dominio puede estar detrás de un CDN (Cloudflare, Akamai) que enmascara las IPs reales
          </div>
        </div>
      )}

      {/* ── Certificados TLS agrupados ── */}
      {allCerts.length > 0 && (
        <Section title="Certificados TLS detectados" count={allCerts.length} defaultOpen={false}>
          <div className="space-y-3">
            {allCerts.map((cert, i) => (
              <div key={i}>
                <div className="text-[10px] text-slate-600 mb-1 font-mono">IP: {cert.ip}</div>
                <TlsCertCard tls={cert.tls} port={cert.port} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Servicios expuestos ── */}
      {exposedServices.length > 0 && (
        <Section title="Servicios detectados" count={exposedServices.length} defaultOpen={false}>
          <div className="flex flex-wrap gap-2">
            {exposedServices.map((svc, i) => (
              <span key={i} className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono">
                {svc}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ── Footer ── */}
      <div className="text-[10px] text-slate-700 text-center pb-2">
        Datos obtenidos via Censys.io API v2 — sin tráfico directo al objetivo
      </div>
    </div>
  )
}