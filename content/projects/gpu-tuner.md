---
# Facts from the public README and release v1.1.2 (2026-10-04),
# github.com/willboyden/gpu-tuner. Checked 2026-10-24.
title: GPU Tuner — power caps, fan curves and clock caps with a GUI
slug: gpu-tuner
summary: >-
  A local web page that shows every NVIDIA GPU live and changes the three
  settings that are safe on any card. It manages several machines over ssh,
  and each machine's root daemon enforces its own limits.
tags: [gpu, nvidia, python, security, linux, open-source]
date: 2026-10-04
role: Design and implementation
status: shipped
period: "Sep–Oct 2026"
featured: true
links:
  source: "https://github.com/willboyden/gpu-tuner"
stack: [Python (stdlib), NVML (pynvml), systemd (Type=notify + watchdog), Unix sockets with SO_PEERCRED, ssh, vanilla JS (strict CSP)]
highlights:
  - "Power limit, fan curve and core clock cap per card, plus a combined power budget per machine; going over the budget is a confirmed soft limit, never past the card's own hardware range"
  - "Every write is validated by a root daemon against a root-owned safety module, never by the page; the page runs as the desktop user and talks to the daemon over a Unix socket that checks the caller's uid"
  - "Fan safety floor rescaled per card from that card's own slowdown threshold (85 °C on the lab's RTX PRO 6000s); fans are handed back to the driver on exit, crash or watchdog kill"
  - "One page for several machines: a fleet strip plus a tab per machine, reached over ssh with the page's own key restricted to one command and one source address"
  - "Measured on four DGX Sparks: NVML exposes no power limit, fans or clock list there, so Sparks join as monitor-only nodes and the page says why"
  - "Deliberately not containerized: rootless Docker maps container root to the desktop user, verified to get \"Insufficient Permissions\" on power writes even with --privileged"
metrics:
  - knobs per card = 3 (power, fan, clock cap)
  - machines in the lab fleet = 6 (2 with controls, 4 Sparks monitor-only)
  - latest release = v1.1.2 (2026-10-04)
---

Two RTX PRO 6000s in one workstation need power caps and a fan curve that
survive reboots, driver resets and suspend. The lab first had
two systemd services with numbers baked in. GPU Tuner replaces them with a page
that shows what each card is doing and why its clock is limited, and lets you
change only what is safe, with the root daemon as the single authority.

## The safety model

- **Power:** each card's own NVML range, narrowed by a measured profile where
  one exists, then the machine's combined budget. Lowering is always allowed.
- **Fans:** any curve is evaluated as `max(requested, floor(temperature))`, with
  hysteresis (up at once, down only after 2 °C of cooling) and the floor
  re-asserted every 30 seconds.
- **Clocks:** a cap can only slow the card down.
- **Left out on purpose:** clock offsets, thermal targets and toggling ECC, MIG
  or compute mode — no range is known to be stable across arbitrary hardware.

The installer has a `--dry-run` that prints every privileged command, rolls
back on any failure, and `--uninstall` restores the services it replaced.
