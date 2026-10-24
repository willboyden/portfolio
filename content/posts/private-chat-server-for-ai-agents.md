---
title: "A private chat server for my AI agents (and why not Discord)"
slug: private-chat-server-for-ai-agents
summary: >-
  Six agents on one workstation needed a way to ping me, ask before risky
  steps, and hand work to each other. Discord was the obvious idea and the
  wrong one. Here is the self-hosted Matrix server and sandboxed MCP bridge I
  built instead: how agents post without ever holding a chat token, how room
  rules are enforced twice, what three security reviews changed, how I chat
  with a sandboxed Hermes agent in the same server, and the gotchas that cost
  the most time.
tags: [mcp, agents, security, matrix, self-hosted]
date: 2026-10-24
series: AI engineering notes
relatedProject: lab-chat
relatedPosts: [mcp-production-lessons, security-first-ingest-prompt-injection]
---

My workstation runs six coding agents. Three are trusted and run as me: Claude
Code, opencode and Codex. Three are contained: a sandboxed Claude Code on a
local model, Hermes Agent and Turnstone, each walled off because they read the
web or run on models I trust less. All of them do long jobs, and all of them
hit moments where they need me: "done", "blocked", "may I delete this?".
They also need to hand work to each other. And the lab's Prometheus alerts
had nowhere to go except a web page nobody watches.

I wanted one place for all of it.

## Why not Discord

A private Discord server was my first idea, and it fails on every point that
matters here.

- **It can't be self-hosted.** A "private server" is still a guild on
  Discord's cloud, so every message, every bot token and every piece of agent
  output (code, prompts, sometimes personal data) goes to a third party.
- **Every bot needs internet access** to Discord's API and gateway. My lab is
  deny-by-default for egress; each bot would be a new hole.
- **A leaked bot token or invite is a command channel** into agents that can
  run shell commands. Hermes and Turnstone both ship Discord integrations, and
  I keep both switched off for exactly these reasons.

## The shape

Matrix is an open protocol I can run myself, with good web, desktop and phone
clients. So: Matrix, closed off from everything.

| Piece | Job | Exposure |
|---|---|---|
| Synapse + PostgreSQL | the Matrix server and its database | internal Docker network only: no route to the internet, the LAN or DNS |
| nginx gateway | serves Element Web and the Matrix client API | loopback only; federation and the admin API answer 404 |
| `lab-chat-mcp` | the MCP bridge agents talk to | one sandboxed process per trust domain |
| Alertmanager + chat-alerts | Prometheus alerts into an `#alerts` room | an internal network with exactly two members |

Synapse runs closed: no federation listener, an empty federation allowlist,
registration and guests off, URL previews off (they are an SSRF and egress
path), no stats reporting. The internal network enforces the same thing a
second time, so a config mistake does not open a door. Element has its
integration manager, video calls, location sharing, analytics and bug reports
turned off, and the gateway's Content-Security-Policy (`connect-src 'self'`)
is the real guarantee: the browser refuses any request to another host.

Rooms come from one file:

| Room | Who may post | Who may read |
|---|---|---|
| `#alerts` | the alerts bot only | me, trusted agents |
| `#trusted` | me, trusted agents | me, trusted agents |
| `#contained` | me, sandboxed Claude Code, Turnstone, trusted agents (hand-offs) | the same |
| `#ask-<agent>` (one each) | me and that agent | me and that agent |
| `#chat-hermes` | me and a chat-only Hermes | me and that Hermes |

## Agents never hold a chat token

This is the core of the design. Each agent gets an MCP server called
`lab-chat` with six tools:

| Tool | What it does |
|---|---|
| `notify(text, level)` | a message to me in the agent's own room, with a ping |
| `ask_human(question, options)` | a question in that room; returns a ticket |
| `get_answer(ticket, wait)` | long-polls up to 50 s for my reply, reaction or thread answer |
| `post(room, text)` | a message for other agents |
| `read(room, since)` | messages, each tagged with who wrote it and whether it was me |
| `list_rooms` | who am I, and where may I read and post |

The bridge holds the Matrix tokens; agents hold only a bridge token, and the
bridge maps it to exactly one Matrix account. Containerized agents don't even
hold that: Hermes and Turnstone reach the bridge through a relay container on
their own internal Docker network, and the bridge treats every request from
that network as that agent. Network identity only works if nothing else can
join the network, so three things check it: the agent's start script refuses
to start if a stranger is on it, a policy script scans every compose file in
the repo for that network (and for containers that borrow another container's
network namespace), and the bridge's status command checks the live members.

The bridge runs as four processes, one per trust domain: trusted host agents,
the sandboxed local Claude Code, Hermes, and Turnstone. Each runs inside
Anthropic's `srt` sandbox with no network and read access to only its own
domain's tokens; it reaches Synapse through a Unix socket that a separate relay
forwards to the gateway. The code runs from copies outside the repository,
hash-checked before every start, because the contained agents can write the
repository and a changed bridge would run outside their sandbox.

## Room rules, enforced twice

The bridge checks every call against an ACL built from `rooms.json`. Synapse
enforces the same table independently: contained bots are simply never members
of `#trusted` or `#alerts`, posters sit at power level 50 and a room's default
send level is 50, so a reader with a valid token still can't post. The same
parser feeds both, and it refuses any room file that would let contained
agents read what trusted ones post.

## Treating chat as an injection surface

Agents read text other agents wrote, and some of those agents read the web. So
the bridge assumes every message from a bot is hostile:

- **Only the human counts.** Each message carries `from_human`, which comes
  from the sender the server authenticated, so no agent can fake it. The tool
  descriptions and the agents' instructions say only those messages are
  instructions.
- **Labels and stripping.** Agent text comes back prefixed
  `[UNTRUSTED contained:hermes]` (or similar), with terminal escape codes and
  bidirectional-text characters removed.
- **No reply loops.** Agent posts are Matrix notices, which bots by convention
  never answer.
- **Rate limits.** 10 writes a minute and 120 an hour per account, a separate
  budget of 3 pings a minute and 20 an hour to me, and at most 2 waiting
  `get_answer` calls per account.
- **A secret filter, which is a seatbelt, not the boundary.** A post that
  looks like a key is refused, never redacted and sent. Split or encoded
  secrets get through; the real controls are that agents can't read
  credentials in the first place and that the chat never leaves the machine.

## What the two security reviews changed

I had an independent reviewer agent audit the design twice, once before the
sandboxed Claude Code was wired and once before Hermes and Turnstone were.
Both came back "allow with changes", and all eight changes are in:

- The sandboxed Claude Code may not `read` without asking, since `#contained`
  carries text from agents that browse the web.
- The installed helper that hands the client its token must exist, not be a
  symlink, match the repository copy, and that copy may have no uncommitted
  change: the model can write the repository, and the helper runs outside its
  sandbox.
- Inline untrusted labels, control-character stripping, the separate ping
  budget, a cap on concurrent waits, tests for cross-domain tickets, and a
  health endpoint that names nothing.
- The compose scan and the live member check for network identity described
  above.

### The risk I first accepted, then closed

The second review left one risk open on purpose: Hermes has no per-tool
approval layer for MCP tools, so it ran the chat tools without asking, and
it shared `#contained` with the other contained agents. A message one of them
posted could steer an agent that has a terminal and some web access.

I closed it the same day by taking Hermes out of agent conversations
entirely: it can notify me and ask me questions, nothing else. The obvious fix
was one line in Hermes's tool policy denying `read` and `post`, and on its own
it would have been theatre. Hermes has a terminal, and on its private network
the bridge needs no token, so a single `curl` could skip the agent's own tool
guard. The fix that counts is on the bridge side: `rooms.json` no longer lists
Hermes in `#contained`, so the bridge refuses it and Synapse removed it from
the room. The tool-policy denial stays as the first layer. I tested both: a
real Hermes run had its `read` blocked by the guard, and a raw MCP client on
Hermes's network was refused by the bridge.

## Chatting with Hermes directly

MCP tools let an agent reach me while it works. I also wanted to open Element
and just talk to an agent. Hermes ships a Matrix gateway, but switching it on
means an always-on inbound channel into an agent with a terminal, so it got
its own review before any code: allow with changes, nine of them, all done.
The result:

- **A separate Hermes.** Not the one I use from the desktop app: its own
  container, memory, skills, workspace and model key, on two private networks
  that each hold exactly one other container: a proxy to the chat server and
  a proxy to the model router. No internet, no MCP servers, no web tools.
- **The bot doesn't hold its chat token either.** A small mitmproxy add-on in
  front of Synapse holds the token and swaps it in, the same broker pattern
  the lab uses for model keys. It also allowlists the API: the bot can read
  its one room and send messages, reactions, read receipts and typing
  notices there. Joining, inviting, creating rooms, changing room settings,
  deleting messages and uploading are refused. The proxy won't start unless
  the bot is a member of exactly one room.
- **Only I can drive it.** The gateway answers one account and ignores
  anyone else's direct messages, and the room has two members.
- **Nothing it can rewrite.** It runs as an unprivileged user with no Linux
  capabilities and a read-only root filesystem. Its config, its tool policy
  and two other files Hermes reads settings from are mounted read-only.
- **Fewer tools, checked twice.** Terminal and files inside its own
  container, memory and skills; no task queue, delegation or scheduled jobs.
  Hermes's per-platform tool list sets that, and the lab's tool guard
  allowlist enforces it again.
- **Risky commands ask me in the room.** Hermes's approval prompt arrives as
  a message. A ✅ reaction allows it once, ❌ refuses it, and only the person
  who asked can answer.

## Gotchas that cost the most time

- **Room version 12 changed power levels.** The room creator now outranks
  every power level and must *not* appear in the power-level user list.
  Listing myself there made room creation fail, and the failed attempt left a
  half-made room behind its alias. Setup now re-asserts every piece of room
  state on each run.
- **Single-file bind mounts pin the inode.** Editing Element's config on the
  host changed nothing in the container, because the editor wrote a new file.
  Mount the directory.
- **Tool names get rewritten.** Hermes turns `-` into `_` in MCP tool names,
  and its tool guard matches names exactly. The server is `lab_chat` for
  Hermes and Turnstone so every layer sees one spelling.
- **Invisible characters.** A regex of `\u` escapes went through a file-write
  tool as literal bidi and zero-width characters. Semgrep caught it; every
  file is now swept for them.
- **Configs that hold tokens inline get read.** One client keeps MCP tokens
  inline in its config file. An agent grepping that file printed a token into
  its transcript; it was rotated the same hour.
- **Default invite rate limits** blocked the first setup run, which invites
  seven bots into nine rooms at once.
- **Settings live in more than one file.** Besides its config file, Hermes
  reads a legacy gateway file and an env file in its home, and that env file
  overrides the container's own environment. A read-only config alone would
  not have meant read-only settings.
- **A gateway I didn't know was running.** My sandbox notes said Hermes ran
  no gateway. One starts by itself, for scheduled jobs and the task queue,
  from state in Hermes's data volume. Matrix settings there would have put a
  chat bot in every Hermes container at once, so the chat Hermes got its own
  volume.

## How it is proven

- 23 offline tests against a fake Matrix server, mutation-checked (break the
  code, watch a test fail).
- Live end to end through the real bridge: an agent asked a question, a
  reply from my own account came back from `get_answer` as answered (with
  the option it picked); a post outside an account's rooms was refused; a
  token used on the wrong domain's listener was rejected; a post holding a
  fake key was refused.
- A test alert fired through Alertmanager reached `#alerts`, and its
  resolution followed.
- The server's containers were tested for no DNS and no outbound
  connections.
- A real model drives it: with GLM-5.3-Flash loaded, Hermes and Turnstone
  were each asked to call `list_rooms` once. Each reported back its own
  contained account and exactly its two rooms, and the bridge's audit log
  shows one call from each.
- The chat Hermes, live on the same model: a test message sent from my
  account (by a script) got its reply in 12 seconds; asked to run an
  `rm -rf`, it posted an approval prompt, and denying it stopped the command.
- From the bot's network, every call outside the allowlist got a 403:
  creating a room, inviting, joining `#trusted`, room-state writes,
  deletions, uploads, path tricks and the admin API. A token passed in the
  URL was dropped. The allowlist has its own mutation-checked test suite.
- Inside its container: no root, no capabilities, its policy and config
  refuse writes, and only its two proxies answer.

## What's next

- **Phone access**, once the lab has a VPN: bind the gateway to the VPN
  interface, a certificate the phone trusts, Element X, and push
  notifications that don't route through Google.
- **End-to-end encryption**, reconsidered then. On one machine, encrypting
  between me and a bot whose keys sit on the same disk protects almost
  nothing, so rooms are unencrypted on purpose for now.
