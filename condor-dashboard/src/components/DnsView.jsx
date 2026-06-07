/**
 * ╔══════════════════════════════════════════════════════╗
 * ║   CÓNDOR FRAMEWORK — components/DnsView.jsx          ║
 * ║   Vista detallada del módulo DNS                     ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * DESCRIPCIÓN:
 *   Visualización completa de los resultados del módulo dns_recon.
 *   Muestra:
 *     - Registros DNS por tipo (A, MX, NS, TXT, CNAME)
 *     - Subdominios descubiertos via crt.sh
 *     - Análisis visual de seguridad de email (SPF/DMARC/DKIM)
 *     - Evaluación de riesgo de email spoofing
 *
 * PROPS:
 *   data   → results.dns del reporte condor-cli
 *   report → reporte completo (para acceder a meta.target)
 */

import { useState, useMemo } from "react"

// ─────────────────────────────────────────────
//  Colores por tipo de registro DNS
// ─────────────────────────────────────────────
const RECORD_COLORS = {
  A:     { bg: "bg-blue-500/10",   border: "border-blue-500/30",   text: "text-blue-400",   label: "bg-blue-500/20 text-blue-300"   },
  MX:    { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", label: "bg-purple-500/20 text-purple-300" },
  NS:    { bg: "bg-cyan-500/10",   border: "border-cyan-500/30",   text: "text-cyan-400",   label: "bg-cyan-500/20 text-cyan-300"   },
  TXT:   { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", label: "bg-yellow-500/20 text-yellow-300" },
  CNAME: { bg: "bg-green-500/10",  border: "border-green-500/30",  text: "text-green-400",  label: "bg-green-500/20 text-green-300"  },
}

const RISK_COLORS = {
  ALTO:  { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30"    },
  MEDIO: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  BAJO:  { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30"  },
}

// ─────────────────────────────────────────────
//  Componente: badge de tipo de registro
// ─────────────────────────────────────────────
function RecordTypeBadge({ type }) {
  const colors = RECORD_COLORS[type] || RECORD_COLORS.TXT
  return (
    <span className={`
      text-[10px] font-bold px-2 py-0.5 rounded font-mono
      ${colors.label}
    `}>
      {type}
    </span>
  )
}

// ─────────────────────────────────────────────
//  Componente: fila de registro DNS
// ─────────────────────────────────────────────
function RecordRow({ type, value, highlight }) {
  const colors = RECORD_COLORS[type] || RECORD_COLORS.TXT

  // Detectar si el valor TXT es SPF/DMARC/DKIM para resaltarlo
  const isSPF   = type === "TXT" && value.toLowerCase().includes("v=spf1")
  const isDMARC = type === "TXT" && value.toLowerCase().includes("v=dmarc1")
  const isDKIM  = type === "TXT" && value.toLowerCase().includes("v=dkim1")
  const isSpecial = isSPF || isDMARC || isDKIM

  return (
    <div className={`
      flex items-start gap-3 p-3 rounded-lg border transition-all duration-150
      ${isSpecial
        ? `${colors.bg} ${colors.border}`
        : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/40"
      }
    `}>
      <RecordTypeBadge type={type} />
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-mono break-all leading-relaxed ${colors.text}`}>
          {value}
        </div>
        {isSPF   && <div className="text-[10px] text-slate-500 mt-0.5">SPF — define IPs autorizadas a enviar email</div>}
        {isDMARC && <div className="text-[10px] text-slate-500 mt-0.5">DMARC — política de autenticación de email</div>}
        {isDKIM  && <div className="text-[10px] text-slate-500 mt-0.5">DKIM — firma criptográfica de emails</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: sección colapsable
// ─────────────────────────────────────────────
function Section({ title, count, children, defaultOpen = true, accent = "text-slate-300" }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 hover:bg-slate-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${accent}`}>{title}</span>
          {count !== undefined && (
            <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-mono">
              {count}
            </span>
          )}
        </div>
        <span className={`text-slate-500 text-xs transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>
      {open && (
        <div className="p-4 space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: indicador SPF/DMARC/DKIM
// ─────────────────────────────────────────────
function EmailSecurityIndicator({ label, present, detail }) {
  return (
    <div className={`
      flex items-center gap-3 p-3 rounded-lg border
      ${present
        ? "bg-green-500/5 border-green-500/20"
        : "bg-red-500/5 border-red-500/20"
      }
    `}>
      {/* Icono */}
      <div className={`
        w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0
        ${present ? "bg-green-500/20" : "bg-red-500/20"}
      `}>
        {present ? "✓" : "✗"}
      </div>

      <div className="flex-1 min-w-0">
        <div className={`text-xs font-bold font-mono ${present ? "text-green-400" : "text-red-400"}`}>
          {label}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
          {detail || (present ? "Configurado correctamente" : "No encontrado")}
        </div>
      </div>

      <span className={`
        text-[10px] font-bold px-2 py-0.5 rounded
        ${present ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}
      `}>
        {present ? "OK" : "FALTA"}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: tabla de subdominios
// ─────────────────────────────────────────────
function SubdomainTable({ subdomains, target }) {
  const [search, setSearch]   = useState("")
  const [page,   setPage]     = useState(0)
  const PER_PAGE = 15

  const filtered = useMemo(() =>
    subdomains.filter(s => s.toLowerCase().includes(search.toLowerCase())),
    [subdomains, search]
  )

  const pages     = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  // Nivel de subdominio (ej: sub.ejemplo.bo → nivel 3)
  const getLevel = (sub) => sub.split(".").length - target.split(".").length

  const LEVEL_COLORS = [
    "text-[#00d4ff]",
    "text-[#00ff88]",
    "text-purple-400",
    "text-yellow-400",
  ]

  return (
    <div className="space-y-3">
      {/* Buscador */}
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0) }}
        placeholder="Filtrar subdominios..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono placeholder-slate-600 focus:outline-none focus:border-[#00d4ff]/50"
      />

      {/* Lista */}
      <div className="space-y-1">
        {paginated.length === 0 ? (
          <div className="text-slate-600 text-xs text-center py-4">
            {search ? "Sin resultados para ese filtro" : "Sin subdominios encontrados"}
          </div>
        ) : paginated.map((sub, i) => {
          const level = getLevel(sub)
          const color = LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)]
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-900/60 border border-transparent hover:border-slate-800 transition-all group"
            >
              {/* Indentación visual por nivel */}
              {level > 0 && (
                <div className="flex gap-1 shrink-0">
                  {Array.from({ length: level }).map((_, j) => (
                    <div key={j} className="w-px h-4 bg-slate-700" />
                  ))}
                </div>
              )}
              <div className={`text-xs font-mono flex-1 ${color}`}>{sub}</div>
              <span className="text-[9px] text-slate-700 group-hover:text-slate-500 font-mono shrink-0">
                nivel {level + 1}
              </span>
            </div>
          )
        })}
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
          <span>{filtered.length} subdominios{search ? " filtrados" : ""}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <span className="px-2 py-1">{page + 1} / {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
              disabled={page === pages - 1}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: stat chip
// ─────────────────────────────────────────────
function StatChip({ label, value, color = "text-[#00ff88]" }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-center">
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Vista principal: DnsView
// ─────────────────────────────────────────────
export default function DnsView({ data, report }) {
  const target = report?.meta?.target || "—"

  // ── Módulo no disponible ─────────────────
  if (!data || data.status === "not_implemented") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-slate-500 text-sm">
          Módulo DNS no ejecutado en este escaneo
        </div>
        <div className="text-slate-600 text-xs mt-2">
          Correr con: <span className="text-[#00ff88]">--modules dns</span>
        </div>
      </div>
    )
  }

  if (data.status === "error") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-red-400 text-sm">Error en módulo DNS</div>
        <div className="text-slate-500 text-xs mt-2">{data.message}</div>
      </div>
    )
  }

  const records       = data.records       || {}
  const subdomains    = data.subdomains    || []
  const emailSec      = data.email_security || {}
  const summary       = data.summary       || {}

  // Aplanar todos los registros en lista ordenada por tipo
  const allRecords = useMemo(() => {
    const order = ["A", "NS", "MX", "TXT", "CNAME"]
    return order.flatMap(type =>
      (records[type] || []).map(value => ({ type, value }))
    )
  }, [records])

  const spoofRisk  = emailSec.email_spoofing_risk || "DESCONOCIDO"
  const riskColors = RISK_COLORS[spoofRisk] || { text: "text-slate-400", bg: "bg-slate-800/40", border: "border-slate-700" }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto font-mono">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Módulo DNS</div>
          <div className="text-[#00d4ff] text-xl font-bold">{target}</div>
          <div className="text-slate-500 text-xs mt-1">
            Registros DNS públicos + subdominios via Certificate Transparency
          </div>
        </div>
        {/* Riesgo email spoofing */}
        <div className={`shrink-0 px-4 py-3 rounded-xl border text-center ${riskColors.bg} ${riskColors.border}`}>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Email Spoofing</div>
          <div className={`text-lg font-black ${riskColors.text}`}>{spoofRisk}</div>
        </div>
      </div>

      {/* ── Stats rápidas ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <StatChip label="Reg. A"     value={records.A?.length     ?? 0} color="text-blue-400" />
        <StatChip label="Reg. MX"    value={records.MX?.length    ?? 0} color="text-purple-400" />
        <StatChip label="Reg. NS"    value={records.NS?.length     ?? 0} color="text-cyan-400" />
        <StatChip label="Reg. TXT"   value={records.TXT?.length   ?? 0} color="text-yellow-400" />
        <StatChip label="CNAME"      value={records.CNAME?.length ?? 0} color="text-green-400" />
        <StatChip label="Subdominios" value={subdomains.length}          color="text-[#00ff88]" />
      </div>

      {/* ── Seguridad de email ── */}
      <Section title="Seguridad de Email (SPF / DMARC / DKIM)" defaultOpen accent="text-[#00ff88]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <EmailSecurityIndicator
            label="SPF"
            present={emailSec.has_spf}
            detail={emailSec.has_spf
              ? "v=spf1 encontrado en TXT"
              : "Sin registro SPF — emails pueden ser falsificados"
            }
          />
          <EmailSecurityIndicator
            label="DMARC"
            present={emailSec.has_dmarc}
            detail={emailSec.has_dmarc
              ? `Política: ${emailSec.dmarc_policy || "none"}`
              : "Sin DMARC — sin política de rechazo"
            }
          />
          <EmailSecurityIndicator
            label="DKIM"
            present={emailSec.has_dkim}
            detail={emailSec.has_dkim
              ? "Selector 'default' encontrado"
              : "No detectado con selector genérico"
            }
          />
        </div>

        {/* Explicación del riesgo */}
        <div className={`p-3 rounded-lg border text-xs ${riskColors.bg} ${riskColors.border}`}>
          <span className={`font-bold ${riskColors.text}`}>Riesgo de spoofing: {spoofRisk} — </span>
          {spoofRisk === "ALTO"  && "Sin SPF ni DMARC, cualquiera puede enviar emails falsificados desde este dominio."}
          {spoofRisk === "MEDIO" && "SPF configurado pero sin DMARC. Los emails no autorizados pueden llegar a destino sin política de rechazo."}
          {spoofRisk === "BAJO"  && "SPF y DMARC configurados. El dominio tiene protección básica contra email spoofing."}
        </div>

        {/* DMARC policy detail */}
        {emailSec.has_dmarc && emailSec.dmarc_policy && (
          <div className="mt-2 text-[11px] text-slate-500 px-1">
            Política DMARC: <span className={`font-bold font-mono ${
              emailSec.dmarc_policy === "reject"      ? "text-green-400" :
              emailSec.dmarc_policy === "quarantine"  ? "text-yellow-400" :
              "text-orange-400"
            }`}>{emailSec.dmarc_policy}</span>
            {emailSec.dmarc_policy === "none" && " — solo monitoreo, no rechaza emails"}
            {emailSec.dmarc_policy === "quarantine" && " — emails sospechosos van a spam"}
            {emailSec.dmarc_policy === "reject" && " — emails no autorizados son rechazados"}
          </div>
        )}
      </Section>

      {/* ── Registros DNS ── */}
      <Section
        title="Registros DNS"
        count={allRecords.length}
        accent="text-[#00d4ff]"
      >
        {allRecords.length === 0 ? (
          <div className="text-slate-600 text-xs text-center py-4">
            Sin registros DNS encontrados
          </div>
        ) : (
          <div className="space-y-2">
            {allRecords.map((rec, i) => (
              <RecordRow key={i} type={rec.type} value={rec.value} />
            ))}
          </div>
        )}
      </Section>

      {/* ── IPs detectadas ── */}
      {records.A && records.A.length > 0 && (
        <Section title="IPs detectadas (Registro A)" count={records.A.length} accent="text-blue-400" defaultOpen={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {records.A.map((ip, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20"
              >
                <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                <span className="text-blue-300 font-mono text-sm">{ip}</span>
                <span className="text-slate-600 text-[10px] ml-auto">IPv4</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Nameservers ── */}
      {records.NS && records.NS.length > 0 && (
        <Section title="Nameservers (Registro NS)" count={records.NS.length} accent="text-cyan-400" defaultOpen={false}>
          <div className="space-y-2">
            {records.NS.map((ns, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20"
              >
                <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                <span className="text-cyan-300 font-mono text-xs">{ns}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Subdominios ── */}
      <Section
        title="Subdominios descubiertos (crt.sh — Certificate Transparency)"
        count={subdomains.length}
        accent="text-[#00ff88]"
        defaultOpen={subdomains.length > 0}
      >
        {subdomains.length === 0 ? (
          <div className="text-slate-600 text-xs text-center py-4">
            Sin subdominios encontrados en crt.sh para este dominio
          </div>
        ) : (
          <SubdomainTable subdomains={subdomains} target={target} />
        )}
      </Section>

      {/* ── Servidores de correo ── */}
      {records.MX && records.MX.length > 0 && (
        <Section title="Servidores de correo (Registro MX)" count={records.MX.length} accent="text-purple-400" defaultOpen={false}>
          <div className="space-y-2">
            {records.MX.map((mx, i) => {
              const [priority, ...hostParts] = mx.split(" ")
              const host = hostParts.join(" ")
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20"
                >
                  <span className="text-[10px] font-mono text-slate-500 w-8 text-right shrink-0">
                    {priority}
                  </span>
                  <div className="w-px h-4 bg-slate-700" />
                  <span className="text-purple-300 font-mono text-xs">{host}</span>
                  <span className="text-slate-600 text-[10px] ml-auto">prioridad</span>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Footer ── */}
      <div className="text-[10px] text-slate-700 text-center pb-2">
        Datos obtenidos via reconocimiento pasivo — sin tráfico directo al objetivo
      </div>
    </div>
  )
}