---
name: clawiq
description: Emit semantic events to ClawIQ and pull telemetry/history (traces, errors, markers, unified timeline) for agent analytics and debugging.
---

# ClawIQ Event Reporting

You have `clawiq emit`

You also have read/query commands via `clawiq pull` for reviewing history.

## When to Emit

1. **Complete a request** → `task`
2. **Something breaks or fails** → `error`
3. **Fix a mistake** → `correction`
4. **Receive feedback** → `feedback`
5. **Produce an artifact** (send message, create file) → `output`
6. **User leaves a bookmark or observation** → `note`

## Usage

```bash
clawiq emit <type> <name> -q --agent <name> [options] &
```

- **ALWAYS use `-q`** — suppress output
- **ALWAYS include `--agent`** — your OpenClaw agent config name (e.g., `alex`)
- **ALWAYS run in background with `&`** — never block your response

## Read Back Data (Pull)

Use pull commands whenever you need evidence from past runs, errors, markers, or other agents.

```bash
clawiq pull <resource> [options]
```

Resources:
- `all` - merged timeline (traces + errors + markers)
- `traces` - run-level OTEL traces
- `errors` - failures and error records
- `events` - span-level event feed
- `semantic` - semantic annotations (task/error/correction/feedback/note)
- `markers` - aggregated semantic markers over time

Common pull flags:
- `--since <time>` and `--until <time>` (e.g., `24h`, `7d`, or ISO timestamp)
- `--agent <name>` to focus on one agent
- `--limit`, `--offset`, `--page` for pagination
- `--compact` for quick scans
- `--json` for structured handoff/automation

Examples:

```bash
# Unified timeline for recent debugging
clawiq pull all --agent alex --since 24h --limit 50

# Inspect only failures
clawiq pull errors --agent alex --since 7d --compact

# Review trace runs by channel
clawiq pull traces --agent alex --channel imessage --since 48h

# Pull semantic activity for a time period
clawiq pull semantic --agent alex --since 7d
```

When debugging, prefer `pull all` first, then drill down into `pull traces`, `pull errors`, or `pull semantic`.

## Event Types

| Type | When |
|------|------|
| `task` | Completed work (includes decisions, handoffs, research) |
| `error` | Something failed |
| `correction` | Fixed a mistake (yours or user-caught) |
| `feedback` | User responded positively or negatively |
| `output` | Sent a message or produced an artifact |
| `health` | System status (startup, heartbeat) |
| `note` | User-initiated bookmark, observation, or annotation |

## Task Lifecycle

For multi-step tasks, emit start AND completion:

```bash
# Starting a complex task
clawiq emit task research-topic -q --agent alex --quality-tags started &

# Completing the task
clawiq emit task research-topic -q --agent alex &

# If it fails, emit error instead of completion
clawiq emit error research-failed -q --agent alex --meta '{"reason":"API unavailable"}' &
```

**Use `started` tag for:**
- Tasks with multiple tool calls
- Tasks that might fail partway through

**Skip `started` for:**
- Quick single-tool responses
- Trivial lookups

## Options

**Required:**
- `--agent <name>` - Your OpenClaw agent config name
- `-q` - Quiet mode

**Common:**
- `--channel <ch>` - imessage, telegram, slack, email
- `--target <recipient>` - Who received the message
- `--severity <lvl>` - info (default), warn, error
- `--meta '<json>'` - Context explaining what happened
- `--quality-tags` - started, self-corrected, user-corrected, retry, fallback
- `--action-tags` - What you did: poll, reminder, summary, handoff, research
- `--domain-tags` - Context: family, work, finance, health

**ALWAYS run `clawiq tags` before inventing new tags.** Reuse existing ones.

## Examples

```bash
# Completed a task
clawiq emit task explain-feature -q --agent alex --meta '{"topic":"OTEL"}' &

# Sent a message (output)
clawiq emit output dinner-poll -q --agent alex --channel imessage --target "Family" &

# Handed off to sub-agent (just a task with meta)
clawiq emit task spawn-research -q --agent alex --action-tags handoff --meta '{"sub_agent":"scout"}' &

# Fixed my mistake
clawiq emit correction wrong-date -q --agent alex --quality-tags self-corrected &

# User corrected me
clawiq emit correction name-fix -q --agent alex --quality-tags user-corrected &

# Something failed
clawiq emit error api-timeout -q --agent alex --severity error --meta '{"service":"weather"}' &

# User said thanks
clawiq emit feedback positive -q --agent alex --channel imessage &

# User bookmarks something for later
clawiq emit note interesting-pattern -q --agent alex --meta '{"observation":"model switches mid-session"}' &
```
