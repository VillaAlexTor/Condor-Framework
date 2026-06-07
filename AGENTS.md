# AGENTS.md — Cóndor Framework

## Estado del repo

Monorepo en etapa temprana. Solo **`condor-cli/`** tiene código; `condor-dashboard` y `condor-report` existen únicamente en el diagrama de arquitectura del README.

## Entrypoint y ejecución

```bash
# Desde la raíz del repo o condor-cli/
python condor-cli/condor.py --target ejemplo.bo              # default: dns,whois,crt,wayback
python condor-cli/condor.py --target ej.bo --all-modules     # necesita todas las API keys
python condor-cli/condor.py --target ej.bo --format html -o report.html
python condor-cli/condor.py --list-modules
```

Versión: `--version` → v0.1.0

## Dependencias

No existe `requirements.txt`, `pyproject.toml` ni `setup.py`. Instalar manualmente:

```bash
pip install dnspython python-whois requests
```

## Aliases de módulos rotos

`crt` → apunta a `modules.crt_sh` (el archivo no existe; debería ser `modules/crt_sh.py` o redirigir a `dns_recon.crt_sh` dentro de `dns_recon.py`)
`hunter` → apunta a `modules.hunter_lookup` (debería ser `modules/metadata_hunter.py`)

Ambos fallan silenciosamente (se loguean como `not_implemented`, el escaneo continúa). Arreglar antes de confiar en estos módulos.

## API keys (variables de entorno, sin archivo .env)

| Módulo | Variable(s) de entorno |
|---|---|
| censys | `CENSYS_API_ID`, `CENSYS_API_SECRET` |
| shodan | `SHODAN_API_KEY` |
| hunter | `HUNTER_API_KEY` |

Módulos por defecto (sin API keys): dns, whois, crt, wayback.

## Contrato de módulos

Todo módulo en `condor-cli/modules/` expone `run(target, timeout)` que retorna un `dict`.

## Sin CI, sin tests, sin linter/typecheck

No hay archivos de test, workflows de CI, ni configuración de formateador/type checker. El repo tiene un único historial de commits.

## Git

El autor firma como `VillaAlexTor <153693343+VillaAlexTor@users.noreply.github.com>`. Remote: solo `origin/main`.
