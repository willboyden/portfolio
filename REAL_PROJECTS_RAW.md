##### PROJECT: gov-payroll-workbench
# gov-payroll workbench

Analytics pipeline over the `gov_payroll` ClickHouse database (23 tables,
~279M rows) in the local-ai-lab sandbox. Three stages:

```
ch_client.py  →  probe.py  →  build_dashboard.py
  (query layer)   (14 datasets)   (dashboard/index.html)
```

Everything is Python 3.13 stdlib — no pip, no network egress except the
read-only ClickHouse MCP server, no CDN. The dashboard is a single self-contained
`dashboard/index.html` (dark, terminal-friendly) with real figures embedded.

## Quick start

```bash
cd /opt/data/workspace/gov-payroll-workbench
python3 probe.py            # refresh data/*.json (idempotent; ~14 queries, <2s total)
python3 build_dashboard.py  # regenerate dashboard/index.html from data/
python3 ch_client.py "SELECT count() AS c FROM gov_payroll.ma_state_payroll"
```

Open `dashboard/index.html` in any browser (file:// works — data is embedded).

## Query layer (`ch_client.py`)

The ClickHouse HTTP endpoint (`gov-payroll-clickhouse:8123`) is not directly
reachable from this sandbox. The only working path is the **clickhouse-mcp**
JSON-RPC server over HTTP + Server-Sent-Events at `http://clickhouse-mcp:8000/mcp`:

##### PROJECT: langfuse-dashboard
# Langfuse Observability Dashboard — `local-ai-lab`

A standalone, air-gapped observability dashboard for the Langfuse traces of
project **mesh** (org **local-ai-lab**). Two parts:

1. **`fetch_traces.py`** — a re-runnable data pipeline that pulls traces,
   observations, sessions and scores from Langfuse into local `data/*.json`,
   using the SDK client from `../langfuse_mcp/client.py` (the same code path
   the `langfuse` MCP server uses).
2. **`build_dashboard.py`** — builds **`index.html`**: a single-file,
   dark-theme, terminal-friendly dashboard (vanilla JS/CSS, **no CDN, no
   external assets**). The data is *embedded* as a JS `const`, because
   `file://` pages cannot `fetch()` sibling files in browsers.

## Finding: 0 traces at build time — broker whitelist blocks data-plane reads

Verified on **2026-08-16** (see `data/step1_verification.txt`):

| endpoint | result |
|---|---|
| `GET /api/public/health` | **OK** — `{'version': '3.200.0', 'status': 'OK'}` |
| `GET /api/public/projects` | **OK** — `lab-project` / `mesh` / `local-ai-lab` |
| `GET /api/public/traces` | **403** `path not allowed by hermes-local langfuse ingestion broker` |
| `GET /api/public/v2/observations` | **403** (same) |
| `GET /api/public/sessions` | **403** (same) |
| `GET /api/public/scores` | **403** (same) |

The hermes-local ingestion broker whitelists only a few public API paths. The
SDK's read calls hit exactly those blocked paths, so **the pipeline found 0
traces / 0 observations / 0 sessions / 0 scores at build time**. No data was

##### PROJECT: model-quality-harness
# Model Quality Harness

Deterministic tool-calling reliability benchmark for local LLMs served behind an
OpenAI-compatible LiteLLM broker. Runs a fixed scenario suite, simulates tool
execution, scores each (model, scenario) run rule-by-rule, and renders a
standalone HTML dashboard from the real results JSON.

**Python 3.13 stdlib only. No pip, no network egress except the broker.**

---

## Layout

```
model-quality-harness/
├── scenarios/                  8 JSON scenario files (the fixed suite)
├── harness/
│   ├── run.py                  driver: models × scenarios × reps, HTTP, transcripts
│   ├── judge.py                tool simulation + deterministic scoring (no LLM judge)
│   ├── results.py              record types, persistence, summaries
│   └── render_dashboard.py     results JSON → dashboard/index.html
├── results/                    results-YYYYMMDD-HHMMSS.json (one per run)
├── dashboard/index.html        generated, standalone (vanilla JS/CSS, no CDN)
└── README.md
```

## How to re-run

```bash
cd /opt/data/workspace/model-quality-harness

##### PROJECT: pcie-m2-monitor
# pcie-m2-monitor

PCIe & M.2 (NVMe/SATA) performance + thermals monitor for this machine.
Stdlib only, read-only against the kernel. Built 2026-09-03 after new M.2
drives + PCIe devices were added to the system.

## What it reads

| Source | What |
|---|---|
| `/sys/class/nvme/*` | model, serial, firmware, state, BDF |
| `/sys/class/hwmon/*` | drive temperatures (mapped to the right NVMe controller via the chip's `device` symlink), system temps (chipset/CPU/NIC) |
| `/sys/bus/pci/devices/*` | full PCIe topology, **negotiated vs max link speed/width** (degraded-link detection), AER error counters |
| `/sys/block/*` | device sizes |
| `/proc/diskstats` | cumulative I/O counters → rates (MB/s, IOPS, latency) between samples |

## Commands

```sh
cd /opt/data/workspace/pcie-m2-monitor

# one JSON snapshot (all drives, links, temps, I/O)
python3 collector.py

# multi-sample capture with a real dd read/write workload (default: 15 x 2s)
python3 collector.py --demo --samples 15 --interval 2
# -> data/samples.jsonl

# regenerate the self-contained HTML dashboard from the capture
python3 make_dashboard.py            # -> data/dashboard.html

##### PROJECT: portfolio
# Portfolio Pipeline

Hermes-driven project factory. Every project here follows one lifecycle,
hits one quality bar, and ends up in the LLM wiki. See the standing
instruction in the `portfolio-pipeline` skill and your persistent memory.

## Lifecycle (six states)

```
IDEA -> PLANNED -> BUILDING -> REVIEWED -> SHIPPED -> ARCHIVED
        ^            |           |
        +-- improve --+------- review (iterate until bar met)
```

- **IDEA** — a scored entry in `BACKLOG.md` (brainstorm skill).
- **PLANNED** — has `PLAN.md` + scaffolded repo (plan skill).
- **BUILDING** — subagents dispatched per plan; orchestrator verifies
  deliverables (delegation-orchestration skill).
- **REVIEWED** — review pass done; `REVIEW.md` records score + findings.
  Not yet the bar? Back to BUILDING with a remediation list.
- **SHIPPED** — quality bar met, docs complete, wiki page + index entry
  written, `CHANGELOG.md` notes status.
- **ARCHIVED** — superseded or no longer maintained (keep the repo).

## Quality bar (enterprise-grade, interview-proof)

A project is SHIPPED only when ALL of these hold (the `portfolio-review`
skill enforces each; the optional hook plugin gates on them automatically):

1. **Runs** — entry point works from a clean checkout; `Makefile` (or

##### PROJECT: scripts
# session_context.py

Search past Hermes sessions for a project or topic, returning **bookend
summaries** (first 3 + last 3 user/assistant messages) so you can quickly
understand the context of prior work and avoid repeating it.

The script queries the Hermes session SQLite database (`state.db`) directly
using FTS5 full-text search — no API calls, no LLM, no network. It runs in
seconds against 24,000+ messages.

## Requirements

- Python 3.8+ (standard library only — `sqlite3`, `argparse`, `textwrap`,
  `json`, `datetime`; no pip installs needed)
- Read access to the Hermes `state.db` SQLite database

## Installation

```bash
# The script lives in the workspace scripts directory
cp /opt/data/workspace/scripts/session_context.py ~/.local/bin/  # optional, for global use
chmod +x /opt/data/workspace/scripts/session_context.py
```

## Finding the database

The script auto-detects `state.db` from these locations, in order:

1. `--db` argument (explicit override)
2. `$HERMES_STATE_DB` environment variable

##### PROJECT: wiki-growth
# wiki-growth

Deterministic **session → wiki** knowledge pipeline. It scans a Hermes
session SQLite database, extracts *hard-won* findings (user corrections,
verified error→fix arcs, durable-fact statements, memory-tool writes),
clusters them, dedupes them against the existing wiki, and **proposes** new
wiki pages.

Rule-based only. **No LLM calls, no network, stdlib only.**

## What it does

1. **Extract** — walks `messages` (via FTS5 when available, else raw scan)
   and flags candidate sentences by signal:
   - `correction` — "no, it's…", "wrong", "stop doing", "you should"…
   - `durable`    — "note", "pitfall", "always", "verified", "takeaway"…
   - `error`      — Tracebacks, `ModuleNotFoundError`, "command not found"…
   - `fix`        — "fixed", "works now", "all passing"… (paired with a prior error)
   - `memory`     — `write_memory` / `MEMORY.md` tool calls
2. **Cluster** — groups candidates that share significant tokens
   (2 within a session, 4 across sessions).
3. **Quality gate** — a cluster survives only if it spans ≥2 independent
   sessions *or* carries a real user correction *or* a verified fix.
   Otherwise it's rejected with reason `quality_gate`.
4. **Dedupe** — each survivor is compared against every existing wiki page;
   ≥4 shared tokens and ≥0.35 overlap ratio → rejected as `duplicate`.
5. **Render** — writes proposed pages + a machine-readable report.

Confidence is `high` when a finding spans ≥2 sessions or is a verified fix,
else `medium`. All output is secret-redacted.

##### PROJECT: code-reviewer
# code-reviewer

Automated code review CLI that orchestrates MCP servers
(code-quality-dashboard `metrics_mcp`, mini-task-manager `tasks_mcp`,
wiki-search `wiki_mcp`): scans a project, raises threshold alerts,
generates a text or JSON report, files a follow-up task, and logs the
report to the wiki.

## Usage

```
python3 review.py <path> [options]

options:
  --complexity N   complexity threshold (default: 10)
  --loc N          LOC threshold (default: 500)
  --no-task        skip task creation
  --no-wiki        skip wiki save
  --json           output JSON instead of the text report
```

By default a review also creates a task via the tasks MCP server and
saves the report to the wiki. Use `--no-task` / `--no-wiki` to skip
either side effect.

## Running the tests

The suite in `tests/` is fully **hermetic**: it never contacts the LLM
broker, the network, real MCP servers, `taskmanager/tasks.db`, or
`/opt/data/kanban.db`.

##### PROJECT: static-site-gen
# static-site-gen

MCP server for building static HTML sites from Markdown (see `site_mcp.py`,
docs in `wiki/index.md`), plus an SEO audit MCP server for the generated
output (`seo_mcp.py`).

## SEO audit server (`seo_mcp.py`)

Stdlib-only HTML analysis (`html.parser`) over any directory of `*.html`
pages. The only third-party import is the `mcp` SDK, same preamble pattern
as `site_mcp.py`.

### MCP tools

| Tool | Returns |
|------|---------|
| `seo_audit(directory)` | Per-page findings: missing/duplicate `<title>`, oversized titles (>160 chars), duplicate title text across pages, missing `<meta name="description">`, `<img>` without `alt`, missing/multiple `<h1>`, external `<a>` without `rel`. Findings carry `severity`: `blocking` (missing title) or `warning`. |
| `seo_suggestions(directory)` | Ranked fix list — blocking first, then by occurrence count — each with a canonical fix hint and affected files. |
| `seo_metrics(directory)` | Page count, avg title/description length, `alt_coverage_pct`, blocking/warning counts. |

### CLI mode

```bash
python3 seo_mcp.py --audit <dir>   # print JSON report; exit 2 if BLOCKING findings, else 0
python3 seo_mcp.py                 # run the MCP server over stdio
```

### Tests

`tests/test_seo_mcp.py` (27 tests) builds HTML fixtures in `tmp_path`; the

##### PROJECT: system-monitor
# system-monitor

Local system monitoring via MCP. Pure-stdlib `/proc` readers behind
[`mcp.server.fastmcp`](https://pypi.org/project/mcp/) FastMCP servers.

## Servers

| File | Purpose |
|------|---------|
| `sysquery_mcp.py` | Query tools: CPU, memory, disk, network, processes, uptime, health, snapshot |
| `alert_mcp.py` | Threshold alerting: user-defined rules evaluated against live `/proc` readings |
| `dashboard_mcp.py` | Unified FastAPI web dashboard over sysquery + alerts + tasks (not an MCP server) |

## Querying (sysquery_mcp.py)

FastMCP server exposing **8 tools**. All readings are pure-stdlib `/proc`
and `statvfs` reads; byte values are exact integers, percentages are
2-decimal floats.

| Tool | Args | Returns |
|------|------|---------|
| `sys_query_cpu(interval=1)` | sampling window in seconds | `usage_percent` (two-sample `/proc/stat` delta, idle incl. iowait), `load_average` {1m,5m,15m}, `cpu_count`, `sampling_interval` |
| `sys_query_memory()` | — | `total`/`used`/`available`/`free`/`buffers`/`cached` bytes (`used = total - MemAvailable`), `usage_percent`, `swap_total`/`swap_free`/`swap_used` |
| `sys_query_disk()` | — | `filesystem`, `total`/`used`/`free` bytes and `usage_percent` for `/` via `os.statvfs` |
| `sys_query_network()` | — | `interfaces`: per-interface `rx_bytes/packets/errors/dropped` and `tx_*` from `/proc/net/dev` (empty dict if unreadable) |
| `sys_query_processes(limit=50)` | max entries | `processes`: `{pid, name, resident_bytes}` (RSS from `/proc/<pid>/statm`), `count` |
| `sys_uptime()` | — | `uptime_seconds`, `uptime_formatted` (`"1d 2h 3m 5s"`), `load_average` |
| `sys_health()` | — | Per-subsystem `checks` (cpu/memory/disk) with threshold verdicts `healthy`/`warning`/`error` and an overall `status`. CPU warns at 1m load >= 2x CPU count; memory and disk warn at >= 90% usage; `error` outranks `warning` |
| `sys_snapshot()` | — | Full snapshot: `cpu`, `memory`, `disk`, `network`, `processes` — each section degrades independently to `{"error": ...}` |


