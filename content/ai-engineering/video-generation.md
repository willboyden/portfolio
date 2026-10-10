---
# DRAFT-REVIEW: human review before publishing. Artifacts verified 2026-10-10.
slug: video-generation
title: Programmatic video generation
summary: >-
  Code-first video pipelines that run where diffusion stacks can't — a Manim CE
  MCP server plus a zero-dependency Pillow+ffmpeg frame pipeline — with the
  diffusion lane honestly declared not yet exercised here.
capability: Video generation
oneLiner: >-
  Scenes as code: Manim CE via an MCP server, Pillow frame pipelines through
  ffmpeg — seven shipped explainer videos, web-ready and moov-safe.
tags: [video, manim, ffmpeg, pillow, mcp]
date: 2026-10-10
status: in-progress
stack: [Manim CE, Pillow, ffmpeg, MCP, Python stdlib]
howItWorks:
  - Author scenes as code — Manim CE Scene classes, or Pillow section functions drawing frame-by-frame with progress t in the 0-1 range.
  - Render frames headlessly — manim CLI via the MCP server, or Pillow PNG sequences at 24 to 30 fps.
  - Stitch with ffmpeg — libx264, yuv420p chroma for player compatibility.
  - Ship web-ready — re-mux with +faststart so the moov atom leads; scan bytes to verify before calling an MP4 browser-playable.
proof:
  - MCP server for Manim rendering — stdlib JSON-RPC over stdio, scene tools, 12 tests = /opt/data/workspace/projects/animated-explainer/explainer_mcp.py
  - Seven rendered videos on disk — 1280x720 h264, 23.5 s, moov at file start = /opt/data/workspace/projects/animated-explainer/project_videos
  - First-party Pillow+ffmpeg pipeline skill — section-function template, faststart pitfall documented = /opt/data/skills/creative/animated-videos
  - Manim CE authoring playbooks — explainer scenes and math/algorithm patterns = /opt/data/skills/creative/manim-explainer
  - Runnable in this container — ffmpeg 7.1.5 and Pillow 12.3.0 verified installed = /usr/bin/ffmpeg
limits:
  - No GPU diffusion stack in this container — no comfy binary, no weights, no ComfyUI workspace; the diffusion lane is offered, not yet exercised locally.
  - Manim is not currently importable in the container; renders above date from 2026-07-10. Regeneration needs the environment reinstalled.
  - Typography constrained to installed fonts (DejaVu/Liberation/Noto) — the same font reality as this site.
  - Frame pipelines are CPU-bound — hundreds of MB of transient disk per render; frames are always cleaned up after stitching.
---

When diffusion is not an option, video is still a code problem: scenes authored
as functions, frames rendered deterministically, bytes verified before shipping.
