"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClawIQClient = void 0;
const node_child_process_1 = require("node:child_process");
const node_os_1 = require("node:os");
const BYTES_PER_MB = 1024 * 1024;
function clampPercent(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value < 0) {
        return 0;
    }
    if (value > 100) {
        return 100;
    }
    return value;
}
function safeNumber(value) {
    return Number.isFinite(value) ? value : 0;
}
function estimateCPUPercent() {
    const cores = typeof node_os_1.availableParallelism === 'function'
        ? (0, node_os_1.availableParallelism)()
        : Math.max((0, node_os_1.cpus)().length, 1);
    const oneMinuteLoad = (0, node_os_1.loadavg)()[0] || 0;
    return clampPercent((oneMinuteLoad / Math.max(cores, 1)) * 100);
}
function readDiskUsage() {
    try {
        const output = (0, node_child_process_1.execSync)('df -kP /', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const lines = output
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        if (lines.length < 2) {
            return { diskMB: 0, diskPercent: 0 };
        }
        const parts = lines[1].split(/\s+/);
        if (parts.length < 6) {
            return { diskMB: 0, diskPercent: 0 };
        }
        const usedKb = Number(parts[2]);
        const percentRaw = Number(parts[4].replace('%', ''));
        const diskMB = Number.isFinite(usedKb) ? usedKb / 1024 : 0;
        const diskPercent = Number.isFinite(percentRaw) ? clampPercent(percentRaw) : 0;
        return {
            diskMB: safeNumber(diskMB),
            diskPercent,
        };
    }
    catch {
        return { diskMB: 0, diskPercent: 0 };
    }
}
function collectServerMetrics() {
    const totalMemoryBytes = (0, node_os_1.totalmem)();
    const freeMemoryBytes = (0, node_os_1.freemem)();
    const usedMemoryBytes = Math.max(totalMemoryBytes - freeMemoryBytes, 0);
    const memoryMB = usedMemoryBytes / BYTES_PER_MB;
    const memoryPercent = totalMemoryBytes > 0 ? clampPercent((usedMemoryBytes / totalMemoryBytes) * 100) : 0;
    const disk = readDiskUsage();
    return {
        hostname: (0, node_os_1.hostname)() || 'unknown',
        cpu_percent: safeNumber(estimateCPUPercent()),
        memory_mb: safeNumber(memoryMB),
        memory_percent: memoryPercent,
        disk_mb: safeNumber(disk.diskMB),
        disk_percent: disk.diskPercent,
        network_in_mb: 0,
        network_out_mb: 0,
        uptime_seconds: Math.max(Math.floor((0, node_os_1.uptime)()), 0),
    };
}
function semanticEventToIssue(event) {
    let meta;
    try {
        meta = (typeof event.meta === 'string' ? JSON.parse(event.meta) : event.meta);
    }
    catch {
        meta = undefined;
    }
    const rawImpact = (meta?.issue_impact || '').toLowerCase();
    const impact = rawImpact === 'low' || rawImpact === 'medium' || rawImpact === 'high' || rawImpact === 'critical'
        ? rawImpact
        : event.severity === 'error'
            ? 'high'
            : event.severity === 'warn'
                ? 'medium'
                : event.severity === 'info'
                    ? 'low'
                    : 'medium';
    return {
        id: event.id,
        timestamp: event.timestamp,
        agent_id: event.agent_id,
        target_agent: meta?.target_agent || event.target || '-',
        impact,
        title: meta?.title || event.name,
        description: meta?.description,
        patch: meta?.patch,
        evidence: meta?.evidence,
    };
}
class ClawIQClient {
    endpoint;
    apiKey;
    version;
    constructor(endpoint, apiKey, version) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
        this.version = version;
    }
    async request(method, path, body) {
        const url = `${this.endpoint}${path}`;
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
        if (this.version) {
            headers['X-ClawIQ-Version'] = this.version;
        }
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const text = await response.text();
            let message = text;
            try {
                const json = JSON.parse(text);
                message = json.error || json.message || text;
            }
            catch {
                // Use raw text
            }
            throw new Error(`API error (${response.status}): ${message}`);
        }
        if (this.shouldEmitServerMetrics(method, path)) {
            await this.emitServerMetrics(headers);
        }
        const json = await response.json();
        // Handle wrapped responses from API service
        if (json.success !== undefined) {
            if (!json.success) {
                throw new Error(json.error || 'Unknown error');
            }
            return json.data;
        }
        return json;
    }
    shouldEmitServerMetrics(method, path) {
        const normalizedMethod = method.toUpperCase();
        if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD' || normalizedMethod === 'OPTIONS') {
            return false;
        }
        return !path.startsWith('/v1/server');
    }
    async emitServerMetrics(baseHeaders) {
        try {
            const response = await fetch(`${this.endpoint}/v1/server`, {
                method: 'POST',
                headers: baseHeaders,
                body: JSON.stringify(collectServerMetrics()),
            });
            if (!response.ok) {
                return;
            }
        }
        catch {
            // Best effort only: health metrics should not block primary API writes.
        }
    }
    /**
     * Emit events to ClawIQ (via measure service)
     */
    async emit(events) {
        return this.request('POST', '/v1/events', { events });
    }
    /**
     * Get tags (via API service - need different endpoint)
     * Note: OSS mode accepts API-key style auth on the same service.
     */
    async getTags(since, limit) {
        const params = new URLSearchParams();
        if (since)
            params.set('since', since);
        if (limit)
            params.set('limit', limit.toString());
        const query = params.toString();
        return this.request('GET', `/v1/tags${query ? `?${query}` : ''}`);
    }
    async getSemanticEvents(params) {
        const searchParams = new URLSearchParams();
        if (params.since)
            searchParams.set('start', params.since);
        if (params.until)
            searchParams.set('end', params.until);
        if (params.source)
            searchParams.set('source', params.source);
        if (params.type)
            searchParams.set('type', params.type);
        if (params.agent)
            searchParams.set('agent_id', params.agent);
        if (params.severity)
            searchParams.set('severity', params.severity);
        if (params.limit)
            searchParams.set('limit', params.limit.toString());
        if (params.offset)
            searchParams.set('offset', params.offset.toString());
        if (params.name)
            searchParams.set('name', params.name);
        const query = searchParams.toString();
        return this.request('GET', `/v1/semantic-events${query ? `?${query}` : ''}`);
    }
    async getSemanticEventByID(eventID) {
        return this.request('GET', `/v1/semantic-events/${encodeURIComponent(eventID)}`);
    }
    async getEvents(params) {
        const searchParams = new URLSearchParams();
        if (params.since)
            searchParams.set('start', params.since);
        if (params.until)
            searchParams.set('end', params.until);
        if (params.channel)
            searchParams.set('channel', params.channel);
        if (params.model)
            searchParams.set('model', params.model);
        if (params.status)
            searchParams.set('status', params.status);
        if (params.session)
            searchParams.set('session_id', params.session);
        if (params.search)
            searchParams.set('search', params.search);
        if (params.limit !== undefined)
            searchParams.set('limit', params.limit.toString());
        if (params.offset !== undefined)
            searchParams.set('offset', params.offset.toString());
        const query = searchParams.toString();
        return this.request('GET', `/v1/events${query ? `?${query}` : ''}`);
    }
    async getTraces(params) {
        const searchParams = new URLSearchParams();
        if (params.since)
            searchParams.set('start', params.since);
        if (params.until)
            searchParams.set('end', params.until);
        if (params.channel)
            searchParams.set('channel', params.channel);
        if (params.status)
            searchParams.set('status', params.status);
        if (params.limit !== undefined)
            searchParams.set('limit', params.limit.toString());
        if (params.offset !== undefined)
            searchParams.set('offset', params.offset.toString());
        const query = searchParams.toString();
        return this.request('GET', `/v1/traces${query ? `?${query}` : ''}`);
    }
    async getErrors(params) {
        const offset = params.offset || 0;
        const requestedLimit = params.limit || 100;
        const backendLimit = requestedLimit + offset;
        const searchParams = new URLSearchParams();
        if (params.since)
            searchParams.set('start', params.since);
        if (params.until)
            searchParams.set('end', params.until);
        searchParams.set('limit', backendLimit.toString());
        const query = searchParams.toString();
        const raw = await this.request('GET', `/v1/errors${query ? `?${query}` : ''}`);
        let filtered = raw.errors ?? [];
        if (params.channel) {
            filtered = filtered.filter((item) => item.channel === params.channel);
        }
        if (params.errorType) {
            filtered = filtered.filter((item) => item.error_type === params.errorType);
        }
        if (params.traceId) {
            filtered = filtered.filter((item) => item.trace_id === params.traceId);
        }
        const page = filtered.slice(offset, offset + requestedLimit);
        const byType = {};
        for (const item of page) {
            byType[item.error_type] = (byType[item.error_type] || 0) + 1;
        }
        return {
            errors: page,
            summary: {
                total: page.length,
                by_type: byType,
            },
        };
    }
    async getEventMarkers(hours = 24) {
        const searchParams = new URLSearchParams();
        searchParams.set('hours', hours.toString());
        const query = searchParams.toString();
        return this.request('GET', `/v1/event-markers${query ? `?${query}` : ''}`);
    }
    /**
     * Submit an issue as a semantic event with type='issue'.
     * Uses the existing emit endpoint; backend can add a dedicated endpoint later.
     */
    async submitIssue(issue) {
        const event = {
            type: 'issue',
            name: 'agent-issue',
            source: 'agent',
            severity: issue.impact === 'critical' ? 'error'
                : issue.impact === 'high' ? 'error'
                    : issue.impact === 'medium' ? 'warn'
                        : 'info',
            agent_id: issue.agent,
            target: issue.targetAgent,
            meta: {
                title: issue.title,
                description: issue.description,
                patch: issue.patch,
                evidence: issue.evidence,
                target_agent: issue.targetAgent,
                issue_impact: issue.impact,
            },
        };
        // Remove undefined meta fields
        if (event.meta) {
            for (const key of Object.keys(event.meta)) {
                if (event.meta[key] === undefined) {
                    delete event.meta[key];
                }
            }
        }
        return this.emit([event]);
    }
    /**
     * Query issues (semantic events with type='issue').
     */
    async getIssues(params) {
        const response = await this.getSemanticEvents({
            since: params.since,
            until: params.until,
            agent: params.agent,
            type: 'issue',
            limit: params.limit,
            offset: params.offset,
        });
        let issues = response.events.map(semanticEventToIssue);
        // Client-side filter by target agent if specified
        if (params.targetAgent) {
            issues = issues.filter((issue) => issue.target_agent === params.targetAgent);
        }
        return {
            issues,
            total: params.targetAgent ? issues.length : response.total,
        };
    }
    async getIssueByID(issueID) {
        const event = await this.getSemanticEventByID(issueID);
        if (event.type !== 'issue') {
            throw new Error(`Event ${issueID} is not an issue`);
        }
        return semanticEventToIssue(event);
    }
}
exports.ClawIQClient = ClawIQClient;
//# sourceMappingURL=api.js.map