# ClawIQ: Agent Teams That Understand Your Business

## What ClawIQ is

ClawIQ is a product and framework for delivering customized AI agent teams to SMBs. It connects a company's actual systems into a unified data layer, then gives them a team of agents that can read and reason about that data. The customer interacts with their team at `<company>.clawiq.md`.

ClawIQ is built and operated by More Than Theory (MTT). MTT runs discovery engagements to understand the customer's business, then uses agents to follow a standardized recipe (CUSTOMIZE.md) to build the customer's environment. The more engagements MTT completes in an industry, the faster the next one goes — source connectors, agent personas, and domain knowledge accumulate.

The customer doesn't know or care what OpenClaw is. They see ClawIQ. They talk to their agents. Their agents know their business.

## The problem

Agent teams are everywhere now. Estimators, project managers, compliance reviewers, scheduling assistants. They're impressive in demos. They fall apart in production for one reason: **they don't have access to the company's actual stuff.**

Every "AI project manager" on the market works in a vacuum. The user copy-pastes context, re-explains history, manually feeds it the data. It has no idea what the company's systems look like, what's overdue, or what the budget variance is. It's a smart person who just started on day one, every single time.

The missing piece isn't better agents. It's the data layer underneath them. That's what ClawIQ builds.

---

## Architecture

ClawIQ is the **control plane and data proxy** for AI employee teams. It sits between the customer's data sources and the agents, brokering all access. Agents never touch customer credentials — they call ClawIQ's data proxy with a scoped token, and ClawIQ forwards the request to the customer's API using credentials the customer stored in ClawIQ.

The execution backend (currently OpenClaw) runs the agents. ClawIQ controls what they do and what data they can see. If the execution backend changes, the customer doesn't notice.

```
                     ┌───────────────────────────┐
                     │    Customer Data Sources   │
                     │  ┌────────┐ ┌───────────┐  │
                     │  │REST API│ │Google     │  │
                     │  │        │ │Drive      │  │
                     │  └───┬────┘ └─────┬─────┘  │
                     └──────┼────────────┼────────┘
                            │            │
                 credentials held by ClawIQ
                 (never exposed to agents)
                            │            │
┌───────────────────────────┼────────────┼─────────────────────┐
│  ClawIQ Platform (control plane + data proxy)                │
│                           │            │                     │
│  Data Proxy                                                  │
│  ├── Credential vault (OAuth tokens, API keys, encrypted)    │
│  ├── Role-scoped routing (enforced, not instructional)       │
│  ├── Request logging (complete audit trail)                  │
│  └── Rate limiting + cost tracking                           │
│                                                              │
│  Control Plane                                               │
│  ├── Agent catalog (role templates)                          │
│  ├── Command queue (hire/fire/config)                        │
│  ├── Telemetry receiver                                      │
│  └── Cost tracking + budgets                                 │
│                                                              │
│  Dashboard (<company>.clawiq.md)                             │
│  ├── Hire / fire / manage agents                             │
│  ├── Define data access per role                             │
│  ├── Connect data sources (OAuth flows, API keys)            │
│  ├── Chat with agents                                        │
│  ├── Activity feed + audit log                               │
│  ├── Lenny's issues + patches                                │
│  └── Cost tracking + budgets                                 │
│                                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
               poll + data requests
               (outbound from instance)
                           │
┌──────────────────────────┴───────────────────────────────────┐
│  ClawIQ Instance (execution backend)                         │
│                                                              │
│  Agent Runtime (OpenClaw)                                    │
│  ├── Estimator   → calls ClawIQ data proxy                   │
│  ├── PM          → calls ClawIQ data proxy                   │
│  ├── Accountant  → calls ClawIQ data proxy                   │
│  └── Lenny       → calls ClawIQ data proxy + CLI             │
│                                                              │
│  Agents have a ClawIQ token (not customer credentials)       │
│  Proxy enforces: is this agent allowed this endpoint?        │
│                                                              │
│  ClawIQ CLI (telemetry, issues, session analysis)            │
│  Model access (BYOK cloud, local, or ClawIQ-metered)        │
│  Poll daemon (syncs with control plane)                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Why the data proxy matters

Agents never see customer credentials. All data flows through ClawIQ:

- **Credential isolation.** OAuth tokens, API keys stay in ClawIQ's vault. The agent container only has a ClawIQ proxy token.
- **Enforced scoping.** The proxy checks every request against the agent's allowed endpoints. Even if the agent ignores TOOLS.md, the proxy blocks it. Lenny is flagged on repeated 403s.
- **One place to update.** Customer rotates their API key? Update in ClawIQ. Agents don't know.
- **Complete audit trail.** Every data request logged before it reaches the customer's API.
- **Source-agnostic.** Agents call the proxy the same way regardless of whether data comes from a REST API, Google Drive, or a custom data layer. New connectors don't change agent code.

### Communication: poll, not push

The ClawIQ instance initiates all communication. It polls the ClawIQ platform on a schedule — "anything new for me?" — and pulls down commands, updates, and configuration. No inbound ports. No firewall holes. No Tailscale required (though it's an option for lower-latency use cases).

**Outbound from ClawIQ instance → ClawIQ platform:**
- Telemetry (OTEL traces, semantic events, error rates)
- KPI values and report data (for the dashboard)
- Lenny's issues and patches
- Agent roster and status
- Session summaries (not raw transcripts — business data stays local)

**Queued at ClawIQ platform, pulled by ClawIQ instance:**
- Hire/fire agent commands (initiated from the dashboard)
- Agent catalog updates (new personas, improved templates)
- ClawIQ CLI updates
- Configuration patches
- Customer messages relayed from the dashboard chat

This is the same pattern whether the ClawIQ instance runs in ClawIQ's cloud or on-prem. One architecture. The deployment location is a configuration choice, not an architectural fork.

### Why poll-not-push

- **Security.** No inbound ports means no attack surface on the customer's network. The IT provider doesn't need to open firewall rules. The ClawIQ instance reaches out; nothing reaches in.
- **On-prem friendly.** Works behind any corporate firewall, NAT, or proxy. If the machine can make HTTPS requests, it can run a ClawIQ instance.
- **Simpler ops.** No WebSocket connections to maintain, no message queue infrastructure, no Tailscale mesh to manage. Just HTTPS polling.
- **Resilience.** If the ClawIQ platform goes down, the ClawIQ instance keeps running locally. Agents still answer questions, data still syncs, Lenny still reviews. Telemetry queues up and syncs when the connection is restored.

### Deployment modes

| | ClawIQ-hosted | On-prem |
|---|---|---|
| ClawIQ instance location | ClawIQ cloud | Customer's server |
| Business data location | ClawIQ cloud | Customer's premises |
| Model access | Cloud APIs or ClawIQ-metered | Local models + optional cloud fallback |
| Communication | Same: outbound poll | Same: outbound poll |
| Dashboard | `<company>.clawiq.md` | Same |
| Who manages hardware | MTT | Customer's IT provider |
| Data leaves premises | Yes | No (only telemetry + aggregated KPIs) |

On-prem deployments are a natural fit for the IT provider channel. The IT provider installs the ClawIQ instance (a Docker compose on a server they already manage), and the customer's data never leaves the building. The dashboard at `<company>.clawiq.md` shows KPIs and reports but the raw business data stays local.

### Model flexibility

Agents in the ClawIQ instance can use any combination of models:

- **Local models (ollama, llama.cpp):** For routine tasks — health checks, data lookups, simple Q&A. Flat cost, no per-token billing, data stays on-prem.
- **Cloud APIs (bring your own keys):** Customer provides their own Anthropic/OpenAI keys. For complex reasoning — deep bid analysis, cross-referencing documents, nuanced reporting.
- **ClawIQ-metered models (future):** MTT hosts open-source models and meters usage. Simpler than BYOK for customers who don't want to manage API keys. Margin opportunity.

The right model for the job depends on the task. Lenny's hourly health checks don't need Opus. An estimator crunching a complex bid does. The routing can start simple (everything cloud) and get smarter over time.

### Why isolated ClawIQ instances

- **Data isolation is absolute.** One customer's data can never leak to another. Separate instance, separate credential vault, separate proxy. No shared state.
- **Customization is safe.** Different agents, different scoping rules, different API configurations — none of it can affect other customers.
- **We control the environment.** Lenny is pre-configured. The CLI is installed. The proxy is configured. The customer doesn't SSH in or manage infra.
- **On-prem is just a checkbox.** Same Docker, same config, different location. No architectural changes needed.

### Agent sandboxing

Agents in the ClawIQ instance must not be able to modify their own runtime, the OpenClaw configuration, or the infrastructure. They have access to:
- Their workspace files (SOUL.md, TOOLS.md, memory, etc.)
- The local data proxy (via scoped ClawIQ tokens — not customer credentials)
- The ClawIQ CLI (for telemetry and reporting)
- OpenClaw channels (for communicating with the customer)

They do not have access to:
- Gateway configuration
- OpenClaw system files
- Docker or container management
- Other customers' environments

OpenClaw's built-in security (tool allow/deny lists, sandbox modes, exec approval) provides a first layer, but it was designed as a personal assistant framework — not for hostile multi-tenant hosting. Multiple critical CVEs in early 2026 and Snyk-documented sandbox bypasses confirm that OpenClaw's own sandboxing is not sufficient as the sole isolation boundary. The container and network layers below are the real enforcement.

NVIDIA's NemoClaw (announced GTC March 2026) wraps OpenClaw with **OpenShell** — a deny-by-default policy engine that sits outside the agent process, controlling filesystem, network, and process execution at the OS level. OpenShell also includes a **privacy router** that routes sensitive context to local models and only allows cloud model access when policy permits. NemoClaw is early-stage alpha but represents the architecture pattern ClawIQ should adopt or build toward: governance that wraps the agent runtime rather than forking it.

---

## Security architecture

ClawIQ's security is layered. No single layer is trusted alone. Each layer constrains what the layers above it can do.

```
┌── Layer 5: Data Sovereignty ───────────────────────┐
│  Business data never leaves the instance             │
│  Privacy router: sensitive context → local model    │
│  Only telemetry + aggregated KPIs flow outbound     │
│  On-prem = data never leaves the building           │
├── Layer 4: Audit & Observability ──────────────────┤
│  Every agent action logged with params/results      │
│  Every guardrail trigger logged                     │
│  Audit trail flows to ClawIQ platform via poll      │
│  Lenny monitors for anomalous patterns              │
├── Layer 3: Agent Guardrails ───────────────────────┤
│  NeMo Guardrails (or similar) as inference proxy    │
│  ├── PII detection/redaction on all model I/O       │
│  ├── Retrieval rails (enforce role scoping on RAG)  │
│  ├── Execution rails (validate tool calls)          │
│  └── Output rails (block sensitive data leakage)    │
│  OpenClaw tool deny-lists (defense in depth)        │
│  Role-scoped tokens (local data proxy enforces)     │
├── Layer 2: Network Control ────────────────────────┤
│  Egress proxy with DNS + IP allowlist               │
│  Only allowed destinations:                         │
│  ├── ClawIQ platform (poll endpoint)                │
│  ├── AI model APIs (configured per customer)        │
│  └── Customer APIs (called by local data proxy)     │
│  No inbound ports. All communication outbound.      │
├── Layer 1: Container Isolation ────────────────────┤
│  gVisor runtime (user-space kernel, no shared host) │
│  Read-only root filesystem + selective tmpfs mounts  │
│  cap_drop: ALL + no-new-privileges                  │
│  Non-root user + user namespace remapping           │
│  pids_limit (prevents fork bombs)                   │
│  Memory/CPU/disk hard limits                        │
│  Separate Docker network per customer               │
└────────────────────────────────────────────────────┘
```

### Layer 1: Container isolation

The ClawIQ instance runs as a Docker Compose deployment. Each container is hardened:

- **Read-only root filesystem.** Agents physically cannot write to system paths, install packages, or modify config files. Selective `tmpfs` mounts (with size limits) provide `/tmp` and other required writable paths.
- **Zero Linux capabilities.** `cap_drop: ALL` with `no-new-privileges`. Even if an agent finds a setuid binary, it cannot escalate. For an AI agent that runs code and makes HTTP calls, zero capabilities is sufficient.
- **gVisor container runtime.** Drop-in replacement for Docker's default `runc`. gVisor intercepts syscalls in a user-space kernel — the container never touches the host kernel directly. This is the same class of isolation AWS uses for Lambda (Firecracker). gVisor is the practical sweet spot: stronger than standard Docker, simpler than microVMs.
- **Non-root execution** with user namespace remapping. Even root inside the container maps to an unprivileged UID on the host.
- **Resource hard limits.** `pids_limit: 256` (prevents fork bombs), memory caps (OOM killer terminates runaway processes), CPU limits, and disk quotas via sized tmpfs.
- **Separate Docker network per customer.** Containers on different bridge networks cannot communicate. Docker's iptables rules enforce this.

### Layer 2: Network control

Agents only need to reach two things: the local data proxy (inside the instance) and AI model APIs. Everything else is blocked.

- **Egress proxy** (DNS-based filtering with dynamic IP allowlists). Outbound traffic routes through a sidecar that resolves allowed domains and blocks everything else.
- **No inbound ports.** The poll-not-push architecture means the ClawIQ instance has zero inbound attack surface.
- **Agents never call customer APIs directly.** All data requests go through the local data proxy, which holds credentials and enforces scoping. The agent container has no access to customer credentials.

### Layer 3: Agent guardrails

Content-level safety on what enters and exits the AI model.

- **PII detection and redaction.** Input and output rails detect personally identifiable information before it reaches the model and before responses reach the customer. Options: NVIDIA's GLiNER, Microsoft Presidio, or similar — all run locally, no data leaves the ClawIQ instance.
- **Retrieval rails.** When RAG chunks are assembled for the model's context, guardrails verify that only chunks from the agent's allowed collections are included. Defense-in-depth on top of the data proxy's role-scoped enforcement.
- **Execution rails.** Tool calls are validated before and after execution. An agent attempting to call a tool outside its allowed set is blocked and logged.
- **Output rails.** Model responses are scanned before delivery. Sensitive data patterns, toxic content, and off-topic responses can be blocked or flagged.
- **OpenClaw tool deny-lists.** Defense-in-depth. Even if guardrails miss something, OpenClaw's own tool policy system provides a second gate.

The guardrails framework (NeMo Guardrails, LlamaFirewall, or similar) runs as an inference proxy inside the ClawIQ instance. The agent thinks it's talking to a model API; it's actually talking to the guardrails proxy, which talks to the model. This is transparent to the agent — no agent code changes required.

### Layer 4: Audit and observability

Everything is logged.

- **Every agent action** — tool calls, API requests, file reads/writes — logged with parameters and results.
- **Every guardrail trigger** — what was blocked, what was flagged, what rule fired.
- **Every model interaction** — prompts sent, responses received, token counts, latency.
- **Lenny as security monitor.** Lenny already watches telemetry for performance issues. The same pattern applies to security: repeated 403s (scope violations), unusual tool call patterns, excessive resource usage, guardrail triggers. Lenny flags anomalies.
- **Audit trail flows outbound via poll.** The customer and their IT provider can review the complete audit log at `<company>.clawiq.md`. For compliance-sensitive industries, this is the paper trail.

### Layer 5: Data sovereignty

The strongest security claim ClawIQ makes: **business data stays where the customer puts it.**

- **On-prem ClawIQ instances:** Raw business data — API responses, financial records, documents, session transcripts — never leaves the customer's server. The ClawIQ platform receives only telemetry (token counts, error rates, response latency) and aggregated KPIs (the numbers on the dashboard, not the underlying records).
- **Privacy routing for models:** Sensitive queries route to local models running inside the ClawIQ instance. Cloud model APIs are used only when the data sensitivity allows it and the customer's policy permits. This is configurable per role, per task type, or per data domain.
- **Cloud-hosted ClawIQ instances** still maintain per-customer isolation. Each customer's data is in a separate database in a separate container on a separate network. But the data is in ClawIQ's cloud, not the customer's building. The customer chooses based on their sensitivity requirements.

### Security as a value proposition

These layers translate to concrete customer-facing claims:

1. **Your data stays in your box.** On-prem means business data never leaves the building. Cloud means it's isolated in your own environment.
2. **Agents can't go rogue.** Read-only filesystems, zero capabilities, gVisor isolation, resource limits. An agent can't install packages, modify config, or escape its container.
3. **Agents can only see what their role allows.** Role-scoped API keys enforced at the data layer. Guardrails filter what enters the model's context. Double-gated.
4. **PII is caught before it reaches the model.** On-prem with local models means sensitive data never leaves the machine. Cloud models get scrubbed inputs.
5. **Everything is auditable.** Complete log of every agent action, tool call, and guardrail trigger. Reviewable at `<company>.clawiq.md`.
6. **Network-locked.** Egress filtering. Only approved destinations. No inbound ports. Nothing unexpected gets in or out.

---

## The data layer: three tiers

ClawIQ agents need access to the customer's business data. How that data gets into ClawIQ scales from self-service to fully custom:

### Tier 1: Connect your sources (self-service)

The customer signs up at clawiq.md and connects file-based data sources directly:

- Google Drive, Dropbox, SharePoint, OneDrive
- Local file uploads (PDFs, spreadsheets, docs)
- Future: email, CRM exports, accounting exports

A **RAG curation agent** runs automatically — it chunks documents, builds vector embeddings, organizes collections, and keeps the index fresh as files change. The customer doesn't configure chunking strategies or embedding models. The agent handles it.

This is the entry point. No MTT involvement. The customer gets a team of agents that can search and reason over their documents. It's not as deep as a custom data layer — there's no canonical schema, no pre-computed intelligence, no domain-specific API. But it's useful on day one and it gets people in the door.

**Who it's for:** SMBs who want to try agent teams without a consulting engagement. Small teams that live in Google Drive and want agents that can actually find and understand their files.

### Tier 2: Bring your own API (BYOD)

The customer already has data infrastructure — an internal API, a data warehouse, a custom application. ClawIQ doesn't need to build the data layer. It just needs an **agent-friendly API** to call.

The contract is simple: if your API can answer domain-scoped questions via authenticated REST endpoints, ClawIQ's agents can use it. The customer provides:
- API base URL and authentication method
- Endpoint documentation (what's available, what parameters, what response shapes)
- Role definitions (which endpoints each agent role can access)

MTT (or the customer's own team) wires the agents' TOOLS.md to the customer's API. Everything else — the instance, Lenny, the dashboard, the catalog, the security layers — works the same. This is also the path for customers with existing on-prem systems that can't be moved.

**Who it's for:** Companies with existing engineering teams or IT providers who've already built internal tools. Enterprises with on-prem infrastructure. Customers who want the agent team but not the data layer engagement.

### Tier 3: Custom data layer (full engagement)

MTT runs a discovery sprint and uses agents to follow the CUSTOMIZE.md recipe to build a purpose-built intelligence platform:

**Phase 0: Discovery (human-led)**
- Identify the business's central entity (project, property, patient, work order, etc.)
- Inventory source systems (Procore, Sage, QuickBooks, SharePoint, etc.)
- Map 6–10 data domains (financial, schedule, operations, etc.)
- Define 3–5 KPIs for the dashboard
- Catalog 8–12 reports that replace manual spreadsheets

**Phases 1–5: Build (agent-led, human-reviewed)**
- **Data model:** stage → core → serving schema (SQL migrations)
- **Ingestion:** Source extractors, stage→core materialization, core→serving analytics
- **API:** Auth middleware, entity list endpoints, domain-specific routes (all custom per customer)
- **Dashboard:** KPIs, reports, branding applied to the ClawIQ UI template
- **Deploy:** ClawIQ instance provisioned, cron scheduled, credentials stored

**Estimated effort per customer:** 6–10 hours human (mostly discovery + review), 12–20 hours agent time. The more engagements completed in an industry, the less human time required — because connectors, schemas, and domain patterns already exist.

This is the deepest offering. The difference between Tier 1 (RAG over documents) and Tier 3 (canonical data model with pre-computed intelligence) is the difference between an agent that can "search your files" and an agent that knows your change order exposure is $340K and trending up. Tier 3 agents don't just find information — they compute answers from structured, live data.

The full recipe is documented in CUSTOMIZE.md (currently in the MEC reference implementation). It details what's always the same (admin schema, auth middleware, UI primitives, report renderer) vs. what changes every time (stage/core schema, API routes, KPI calculations, source extractors).

**Who it's for:** Customers who want the full value. Businesses with complex source systems (Procore, Sage, QuickBooks) that need real-time data integration, not just document search. Can be hosted on ClawIQ cloud or deployed on-prem.

### The funnel

```
Tier 1: Connect sources (self-service, sign up at clawiq.md)
  │
  │  Customer hits the limits of document-only RAG
  │  "I wish the agent could see my actual Procore data"
  │
  ▼
Tier 2: BYOD API (customer has infra, or IT provider builds it)
  │
  │  Customer wants deeper integration, pre-computed intelligence
  │  "I want the agent to compute answers, not just search"
  │
  ▼
Tier 3: Full engagement (MTT builds the custom data layer)
```

Every tier uses the same instance architecture, the same security layers, the same dashboard, the same Lenny. The difference is the depth of data access underneath. A Tier 1 customer can upgrade to Tier 3 without rebuilding their agent team — the agents just get smarter data to work with.

---

## Role-based data scoping

Each agent gets a ClawIQ token scoped to a role. The role determines which customer API endpoints the agent can access. Scoping is enforced by the local data proxy inside the instance — not by instruction alone.

The customer defines scoping in the dashboard:
- Which endpoints each role can access
- Read-only vs read-write per endpoint (read-only for MVP)
- RAG collection access per role (when RAG is available)

The proxy checks every request: valid token → role lookup → endpoint allowed → forward or deny. An estimator calling `/budget` gets data. Same estimator calling `/invoices` gets 403 and Lenny is notified.

Lenny has admin-level scope — he can access all endpoints. But his persona is constrained: he's a reviewer, not a doer.

---

## Agent catalog

Agents are pre-built personas with domain-specific instructions. Each role gets a template:

```
agent-catalog/
├── estimator/
│   ├── SOUL.md          # How to think about estimates
│   ├── IDENTITY.md      # Name, role, communication style
│   ├── TOOLS.md         # Which API endpoints to use
│   └── BOOTSTRAP.md     # First-run context loading
├── project-manager/
│   ├── ...
├── safety-officer/
│   ├── ...
├── accountant/
│   ├── ...
└── lenny/               # Team monitor, always present
    ├── ...
```

When a customer "hires" an estimator through `<company>.clawiq.md`:
1. Command is queued at the ClawIQ platform
2. Instance picks it up on next poll
3. Agent is created from the `estimator/` template
4. A scoped proxy token is issued (estimator's allowed endpoints only)
5. TOOLS.md is generated with the proxy endpoints this agent can call
6. Workspace is created in the execution backend
7. Lenny is notified of the new team member
8. Status is reported back on next poll

The catalog grows with each engagement. Construction personas come first (estimator, PM, safety officer). As MTT enters new verticals, new personas are added (property manager, maintenance coordinator, compliance analyst, etc.).

---

## RAG layer

Company documents (plans, specs, contracts, meeting notes) are indexed and scoped by role.

```
rag.collections    ("plans", "specs", "bids", "contracts", "safety")
rag.documents      (source_system, source_path, content_hash, metadata)
rag.chunks         (content, embedding vector, token_count)
```

An estimator searching RAG only sees chunks from collections in their role's `rag_collections`. A safety officer searching "fall protection" only sees safety-tagged documents, not financial contracts.

---

## How Lenny fits

Lenny is not the orchestrator. He's the teammate who keeps the team healthy. He comes pre-installed in every ClawIQ instance.

**What Lenny does today (carries forward):**
- Watches OTEL telemetry from all agents
- Runs performance reviews (OTEL + transcript cross-referencing)
- Files issues with specific behavioral patches
- Tracks what's been reported to avoid noise

**What Lenny gains per customer deployment:**

| Capability | How it works |
|-----------|-------------|
| **Team awareness** | Knows who's on the team, their roles, their data scopes. Roster updated when agents are hired/fired. |
| **Cross-agent pattern detection** | Sees all agents' telemetry. Flags when estimator and PM reach different conclusions from the same data. |
| **Data quality monitoring** | Queries the customer API through the proxy with admin scope. Alerts if source data is stale before agents work with bad data. |
| **Scope violation detection** | If an agent repeatedly hits 403s, reports it — either the role is too narrow or the agent's instructions need a patch. |
| **Onboarding review** | Reviews new agents' first sessions more aggressively. Tighter feedback loop during the first week. |

---

## The customer experience

### Engagement flow

```
1. Discovery sprint
   └── MTT interviews the customer
   └── Map source systems, data domains, KPIs, reports
   └── Identify which agent roles they need

2. Build (agent-led, following CUSTOMIZE.md)
   └── Agents generate schema, ETL, API, reports
   └── MTT reviews and validates
   └── ClawIQ instance built and tested

3. Deploy
   └── ClawIQ instance deployed (ClawIQ cloud or customer's server)
   └── <company>.clawiq.md goes live (auto-branded)
   └── ClawIQ instance begins polling ClawIQ platform

4. Handoff
   └── Customer hires their first agents from the catalog
   └── Agents bootstrap: load context, learn the business
   └── Lenny starts monitoring

5. Ongoing (monthly platform fee)
   └── Customer uses dashboard for KPIs and reports
   └── Customer talks to agents via clawiq.md or channels
   └── Agents query real data, provide real answers
   └── Lenny monitors, reviews, patches
   └── MTT handles updates, new connectors, catalog improvements
   └── ClawIQ instance pulls updates automatically via poll
```

### Day-to-day

The customer interacts with their agent team like they'd interact with employees:
- "What's the budget variance on the Riverside account?" → PM queries the customer's API, answers with real numbers
- "Put together a cost estimate based on our last three similar projects" → Estimator pulls historical data from the customer's systems
- "What compliance docs are we missing for the Q2 audit?" → Compliance officer cross-references requirements against uploaded documents
- "Total outstanding AR — who's past 60 days?" → Accountant queries financial endpoints with real numbers

The agents aren't regurgitating training data. They're querying the customer's actual systems through ClawIQ's data proxy. The customer doesn't know what OpenClaw is. They know they have a team at `<company>.clawiq.md` that understands their business.

---

## What exists today

### ClawIQ CLI (this repo)

The CLI runs inside each customer's ClawIQ instance. It is the agent-layer tooling:

| Component | Purpose |
|-----------|---------|
| OTEL telemetry pipeline | Every agent emits traces, errors, semantic events |
| Lenny persona + review system | Team health monitor, always on the team |
| Issue/patch system | Agents file issues with behavioral patches |
| Semantic event taxonomy | Structured vocabulary for agent activity |
| Session transcript analysis | Deep investigation when OTEL flags something |
| ClawIQ API client | Interface agents use to report and query |

### MEC (first customer, reference implementation)

MEC is a general contractor — the first ClawIQ deployment. Their implementation serves as the reference for the CUSTOMIZE.md recipe:

| Component | What it demonstrates |
|-----------|---------------------|
| stage → core → serving schema pattern | The data architecture that applies to any business |
| Procore source connector | First industry connector (construction) |
| Topic-based REST API | Custom API generated from the schema |
| KPI dashboard + report system | The UI pattern that becomes `<company>.clawiq.md` |
| CUSTOMIZE.md | The playbook for standing up new customers |

MEC's codebase is not part of ClawIQ. It's a client deployment. But the patterns extracted from it — the recipe, the reusable UI components, the schema architecture — become part of ClawIQ's framework.

---

## What to build

See **ROADMAP.md** for the detailed build plan with phased delivery. The MVP:

1. **Dashboard** — the product is `<company>.clawiq.md`. Build the UI first, wire up data underneath.
2. **Data proxy** — runs in the instance, enforces scoping, holds credentials, logs everything.
3. **Agent catalog** — pre-configured role templates. Customer picks a role, maps it to endpoints.
4. **Docker instance** — execution backend + local proxy + Lenny + poll daemon.
5. **Poll protocol** — sync credentials, commands, telemetry, and chat between platform and instance.

After MVP: Tier 1 file connectors (self-service), Tier 3 custom data layers (consulting), security hardening, on-prem deployment, reseller program.

---

## Distribution: IT service provider channel

SMBs already have an IT service provider — the local company that manages their network, their email, their computers. Those providers get asked "can you set up AI for us?" and today they don't have a good answer.

ClawIQ gives them one. The arrangement:

- **IT provider sells the relationship.** They're already trusted by the SMB. They position ClawIQ as part of their service offering: "We partner with ClawIQ for AI agent teams."
- **MTT builds and hosts (or the IT provider hosts on-prem).** Discovery, build, deploy, ongoing updates. For on-prem, the IT provider manages the hardware; MTT manages the software via the poll channel.
- **Revenue share.** The IT provider gets a percentage of the monthly/yearly platform fee. Recurring revenue for them, distribution for MTT.

On-prem deployments are especially attractive for this channel. The IT provider installs the ClawIQ instance on a server they already manage. The customer's data never leaves the building. The IT provider can point to the physical box and say "your AI runs right there." That's a trust signal that no cloud-only product can match.

This scales without MTT doing direct sales to every SMB. The IT providers are the channel. They bring the relationship, MTT brings the product.

---

## Business model

**Three tiers, one platform.**

| | Tier 1: Connect | Tier 2: BYOD | Tier 3: Custom |
|---|---|---|---|
| Data layer | RAG over connected files | Customer's existing API | MTT builds it (CUSTOMIZE.md) |
| Setup | Self-service | Light configuration | Discovery sprint + build |
| Setup cost | Free / included | Configuration fee | Fixed-scope engagement |
| Monthly | Platform fee + AI costs | Platform fee + AI costs | Platform fee + AI costs |
| MTT involvement | None | Minimal | Full engagement |
| Deployment | Cloud | Cloud or on-prem | Cloud or on-prem |

**Model cost options (all tiers):**
- **Bring your own keys:** Customer provides Anthropic/OpenAI API keys. They pay the model providers directly. ClawIQ charges for platform only.
- **Local models:** Customer runs open-source models on their hardware. No per-token cost. Higher upfront hardware investment but predictable ongoing costs.
- **ClawIQ-metered (future):** MTT hosts models and meters usage. Simpler for customers, margin opportunity for MTT.

**What compounds with each engagement:**
- Connector library (each source system integration is reusable across customers)
- Agent persona catalog (role templates improve with every deployment)
- Industry domain knowledge (how GCs use Procore + Sage is learned, not guessed)
- The recipe itself (CUSTOMIZE.md gets battle-tested with every customer)
- Speed (engagement #5 in construction is dramatically faster than engagement #1)

**The trajectory:** Build ClawIQ by delivering real engagements. Each engagement makes the framework better. At some point, the framework is mature enough that new engagements in known industries are nearly turnkey. The consulting practice funds the product development. The product makes the consulting practice faster. Flywheel.

---

## Why ClawIQ vs. enterprise AI products

Claude, ChatGPT, and others will ship agent products for enterprise. They'll have better models, bigger teams, and wider distribution. ClawIQ wins on different axes:

**1. Depth over breadth.** Enterprise AI products will build generic connectors — "connect your Procore" and get RAG over your API. ClawIQ builds a canonical data model for your business: stage→core→serving, custom API routes per domain, pre-computed intelligence layers. The difference is an agent that can "search your Procore docs" vs. an agent that knows your change order exposure on the Spring Creek job is $340K and trending up.

**2. Vertical expertise compounds.** Enterprise products serve everyone generically. ClawIQ gets deeply good at specific industries. By customer #5 in construction, the connectors exist, the personas are tuned, the KPIs are proven. That depth can't be replicated by a horizontal platform.

**3. SMBs aren't their customer.** Enterprise AI is priced and sold for companies with IT departments and six-figure software budgets. A 50-person GC doesn't have a CISO. They have Dave. Dave wants someone to set it up and make it work. The IT provider channel serves Dave.

**4. Model-agnostic.** ClawIQ runs on whatever model makes sense — Claude for complex reasoning, a local llama for routine lookups, GPT for something in between. Enterprise products lock you into their model. When the next model leap happens, ClawIQ's data layer stays the same and the model swaps.

**5. Data sovereignty.** On-prem ClawIQ instances mean business data never leaves the building. No enterprise AI product offers that. For construction, legal, healthcare, finance — industries where data sensitivity is a dealbreaker — this is the answer.

**6. Security you can point to.** Five layers: container isolation with gVisor, network egress filtering, content guardrails with PII detection, complete audit logging, and data sovereignty. Enterprise AI products say "we take security seriously." ClawIQ says "here's the audit log, here's the egress allowlist, here's the box under your desk where the data lives." Concrete beats abstract.

**7. The data layer outlasts everything.** Models change. Agent frameworks evolve. The customer's canonical data model and unified API persist. ClawIQ sells understanding of the business, not access to a model.

**8. Bring your own data layer.** Customers with existing infrastructure don't need a full engagement. Connect their API in the dashboard and go. Enterprise AI products assume they own the whole stack. ClawIQ meets customers where they are.

---

## Why customers choose ClawIQ

1. **Agents that actually work.** Not demos. Agents connected to the company's live data, scoped to what they need. An estimator that queries real budget history. A PM that reads the actual schedule.

2. **Safe and secure by default.** Five-layer security: container isolation (gVisor, read-only FS, zero capabilities), network lockdown (egress filtering, no inbound ports), content guardrails (PII detection, role enforcement, output scanning), complete audit logging, and data sovereignty (on-prem option where business data never leaves the building). Every agent action is logged and reviewable.

3. **The data layer outlasts the models.** Models change. Agent frameworks evolve. The customer's canonical data model and unified API persist. When better agents come out, they plug into the same data layer.

4. **Quality built in.** Lenny monitors every agent. Performance reviews, issue detection, behavioral patches. The agent team improves over time without the customer managing it.

5. **Data stays where you want it.** Cloud or on-prem — customer's choice. On-prem means business data never leaves the building. The dashboard shows aggregated metrics, not raw data.

6. **Start simple, go deep.** Connect Google Drive and get agents searching your documents today. When you're ready, bring your own API or hire MTT to build a custom data layer. Same agents, same dashboard — deeper data underneath.

7. **Speed to value.** MTT delivers in weeks using a proven recipe. The customer goes from "we'd like AI to help with X" to agents that answer questions with real data, fast.

8. **They don't need to understand AI.** The customer talks to their agents. The agents understand the business. ClawIQ handles everything underneath. "OpenClaw" is not in their vocabulary — "claws" are just what they call their agents.

9. **Cost flexibility.** Bring your own API keys, run local models, or use ClawIQ-metered. The customer picks the model economics that work for their budget and sensitivity requirements.
