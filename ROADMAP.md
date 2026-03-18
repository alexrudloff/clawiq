# ROADMAP.md — ClawIQ

## What ClawIQ is (architecturally)

ClawIQ is the **control plane and data proxy for AI employee teams**. It manages the full lifecycle: hiring agents from a catalog, giving them personality and workspace, scoping their data access, scheduling their work, monitoring their performance, and providing the customer-facing dashboard.

ClawIQ drives agents via `acpx` — a lightweight process wrapper that speaks ACP (Agent Client Protocol) to Claude Code, Codex, and other compatible agent CLIs. The agent runtimes handle the hard parts (tool loops, retries, context management). ClawIQ handles everything around them (team management, data scoping, scheduling, monitoring, the customer dashboard).

The customer authenticates Claude Code or Codex with their own subscription. ClawIQ orchestrates — it doesn't proxy model API calls or handle model auth.

### Full architecture

```
┌── ClawIQ Platform (control plane) ───────────────────────────┐
│                                                               │
│  Dashboard (<company>.clawiq.md)                              │
│  ├── Hire / fire / manage agents                              │
│  ├── Define data access per role                              │
│  ├── Connect data sources (API keys, OAuth)                   │
│  ├── Chat room (watch agents work, talk to them)              │
│  ├── Activity feed + audit log                                │
│  ├── Lenny's issues + patches                                 │
│  └── Cost tracking + budgets                                  │
│                                                               │
│  Control Plane API                                            │
│  ├── Agent catalog (role templates)                           │
│  ├── Agent lifecycle (hire, fire, configure, schedule)         │
│  ├── Scheduler (cron, heartbeats, periodic reviews)           │
│  ├── Credential store (encrypted, synced to instances)        │
│  ├── Scope definitions (which agents get which endpoints)     │
│  ├── Telemetry + audit log aggregator                         │
│  └── Channel relay (future: Slack, Teams)                     │
│                                                               │
└──────────────────────────┬────────────────────────────────────┘
                           │
               poll (outbound from instance)
               ├── pulls: commands, credentials, scope config
               └── pushes: telemetry, audit logs, agent status
                           │
┌──────────────────────────┴────────────────────────────────────┐
│  ClawIQ Instance (Docker on Railway / VM / on-prem)           │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Data Proxy (local)                                     │  │
│  │  ├── Credential vault (synced from platform, encrypted) │  │
│  │  ├── Scope enforcement (deny by default)                │  │
│  │  ├── Request logging → syncs to platform                │  │
│  │  └── Calls customer APIs using stored credentials       │  │
│  └──────────────────────────┬──────────────────────────────┘  │
│                              │                                 │
│  ┌──────────────────────────┴──────────────────────────────┐  │
│  │  Agent Executor (via acpx)                              │  │
│  │  ├── Spawns acpx → drives Claude Code / Codex           │  │
│  │  ├── Each agent has:                                    │  │
│  │  │   ├── Named acpx session (persists between turns)    │  │
│  │  │   ├── Workspace dir (/workspaces/{agent-id}/)        │  │
│  │  │   ├── Personality files (SOUL.md, TOOLS.md, etc.)    │  │
│  │  │   └── Memory (long-term + daily, in workspace)       │  │
│  │  ├── Prompt in via stdin, NDJSON events out via stdout   │  │
│  │  ├── Estimator, PM, Accountant, etc.                    │  │
│  │  └── Lenny (scheduled, same acpx mechanism)             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Agent CLIs (pre-installed in Docker image)                   │
│  ├── claude (Claude Code) — user's subscription via OAuth     │
│  ├── codex (Codex CLI) — user's subscription via OAuth        │
│  └── ollama (future — local models)                           │
│                                                               │
│  ClawIQ CLI (telemetry, issue reporting)                      │
│  Poll daemon (syncs with platform)                            │
│  Railway Volume at /workspaces (persistent across deploys)    │
│                                                               │
└──────────────────────────┬────────────────────────────────────┘
                           │
               customer API calls (from local proxy)
                           │
               ┌───────────┴───────────┐
               │  Customer Data Sources │
               │  ├── REST API          │
               │  ├── Google Drive      │
               │  └── etc.              │
               └───────────────────────┘
```

### Agent model

Each agent is an acpx session with a workspace directory:

```
/workspaces/est-001/                  # agent's cwd (persistent volume)
├── SOUL.md                           # personality (generated from role template)
├── AGENTS.md                         # operating rules
├── TOOLS.md                          # available data proxy endpoints
├── MEMORY.md                         # long-term curated memory
├── memory/
│   ├── 2026-03-18.md                 # daily session notes
│   └── 2026-03-17.md
└── files/                            # agent's scratchpad (drafts, analysis, etc.)
```

The agent CLI (Claude Code / Codex) reads these files natively — they're real files on disk, not a virtual filesystem. The workspace lives on a Railway Volume (persistent across deploys) or on-prem disk.

ClawIQ generates the personality files from the role template + customer context when an agent is hired. The agent can update its own memory and files during sessions — that's how it learns and persists context.

The customer doesn't know about SOUL.md or workspace files. They see the agent's personality and capabilities in the dashboard. Under the hood, changes to an agent's configuration regenerate the workspace files.

### Model access

Agents run on the customer's own subscription or API keys:

- **Claude Code:** Customer authenticates with their Claude Pro/Max subscription. OAuth token cached in the instance. Usage counts against their subscription. This is legitimate — the actual `claude` CLI is running, authenticated by the user.
- **Codex:** Same pattern — customer authenticates with their ChatGPT Plus/Pro subscription. OpenAI explicitly supports this in third-party contexts.
- **API keys (BYOK):** For customers who prefer per-token billing or need programmatic access. Customer provides their Anthropic/OpenAI API key.
- **ClawIQ-metered (future):** ClawIQ provides API access, meters usage, adds margin.

**The key distinction:** ClawIQ doesn't extract or proxy OAuth tokens. The actual agent CLI runs in the instance and authenticates directly with the provider. ClawIQ orchestrates the session via acpx/stdio — it never touches the auth flow.

**Future: Local models.**
- Ollama for on-prem instances
- Routine tasks (Lenny health checks, simple lookups) on local models
- Complex reasoning on cloud models
- Not MVP

### Scheduling

ClawIQ handles all scheduling directly:
- **Heartbeats:** Periodic health checks (configurable interval per agent)
- **Cron:** Scheduled tasks (Lenny's nightly review, recurring reports)
- **On-demand:** Dashboard chat, triggered by customer message
- **Event-driven:** Lenny responds to scope violations, error spikes, etc.

No external scheduler needed. The ClawIQ instance runs its own scheduler.

---

## MVP: Agent team on your API

Customer provides a REST API. ClawIQ gives them a team of AI employees that query it through a local data proxy. No OpenClaw. No Docker complexity. Just ClawIQ calling Claude's API.

### What the customer gets

- Dashboard at `<company>.clawiq.md`
- Agent catalog — pre-configured roles to hire
- Each agent scoped to specific endpoints (enforced at the proxy)
- Lenny reviewing every agent automatically
- Chat room — watch agents work, talk to them
- Audit log of every action and data request

### What the customer provides

- REST API base URL + auth credentials
- Description of endpoints (or OpenAPI spec)
- Claude or Codex subscription (or API key for BYOK)
- Which roles they want and which endpoints each role can access

---

## MVP Build Phases

### Phase 1: Dashboard + onboarding (skeleton)
_The product IS the dashboard. Build it first._

- [ ] Auth (email/password or Google OAuth)
- [ ] Onboarding: provide API URL + auth, describe endpoints, provide model API key
- [ ] Team roster page (empty state → first hire)
- [ ] Hire flow: browse catalog → pick role → assign endpoints → hire
- [ ] Chat room: message agents, see responses
- [ ] Activity feed (placeholder)
- [ ] Auto-branding: customer name

### Phase 2: Agent executor (via acpx)
_Driving Claude Code / Codex as agent runtimes._

ClawIQ doesn't reimplement the agent loop. It uses `acpx` (from the OpenClaw ecosystem) to drive Claude Code, Codex, or other ACP-compatible agent CLIs. Each agent is a named `acpx` session with a workspace directory.

```
ClawIQ spawns:
  acpx --format json --json-strict --cwd /workspaces/est-001 \
    claude prompt --session est-001-main --file -

ClawIQ writes prompt to stdin (role context + memory + customer message)
ClawIQ reads NDJSON events from stdout:
  agent_message_chunk → stream to chat room
  tool_call           → agent is working (log it)
  usage_update        → token tracking
  done                → turn complete
```

- [ ] Install `acpx`, `claude` (Claude Code), `codex` as npm packages in the Docker image
- [ ] Agent executor service: spawns acpx per turn, manages sessions, parses NDJSON events
- [ ] Prompt assembly: role template + personality + memory + tool definitions → written to stdin
- [ ] Tool call routing: agent tool calls go through the local data proxy (via workspace config)
- [ ] Session persistence: named acpx sessions persist between turns (filesystem-backed)
- [ ] Workspace per agent: `/workspaces/{agent-id}/` — agent's cwd, files, scratchpad
- [ ] Memory injection: long-term + daily memory assembled into the prompt context
- [ ] Event streaming: NDJSON events relayed to dashboard chat room in real time
- [ ] Multi-model support: `claude` or `codex` selected per agent config
- [ ] User auth: customer logs into Claude Code / Codex with their own subscription (cached OAuth)

### Phase 3: Data proxy + credential vault
_Scoped data access with credential isolation._

- [ ] Proxy service (runs in instance): agent requests → scope check → forward to customer API
- [ ] Credential vault: encrypted storage, synced from platform
- [ ] Agent tokens: per-agent scoped to allowed endpoints
- [ ] Scope enforcement: deny by default
- [ ] Request logging: every request logged
- [ ] 403 flagging: repeated violations → Lenny alert

### Phase 4: Agent catalog + provisioning
_Making agents hirable from the dashboard._

- [ ] Catalog data model: role templates with personality, capabilities, default scoping
- [ ] Five MVP roles: Project Manager, Estimator, Compliance Officer, Accountant, Operations Analyst
- [ ] System prompt generation: role template + customer context → agent personality
- [ ] Tool definition generation: role + allowed endpoints → tool schemas for Claude API
- [ ] Provisioning: create agent record + workspace + proxy token
- [ ] Deprovisioning: archive agent, revoke token

### Phase 5: Lenny
_The built-in manager._

- [ ] Lenny as a scheduled agent (cron-based, runs nightly + on-demand)
- [ ] Reviews proxy audit logs for: errors, scope violations, cost spikes, stuck patterns
- [ ] Reviews conversation quality (samples agent responses, checks for accuracy)
- [ ] Files issues with specific findings and suggested fixes
- [ ] Issues appear in dashboard with accept/dismiss/resolve workflow

### Deployment (Railway for MVP)

The ClawIQ instance runs as a Docker container on Railway (Pro plan):

```dockerfile
FROM node:20-slim
RUN npm install -g @anthropic-ai/claude-code @openai/codex acpx
# ... install ClawIQ platform, proxy, CLI
```

- Railway Volume mounted at `/workspaces` (persistent agent workspaces)
- Pro plan: up to 48 vCPU / 48 GB RAM, no execution timeout
- Child process spawning (acpx → claude/codex) supported
- Stdio pipes between processes supported
- ~$160/month for a 4 vCPU / 8 GB container (per customer instance)
- At scale: move to Fly.io or bare VMs for cost and control

### Phase 6: Poll protocol + instance management
_For when we need to run instances separately from the platform._

- [ ] Instance ↔ platform sync: credentials, commands, telemetry, audit logs
- [ ] Instance registration and authentication
- [ ] Credential sync (encrypted, hot-swap)
- [ ] Chat relay (2s poll during active conversations)

**Note:** For MVP, the platform and instance can be the same process. The poll protocol becomes necessary when we need on-prem deployment or scale to multiple instances. Don't over-engineer this until it's needed.

---

## What's already built

| Component | Status | MVP role |
|-----------|--------|----------|
| ClawIQ CLI (emit, pull, report, session) | Working | Telemetry + issue reporting |
| Lenny persona + review system | Working | Personality template for Lenny agent |
| Issue/patch system | Working | Lenny files issues, dashboard displays |
| OTEL telemetry pipeline | Working | Agent monitoring infrastructure |
| ClawIQ API (Go backend) | Working | Foundation for control plane API |
| Web app (Next.js) | Working | Foundation for dashboard |
| Landing page (`/new`) | Working | Customer acquisition |

---

## After MVP

### Chat room → channels
- Basic chat room ships with MVP (dashboard-only)
- Slack integration (most requested for SMBs)
- Microsoft Teams integration
- Each agent can be @-mentioned in channels
- Channel messages flow through ClawIQ (not direct to model API)

### Tier 1: Self-service file connectors
- Google Drive, Dropbox, SharePoint OAuth in dashboard
- Customer authenticates → ClawIQ stores tokens → proxy serves files to agents
- RAG curation agent (auto-chunking, indexing)
- Agents call the same proxy — data source is transparent

### Tier 3: Custom data layer
- CUSTOMIZE.md recipe (discovery → schema → ETL → custom API)
- Custom API runs behind the data proxy
- KPIs and reports on dashboard
- Premium consulting engagement

### Local models (ollama)
- Instance runs ollama alongside the agent executor
- Model routing: cheap tasks → local, complex tasks → cloud
- Requires Docker or bare-metal deployment
- Key for on-prem customers with data sensitivity

### On-prem deployment
- Package instance as Docker or installable service
- Proxy runs locally — all data stays on-premises
- Poll-not-push for platform connectivity
- IT provider installation guide

### Security hardening
- Container isolation (when Dockerized)
- Inference guardrails (PII detection, output filtering)
- Privacy routing (sensitive queries → local models)
- Per-agent budget auto-pause

### Reseller program
- Partner portal, revenue share tracking
- Referral management

---

## Principles

1. **ClawIQ is the control plane. Agent CLIs do the execution.** ClawIQ orchestrates via acpx. Claude Code and Codex handle the agent loop, tool calls, retries. ClawIQ handles everything around them.
2. **Dashboard first.** The product is `<company>.clawiq.md`. Build the UI, demo with mock data, wire up real agents underneath.
3. **Workspaces are real filesystems.** Each agent gets a directory with personality files, memory, and scratchpad. The agent CLI reads and writes these natively. No virtual filesystem abstraction.
4. **Lenny is the differentiator.** Others can put agents on an API. Nobody else has a built-in manager that makes the team better every week.
5. **The data proxy runs locally.** Customer API credentials never leave the instance. Data requests never route through the cloud.
6. **Start monolith, split later.** MVP runs platform + instance in one process on Railway. Poll protocol and instance separation come when on-prem demands it.
7. **Customer's subscription, not ours.** The agent CLI authenticates with the customer's Claude/Codex subscription. ClawIQ never touches model auth. This keeps model costs on the customer and avoids TOS issues.
