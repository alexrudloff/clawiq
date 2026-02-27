# ClawIQ CLI

Analytics for AI agents. Understand what your agents actually do — not just what they cost.

## Installation

```bash
npm install -g clawiq
```

## Quick Start

### 1. Initialize

```bash
clawiq init
```

This prompts for your API key and saves it to `~/.clawiq/config.json`. Get an API key from **Settings > API Keys** in the [ClawIQ dashboard](https://clawiq-www-production.up.railway.app).

### 2. Send your first event

```bash
clawiq emit task my-first-task --agent my-agent
```

### 3. View insights

Open the [Insights dashboard](https://clawiq-www-production.up.railway.app/insights) to see your agent activity.

## Usage

```bash
# Report a completed task
clawiq emit task dinner-poll --agent alex --channel imessage

# Report an error
clawiq emit error api-timeout --agent alex --severity error

# Report a correction
clawiq emit correction wrong-date --agent alex --quality-tags user-corrected

# Query recent events
clawiq query --limit 10 --type task

# Pull traces from last 24h
clawiq pull traces --limit 25

# Pull a merged timeline stream
clawiq pull all --since 24h --limit 30
```

## Event Types

| Type | When |
|------|------|
| `task` | Completed a user request |
| `delivery` | Sent a message/notification |
| `decision` | Made a routing/handling choice |
| `correction` | Fixed a mistake |
| `error` | Something failed |
| `coordination` | Handed off to another system |
| `feedback` | Received user feedback |
| `health` | System status |
| `note` | Observation or annotation |

## Configuration

The CLI loads config from (highest to lowest priority):

1. Environment variables (`CLAWIQ_API_KEY`, `CLAWIQ_ENDPOINT`)
2. `~/.clawiq/config.json` (written by `clawiq init`)
3. `~/.openclaw/openclaw.json` (auto-discovered from OpenClaw)

## Flags

| Flag | Description |
|------|-------------|
| `-q` | Quiet mode (suppress output) |
| `--agent <name>` | Agent name |
| `--channel <ch>` | Channel: imessage, telegram, slack, email, etc. |
| `--severity <lvl>` | info (default), warn, error |
| `--quality-tags <t>` | Tags: started, abandoned, hallucination, self-corrected, etc. |
| `--action-tags <t>` | Tags: poll, reminder, summary, etc. |
| `--domain-tags <t>` | Tags: family, work, finance, health |
| `--meta '<json>'` | Additional context as JSON |

## License

MIT
