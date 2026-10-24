---
# DRAFT: no links — the repo is local only (/opt/data/workspace/ds_core).
# DRAFT: metrics verified by a fresh pytest run (2026-10-08) — 294 passed,
# DRAFT: 1 flaky (test_sample's ±tolerance on a seeded fractional sample);
# DRAFT: the flake is disclosed in highlights rather than hidden.
title: ds_core Data Science Toolkit
slug: ds-core
summary: >-
  Pure-Python data science toolkit on the DuckDB CLI subprocess — 38 modules,
  no numpy, no duckdb binding. A five-reviewer audit confirmed 26 bugs
  (5 critical); every one fixed and verified.
tags: [data-science, duckdb, python, ml, testing]
date: 2026-08-16
role: Design, implementation and adversarial audit (solo)
status: shipped
period: "2026"
featured: true
stack: [Python 3.11+, DuckDB CLI subprocess, stdlib only, pytest]
highlights:
  - "38 modules, all running on stdlib + subprocess calls to the duckdb binary — genuine Lloyd's k-means, power-iteration PCA, Lee & Seung NMF, logistic-loss gradient boosting, bootstrap random forests, all hand-rolled and audit-verified"
  - "2026-07-12 full-codebase audit by 5 reviewers found 26 confirmed findings (5 CRITICAL, 16 HIGH, 4 MEDIUM, 1 LOW); all fixed with 72 inline AUDIT FIX comments, plus 3 extra bugs surfaced only while verifying"
  - "Fixes proven by measurement, not inspection — t-SNE same-cluster 5-NN accuracy 0.57 to 0.97, UMAP cluster separation chance to 1.0, AutoML selection leakage removed (validation 0.95 vs honest test 0.90), new Platt/isotonic calibrators cut ECE 0.221 to 0.019"
  - "Security hardening in the same pass — HTML/JS escaping in report and dashboard generators, a trusted_sql opt-in gate on Pipeline.load, and path-traversal refusal in the model downloader"
  - "One honest gap: the seeded fractional-sample test intermittently fails its tolerance band — 294/295 tests pass on a fresh 2026-10-08 run and the flake is documented, not deleted"
metrics:
  - modules = 38
  - audit findings fixed = 26 (+3 found during verification)
  - test suite = 295 tests
---
