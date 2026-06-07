# AGENTS.md — Cóndor Framework

## Repo state

Early-stage monorepo. Only **`condor-cli/`** has code; `condor-dashboard` and `condor-report` exist only in the README architecture diagram.

## Entrypoint & run

```bash
# From repo root or condor-cli/
python condor-cli/condor.py --target ejemplo.bo              # default: dns,whois,crt,wayback
python condor-cli/condor.py --target ej.bo --all-modules     # needs all API keys
python condor-cli/condor.py --target ej.bo --format html -o report.html
python condor-cli/condor.py --list-modules
```

Version: `--version` → v0.1.0

## Dependencies

No `requirements.txt`, `pyproject.toml`, or `setup.py` exists. Install manually:

```bash
pip install dnspython python-whois requests
```

## Broken module aliases

`crt` → maps to `modules.crt_sh` (file does not exist, should be `modules/crt_sh.py` or alias to `dns_recon.crt_sh` inside `dns_recon.py`)
`hunter` → maps to `modules.hunter_lookup` (should be `modules/metadata_hunter.py`)

Both fail gracefully (logged as `not_implemented`, scan continues). Fix before relying on these.

## API keys (env vars, no .env file)

| Module | Env var(s) |
|---|---|
| censys | `CENSYS_API_ID`, `CENSYS_API_SECRET` |
| shodan | `SHODAN_API_KEY` |
| hunter | `HUNTER_API_KEY` |

Default modules (no keys): dns, whois, crt, wayback.

## Module contract

Every module in `condor-cli/modules/` exposes `run(target, timeout)` returning a dict.

## No CI, no tests, no lint/typecheck

No test files, no CI workflows, no formatter or type checker config. The repo has a single commit history.

## Git

Author commits as `VillaAlexTor <153693343+VillaAlexTor@users.noreply.github.com>`. Remote: `origin/main` only.
