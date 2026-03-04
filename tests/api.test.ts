/**
 * ClawIQ API integration tests
 * Uses account: arudloff@gmail.com
 * Run: npx vitest run tests/api.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'https://api.clawiq.md';
const ACCOUNT_EMAIL = 'arudloff@gmail.com';
const ACCOUNT_NAME = 'Alex Rudloff';

let apiToken: string;
let apiKey: string;

// ── Auth ─────────────────────────────────────────────────────────

describe('Auth', () => {
  it('obtains a JWT via OAuth endpoint', async () => {
    const res = await fetch(`${API_BASE}/v1/auth/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ACCOUNT_EMAIL,
        name: ACCOUNT_NAME,
        provider: 'google',
        provider_id: 'test-integration',
      }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.token).toBeTruthy();
    expect(data.data.account.email).toBe(ACCOUNT_EMAIL);
    expect(data.data.account.id).toBeTruthy();

    apiToken = data.data.token;
  });
});

// ── API Key auth ──────────────────────────────────────────────────

describe('API Key', () => {
  beforeAll(() => {
    // Load from env or config file
    apiKey = process.env.CLAWIQ_API_KEY || '';
    if (!apiKey) {
      try {
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync(`${process.env.HOME}/.clawiq/config.json`, 'utf-8'));
        apiKey = config.apiKey || '';
      } catch {}
    }
  });

  it('API key is present', () => {
    expect(apiKey).toBeTruthy();
  });

  it('can emit an event with API key', async () => {
    const res = await fetch(`${API_BASE}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        events: [{
          type: 'task',
          name: 'api-integration-test',
          source: 'agent',
          severity: 'info',
          agent_id: 'friday',
          action_tags: ['completed'],
        }],
      }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    // API returns {accepted, event_ids} directly (no success wrapper)
    expect(data.accepted).toBe(1);
    expect(data.event_ids).toHaveLength(1);
    console.log(`  → event id: ${data.event_ids[0]}`);
  });
});

// ── Events ────────────────────────────────────────────────────────

describe('Events', () => {
  beforeAll(async () => {
    if (!apiToken) {
      const res = await fetch(`${API_BASE}/v1/auth/oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ACCOUNT_EMAIL,
          name: ACCOUNT_NAME,
          provider: 'google',
          provider_id: 'test-integration',
        }),
      });
      const data = await res.json();
      apiToken = data.data.token;
    }
  });

  it('GET /v1/events returns events with JWT', async () => {
    const res = await fetch(`${API_BASE}/v1/events?since=24h&limit=10`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.events)).toBe(true);
    console.log(`  → ${data.data.events.length} events returned`);
  });

  it('GET /v1/events returns events with API key', async () => {
    const res = await fetch(`${API_BASE}/v1/events?since=24h&limit=10`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.events)).toBe(true);
    console.log(`  → ${data.data.events.length} events returned`);
  });

  it('GET /v1/events?type=issue returns issues', async () => {
    const res = await fetch(`${API_BASE}/v1/events?type=issue&since=7d&limit=10`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.events)).toBe(true);
    console.log(`  → ${data.data.events.length} issues returned`);
  });

  it('JWT and API key return same account data', async () => {
    const [jwtRes, keyRes] = await Promise.all([
      fetch(`${API_BASE}/v1/events?since=1h&limit=5`, {
        headers: { 'Authorization': `Bearer ${apiToken}` },
      }),
      fetch(`${API_BASE}/v1/events?since=1h&limit=5`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }),
    ]);

    const [jwtData, keyData] = await Promise.all([jwtRes.json(), keyRes.json()]);

    expect(jwtData.success).toBe(true);
    expect(keyData.success).toBe(true);

    // Both should return the same number of events (same account)
    expect(jwtData.data.events.length).toBe(keyData.data.events.length);
  });
});

// ── Traces ────────────────────────────────────────────────────────

describe('Traces', () => {
  it('GET /v1/traces returns traces', async () => {
    const res = await fetch(`${API_BASE}/v1/traces?since=24h&limit=10`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    console.log(`  → ${data.data?.traces?.length ?? 0} traces returned`);
  });
});

// ── Issues ────────────────────────────────────────────────────────
// Issues are stored as events with type=issue.
// Use POST /v1/events with type:"issue" to create,
// GET /v1/events?type=issue to retrieve.

describe('Issues', () => {
  let issueEventId: string;

  it('POST /v1/events creates an issue event', async () => {
    const res = await fetch(`${API_BASE}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        events: [{
          type: 'issue',
          name: 'api-integration-test-issue',
          source: 'agent',
          severity: 'info',
          agent_id: 'friday',
          meta: {
            target_agent: 'friday',
            issue_impact: 'low',
            title: 'API integration test issue',
            description: 'Created by automated API tests. Safe to ignore.',
            evidence: 'Test run at ' + new Date().toISOString(),
          },
        }],
      }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.accepted).toBe(1);
    expect(data.event_ids).toHaveLength(1);
    issueEventId = data.event_ids[0];
    console.log(`  → issue event created: ${issueEventId}`);
  });

  it('GET /v1/events?type=issue returns issues', async () => {
    const res = await fetch(`${API_BASE}/v1/events?type=issue&since=7d&limit=10`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.events)).toBe(true);
    console.log(`  → ${data.data.events.length} issues returned`);
  });
});

// ── No auth ───────────────────────────────────────────────────────

describe('Auth rejection', () => {
  it('rejects requests with no auth header', async () => {
    const res = await fetch(`${API_BASE}/v1/events?since=1h`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects requests with bad token', async () => {
    const res = await fetch(`${API_BASE}/v1/events?since=1h`, {
      headers: { 'Authorization': 'Bearer bad-token-here' },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
