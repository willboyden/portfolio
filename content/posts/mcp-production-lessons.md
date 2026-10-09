---
# DRAFT-REVIEW: human review before publishing. Facts trace to
# /opt/data/workspace/duckdb-mcp (src/ + wiki) and
# /opt/data/workspace/orchestrator (cli.py + wiki).
title: "MCP in production: what the spec doesn't tell you"
slug: mcp-production-lessons
summary: >-
  Field notes from shipping a 15-tool DuckDB MCP server and a six-server
  orchestrator: stdio lifecycle quirks, argument-length walls, JSON type
  erosion, return-shape chaos, and why direct imports beat JSON-RPC in-process.
tags: [mcp, agents, python, duckdb, architecture]
date: 2026-09-02
series: AI engineering notes
relatedProject: orchestrator
---

The MCP spec is short enough to read in an afternoon and vague enough to hide
about a week of debugging in every one of its "implementations MAY" clauses.
I shipped two projects that live on both sides of that vagueness: `duckdb-mcp`,
a stdio MCP server exposing 15 DuckDB tools, and `orchestrator`, a CLI that
composes six MCP servers in one process. Here is what the spec did not warn
me about.

## 1. FastMCP gets you a hello world; the low-level server is the job

`FastMCP` gets you a hello world in ten lines — then hides the three things
you need to control. The moment you need a tool
router, structured error semantics, or control over the JSON-RPC lifecycle,
you want the lower-level `mcp.server.stdio` API with an explicit `Server`
instance. The DuckDB server ends up as three pieces: a `TOOLS` list of
tool-definition objects with input schemas, a `HANDLERS` dict mapping tool
names to async functions, and a `call_tool` router that dispatches by name.
That separation costs you nothing and pays for itself the first time a tool
needs to return a structured error instead of crashing the connection.

## 2. You will hit the argument-length wall

My first instinct for running SQL through the DuckDB CLI was
`duckdb -c "SELECT ..."`. Multi-statement scripts, or anything with bulk
data, eventually dies on the OS argument-length limit. The pattern that
holds: write the SQL to a temp file and run `duckdb -f tmpfile.sql`. Same
for results: `-json` mode gives you structured output that you parse
yourself. Which leads to the next one.

## 3. JSON over stdio erodes your types

DuckDB's `-json` output stringifies more than you would guess, though not
uniformly: ints and bools come back as real JSON types, while
floats/decimals/dates are strings — `SELECT 42 AS i, 1.23::DECIMAL(18,2) AS d`
returns `{"i":42,"d":"1.23"}`. Older CLI versions stringified numbers
wholesale, so pin the version you test against. If you hand that straight to
a model, the model will learn
that `count` looks like `"42"` and start emitting comparisons against
strings. The server has a recursive `_coerce_types()` pass that walks parsed
JSON and converts strings back to `int`, `float`, `bool`, and `None`. Every
tool boundary where you serialize through the weakest format in the pipe
needs a re-hydration step on the way back. Nobody tells you this in the
protocol docs because the protocol has no types to lose — your data does.

## 4. Return shapes are folklore, not a standard

When the orchestrator imports six MCP server modules directly (more on that
below), I found their `call_tool` implementations do not agree on anything:
one returns a `tuple` of `(list_of_TextContent, dict)` where the useful
payload lives at index 1; the rest return a bare list of `TextContent` whose
`.text` is a JSON string. The dispatcher is 15 lines of shape-sniffing. The
spec describes what a wire response looks like, not what your in-process
handler function returns, so every server you import is a small archaeology
dig. Two more discoveries, filed under "why are these not in the README":
tool listing lives on the private `_tool_manager`, not the name you will
guess, so plan on reading the SDK source once; and server
modules with top-level imports must be imported *after* `sys.path` is set up.

## 5. In-process, skip the wire entirely

JSON-RPC over stdio exists to cross a process boundary. When the consumer is
your own Python CLI, that boundary is pure overhead — serialization,
subprocess lifecycle, an event loop per server. The orchestrator imports the
server modules directly and calls `asyncio.run(server.call_tool(name, kwargs))`.
That collapses "run a code-quality scan, log the findings as tasks, write a
wiki report, query the trend in DuckDB" from a distributed-systems problem
into one command. The stdio transport stays where it belongs: for external
clients like Claude Desktop or IDE integrations.

## 6. The server is where the lessons belong

duckdb-mcp's most useful feature isn't query execution. It's that
nine benchmark-proven practices are encoded in the tools themselves: bulk
insert via `generate_series` instead of `INSERT VALUES`, `CREATE SEQUENCE`
instead of broken `IDENTITY`/`SERIAL`, Parquet-first ingest. The server stops
the model from choosing the wrong pattern, which is worth more than any
prompt that says "please prefer bulk inserts". Treat your MCP server as the
place where operational knowledge becomes a tool constraint.

The spec covers the handshake. Everything above is the part you learn by
having the thing fail at 2 a.m., and all of it is now a unit test.
