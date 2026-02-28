"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClawIQClient = void 0;
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
        let filtered = raw.errors;
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
     * Submit a finding as a semantic event with type='finding'.
     * Uses the existing emit endpoint; backend can add a dedicated endpoint later.
     */
    async submitFinding(finding) {
        const event = {
            type: 'finding',
            name: 'agent-finding',
            source: 'agent',
            severity: finding.severity === 'critical' ? 'error'
                : finding.severity === 'high' ? 'error'
                    : finding.severity === 'medium' ? 'warn'
                        : 'info',
            agent_id: finding.agent,
            target: finding.targetAgent,
            meta: {
                title: finding.title,
                description: finding.description,
                patch: finding.patch,
                evidence: finding.evidence,
                target_agent: finding.targetAgent,
                finding_severity: finding.severity,
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
     * Query findings (semantic events with type='finding').
     */
    async getFindings(params) {
        const response = await this.getSemanticEvents({
            since: params.since,
            until: params.until,
            agent: params.agent,
            type: 'finding',
            limit: params.limit,
            offset: params.offset,
        });
        let findings = response.events.map((event) => {
            const meta = (typeof event.meta === 'string' ? JSON.parse(event.meta) : event.meta);
            return {
                id: event.id,
                timestamp: event.timestamp,
                agent_id: event.agent_id,
                target_agent: meta?.target_agent || event.target || '-',
                severity: (meta?.finding_severity || 'medium'),
                title: meta?.title || event.name,
                description: meta?.description,
                patch: meta?.patch,
                evidence: meta?.evidence,
            };
        });
        // Client-side filter by target agent if specified
        if (params.targetAgent) {
            findings = findings.filter((f) => f.target_agent === params.targetAgent);
        }
        return {
            findings,
            total: params.targetAgent ? findings.length : response.total,
        };
    }
}
exports.ClawIQClient = ClawIQClient;
//# sourceMappingURL=api.js.map