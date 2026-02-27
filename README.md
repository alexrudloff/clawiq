# ClawIQ

Agent intelligence for [OpenClaw](https://github.com/alexrudloff/openclaw). Understand what your agents actually do — not just what they cost.

## What is ClawIQ?

ClawIQ is the monitoring layer for OpenClaw. It collects OTEL traces, semantic events, and error data from your agents, then surfaces insights through a web dashboard and CLI.

When you run `clawiq init`, a monitoring agent is created in your OpenClaw workspace — a dedicated persona that watches over your system and reports on what it finds.

## Installation

```bash
npm install -g clawiq
```

Requires Node.js 18+.

## Setup

### 1. Get an API key

Sign up at [clawiq.dev](https://clawiq-www-production.up.railway.app) and create an API key in **Settings > API Keys**.

### 2. Run the setup wizard

```bash
clawiq init
```

The wizard will:
- Validate your API key against the ClawIQ API
- Let you choose a monitoring persona (Grip, Pinchy, or Clawfucius)
- Configure OTEL telemetry in `~/.openclaw/openclaw.json`
- Create an agent workspace at `~/.openclaw/workspace-{persona}/`
- Register the agent in your OpenClaw config
- Link the ClawIQ skill to existing workspaces

### 3. Verify

```bash
clawiq pull all --since 1h
```

If your OpenClaw instance is running with the diagnostics plugin enabled, you should see traces flowing in.

## Non-interactive setup

```bash
clawiq init --api-key YOUR_KEY --persona grip --non-interactive
```

Valid personas: `grip`, `pinchy`, `clawfucius`.

## Personas

| Persona | Style |
|---------|-------|
| Grip 🦀 | Senior SRE. Direct, analytical, numbers first. |
| Pinchy 🦞 | Sharp + playful. Wry humor, colorful delivery. |
| Clawfucius 🦐 | Wise sage. Context over reaction, patterns over noise. |

Each persona gets a full workspace with IDENTITY.md, SOUL.md, AGENTS.md, HEARTBEAT.md, TOOLS.md, and a ClawIQ-informed monitoring workflow.

## How it works

1. OpenClaw sends OTEL traces to ClawIQ via the diagnostics plugin
2. Agents emit semantic events (`clawiq emit`) to annotate their work
3. The ClawIQ dashboard and CLI (`clawiq pull`) surface insights
4. Your monitoring persona analyzes the data and reports findings

## Configuration

Config is loaded from (highest to lowest priority):

1. Environment variables (`CLAWIQ_API_KEY`, `CLAWIQ_ENDPOINT`)
2. `~/.clawiq/config.json` (written by `clawiq init`)
3. `~/.openclaw/openclaw.json` (auto-discovered from OpenClaw OTEL headers)

## License

MIT
