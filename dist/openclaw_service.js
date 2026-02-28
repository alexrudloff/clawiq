"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureOtelDiagnostics = configureOtelDiagnostics;
exports.ensureDiagnosticsPlugin = ensureDiagnosticsPlugin;
exports.upsertAgent = upsertAgent;
exports.removeClawiqConfig = removeClawiqConfig;
function configureOtelDiagnostics(config, apiKey, endpoint) {
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
function ensureDiagnosticsPlugin(config) {
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
function upsertAgent(config, agentId, workspacePath) {
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
function removeClawiqConfig(config, endpoint, agentId) {
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
    if (config.agents?.list) {
        const originalLength = config.agents.list.length;
        config.agents.list = config.agents.list.filter((agent) => agent.id !== agentId);
        removedAgent = config.agents.list.length !== originalLength;
    }
    return { removedOtel, removedAgent, disabledPlugin };
}
//# sourceMappingURL=openclaw_service.js.map