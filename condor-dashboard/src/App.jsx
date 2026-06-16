import { useState, useCallback } from "react"
import Overview    from "./components/Overview"
import DnsView     from "./components/DnsView"
import WhoisView   from "./components/WhoisView"
import WaybackView from "./components/WaybackView"
import CensysView  from "./components/CensysView"
import ShodanView  from "./components/ShodanView"
import HunterView  from "./components/HunterView"

// ─────────────────────────────────────────────
//  Íconos SVG inline (sin dependencia extra)
// ─────────────────────────────────────────────
const Icons = {
  Upload:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Grid:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Dns:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  Whois:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>,
  Wayback:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Censys:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  Shodan:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Hunter:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Alert:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><triangle/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Condor:   () => (
    <svg viewBox="0 0 32 32" fill="currentColor" className="w-7 h-7">
      <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2zm0 2c6.627 0 12 5.373 12 12S22.627 28 16 28 4 22.627 4 16 9.373 4 16 4zm-1 4v7H8l8 9 8-9h-7V8h-2z"/>
    </svg>
  ),
}

// ─────────────────────────────────────────────
//  Configuración de vistas / navegación
// ─────────────────────────────────────────────
const VIEWS = [
  { id: "overview", label: "Overview",    Icon: Icons.Grid,    component: Overview    },
  { id: "dns",      label: "DNS",         Icon: Icons.Dns,     component: DnsView     },
  { id: "whois",    label: "WHOIS",       Icon: Icons.Whois,   component: WhoisView   },
  { id: "wayback",  label: "Wayback",     Icon: Icons.Wayback, component: WaybackView },
  { id: "censys",   label: "Censys",      Icon: Icons.Censys,  component: CensysView  },
  { id: "shodan",   label: "Shodan",      Icon: Icons.Shodan,  component: ShodanView  },
  { id: "hunter",   label: "Hunter",      Icon: Icons.Hunter,  component: HunterView  },
]

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
const getRiskColor = (risk) => {
  const map = {
    "CRÍTICO":     "text-red-400 bg-red-400/10 border-red-400/30",
    "ALTO":        "text-orange-400 bg-orange-400/10 border-orange-400/30",
    "MEDIO":       "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    "BAJO":        "text-green-400 bg-green-400/10 border-green-400/30",
    "NINGUNO":     "text-slate-400 bg-slate-400/10 border-slate-400/30",
    "DESCONOCIDO": "text-slate-500 bg-slate-500/10 border-slate-500/30",
  }
  return map[risk] || map["DESCONOCIDO"]
}

const getModuleStatus = (results, moduleId) => {
  const data = results?.[moduleId]
  if (!data) return "missing"
  if (data.status === "skipped") return "skipped"
  if (data.status === "error")   return "error"
  if (data.status === "not_implemented") return "missing"
  return "ok"
}

const STATUS_DOT = {
  ok:      "bg-green-400",
  skipped: "bg-yellow-400",
  error:   "bg-red-400",
  missing: "bg-slate-600",
}

// ─────────────────────────────────────────────
//  Pantalla de bienvenida / carga de archivo
// ─────────────────────────────────────────────
function DropZone({ onLoad }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError]       = useState("")

  const processFile = useCallback((file) => {
    if (!file || !file.name.endsWith(".json")) {
      setError("Solo se aceptan archivos .json generados por condor-cli")
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        // Validar estructura básica
        if (!data.meta || !data.results) {
          setError("JSON inválido — debe ser un reporte generado por condor-cli")
          return
        }
        onLoad(data)
      } catch {
        setError("Error al parsear el JSON — archivo corrupto o inválido")
      }
    }
    reader.readAsText(file)
  }, [onLoad])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    setError("")
    const file = e.dataTransfer.files[0]
    processFile(file)
  }, [processFile])

  const handleFileInput = useCallback((e) => {
    setError("")
    processFile(e.target.files[0])
  }, [processFile])

  return (
    <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-8 font-mono">
      {/* Header */}
      <div className="mb-12 text-center">
        <pre className="text-[#00ff88] text-xs leading-tight mb-4 hidden md:block select-none">
{`  ██████╗ ██████╗ ███╗   ██╗██████╗  ██████╗ ██████╗
 ██╔════╝██╔═══██╗████╗  ██║██╔══██╗██╔═══██╗██╔══██╗
 ██║     ██║   ██║██╔██╗ ██║██║  ██║██║   ██║██████╔╝
 ██║     ██║   ██║██║╚██╗██║██║  ██║██║   ██║██╔══██╗
 ╚██████╗╚██████╔╝██║ ╚████║██████╔╝╚██████╔╝██║  ██║
  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝`}
        </pre>
        <p className="text-[#00d4ff] text-sm tracking-[0.3em] uppercase">
          Passive OSINT Framework — Dashboard
        </p>
        <p className="text-slate-500 text-xs mt-2">
          by villaalextor · github.com/villaalextor/condor-framework
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          relative w-full max-w-lg border-2 border-dashed rounded-xl p-12
          flex flex-col items-center gap-4 cursor-pointer transition-all duration-300
          ${dragging
            ? "border-[#00ff88] bg-[#00ff88]/5 scale-[1.02]"
            : "border-slate-700 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-900/60"
          }
        `}
        onClick={() => document.getElementById("file-input").click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Icono animado */}
        <div className={`transition-transform duration-300 ${dragging ? "scale-110" : ""}`}>
          <Icons.Upload />
        </div>

        <div className="text-center">
          <p className="text-slate-300 text-sm font-medium">
            Arrastrar reporte JSON aquí
          </p>
          <p className="text-slate-500 text-xs mt-1">
            o hacer clic para seleccionar archivo
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="px-2 py-1 bg-slate-800 rounded text-[#00ff88]">
            condor.py --format json
          </span>
          <span>→</span>
          <span className="px-2 py-1 bg-slate-800 rounded">
            *.json
          </span>
        </div>

        {dragging && (
          <div className="absolute inset-0 rounded-xl bg-[#00ff88]/5 border-2 border-[#00ff88] animate-pulse pointer-events-none" />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 px-4 py-2 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-xs max-w-lg text-center">
          {error}
        </div>
      )}

      {/* Demo hint */}
      <p className="mt-8 text-slate-600 text-xs text-center max-w-sm">
        Genera un reporte con:{" "}
        <span className="text-slate-400 font-mono">
          python condor.py --target objetivo.bo --format json
        </span>
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Sidebar de navegación
// ─────────────────────────────────────────────
function Sidebar({ report, activeView, onNavigate, onReset }) {
  const { meta, results } = report
  const target = meta?.target || "—"
  const ts     = meta?.timestamp
    ? new Date(meta.timestamp).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" })
    : "—"

  // Riesgo global — el peor entre todos los módulos
  const riskLevels = ["CRÍTICO", "ALTO", "MEDIO", "BAJO", "NINGUNO", "DESCONOCIDO"]
  const allRisks = Object.values(results || {})
    .map(r => r?.analysis?.risk_level || r?.analysis?.expiry_risk || "DESCONOCIDO")
  const globalRisk = riskLevels.find(r => allRisks.includes(r)) || "DESCONOCIDO"

  return (
    <aside className="w-56 min-h-screen bg-[#070b12] border-r border-slate-800 flex flex-col font-mono shrink-0">

      {/* Logo */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[#00ff88]"><Icons.Condor /></span>
          <div>
            <div className="text-[#00ff88] font-bold text-sm tracking-wider">CÓNDOR</div>
            <div className="text-slate-500 text-[10px] tracking-widest uppercase">Framework</div>
          </div>
        </div>

        {/* Target info */}
        <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Target</div>
          <div className="text-[#00d4ff] text-xs font-bold truncate">{target}</div>
          <div className="text-slate-600 text-[10px] mt-1">{ts}</div>
        </div>

        {/* Riesgo global */}
        <div className={`mt-2 px-2 py-1 rounded border text-[10px] font-bold tracking-wider text-center uppercase ${getRiskColor(globalRisk)}`}>
          Riesgo: {globalRisk}
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-2 overflow-y-auto">
        <div className="text-[10px] text-slate-600 uppercase tracking-widest px-2 py-2">
          Módulos
        </div>
        {VIEWS.map(({ id, label, Icon }) => {
          const status  = getModuleStatus(results, id === "overview" ? null : id)
          const isActive = activeView === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`
                w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs
                transition-all duration-150 mb-0.5 text-left
                ${isActive
                  ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }
              `}
            >
              <Icon />
              <span className="flex-1">{label}</span>
              {id !== "overview" && (
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] || STATUS_DOT.missing}`} />
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={onReset}
          className="w-full text-[10px] text-slate-500 hover:text-slate-300 transition-colors py-1 flex items-center justify-center gap-1.5"
        >
          <Icons.Upload />
          Cargar otro reporte
        </button>
        <div className="text-center text-[9px] text-slate-700 mt-2">
          v0.1.0 · villaalextor
        </div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────
//  Header superior
// ─────────────────────────────────────────────
function TopBar({ activeView, report }) {
  const view    = VIEWS.find(v => v.id === activeView)
  const duration = report?.meta?.duration_seconds
  const modules  = report?.meta?.modules_run || []
  const errors   = Object.keys(report?.errors || {}).length

  return (
    <header className="h-12 bg-[#070b12]/80 backdrop-blur border-b border-slate-800 flex items-center px-6 gap-4 shrink-0">
      <div className="flex items-center gap-2">
        {view && <view.Icon />}
        <span className="text-slate-200 text-sm font-medium font-mono">
          {view?.label || "Dashboard"}
        </span>
      </div>

      <div className="flex-1" />

      {/* Stats del reporte */}
      <div className="flex items-center gap-4 text-[11px] font-mono">
        <span className="text-slate-500">
          <span className="text-slate-300">{modules.length}</span> módulos
        </span>
        {duration && (
          <span className="text-slate-500">
            <span className="text-slate-300">{duration}s</span> duración
          </span>
        )}
        {errors > 0 && (
          <span className="text-red-400/80">
            {errors} error{errors > 1 ? "es" : ""}
          </span>
        )}
        <span className="px-2 py-0.5 rounded bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 text-[10px] tracking-wider uppercase">
          Reconocimiento Pasivo
        </span>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────
//  Placeholder para vistas no implementadas aún
// ─────────────────────────────────────────────
function PlaceholderView({ moduleId, data }) {
  const status = data?.status

  return (
    <div className="p-8 font-mono">
      <div className="max-w-2xl mx-auto">
        <div className="border border-slate-700 rounded-xl p-8 text-center bg-slate-900/40">
          <div className="text-slate-500 text-sm mb-4">
            Vista <span className="text-[#00d4ff]">{moduleId}</span> — en desarrollo
          </div>
          {status === "skipped" && (
            <div className="text-yellow-400/80 text-xs">
              Módulo omitido — API key no configurada
            </div>
          )}
          {status === "error" && (
            <div className="text-red-400/80 text-xs">
              Error en el módulo: {data?.message}
            </div>
          )}
          {/* JSON raw como fallback */}
          {data && status === "ok" && (
            <details className="mt-4 text-left">
              <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-300 mb-2">
                Ver datos raw del módulo
              </summary>
              <pre className="text-[10px] text-slate-400 bg-slate-950 rounded-lg p-4 overflow-auto max-h-96 text-left">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  App principal
// ─────────────────────────────────────────────
export default function App() {
  const [report,     setReport]     = useState(null)
  const [activeView, setActiveView] = useState("overview")

  // Cargar reporte desde archivo
  const handleLoad = useCallback((data) => {
    setReport(data)
    setActiveView("overview")
  }, [])

  // Resetear — volver a la pantalla de carga
  const handleReset = useCallback(() => {
    setReport(null)
    setActiveView("overview")
  }, [])

  // Sin reporte → pantalla de bienvenida
  if (!report) {
    return <DropZone onLoad={handleLoad} />
  }

  // Renderizar vista activa
  const viewConfig    = VIEWS.find(v => v.id === activeView)
  const ViewComponent = viewConfig?.component

  // Datos del módulo activo (null para overview)
  const moduleData = activeView === "overview"
    ? report
    : report.results?.[activeView] || null

  return (
    <div className="min-h-screen bg-[#0a0e17] flex font-mono text-slate-300">
      <Sidebar
        report={report}
        activeView={activeView}
        onNavigate={setActiveView}
        onReset={handleReset}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar activeView={activeView} report={report} />

        <main className="flex-1 overflow-auto">
          {ViewComponent ? (
            <ViewComponent
              data={moduleData}
              report={report}
              onNavigate={setActiveView}
            />
          ) : (
            <PlaceholderView moduleId={activeView} data={moduleData} />
          )}
        </main>
      </div>
    </div>
  )
}