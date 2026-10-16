---
# DRAFT: no links — the source repo is local only (/opt/data/workspace/portfolio/crucible).
title: Crucible — WASM Training-Data Refinery
slug: crucible
summary: >-
  Security-first multimodal training-data refinery that treats every inbound
  byte as hostile: content is inspected exclusively inside import-free
  WebAssembly kernels (wasmtime), never on the host. Deterministic
  CLEAN/QUARANTINE/REJECT verdicts, a sha256-chained tamper-evident audit log,
  a sha-addressed content store, and a real cross-language kernel story —
  Rust compiled std-only to wasm32 under a blocked crates.io, hand-written WAT
  for simple kernels, and runtime parity gates across wasmtime and Node.
tags: [security, webassembly, rust, python, supply-chain, data-pipelines]
date: 2026-10-16
role: Design and implementation (solo)
status: shipped
period: "2026-10"
featured: false
stack: [Python 3.13 stdlib, wasmtime 49, Rust std-only → wasm32-unknown-unknown, hand-written WAT, wasmtime Node runtime]
highlights:
  - "Hostile-content-first architecture: parsers are WASM kernels with zero imports (no fs/net/clock/WASI), so a kernel bug cannot exfiltrate or escape — OOB access traps inside wasmtime — and the host never interprets untrusted bytes (magic_fmt, zip_inspect, media_meta, entropy all run in-kernel)"
  - "Deterministic verdicts with fail-closed policy: same bytes always produce the same verdict, unknown rules fall closed to QUARANTINE, and every decision lands in a hash-chained audit log — hash = sha256(prev_hash + canonical(entry)), HMAC-SHA256 keyed when key material is present, with key rotation joining the chain and multi-key per-segment verification"
  - "Blocked-sandbox engineering workaround: crates.io and static.rust-lang.org were 403 from the sandbox, so the Rust tier was built on the host (Rust 1.99.0 + wasm32-unknown-unknown std target) with a strict std-only design — zero crates.io deps, in-repo std-only SHA-256, chain verifier, and canonical JSON (a custom panic handler conflicts with std's wasm build, error E0152)"
  - "Three kernel tiers by fit: Rust (one module, same ABI, 30,371-byte crucible_wasm.wasm, 18/18 host tests green incl. golden parity), hand-written WAT for simple kernels (crc32 and xorsum, 15/15 pytest plus 7/7 Node runtime-parity checks, WAT magic_fmt smoke 11/11), and Zig tier with a documented miscompile workaround (ziglang 0.17's std.mem.eql wasm32 backend miscompares runtime-derived slices — kernels use explicit byte-wise compares)"
  - "The whole refinery is operator-friendly and fail-closed end to end: crucible.cli ships store/clean/train/quarantine/audit-key/check commands, quarantined items require an explicit reviewer promote/deny appended to the same chain, dataset manifests bind training bytes to the audit log with sha-bound, path-contained, TOCTOU-guarded verification, and one-shot crucible check chains posture verdicts (exit 0 ok / 3 spike / 2 fail)"
metrics:
  - rust kernel tests = 18/18 green (10 kernels, 6 core, 2 golden parity)
  - rust wasm binary = 30,371 bytes, zero crates.io dependencies
  - wat kernel parity = 15/15 pytest + 7/7 node + 11/11 smoke
---
