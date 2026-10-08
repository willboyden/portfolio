---
# DRAFT-REVIEW: human review before publishing. Every number below traces to
# /opt/data/workspace/duckdb-mcp (wiki/index.md: 9 best practices + benchmark
# suite). Dates and hardware context to be confirmed by the author.
title: DuckDB is the analytics database your agent workflows needed
slug: duckdb-for-agent-workflows
summary: >-
  What a 14-benchmark suite says about wiring agents to DuckDB: 100K inserts
  in 27 ms, cross-database joins in 8 ms, Parquet at a quarter of CSV's size
  — and the DDL shapes that fail loudly when you least expect it.
tags: [duckdb, analytics, agents, python, performance]
date: 2026-09-15
series: AI engineering notes
---

When you build tools that let an LLM agent query data, the database choice
stops being an architecture-slide decision and becomes a *failure-mode*
decision: what happens when the model does something reasonable-sounding but
slow, or generates DDL that quietly does not work. I benchmarked that question
the slow way — a 14-benchmark suite behind the duckdb-mcp server, measuring
everything from DDL speed to MCP round-trip overhead. The numbers argued for
DuckDB, and the gotchas were worth the exercise by themselves.

## The numbers that changed my defaults

All figures below come from the project's benchmark suite (`test_benchmarks.py`
and the integration tests that pin each practice), run against DuckDB CLI
v1.5.4. One machine: 8-core laptop, NVMe, DuckDB 1.5.4 (Variegata) defaults,
single run, warm cache. Treat the ratios as the finding and the absolutes as
indicative.

**Bulk insert: `generate_series`, never `INSERT VALUES`.** 100,000 users land
in 27 ms via a select-from-generate_series. Hand the same task to a model's
natural instinct — long `INSERT INTO ... VALUES (...), (...)` lists — and you
are paying parse costs per statement, and the practice guide's rule of thumb
is to stop generating them past a thousand rows anyway.

**Parquet as the ingest format, not CSV.** Parquet files came in around 27%
of the equivalent CSV size, and `read_parquet` queries the file zero-copy
without loading it into a database first. For agent pipelines this matters
twice: smaller files mean faster handoffs between pipeline stages and
cheaper multi-copy retention — files are what agents pass around, after all.

**Cross-database joins are instant.** Three attached databases of 100K rows
each joined in 8 ms. One caveat that cost me an hour: `ATTACH` needs a path
within reach of the session doing the attaching (attached `:memory:`
databases, for what it is worth, do join fine within a single v1.5.4
session), and every CLI invocation is a fresh session — so anything doing
cross-process cross-DB work still means temp files, which the server does
for you.

**Window functions scale flat-ish.** ROW_NUMBER, RANK, LAG/LEAD, running
sums and NTILE at 100K rows all landed in a uniform 6.9–7.5 ms band. The
kind of analysis an agent is most likely to be asked for is exactly what
columnar engines are boringly good at.

**JSON output is affordable.** The CLI's `-json` mode adds 9–15% overhead
versus plain text. For machine-readable tool responses, that is a tax worth
paying — but see the coercion post, because the JSON types need re-hydration.

## The failure you will only find at runtime

Here is the one the documentation under-sells: on DuckDB v1.5.4, `DEFAULT`,
`UNIQUE`, `CHECK` and `FOREIGN KEY` constraints all work fine.
`IDENTITY` fails with `Constraint not implemented!`. `SERIAL` fails earlier,
at parse time: v1.5.4 has no `SERIAL` type at all (`Catalog Error: Type with
name SERIAL does not exist!`). Any model
trained on Postgres-heavy corpora will generate `SERIAL PRIMARY KEY` on
demand, all day, and every one of those calls dies.

The fix belongs below the prompt, at the tool level:

```sql
CREATE SEQUENCE user_id_seq;
CREATE TABLE users (
  id BIGINT DEFAULT nextval('user_id_seq') PRIMARY KEY,
  email TEXT UNIQUE CHECK (email LIKE '%@%')
);
```

Auto-increment through `CREATE SEQUENCE` + `nextval()` works and keeps the
IDs in the database, where they belong — the practice notes are blunt about
it: *never generate IDs in Python, use DuckDB-native bulk patterns*. Because
the MCP server exposes schema creation through recipes that already use the
working pattern, the model never gets the chance to discover the failure at
3 a.m. on someone's pipeline.

## Why this matters for agents specifically

An agent workflow is an unpredictable query generator with a budget. Three
properties of DuckDB line up with that: it is a library-grade database that
needs no server to administer (an agent can be handed a file path and be
productive immediately), it is columnar and fast on exactly the analytical
shapes models tend to write, and its failure modes are loud exceptions
rather than silent plan degradations.

The benchmark suite is not an argument that DuckDB beats a warehouse for
everything — 500K rows is not big data. It is an argument that for the
agent-tooling niche — single-node files, sub-second interactive queries,
Parquet in the middle, JSON out the other side — the boring choice is the
database that lets your tools encode the three patterns that work
(`generate_series` bulk insert, `SEQUENCE` auto-increment, Parquet ingest)
and make the wrong ones impossible.
