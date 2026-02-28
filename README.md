# ClawIQ

Agent intelligence for [OpenClaw](https://github.com/alexrudloff/openclaw). Understand what your agents actually do — not just what they cost.

## What is ClawIQ?

ClawIQ is the monitoring layer for OpenClaw. It collects OTEL traces, semantic events, and error data from your agents, then surfaces insights through a web dashboard and CLI.

When you run `clawiq init`, Lex the Lobster is created in your OpenClaw workspace — a dedicated agent that watches over your system, runs nightly performance reviews, and submits findings on what's working and what isn't.

## Installation

```bash
git clone https://github.com/alexrudloff/clawiq.git ~/.clawiq-cli
cd ~/.clawiq-cli
npm install
npm link
```

Requires Node.js 22+.

## Setup

### 1. Get an API key

Sign up at [clawiq.md](https://clawiq.md) and click **Generate Command** on the getting started page.

### 2. Run the setup wizard

```bash
clawiq init --api-key YOUR_KEY
```

The wizard will:
- Validate your API key against the ClawIQ API
- Configure OTEL telemetry in `~/.openclaw/openclaw.json`
- Create Lex's agent workspace at `~/.openclaw/workspace-clawiq/`
- Register the agent in your OpenClaw config
- Link the ClawIQ skill to existing workspaces
- Schedule a nightly performance review cron job (3 AM daily)

### 3. Verify

Send your OpenClaw agent a message, then check [clawiq.md](https://clawiq.md) to see data flowing in.

## How it works

1. OpenClaw sends OTEL traces to ClawIQ via the diagnostics plugin
2. Agents can optionally emit semantic events (`clawiq emit`) to annotate their work
3. Lex runs nightly reviews on your local machine — combining OTEL data with session transcripts to find behavioral patterns
4. Findings are submitted to your ClawIQ account with specific patches to improve your agents

## CLI Commands

```bash
clawiq init                          # Set up ClawIQ + Lex
clawiq pull all --since 24h          # Unified timeline
clawiq pull traces --since 24h       # OTEL traces
clawiq pull errors --since 24h       # Error records
clawiq pull semantic --since 24h     # Semantic events
clawiq emit task <name>              # Emit a semantic event
clawiq report finding --agent <id>   # Submit a finding
clawiq report list --since 7d        # List recent findings
clawiq tags                          # List all tags
```

## Configuration

Config is loaded from (highest to lowest priority):

1. Environment variables (`CLAWIQ_API_KEY`, `CLAWIQ_ENDPOINT`)
2. `~/.clawiq/config.json` (written by `clawiq init`)
3. `~/.openclaw/openclaw.json` (auto-discovered from OpenClaw OTEL headers)

## License

MIT
