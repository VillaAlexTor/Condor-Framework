import { useMemo } from "react"

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
const RISK_COLORS = {
  "CRÍTICO":     { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    dot: "bg-red-400"    },
  "EXPIRADO":    { text: "text-red-500",    bg: "bg-red-600/10",    border: "border-red-600/30",    dot: "bg-red-500"    },
  "ALTO":        { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-400" },
  "MEDIO":       { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", dot: "bg-yellow-400" },
  "BAJO":        { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  dot: "bg-green-400"  },
  "DESCONOCIDO": { text: "text-slate-400",  bg: "bg-slate-800/40",  border: "border-slate-700",     dot: "bg-slate-600"  },
}
const rc = (r) => RISK_COLORS[r] || RISK_COLORS["DESCONOCIDO"]

function formatDate(iso) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("es-BO", {
      day: "2-digit", month: "short", year: "numeric"
    })
  } catch { return iso }
}

function formatDateFull(iso) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("es-BO", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    })
  } catch { return iso }
}

// ─────────────────────────────────────────────
//  Componente: campo de dato individual
// ─────────────────────────────────────────────
function DataField({ label, value, mono = false, color = "text-slate-200", empty = "—" }) {
  const display = value || empty
  const isEmpty = !value
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] text-slate-600 uppercase tracking-widest">{label}</div>
      <div className={`text-xs ${mono ? "font-mono" : ""} ${isEmpty ? "text-slate-600 italic" : color}`}>
        {display}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: barra de vida útil del dominio
// ─────────────────────────────────────────────
function DomainLifeBar({ registeredOn, expiresOn, daysToExpire }) {
  const { pctUsed, pctLeft, totalDays, usedDays } = useMemo(() => {
    if (!registeredOn || !expiresOn) return { pctUsed: 0, pctLeft: 0, totalDays: 0, usedDays: 0 }
    try {
      const start = new Date(registeredOn).getTime()
      const end   = new Date(expiresOn).getTime()
      const now   = Date.now()
      const total = end - start
      const used  = now - start
      const pctUsed = Math.min(100, Math.max(0, (used / total) * 100))
      const pctLeft = 100 - pctUsed
      return {
        pctUsed: Math.round(pctUsed),
        pctLeft: Math.round(pctLeft),
        totalDays: Math.round(total / 86400000),
        usedDays:  Math.round(used  / 86400000),
      }
    } catch { return { pctUsed: 0, pctLeft: 0, totalDays: 0, usedDays: 0 } }
  }, [registeredOn, expiresOn])

  const barColor =
    daysToExpire === null  ? "bg-slate-600" :
    daysToExpire < 0       ? "bg-red-500" :
    daysToExpire < 30      ? "bg-red-400" :
    daysToExpire < 90      ? "bg-orange-400" :
    daysToExpire < 180     ? "bg-yellow-400" :
    "bg-[#00ff88]"

  if (!registeredOn || !expiresOn) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>Registrado: {formatDate(registeredOn)}</span>
        <span>Expira: {formatDate(expiresOn)}</span>
      </div>

      {/* Barra */}
      <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${pctUsed}%` }}
        />
        {/* Marcador "hoy" */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/40"
          style={{ left: `${pctUsed}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-600">{usedDays} días usados ({pctUsed}%)</span>
        <span className={
          daysToExpire === null ? "text-slate-500" :
          daysToExpire < 0  ? "text-red-400 font-bold" :
          daysToExpire < 90 ? "text-orange-400 font-bold" :
          "text-slate-400"
        }>
          {daysToExpire === null  ? "Expiración desconocida" :
           daysToExpire < 0      ? `EXPIRADO hace ${Math.abs(daysToExpire)} días` :
           `${daysToExpire} días restantes`}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: sección con borde coloreado
// ─────────────────────────────────────────────
function Card({ title, accent = "border-slate-700", children }) {
  return (
    <div className={`border-l-2 ${accent} bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4`}>
      <div className="text-[10px] text-slate-500 uppercase tracking-widest">{title}</div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: badge de status del dominio
// ─────────────────────────────────────────────
function StatusBadge({ status }) {
  // clientTransferProhibited → bien (protegido)
  // serverHold → mal (suspendido)
  const isGood = status.toLowerCase().includes("prohibited") ||
                 status.toLowerCase().includes("ok")
  const isBad  = status.toLowerCase().includes("hold") ||
                 status.toLowerCase().includes("delete") ||
                 status.toLowerCase().includes("suspend")

  return (
    <span className={`
      inline-block text-[10px] font-mono px-2 py-0.5 rounded border
      ${isGood ? "text-green-400 bg-green-500/10 border-green-500/20" :
        isBad  ? "text-red-400 bg-red-500/10 border-red-500/20" :
                 "text-slate-400 bg-slate-800 border-slate-700"}
    `}>
      {status}
    </span>
  )
}

// ─────────────────────────────────────────────
//  Componente: indicador WHOIS Privacy
// ─────────────────────────────────────────────
function PrivacyIndicator({ privacyProtected }) {
  return (
    <div className={`
      flex items-center gap-3 p-4 rounded-xl border
      ${privacyProtected
        ? "bg-yellow-500/5 border-yellow-500/20"
        : "bg-blue-500/5 border-blue-500/20"
      }
    `}>
      <div className={`
        w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0
        ${privacyProtected ? "bg-yellow-500/20" : "bg-blue-500/20"}
      `}>
        {privacyProtected ? "🔒" : "👁"}
      </div>
      <div>
        <div className={`text-sm font-bold ${privacyProtected ? "text-yellow-400" : "text-blue-400"}`}>
          {privacyProtected ? "WHOIS Privacy activado" : "Sin WHOIS Privacy"}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {privacyProtected
            ? "Los datos del registrante están ocultos por un servicio proxy. El propietario real no es identificable via WHOIS."
            : "Los datos del registrante son públicos. Nombre, email y organización están expuestos en WHOIS."
          }
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Componente: timeline de fechas
// ─────────────────────────────────────────────
function DateTimeline({ registeredOn, updatedOn, expiresOn }) {
  const events = [
    { label: "Registro",      date: registeredOn, icon: "●", color: "text-[#00ff88]"  },
    { label: "Actualización", date: updatedOn,    icon: "◆", color: "text-[#00d4ff]"  },
    { label: "Expiración",    date: expiresOn,    icon: "■", color: "text-orange-400" },
  ].filter(e => e.date)

  if (events.length === 0) return null

  return (
    <div className="relative">
      {/* Línea vertical */}
      <div className="absolute left-[7px] top-3 bottom-3 w-px bg-slate-700" />

      <div className="space-y-4">
        {events.map((ev, i) => (
          <div key={i} className="flex items-start gap-4 pl-1">
            <span className={`text-xs shrink-0 mt-0.5 ${ev.color}`}>{ev.icon}</span>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{ev.label}</div>
              <div className="text-slate-200 text-xs font-mono mt-0.5">{formatDateFull(ev.date)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Vista principal: WhoisView
// ─────────────────────────────────────────────
export default function WhoisView({ data, report }) {
  const target = report?.meta?.target || "—"

  // ── Módulo no disponible ─────────────────
  if (!data || data.status === "not_implemented") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-slate-500 text-sm">Módulo WHOIS no ejecutado en este escaneo</div>
        <div className="text-slate-600 text-xs mt-2">Correr con: <span className="text-[#00ff88]">--modules whois</span></div>
      </div>
    )
  }

  if (data.status === "error") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-red-400 text-sm">Error en módulo WHOIS</div>
        <div className="text-slate-500 text-xs mt-2">{data.message}</div>
      </div>
    )
  }

  if (data.status === "not_found") {
    return (
      <div className="p-8 text-center font-mono">
        <div className="text-yellow-400 text-sm">Sin datos WHOIS para este dominio</div>
        <div className="text-slate-500 text-xs mt-2">El dominio puede no estar registrado o el registrar no expone WHOIS público</div>
      </div>
    )
  }

  const owner    = data.owner    || {}
  const analysis = data.analysis || {}
  const summary  = data.summary  || {}

  const expiryRisk = analysis.expiry_risk || "DESCONOCIDO"
  const days       = analysis.days_to_expire
  const colors     = rc(expiryRisk)

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto font-mono">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Módulo WHOIS</div>
          <div className="text-[#00d4ff] text-xl font-bold">{target}</div>
          <div className="text-slate-500 text-xs mt-1">
            Información de registro del dominio — fuente: WHOIS público
          </div>
        </div>

        {/* Badge expiración */}
        <div className={`shrink-0 px-5 py-3 rounded-xl border text-center ${colors.bg} ${colors.border}`}>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Expiración</div>
          <div className={`text-2xl font-black ${colors.text}`}>
            {days === null ? "N/A" : days < 0 ? "EXPIRADO" : `${days}d`}
          </div>
          <div className={`text-[10px] mt-0.5 ${colors.text}`}>{expiryRisk}</div>
        </div>
      </div>

      {/* ── Barra de vida útil ── */}
      {(data.registered_on || data.expires_on) && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
            Vida útil del dominio
          </div>
          <DomainLifeBar
            registeredOn={data.registered_on}
            expiresOn={data.expires_on}
            daysToExpire={days}
          />
        </div>
      )}

      {/* ── WHOIS Privacy ── */}
      <PrivacyIndicator privacyProtected={data.privacy_protected} />

      {/* ── Grid principal ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Registrar */}
        <Card title="Registrar" accent="border-[#00d4ff]/40">
          <div className="space-y-3">
            <DataField label="Empresa registradora" value={data.registrar} color="text-[#00d4ff]" />
            <DataField label="DNSSEC" value={data.dnssec} mono />
            <DataField label="Dominio registrado" value={data.domain} mono color="text-[#00ff88]" />
          </div>
        </Card>

        {/* Registrante */}
        <Card title="Registrante" accent="border-purple-500/40">
          <div className="space-y-3">
            <DataField label="Nombre"       value={owner.name}    color="text-purple-300" />
            <DataField label="Organización" value={owner.org}     color="text-purple-300" />
            <DataField label="Email"        value={owner.email}   mono color="text-purple-300" />
            <div className="grid grid-cols-2 gap-3">
              <DataField label="País"   value={owner.country} />
              <DataField label="Ciudad" value={owner.city}    />
            </div>
          </div>
        </Card>
      </div>

      {/* ── Timeline de fechas ── */}
      <Card title="Historial de fechas" accent="border-[#00ff88]/40">
        <DateTimeline
          registeredOn={data.registered_on}
          updatedOn={data.updated_on}
          expiresOn={data.expires_on}
        />
        {!data.registered_on && !data.updated_on && !data.expires_on && (
          <div className="text-slate-600 text-xs">Sin información de fechas disponible</div>
        )}
      </Card>

      {/* ── Estado del dominio ── */}
      {data.domain_status && data.domain_status.length > 0 && (
        <Card title="Estado del dominio (EPP Status)" accent="border-yellow-500/40">
          <div className="flex flex-wrap gap-2">
            {data.domain_status.map((s, i) => (
              <StatusBadge key={i} status={s} />
            ))}
          </div>
          <div className="text-[10px] text-slate-600 mt-1">
            clientTransferProhibited = protegido contra transferencias no autorizadas
          </div>
        </Card>
      )}

      {/* ── Nameservers WHOIS ── */}
      {data.nameservers && data.nameservers.length > 0 && (
        <Card title="Nameservers registrados" accent="border-cyan-500/40">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.nameservers.map((ns, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                <span className="text-cyan-300 text-xs font-mono truncate">{ns}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Análisis de riesgo ── */}
      <Card title="Análisis de riesgo" accent="border-red-500/40">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Expiración */}
          <div className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Riesgo de expiración</div>
            <div className={`text-sm font-bold ${colors.text}`}>{expiryRisk}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {expiryRisk === "EXPIRADO"  && "El dominio ya expiró — puede ser tomado por un tercero."}
              {expiryRisk === "CRÍTICO"   && "Expira en menos de 30 días — renovación urgente."}
              {expiryRisk === "ALTO"      && "Expira en menos de 90 días — planificar renovación."}
              {expiryRisk === "MEDIO"     && "Expira en menos de 180 días — monitorear."}
              {expiryRisk === "BAJO"      && "Expiración lejana — sin riesgo inmediato."}
              {expiryRisk === "DESCONOCIDO" && "No se pudo determinar la fecha de expiración."}
            </div>
          </div>

          {/* Dominio reciente */}
          <div className={`p-3 rounded-lg border ${
            analysis.recently_created
              ? "bg-yellow-500/5 border-yellow-500/20"
              : "bg-slate-900/40 border-slate-800"
          }`}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Antigüedad</div>
            <div className={`text-sm font-bold ${analysis.recently_created ? "text-yellow-400" : "text-green-400"}`}>
              {analysis.recently_created ? "RECIENTE" : "ESTABLECIDO"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {analysis.recently_created
                ? "Dominio registrado hace menos de 1 año — puede indicar dominio nuevo o recién migrado."
                : "Dominio con más de 1 año de antigüedad — historial establecido."
              }
            </div>
          </div>

          {/* Privacy */}
          <div className={`p-3 rounded-lg border ${
            data.privacy_protected
              ? "bg-yellow-500/5 border-yellow-500/20"
              : "bg-blue-500/5 border-blue-500/20"
          }`}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">WHOIS Privacy</div>
            <div className={`text-sm font-bold ${data.privacy_protected ? "text-yellow-400" : "text-blue-400"}`}>
              {data.privacy_protected ? "ACTIVADO" : "DESACTIVADO"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {data.privacy_protected
                ? "Registrante oculto — limita el alcance del reconocimiento pasivo."
                : "Datos del registrante expuestos públicamente en WHOIS."
              }
            </div>
          </div>

          {/* Ya expirado */}
          {analysis.already_expired && (
            <div className="p-3 rounded-lg border bg-red-600/10 border-red-600/30">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Estado</div>
              <div className="text-sm font-bold text-red-400">DOMINIO EXPIRADO</div>
              <div className="text-[11px] text-slate-500 mt-1">
                El dominio expiró hace {Math.abs(days)} días — puede estar en período de gracia o disponible para registro.
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Footer ── */}
      <div className="text-[10px] text-slate-700 text-center pb-2">
        Datos obtenidos via WHOIS público — sin tráfico directo al objetivo
      </div>
    </div>
  )
}