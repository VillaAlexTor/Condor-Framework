import argparse
import json
import sys
import os
import logging
from datetime import datetime
from pathlib import Path

# ─────────────────────────────────────────────
#  Colores de la Terminal
# ─────────────────────────────────────────────
class Color:
    RED     = "\033[91m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    BLUE    = "\033[94m"
    CYAN    = "\033[96m"
    WHITE   = "\033[97m"
    BOLD    = "\033[1m"
    RESET   = "\033[0m"

def c(text, color):
    """Aplica color a un string."""
    return f"{color}{text}{Color.RESET}"

# ─────────────────────────────────────────────
#  Banner ASCII
# ─────────────────────────────────────────────
BANNER = f"""
{Color.CYAN}{Color.BOLD}
  ██████╗ ██████╗ ███╗   ██╗██████╗  ██████╗ ██████╗
 ██╔════╝██╔═══██╗████╗  ██║██╔══██╗██╔═══██╗██╔══██╗
 ██║     ██║   ██║██╔██╗ ██║██║  ██║██║   ██║██████╔╝
 ██║     ██║   ██║██║╚██╗██║██║  ██║██║   ██║██╔══██╗
 ╚██████╗╚██████╔╝██║ ╚████║██████╔╝╚██████╔╝██║  ██║
  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝
{Color.RESET}{Color.YELLOW}         Passive OSINT Framework — by villaalextor{Color.RESET}
{Color.WHITE}  ─────────────────────────────────────────────────{Color.RESET}
"""

# ─────────────────────────────────────────────
#  Módulos disponibles
#  Cada entrada: nombre_clave → (función_importar, descripción)
#  La función se importa solo si el módulo es requerido
# ─────────────────────────────────────────────
AVAILABLE_MODULES = {
    "dns":     "Registros DNS  (A, MX, NS, TXT, CNAME)",
    "whois":   "WHOIS          (registrante, fechas, nameservers)",
    "crt":     "crt.sh         (subdominios via Certificate Transparency)",
    "censys":  "Censys.io API  (puertos abiertos, servicios, TLS) [requiere API key]",
    "shodan":  "Shodan API     (banners, tecnologías expuestas)   [requiere API key]",
    "wayback": "Wayback Machine (URLs históricas del dominio)",
    "hunter":  "Hunter.io API  (emails corporativos filtrados)    [requiere API key]",
}
# Módulos sin API key que se ejecutan por defecto
DEFAULT_MODULES = ["dns", "whois", "crt", "wayback"]  

# ─────────────────────────────────────────────
#  Configuración de logging
# ─────────────────────────────────────────────
def setup_logging(verbose: bool, log_file: str | None) -> logging.Logger:
    logger = logging.getLogger("condor")
    level = logging.DEBUG if verbose else logging.INFO
    logger.setLevel(level)

    formatter = logging.Formatter(
        fmt="[%(asctime)s] %(levelname)-8s %(message)s",
        datefmt="%H:%M:%S"
    )

    # Handler consola
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    console.setFormatter(formatter)
    logger.addHandler(console)

    # Handler archivo (opcional)
    if log_file:
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger


# ─────────────────────────────────────────────
#  Parser de argumentos
# ─────────────────────────────────────────────
def build_parser() -> argparse.ArgumentParser:
    """
    Define todos los argumentos que acepta condor.py.
    argparse puede generar automáticamente --help con las siguientes descripciones.
    Cada argumento tiene:
      - flags        : --target, -t  (la forma corta es opcional)
      - type         : str, int, etc.
      - default      : valor si no se especifica
      - help         : descripción para --help
      - required     : si es obligatorio
    """
    parser = argparse.ArgumentParser(
        prog="condor",
        description=(
            "Cóndor Framework — Pipeline de reconocimiento pasivo OSINT.\n"
            "Consulta múltiples fuentes públicas sin generar tráfico directo al objetivo."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "EJEMPLOS:\n"
            "  python condor.py --target ejemplo.bo\n"
            "  python condor.py --target ejemplo.bo --modules dns,whois,crt\n"
            "  python condor.py --target ejemplo.bo --format html -o reporte.html\n"
            "  python condor.py --target ejemplo.bo --verbose --log scan.log\n"
            "  python condor.py --list-modules\n"
        )
    )

    # ── Argumento principal ──────────────────
    parser.add_argument(
        "--target", "-t",
        type=str,
        required=False,          # No required porque --list-modules no necesita target
        metavar="DOMINIO",
        help="Dominio objetivo del reconocimiento. Ej: ejemplo.bo"
    )

    # ── Selección de módulos ─────────────────
    parser.add_argument(
        "--modules", "-m",
        type=str,
        default=",".join(DEFAULT_MODULES),
        metavar="MOD1,MOD2,...",
        help=(
            f"Módulos a ejecutar, separados por coma. "
            f"Default: {','.join(DEFAULT_MODULES)}. "
            f"Disponibles: {','.join(AVAILABLE_MODULES.keys())}"
        )
    )

    parser.add_argument(
        "--all-modules",
        action="store_true",
        help="Ejecutar TODOS los módulos disponibles (requiere todas las API keys)"
    )

    # ── Formato de output ────────────────────
    parser.add_argument(
        "--format", "-f",
        type=str,
        choices=["json", "html"],
        default="json",
        help="Formato del output: 'json' (default) o 'html' (reporte standalone)"
    )

    parser.add_argument(
        "--output", "-o",
        type=str,
        default=None,
        metavar="ARCHIVO",
        help=(
            "Ruta del archivo de salida. "
            "Si no se especifica, se genera automáticamente: "
            "<target>_<timestamp>.json/html"
        )
    )

    # ── Opciones de ejecución ────────────────
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Mostrar información detallada de cada paso (modo debug)"
    )

    parser.add_argument(
        "--log",
        type=str,
        default=None,
        metavar="ARCHIVO",
        help="Guardar log completo en archivo. Ej: --log condor.log"
    )

    parser.add_argument(
        "--timeout",
        type=int,
        default=10,
        metavar="SEGUNDOS",
        help="Timeout en segundos para cada consulta de red (default: 10)"
    )

    # ── Utilidades ───────────────────────────
    parser.add_argument(
        "--list-modules",
        action="store_true",
        help="Listar todos los módulos disponibles y salir"
    )

    parser.add_argument(
        "--version",
        action="version",
        version="Cóndor Framework v0.1.0"
    )

    return parser


# ─────────────────────────────────────────────
#  Validaciones
# ─────────────────────────────────────────────
def validate_target(target: str) -> str:
    """
    Limpia y valida el dominio objetivo.
    - Elimina http://, https://, www.
    - Verifica que tenga al menos un punto
    """
    # Limpiar prefijos de URL
    for prefix in ["https://", "http://", "www."]:
        if target.lower().startswith(prefix):
            target = target[len(prefix):]

    # Quitar trailing slash
    target = target.rstrip("/")

    # Validación básica
    if "." not in target:
        raise ValueError(f"Dominio inválido: '{target}'. Debe contener al menos un punto.")

    return target.lower()


def validate_modules(modules_str: str, all_modules: bool) -> list[str]:
    """
    Parsea el string de módulos y verifica que existan.
    Retorna lista de nombres de módulos válidos.
    """
    if all_modules:
        return list(AVAILABLE_MODULES.keys())

    selected = [m.strip().lower() for m in modules_str.split(",") if m.strip()]
    invalid = [m for m in selected if m not in AVAILABLE_MODULES]

    if invalid:
        raise ValueError(
            f"Módulos desconocidos: {', '.join(invalid)}. "
            f"Disponibles: {', '.join(AVAILABLE_MODULES.keys())}"
        )

    return selected


def resolve_output_path(output: str | None, target: str, fmt: str) -> str:
    """
    Si el usuario no especificó --output, genera un nombre automático:
      ejemplo_bo_20260606_143022.json
    """
    if output:
        return output

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_target = target.replace(".", "_").replace("-", "_")
    return f"{safe_target}_{timestamp}.{fmt}"


# ─────────────────────────────────────────────
#  Importación dinámica de módulos
# ─────────────────────────────────────────────
def load_module(name: str):
    """
    Importa el módulo de reconocimiento correspondiente.
    
    Cada módulo vive en modules/<name>_recon.py (o nombre equivalente)
    y debe exponer una función: run(target, timeout) → dict
    
    Se importa de forma dinámica para que un módulo faltante
    no rompa los demás.
    """
    module_map = {
        "dns":     "modules.dns_recon",
        "whois":   "modules.whois_lookup",
        "crt":     "modules.crt_sh",
        "censys":  "modules.censys_query",
        "shodan":  "modules.shodan_query",
        "wayback": "modules.wayback",
        "hunter":  "modules.hunter_lookup",
    }

    import importlib
    try:
        mod = importlib.import_module(module_map[name])
        return mod
    except ImportError as e:
        return None  # Se maneja en run_modules()


# ─────────────────────────────────────────────
#  Orquestador principal
# ─────────────────────────────────────────────
def run_modules(target: str, modules: list[str], timeout: int, logger: logging.Logger) -> dict:
    """
    Ejecuta cada módulo seleccionado y agrega los resultados
    en un diccionario estructurado.

    Estructura del resultado:
    {
        "meta": { target, timestamp, modules_run, duration },
        "results": {
            "dns":   { ...datos del módulo dns... },
            "whois": { ...datos del módulo whois... },
            ...
        },
        "errors": { "modulo": "mensaje de error" }
    }
    """
    start_time = datetime.now()

    report = {
        "meta": {
            "target":      target,
            "timestamp":   start_time.isoformat(),
            "modules_run": modules,
            "tool":        "Cóndor Framework v0.1.0",
            "author":      "villaalextor",
        },
        "results": {},
        "errors":  {}
    }

    total = len(modules)
    for idx, module_name in enumerate(modules, start=1):
        prefix = f"[{idx}/{total}]"

        logger.info(f"{prefix} Ejecutando módulo: {module_name.upper()}")

        mod = load_module(module_name)

        if mod is None:
            msg = f"No se pudo cargar el módulo '{module_name}'. ¿Está implementado?"
            logger.warning(f"{prefix} ⚠ {msg}")
            report["errors"][module_name] = msg
            # Guardamos placeholder para que el JSON sea consistente
            report["results"][module_name] = {"status": "not_implemented"}
            continue

        try:
            data = mod.run(target=target, timeout=timeout)
            report["results"][module_name] = data
            count = len(data) if isinstance(data, (list, dict)) else "—"
            logger.info(f"{prefix} ✓ {module_name.upper()} completado ({count} registros)")

        except Exception as e:
            msg = str(e)
            logger.error(f"{prefix} ✗ Error en {module_name}: {msg}")
            report["errors"][module_name] = msg
            report["results"][module_name] = {"status": "error", "message": msg}

    # Duración total
    duration = (datetime.now() - start_time).total_seconds()
    report["meta"]["duration_seconds"] = round(duration, 2)

    return report


# ─────────────────────────────────────────────
#  Output
# ─────────────────────────────────────────────
def write_json(report: dict, path: str, logger: logging.Logger):
    """Serializa el reporte a JSON con indentación legible."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)
    logger.info(f"Output JSON guardado en: {path}")


def write_html(report: dict, path: str, logger: logging.Logger):
    """
    Genera un HTML standalone básico con el reporte.
    (Versión completa con Jinja2 template se implementa en sprint 2)
    """
    target   = report["meta"]["target"]
    ts       = report["meta"]["timestamp"]
    duration = report["meta"].get("duration_seconds", "—")
    modules  = report["meta"]["modules_run"]

    # Serializar resultados como JSON embebido en el HTML
    results_json = json.dumps(report["results"], indent=2, ensure_ascii=False, default=str)

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cóndor Report — {target}</title>
  <style>
    body      {{ font-family: 'Courier New', monospace; background: #0d1117; color: #c9d1d9; margin: 40px; }}
    h1        {{ color: #58a6ff; }}
    h2        {{ color: #79c0ff; border-bottom: 1px solid #30363d; padding-bottom: 6px; }}
    .meta     {{ background: #161b22; padding: 16px; border-radius: 6px; margin-bottom: 24px; }}
    .badge    {{ display: inline-block; background: #238636; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin: 2px; }}
    pre       {{ background: #161b22; padding: 16px; border-radius: 6px; overflow-x: auto; font-size: 13px; line-height: 1.5; }}
    .error    {{ color: #f85149; }}
    footer    {{ margin-top: 40px; color: #6e7681; font-size: 12px; }}
  </style>
</head>
<body>
  <h1>🦅 Cóndor Framework — Reporte OSINT</h1>

  <div class="meta">
    <strong>Target:</strong> {target}<br>
    <strong>Timestamp:</strong> {ts}<br>
    <strong>Duración:</strong> {duration}s<br>
    <strong>Módulos:</strong> {"".join(f'<span class="badge">{m}</span>' for m in modules)}
  </div>

  <h2>Resultados</h2>
  <pre>{results_json}</pre>

  {"<h2>Errores</h2><pre class='error'>" + json.dumps(report['errors'], indent=2) + "</pre>" if report["errors"] else ""}

  <footer>
    Generado por Cóndor Framework v0.1.0 · github.com/villaalextor/condor-framework
  </footer>
</body>
</html>"""

    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    logger.info(f"Output HTML guardado en: {path}")


# ─────────────────────────────────────────────
#  Utilidades de display
# ─────────────────────────────────────────────
def print_summary(report: dict):
    """Imprime un resumen en consola al finalizar."""
    meta    = report["meta"]
    errors  = report["errors"]
    results = report["results"]

    print(f"\n{c('═' * 52, Color.CYAN)}")
    print(f"{c('  RESUMEN DEL ESCANEO', Color.BOLD + Color.WHITE)}")
    print(f"{c('═' * 52, Color.CYAN)}")
    print(f"  Target   : {c(meta['target'], Color.YELLOW)}")
    print(f"  Duración : {meta.get('duration_seconds', '—')}s")
    print(f"  Módulos  : {len(meta['modules_run'])}")
    print(f"  Errores  : {c(str(len(errors)), Color.RED if errors else Color.GREEN)}")
    print()

    for mod_name, data in results.items():
        status = data.get("status", "ok") if isinstance(data, dict) else "ok"
        icon   = c("✓", Color.GREEN) if status not in ("error", "not_implemented") else c("✗", Color.RED)
        print(f"  {icon} {mod_name.upper()}")

    print(f"{c('═' * 52, Color.CYAN)}\n")


def list_modules():
    """Imprime la tabla de módulos disponibles."""
    print(f"\n{c('Módulos disponibles en Cóndor Framework:', Color.BOLD + Color.WHITE)}\n")
    for name, desc in AVAILABLE_MODULES.items():
        marker = c("●", Color.CYAN)
        default_marker = c(" [default]", Color.GREEN) if name in DEFAULT_MODULES else ""
        print(f"  {marker} {c(name.ljust(8), Color.YELLOW)}  {desc}{default_marker}")
    print()


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def main():
    print(BANNER)

    parser = build_parser()
    args   = parser.parse_args()

    # ── Comando especial: listar módulos ─────
    if args.list_modules:
        list_modules()
        sys.exit(0)

    # ── Validar que --target esté presente ───
    if not args.target:
        parser.error("Se requiere --target DOMINIO (o usa --list-modules para ver opciones)")

    # ── Setup logging ────────────────────────
    logger = setup_logging(verbose=args.verbose, log_file=args.log)

    # ── Validaciones ─────────────────────────
    try:
        target  = validate_target(args.target)
        modules = validate_modules(args.modules, args.all_modules)
        outpath = resolve_output_path(args.output, target, args.format)
    except ValueError as e:
        logger.error(str(e))
        sys.exit(1)

    # ── Info pre-escaneo ─────────────────────
    logger.info(f"Target    : {target}")
    logger.info(f"Módulos   : {', '.join(modules)}")
    logger.info(f"Output    : {outpath} ({args.format})")
    logger.info(f"Timeout   : {args.timeout}s por consulta")
    print()

    # ── Ejecutar módulos ─────────────────────
    report = run_modules(
        target  = target,
        modules = modules,
        timeout = args.timeout,
        logger  = logger
    )

    # ── Escribir output ──────────────────────
    if args.format == "json":
        write_json(report, outpath, logger)
    elif args.format == "html":
        write_html(report, outpath, logger)

    # ── Resumen final ────────────────────────
    print_summary(report)


if __name__ == "__main__":
    main()