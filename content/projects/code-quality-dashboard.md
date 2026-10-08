---
# DRAFT: no links — the repo is local only (/opt/data/workspace/projects/
# DRAFT: code-quality-dashboard). date = last substantive commit (2026-08-04);
# DRAFT: test count verified by a fresh pytest run on 2026-10-08 (26 passed).
title: Code Quality Metrics MCP
slug: code-quality-dashboard
summary: >-
  FastMCP server computing AST-based Python code-quality metrics with only the
  stdlib ast module — line classification, cyclomatic complexity per function,
  import inventory and static detection of bare excepts, print calls and
  oversized parameter lists, exposed as four scan/query/compare/alert tools.
  Its own scanner flagged its own code, and the findings were fixed.
tags: [mcp, python, static-analysis, developer-tools, testing]
date: 2026-08-04
role: Design and implementation (solo)
status: shipped
period: "2026"
featured: false
stack: [Python 3.13, stdlib ast, mcp SDK (FastMCP), pytest]
highlights:
  - "Cyclomatic complexity straight from the AST — branch points counted for If, IfExp, For, While, ExceptHandler, With, Assert plus BoolOp AND/OR chains"
  - "Three anti-pattern detectors (bare except, print instead of logging, functions over 5 params) turned into file- and function-level alerts with warning/error severities at configurable thresholds (default complexity 10, LOC 500)"
  - "Four MCP tools — scan a directory, query files by complexity/LOC ranges, compare two directories, list threshold breaches; the recursive scanner skips venv, __pycache__ and node_modules"
  - "Dogfooding closed the loop — its own scan flagged print statements and bare excepts in this codebase, and a follow-up commit replaced them with logging on 2026-08-04"
  - "Complexity of the scanner itself was refactored down (72 to 66 total, alert logic 9 to 7) under test coverage"
metrics:
  - MCP tools = 4
  - tests = 26 passed (verified 2026-10-08)
  - detectors = 3 anti-patterns
---
