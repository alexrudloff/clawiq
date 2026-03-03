import { getClawiqWebRuntime } from "./runtime.js";

const CHANNEL_ID = "clawiq-web";
const DEFAULT_ACCOUNT_ID = "default";
const DEFAULT_AGENT_ID = "clawiq";
const DEFAULT_POLL_INTERVAL_MS = 2500;
const MIN_POLL_INTERVAL_MS = 1000;
const MAX_POLL_INTERVAL_MS = 30000;

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function asInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeEndpoint(value) {
  return asString(value).replace(/\/+$/, "");
}

function resolveSecretValue(raw) {
  const value = asString(raw);
  if (!value) return "";

  if (value.startsWith("env:")) {
    const envKey = value.slice(4).trim();
    return envKey ? asString(process.env[envKey]) : "";
  }

  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, envKey) => asString(process.env[envKey]));
}

function resolveChannelSection(cfg) {
  const channels = asObject(cfg?.channels);
  return asObject(channels[CHANNEL_ID]);
}

function resolveAccounts(section) {
  return asObject(section.accounts);
}

function listConfiguredAccountIds(cfg) {
  const section = resolveChannelSection(cfg);
  const ids = Object.keys(resolveAccounts(section)).filter((key) => asString(key) !== "");
  return ids.length > 0 ? ids : [DEFAULT_ACCOUNT_ID];
}

function resolveClawiqWebAccount(cfg, requestedAccountId) {
  const section = resolveChannelSection(cfg);
  const accounts = resolveAccounts(section);

  const incomingAccountId = asString(requestedAccountId);
  const accountId =
    incomingAccountId && accounts[incomingAccountId] && typeof accounts[incomingAccountId] === "object"
      ? incomingAccountId
      : DEFAULT_ACCOUNT_ID;
  const accountSection = accountId === DEFAULT_ACCOUNT_ID ? {} : asObject(accounts[accountId]);

  const endpoint = normalizeEndpoint(accountSection.apiBaseUrl ?? section.apiBaseUrl);
  const apiKey = resolveSecretValue(accountSection.apiKey ?? section.apiKey);
  const enabled = asBoolean(accountSection.enabled, asBoolean(section.enabled, true));
  const pollIntervalMs = clamp(
    asInt(accountSection.pollIntervalMs ?? section.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS),
    MIN_POLL_INTERVAL_MS,
    MAX_POLL_INTERVAL_MS,
  );
  const agentId = asString(accountSection.agentId ?? section.agentId) || DEFAULT_AGENT_ID;

  return {
    accountId,
    enabled,
    configured: endpoint !== "" && apiKey !== "",
    config: {
      endpoint,
      apiKey,
      pollIntervalMs,
      agentId,
    },
  };
}

function updateRuntimeStatus(ctx, patch) {
  const current = asObject(typeof ctx.getStatus === "function" ? ctx.getStatus() : {});
  ctx.setStatus({
    ...current,
    accountId: ctx.accountId,
    ...patch,
  });
}

function sleep(ms, signal) {
  if (signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    }
  });
}

async function postJson(url, apiKey, body, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const detail = asString(payload?.error) || response.statusText || "request failed";
      throw new Error(`HTTP ${response.status}: ${detail}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function pollInboundMessages(account, limit) {
  const payload = await postJson(
    `${account.config.endpoint}/v1/lenny/channel/poll`,
    account.config.apiKey,
    {
      agent_id: account.config.agentId,
      limit,
    },
  );

  const messages = Array.isArray(payload?.data?.messages)
    ? payload.data.messages
    : Array.isArray(payload?.messages)
      ? payload.messages
      : [];

  return messages
    .map((entry) => ({
      id: asString(entry?.id),
      conversationId: asString(entry?.conversation_id),
      agentId: asString(entry?.agent_id) || account.config.agentId,
      content: asString(entry?.content),
    }))
    .filter((entry) => entry.id && entry.conversationId && entry.content);
}

async function postAssistantReply(account, message, content) {
  return postJson(
    `${account.config.endpoint}/v1/lenny/channel/reply`,
    account.config.apiKey,
    {
      conversation_id: message.conversationId,
      inbound_message_id: message.id,
      agent_id: message.agentId || account.config.agentId,
      content,
    },
  );
}

async function markInboundFailed(account, inboundMessageId, error) {
  try {
    await postJson(
      `${account.config.endpoint}/v1/lenny/channel/fail`,
      account.config.apiKey,
      {
        inbound_message_id: inboundMessageId,
        error,
      },
      8000,
    );
  } catch {
    // Best effort: plugin should keep running even if failure reporting fails.
  }
}

async function deliverInboundMessage(ctx, account, message) {
  const runtime = getClawiqWebRuntime();
  const inboundHandler = runtime?.channel?.reply?.handleInboundMessage;
  if (typeof inboundHandler !== "function") {
    throw new Error("OpenClaw inbound handler unavailable");
  }

  let replied = false;
  await inboundHandler({
    channel: CHANNEL_ID,
    accountId: account.accountId,
    senderId: `clawiq:${message.conversationId}`,
    chatType: "direct",
    chatId: message.conversationId,
    text: message.content,
    reply: async (replyText) => {
      const content = asString(replyText);
      if (!content) {
        return;
      }
      replied = true;
      await postAssistantReply(account, message, content);
      updateRuntimeStatus(ctx, {
        lastOutboundAt: Date.now(),
        lastError: null,
      });
    },
  });

  if (!replied) {
    await markInboundFailed(account, message.id, "No assistant response");
  }
}

async function startMonitorLoop(ctx) {
  const account = ctx.account;
  updateRuntimeStatus(ctx, {
    accountId: account.accountId,
    enabled: account.enabled,
    configured: account.configured,
    running: true,
    lastStartAt: Date.now(),
    lastStopAt: null,
    lastError: null,
    apiBaseUrl: account.config.endpoint,
  });

  ctx.log?.info?.(
    `[${account.accountId}] clawiq-web monitor started (agent=${account.config.agentId}, interval=${account.config.pollIntervalMs}ms)`,
  );

  while (!ctx.abortSignal.aborted) {
    try {
      const batch = await pollInboundMessages(account, 5);

      if (batch.length === 0) {
        await sleep(account.config.pollIntervalMs, ctx.abortSignal);
        continue;
      }

      for (const message of batch) {
        if (ctx.abortSignal.aborted) {
          break;
        }

        try {
          updateRuntimeStatus(ctx, {
            lastInboundAt: Date.now(),
            lastError: null,
          });
          await deliverInboundMessage(ctx, account, message);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          updateRuntimeStatus(ctx, { lastError: detail });
          ctx.log?.error?.(`[${account.accountId}] failed to process message ${message.id}: ${detail}`);
          await markInboundFailed(account, message.id, detail);
        }
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      updateRuntimeStatus(ctx, { lastError: detail });
      ctx.log?.error?.(`[${account.accountId}] poll failed: ${detail}`);
      await sleep(Math.max(account.config.pollIntervalMs, 5000), ctx.abortSignal);
    }
  }

  updateRuntimeStatus(ctx, {
    running: false,
    lastStopAt: Date.now(),
  });
  ctx.log?.info?.(`[${account.accountId}] clawiq-web monitor stopped`);
}

export const clawiqWebChannel = {
  id: CHANNEL_ID,
  meta: {
    id: CHANNEL_ID,
    label: "ClawIQ Web",
    selectionLabel: "ClawIQ Web",
    docsPath: "/docs/channels/clawiq-web",
    blurb: "Bridge the ClawIQ web app to a local Lenny runtime.",
    order: 95,
  },
  capabilities: {
    chatTypes: ["direct"],
  },
  reload: { configPrefixes: [`channels.${CHANNEL_ID}`] },
  configSchema: {
    schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        enabled: { type: "boolean" },
        apiBaseUrl: { type: "string" },
        apiKey: { type: "string" },
        agentId: { type: "string" },
        pollIntervalMs: {
          type: "number",
          minimum: MIN_POLL_INTERVAL_MS,
          maximum: MAX_POLL_INTERVAL_MS,
        },
      },
    },
    uiHints: {
      apiBaseUrl: {
        label: "ClawIQ API URL",
      },
      apiKey: {
        label: "ClawIQ API Key",
        sensitive: true,
      },
      agentId: {
        label: "Default Agent ID",
      },
      pollIntervalMs: {
        label: "Poll Interval (ms)",
        advanced: true,
      },
    },
  },
  config: {
    listAccountIds: (cfg) => listConfiguredAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveClawiqWebAccount(cfg, accountId),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    isEnabled: (account) => account.enabled,
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: "ClawIQ Web",
      enabled: account.enabled,
      configured: account.configured,
    }),
  },
  security: {
    resolveDmPolicy: () => ({
      policy: "open",
      allowFrom: [],
      allowFromPath: `channels.${CHANNEL_ID}`,
      approveHint: "ClawIQ web requests are authenticated by account token.",
    }),
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ cfg, to, text, accountId }) => {
      const account = resolveClawiqWebAccount(cfg, accountId);
      const conversationId = asString(to);
      if (!conversationId) {
        throw new Error("clawiq-web outbound target must be a conversation id");
      }
      const content = asString(text);
      if (!content) {
        throw new Error("clawiq-web outbound text is empty");
      }

      const payload = await postJson(
        `${account.config.endpoint}/v1/lenny/channel/reply`,
        account.config.apiKey,
        {
          conversation_id: conversationId,
          agent_id: account.config.agentId,
          content,
        },
      );

      const messageId = asString(payload?.data?.message?.id) || `${CHANNEL_ID}-${Date.now()}`;
      return { channel: CHANNEL_ID, messageId };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      configured: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    },
    collectStatusIssues: (accounts) =>
      accounts.flatMap((account) => {
        const lastError = asString(account.lastError);
        if (!lastError) {
          return [];
        }
        return [
          {
            channel: CHANNEL_ID,
            accountId: account.accountId,
            kind: "runtime",
            message: `Channel error: ${lastError}`,
          },
        ];
      }),
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      lastInboundAt: snapshot.lastInboundAt ?? null,
      lastOutboundAt: snapshot.lastOutboundAt ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: "ClawIQ Web",
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
      apiBaseUrl: account.config.endpoint,
      agentId: account.config.agentId,
    }),
    resolveAccountState: ({ enabled }) => (enabled ? "enabled" : "disabled"),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      if (!account.enabled) {
        ctx.log?.warn?.(`[${account.accountId}] clawiq-web disabled; monitor not started`);
        return;
      }
      if (!account.configured) {
        throw new Error("clawiq-web requires channels.clawiq-web.apiBaseUrl and apiKey");
      }
      return startMonitorLoop(ctx);
    },
  },
};
