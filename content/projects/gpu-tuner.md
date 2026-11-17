---
# Facts from the public README and the release notes of v1.2.0 to v1.4.0 (latest: v1.4.0, 2026-11-05),
# github.com/willboyden/gpu-tuner. Checked 2026-11-16.
title: GPU Tuner — power caps, fan curves and clock caps with a GUI
slug: gpu-tuner
summary: >-
  A local web page that shows every NVIDIA GPU live and changes the three
  settings that are safe on any card. It manages several machines over ssh,
  each machine's root daemon enforces its own limits, and a demo mode runs the
  real page over simulated machines with no GPU at all.
tags: [gpu, nvidia, python, security, linux, open-source]
date: 2026-10-04
role: Design and implementation
status: shipped
period: "Sep–Nov 2026"
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
  - "SoC temperature on system-on-chip GPUs since 1.3.0: on a GB10 the page shows the package's temperature beside the GPU die's; on three Sparks under load it averaged 11 to 14 °C above the die and reached 24 °C above it"
  - "Demo mode since 1.2.0: the real page over three simulated machines, every change still passing the daemon's checks, with NVML, ssh and any real daemon never touched"
  - "Help where the settings are since 1.4.0: Getting started, a searchable FAQ, an (i) explanation on every control, and a builder that drafts, checks and exports the two config files, which the page itself never writes"
  - "Deliberately not containerized: rootless Docker maps container root to the desktop user, verified to get \"Insufficient Permissions\" on power writes even with --privileged"
metrics:
  - knobs per card = 3 (power, fan, clock cap)
  - machines in the lab fleet = 6 (2 with controls, 4 Sparks monitor-only)
  - offline tests = 75 unit, 38 multi-machine and 18 demo-mode, plus a help and config-builder suite
  - latest release = v1.4.0 (2026-11-05)
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

## What 1.2 to 1.4 added

**Demo mode (1.2.0).** `gpu-tuner serve --demo` serves the real page over three
simulated machines: a workstation with two RTX PRO 6000s, a render box with an
RTX 5090 and a monitor-only GB10 box. Readings move like training, inference
and rendering jobs, and every change goes through the same daemon checks as on
real hardware before it lands on a simulated card. It never touches NVML, ssh
or a real daemon, so the page can be tried without a GPU. The README's
screenshots are taken in it.

**SoC temperature (1.3.0).** On a GPU that is part of a system-on-chip, such as
the GB10 in a DGX Spark, the page shows the package's temperature next to the
GPU die's: a tile, a dotted line on the temperature chart and a second number
in the machines table. On three Sparks under load it averaged 11 to 14 °C above
the die and reached 24 °C above it, so on a Spark it is the number to watch.
Since 1.3.1 a fanless card no longer shows an empty Fan tile.

**Help and a config builder (1.4.0).** A Help panel with Getting started and a
searchable FAQ, an (i) explanation on every control, and a builder that drafts,
checks and exports the two config files with the loaders' own rules. The page
still never writes either file: it shows the commands to install a drafted
one. Two independent audits reviewed the change before release.
