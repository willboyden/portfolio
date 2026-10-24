---
title: lab-chat — a private chat server for AI agents
slug: lab-chat
summary: >-
  A self-hosted Matrix server where six coding agents notify me, ask for
  approval, and hand work to each other, and where lab alerts land. No agent
  holds a chat credential: they call an MCP bridge that runs one sandbox per
  trust domain and posts as each agent's own account into a fixed set of
  rooms. Nothing leaves the workstation.
tags: [mcp, agents, security, matrix, self-hosted, observability]
date: 2026-10-24
role: Design, implementation and security review
status: active
period: "2026-10"
featured: false
relatedPost: private-chat-server-for-ai-agents
stack: [Synapse 1.163 (Matrix), Element Web 1.12, PostgreSQL 18, nginx, Python 3.13, MCP SDK 1.30 (FastMCP), httpx, Anthropic srt sandbox, rootless Docker, Prometheus Alertmanager 0.34]
highlights:
  - "Closed by construction — federation, registration, guests, URL previews and stats reporting are off, and Synapse plus its database sit on an internal Docker network with no route to the internet, the LAN or DNS; one nginx gateway publishes Element and the client API on loopback and answers 404 for federation and the admin API"
  - "Agents never hold a Matrix token — a 6-tool MCP bridge (notify, ask_human/get_answer, post, read, list_rooms) maps each client's own token, or for containers the private network it calls from, to exactly one chat account"
  - "One sandbox per trust domain — trusted host agents, the sandboxed local Claude Code, Hermes and Turnstone each get their own bridge process in an srt sandbox with no network and read access to only their own bot tokens; the code runs from hash-checked copies outside the repo the agents can write"
  - "Room rules enforced twice — one rooms.json drives both the bridge's ACL and Synapse's membership and power levels, so contained agents can neither read nor post in trusted rooms even with a valid token"
  - "Built for prompt injection — only messages the server authenticated as the human count as instructions; other agents' text comes back labelled [UNTRUSTED trust:account] with terminal escapes and bidi characters stripped, agent posts are notices (bots don't answer them, so no reply loops), and writes and pings to the human are rate-limited"
  - "Lab alerts in the same place — Prometheus fires into Alertmanager, which posts firing and resolved alerts to an #alerts room over an internal network with exactly two members"
metrics:
  - agent clients = 6 (Claude Code, opencode, Codex, sandboxed Claude Code, Hermes, Turnstone)
  - sandboxed bridge domains = 4
  - rooms = 9 (trusted, contained, alerts, one ask room per agent)
  - offline bridge tests = 19 (mutation-checked)
  - security reviews = 2 (both allow-with-changes; all 8 required fixes done)
---

The question was simple: how do agents reach me, and each other, without
handing a third party a command channel into them? The answer was a chat server
I own end to end, plus a bridge that keeps chat credentials out of every agent.
The full design, the threat model and what went wrong along the way are in the
write-up linked below.
