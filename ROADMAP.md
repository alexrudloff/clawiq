# ROADMAP.md — ClawIQ

## What ClawIQ is (architecturally)

ClawIQ is the **control plane for AI employee teams**. The dashboard at `<company>.clawiq.md` is where customers hire, manage, and talk to their AI employees. ClawIQ manages credentials, enforces data scoping, and provides the audit trail — but the actual data proxy runs locally inside each instance so data requests never leave the customer's network.

The execution backend (currently OpenClaw) runs the agents. ClawIQ tells them what to do and controls what data they can see. If the execution backend changes, the customer doesn't notice.

### Full architecture

```
┌── ClawIQ Platform (control plane) ───────────────────────────┐
│                                                               │
│  Dashboard (<company>.clawiq.md)                              │
│  ├── Hire / fire / manage agents                              │
│  ├── Define data access per role                              │
│  ├── Connect data sources (OAuth flows, API keys)             │
│  ├── Chat with agents                                         │
│  ├── Activity feed + audit log                                │
│  ├── Lenny's issues + patches                                 │
│  └── Cost tracking + budgets                                  │
│                                                               │
│  Control Plane API                                            │
│  ├── Agent catalog (role templates)                           │
│  ├── Command queue (hire/fire/config)                         │
│  ├── Credential store (encrypted, synced to instances)        │
│  ├── Scope definitions (which agents get which endpoints)     │
│  ├── Telemetry receiver                                       │
│  └── Audit log aggregator                                     │
│                                                               │
└──────────────────────────┬────────────────────────────────────┘
                           │
               poll (outbound from instance)
               ├── pulls: commands, credentials, scope config
               └── pushes: telemetry, audit logs, agent status
                           │
┌──────────────────────────┴────────────────────────────────────┐
│  ClawIQ Instance                                              │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Data Proxy (runs locally inside the instance)          │  │
│  │  ├── Credential vault (synced from platform, encrypted) │  │
│  │  ├── Scope enforcement (deny by default)                │  │
│  │  ├── Request logging (full audit trail, syncs to        │  │
│  │  │   platform via poll)                                 │  │
│  │  ├── Rate limiting                                      │  │
│  │  └── Calls customer APIs using stored credentials       │  │
│  └──────────────────────────┬──────────────────────────────┘  │
│                              │                                 │
│  ┌──────────────────────────┴──────────────────────────────┐  │
│  │  Agent Runtime (OpenClaw)                               │  │
│  │  ├── Estimator   → calls local data proxy               │  │
│  │  ├── PM          → calls local data proxy               │  │
│  │  ├── Accountant  → calls local data proxy               │  │
│  │  └── Lenny       → calls local data proxy + CLI         │  │
│  │                                                         │  │
│  │  Agents have a ClawIQ token (not customer credentials)  │  │
│  │  Agents call: localhost:{port}/data/{endpoint}          │  │
│  │  Proxy enforces scope locally — no network hop          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ClawIQ CLI (telemetry, issues, session analysis)             │
│  Poll daemon (syncs with platform)                            │
│  Model access (BYOK cloud, local, or ClawIQ-metered)         │
│                                                               │
└──────────────────────────┬────────────────────────────────────┘
                           │
               customer API calls (direct from instance)
                           │
               ┌───────────┴───────────┐
               │  Customer Data Sources │
               │  ├── REST API          │
               │  ├── Google Drive      │
               │  └── etc.              │
               └───────────────────────┘
```

### Data request flow

```
Agent (Estimator) wants project budget data:

  1. Estimator calls:  GET localhost:9400/data/projects/42/budget
                       Authorization: Bearer clawiq_agent_est_abc123

  2. Local data proxy checks:
     ├── Valid token?                              → yes
     ├── This agent = Estimator?                   → yes
     ├── /projects/*/budget in allowed endpoints?  → yes
     ├── Log request (agent, endpoint, timestamp)
     └── Forward to customer API:
           GET https://customer-api.com/projects/42/budget
           Authorization: Bearer <customer's API key from vault>

  3. Customer API responds → proxy returns to agent

  4. Audit log entry queued for next poll sync:
     { agent: "estimator", endpoint: "/projects/42/budget",
       status: 200, timestamp: "..." }
```

```
Agent (Estimator) tries to access invoices (not in scope):

  1. Estimator calls:  GET localhost:9400/data/invoices?status=overdue

  2. Local data proxy checks:
     ├── /invoices in Estimator's allowed endpoints?  → NO
     ├── Log denied request
     ├── Return 403
     └── Flag for Lenny (repeated 403s = issue)
```

### Why the proxy runs in the instance (not the platform)

- **Data sovereignty.** Data requests go directly from instance to customer API. For on-prem, data never leaves the building. If the proxy were in the cloud, every request would traverse the internet — breaking the core promise.
- **No latency penalty.** Proxy is localhost. Agent makes 15 API calls to answer a question — zero extra network hops.
- **Offline resilience.** If the ClawIQ platform goes down, agents keep working. Credentials are cached locally. Audit logs queue and sync when connection is restored.
- **Credential security.** Credentials are synced from platform to instance (encrypted in transit and at rest). The platform is the source of truth; the instance has a local copy. Credential rotation happens in the platform and propagates on next poll.

### How credentials flow

```
1. Customer connects API in dashboard
   └── Enters credentials at <company>.clawiq.md
   └── Platform encrypts and stores in credential store

2. Instance polls platform
   └── Receives encrypted credential bundle
   └── Decrypts and stores in local vault
   └── Local proxy uses credentials for upstream calls

3. Customer rotates credentials
   └── Updates in dashboard
   └── Platform pushes new bundle on next poll
   └── Instance hot-swaps credentials (no agent restart)
```

---

## MVP: Agent team on your API

Customer provides a REST API. ClawIQ gives them a team of AI employees that query it through a local data proxy. Credentials stay in ClawIQ's vault, scoping is enforced, everything is logged.

### What the customer gets

- Dashboard at `<company>.clawiq.md`
- Agent catalog — pre-configured roles to hire
- Each agent scoped to specific endpoints (enforced locally at the proxy)
- Lenny reviewing every agent automatically
- Audit log of every agent action and data request
- Chat with any agent from the dashboard

### What the customer provides

- REST API base URL + auth credentials (stored in ClawIQ, never exposed to agents)
- Description of endpoints (or OpenAPI spec)
- Which roles they want and which endpoints each role can access

---

## MVP Build Phases

### Phase 1: Dashboard + onboarding (skeleton)
_The product IS the dashboard. Build it first, even with mock data._

- [ ] Auth (email/password or Google OAuth)
- [ ] Onboarding flow: provide API URL + auth, describe endpoints, confirm
- [ ] Team roster page (empty state → first hire)
- [ ] Hire flow: browse catalog → pick role → assign endpoints → hire (queues command)
- [ ] Activity feed (placeholder)
- [ ] Auto-branding: customer name

### Phase 2: Data proxy + credential vault
_The core of ClawIQ's security and scoping._

- [ ] Proxy service (runs inside instance): receives agent requests, validates scope, forwards to customer API
- [ ] Credential vault: encrypted storage, synced from platform
- [ ] Agent tokens: per-agent bearer tokens scoped to allowed endpoints
- [ ] Scope enforcement: endpoint allowlist per agent, deny everything else
- [ ] Request logging: every request logged (agent, endpoint, status, timestamp)
- [ ] 403 flagging: repeated violations trigger Lenny alerts

### Phase 3: Agent catalog + provisioning
_Making agents hirable._

- [ ] Catalog data model: role templates with identity, persona, capabilities, default scoping
- [ ] Five MVP roles: Project Manager, Estimator, Compliance Officer, Accountant, Operations Analyst
- [ ] TOOLS.md generation: role template + allowed proxy endpoints → agent-specific tool docs
- [ ] Provisioning: create agent in execution backend + issue proxy token
- [ ] Deprovisioning: remove agent, revoke proxy token, clean workspace

### Phase 4: ClawIQ instance (Docker)
_The execution environment._

- [ ] Docker Compose: execution backend (OpenClaw) + data proxy + ClawIQ CLI + Lenny + poll daemon
- [ ] Execution backend pre-configured: tool deny-lists, sandbox mode, auth
- [ ] Egress filtering: only allow ClawIQ platform + customer API (via proxy) + model APIs
- [ ] Container hardening: read-only FS, non-root, cap_drop ALL, resource limits
- [ ] Agents configured to call local proxy only

### Phase 5: Poll protocol
_How instances and the platform stay in sync._

- [ ] Instance → platform: agent status, telemetry, Lenny's issues, audit logs
- [ ] Platform → instance: commands, credential bundles, scope config, catalog updates, chat messages
- [ ] Instance registration and authentication
- [ ] Credential sync (encrypted bundle, hot-swap without restart)
- [ ] Chat relay (short poll interval during active conversations — 2s, not 30s)

### Phase 6: Dashboard (full)
_Wire everything up._

- [ ] Team roster: live agent data from instance
- [ ] Fire flow: select → confirm → decommission
- [ ] Activity feed: real data from audit logs
- [ ] Lenny's issues: synced from instance
- [ ] Chat: messages relayed through poll (2s interval when active)
- [ ] Audit log: searchable, filterable
- [ ] Cost tracking: per-agent spend, budget limits, warnings

---

## What's already built

| Component | Status | MVP role |
|-----------|--------|----------|
| ClawIQ CLI (emit, pull, report, session) | Working | Ships inside the instance |
| Lenny persona + review system | Working | Pre-installed, monitors all agents |
| Issue/patch system | Working | Lenny files issues, dashboard displays |
| OTEL telemetry pipeline | Working | Agents emit traces/events |
| Session transcript analysis | Working | Lenny uses for deep reviews |
| ClawIQ API client | Working | Agents report to the platform |
| Landing page (`/new`) | Working | Customer acquisition |
| Web app (clawiq-app) | Partial | Auth, API proxy, basic UI — needs dashboard rebuild |

---

## After MVP

### Tier 1: Self-service file connectors
- Google Drive, Dropbox, SharePoint OAuth flows in the dashboard
- Customer authenticates → platform stores tokens → syncs to instance → local proxy serves files to agents
- RAG curation agent (auto-chunking, indexing, runs in instance)
- Agents call the same local proxy — they don't know the data source changed
- Sign up at clawiq.md, no MTT involvement

### Tier 3: Custom data layer
- CUSTOMIZE.md recipe (discovery → schema → ETL → custom API)
- Custom API runs inside the instance behind the local proxy
- KPIs and reports on dashboard
- Source system connectors (industry-specific)
- Premium consulting engagement

### Security hardening
- gVisor container runtime
- Inference guardrails (PII detection/redaction, output filtering)
- Privacy routing (sensitive queries → local models)
- Per-agent budget auto-pause

### On-prem
- Same Docker, customer's server
- Proxy runs locally — all data requests stay on-premises
- Poll-not-push for control plane connectivity (outbound only)
- Local model support (ollama)
- IT provider installation guide

### Reseller program
- Partner portal, revenue share tracking
- Referral management

---

## Principles

1. **ClawIQ is the control plane. The proxy runs in the instance.** The platform manages credentials and scope definitions. The instance enforces them locally. Data requests never route through ClawIQ's cloud.
2. **The execution backend is swappable.** OpenClaw today, something else tomorrow. The customer sees ClawIQ.
3. **Dashboard first.** The product is the dashboard. Build it before the infrastructure. Demo with mock data. Wire up real data underneath.
4. **Lenny is the differentiator.** Others can put agents on an API. Nobody else has a built-in manager that makes the team better every week.
5. **The data layer is the moat, not the MVP.** Control plane + proxy first. Connectors and custom data layers when customers need them.
6. **Proxy-first means source-agnostic.** Agents call the local proxy the same way regardless of data source. New connectors don't change agent code.
7. **Offline-capable.** If the platform is unreachable, the instance keeps working with cached credentials and queued audit logs.
