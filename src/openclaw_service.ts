import { join } from 'path';
import { OpenClawBinding, OpenClawConfig, OPENCLAW_DIR } from './openclaw.js';

const CLAWIQ_WEB_PLUGIN_ID = 'clawiq-web';
const CLAWIQ_WEB_EXTENSION_PATH = join(OPENCLAW_DIR, 'extensions', CLAWIQ_WEB_PLUGIN_ID);

export function configureOtelDiagnostics(config: OpenClawConfig, apiKey: string, endpoint: string): void {
  if (!config.diagnostics) {
    config.diagnostics = {};
  }
  if (!config.diagnostics.otel) {
    config.diagnostics.otel = {};
  }

  config.diagnostics.enabled = true;
  config.diagnostics.otel.enabled = true;
  config.diagnostics.otel.endpoint = endpoint;
  if (!config.diagnostics.otel.headers) {
    config.diagnostics.otel.headers = {};
  }
  config.diagnostics.otel.headers.Authorization = `Bearer ${apiKey}`;
  config.diagnostics.otel.traces = true;
  config.diagnostics.otel.metrics = true;
  config.diagnostics.otel.logs = true;
}

export function ensureDiagnosticsPlugin(config: OpenClawConfig): boolean {
  if (!config.plugins) {
    config.plugins = {};
  }
  if (!config.plugins.entries) {
    config.plugins.entries = {};
  }

  if (!config.plugins.entries['diagnostics-otel']?.enabled) {
    config.plugins.entries['diagnostics-otel'] = { enabled: true };
    return true;
  }

  return false;
}

export function upsertAgent(
  config: OpenClawConfig,
  agentId: string,
  workspacePath: string
): { added: boolean; updated: boolean } {
  if (!config.agents) {
    config.agents = {};
  }
  if (!config.agents.list) {
    config.agents.list = [];
  }

  const existing = config.agents.list.find((agent) => agent.id === agentId);
  if (!existing) {
    config.agents.list.push({ id: agentId, workspace: workspacePath });
    return { added: true, updated: false };
  }

  if (existing.workspace !== workspacePath) {
    existing.workspace = workspacePath;
    return { added: false, updated: true };
  }

  return { added: false, updated: false };
}

export function configureClawiqWebChannel(
  config: OpenClawConfig,
  endpoint: string,
  apiKey: string,
  agentId: string
): boolean {
  let changed = false;

  if (!config.plugins) {
    config.plugins = {};
    changed = true;
  }
  if (!config.plugins.entries) {
    config.plugins.entries = {};
    changed = true;
  }
  if (!config.plugins.entries[CLAWIQ_WEB_PLUGIN_ID]?.enabled) {
    config.plugins.entries[CLAWIQ_WEB_PLUGIN_ID] = { enabled: true };
    changed = true;
  }

  if (!config.plugins.load) {
    config.plugins.load = {};
    changed = true;
  }
  if (!Array.isArray(config.plugins.load.paths)) {
    config.plugins.load.paths = [];
    changed = true;
  }
  if (!config.plugins.load.paths.includes(CLAWIQ_WEB_EXTENSION_PATH)) {
    config.plugins.load.paths.push(CLAWIQ_WEB_EXTENSION_PATH);
    changed = true;
  }

  if (!config.channels) {
    config.channels = {};
    changed = true;
  }

  const existingChannel = config.channels[CLAWIQ_WEB_PLUGIN_ID] ?? {};
  const desiredChannel = {
    ...existingChannel,
    enabled: true,
    apiBaseUrl: endpoint,
    apiKey,
    agentId,
    pollIntervalMs: 2500,
  };

  if (!channelConfigEquals(existingChannel, desiredChannel)) {
    config.channels[CLAWIQ_WEB_PLUGIN_ID] = desiredChannel;
    changed = true;
  }

  if (!Array.isArray(config.bindings)) {
    config.bindings = [];
    changed = true;
  }

  const existingBinding = config.bindings.find((binding) => binding.match?.channel === CLAWIQ_WEB_PLUGIN_ID);
  if (!existingBinding) {
    config.bindings.push({
      agentId,
      match: { channel: CLAWIQ_WEB_PLUGIN_ID },
    } as OpenClawBinding);
    changed = true;
  } else if (existingBinding.agentId !== agentId) {
    existingBinding.agentId = agentId;
    changed = true;
  }

  return changed;
}

export function removeClawiqConfig(
  config: OpenClawConfig,
  endpoint: string,
  agentId: string
): { removedOtel: boolean; removedAgent: boolean; disabledPlugin: boolean } {
  let removedOtel = false;
  let removedAgent = false;
  let disabledPlugin = false;

  const otel = config.diagnostics?.otel;
  if (otel && otel.endpoint === endpoint) {
    if (otel.headers?.Authorization?.startsWith('Bearer ')) {
      delete otel.headers.Authorization;
    }
    delete otel.endpoint;
    delete otel.traces;
    delete otel.metrics;
    delete otel.logs;
    delete otel.enabled;
    removedOtel = true;
  }

  if (config.plugins?.entries?.['diagnostics-otel']?.enabled) {
    if (!config.diagnostics?.otel?.endpoint) {
      config.plugins.entries['diagnostics-otel'].enabled = false;
      disabledPlugin = true;
    }
  }

  const channels = config.channels;
  if (channels && channels[CLAWIQ_WEB_PLUGIN_ID]) {
    delete channels[CLAWIQ_WEB_PLUGIN_ID];
  }

  if (config.plugins?.load?.paths) {
    config.plugins.load.paths = config.plugins.load.paths.filter((p) => p !== CLAWIQ_WEB_EXTENSION_PATH);
  }

  if (config.plugins?.entries?.[CLAWIQ_WEB_PLUGIN_ID]?.enabled) {
    config.plugins.entries[CLAWIQ_WEB_PLUGIN_ID].enabled = false;
    disabledPlugin = true;
  }

  if (Array.isArray(config.bindings)) {
    config.bindings = config.bindings.filter((binding) => binding.match?.channel !== CLAWIQ_WEB_PLUGIN_ID);
  }

  if (config.agents?.list) {
    const originalLength = config.agents.list.length;
    config.agents.list = config.agents.list.filter((agent) => agent.id !== agentId);
    removedAgent = config.agents.list.length !== originalLength;
  }

  return { removedOtel, removedAgent, disabledPlugin };
}

function channelConfigEquals(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return (
    a.enabled === b.enabled &&
    a.apiBaseUrl === b.apiBaseUrl &&
    a.apiKey === b.apiKey &&
    a.agentId === b.agentId &&
    a.pollIntervalMs === b.pollIntervalMs
  );
}
