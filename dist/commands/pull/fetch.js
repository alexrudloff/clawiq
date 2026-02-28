"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchTraceRecords = fetchTraceRecords;
exports.fetchErrorRecords = fetchErrorRecords;
exports.fetchMarkers = fetchMarkers;
const transforms_js_1 = require("./transforms.js");
const filters_js_1 = require("./filters.js");
async function fetchAllSemanticEvents(client, params) {
    const batchSize = 500;
    const maxEvents = 50_000;
    const all = [];
    let offset = 0;
    while (all.length < maxEvents) {
        const response = await client.getSemanticEvents({
            ...params,
            limit: batchSize,
            offset,
        });
        all.push(...response.events);
        if (response.events.length < batchSize) {
            break;
        }
        offset += batchSize;
    }
    return all;
}
async function fetchTraceRecords(client, options, start, end, limit, offset) {
    const needsEventFallback = Boolean(options.agent) ||
        Boolean(options.model) ||
        Boolean(options.session) ||
        Boolean(options.search) ||
        options.status === 'success';
    if (needsEventFallback) {
        const serverSearch = options.agent ? `agent:${options.agent}:` : options.search;
        const response = await client.getEvents({
            since: start,
            until: end,
            channel: options.channel,
            model: options.model,
            status: options.status,
            session: options.session,
            search: serverSearch,
            limit,
            offset,
        });
        let events = response.events;
        let total = response.total;
        if (options.agent) {
            events = events.filter((event) => (0, filters_js_1.matchesAgent)(event.session_id, options.agent));
            total = undefined;
        }
        if (options.agent && options.search) {
            events = events.filter((event) => (0, filters_js_1.containsInsensitive)(event.name, options.search) ||
                (0, filters_js_1.containsInsensitive)(event.model, options.search) ||
                (0, filters_js_1.containsInsensitive)(event.session_id, options.search));
            total = undefined;
        }
        return {
            traces: events.map(transforms_js_1.toTraceRecord),
            total,
        };
    }
    let traceStatus = options.status;
    if (traceStatus === 'error') {
        traceStatus = 'STATUS_CODE_ERROR';
    }
    const response = await client.getTraces({
        since: start,
        until: end,
        channel: options.channel,
        status: traceStatus,
        limit,
        offset,
    });
    // Current `/v1/traces` returns page length as total in OSS mode.
    return {
        traces: response.traces,
    };
}
async function fetchErrorRecords(client, options, start, end, limit, offset) {
    const needsEventFallback = Boolean(options.agent) ||
        Boolean(options.model) ||
        Boolean(options.session) ||
        Boolean(options.search);
    let errors;
    let total;
    if (needsEventFallback) {
        const serverSearch = options.agent ? `agent:${options.agent}:` : options.search;
        const response = await client.getEvents({
            since: start,
            until: end,
            channel: options.channel,
            model: options.model,
            status: 'error',
            session: options.session,
            search: serverSearch,
            limit,
            offset,
        });
        let events = response.events;
        total = response.total;
        if (options.agent) {
            events = events.filter((event) => (0, filters_js_1.matchesAgent)(event.session_id, options.agent));
            total = undefined;
        }
        if (options.agent && options.search) {
            events = events.filter((event) => (0, filters_js_1.containsInsensitive)(event.name, options.search) ||
                (0, filters_js_1.containsInsensitive)(event.model, options.search) ||
                (0, filters_js_1.containsInsensitive)(event.session_id, options.search));
            total = undefined;
        }
        errors = events.map(transforms_js_1.toErrorRecord);
    }
    else {
        const response = await client.getErrors({
            since: start,
            until: end,
            channel: options.channel,
            errorType: options.type,
            traceId: options.trace,
            limit,
            offset,
        });
        errors = response.errors;
        total = undefined;
    }
    if (options.type) {
        errors = errors.filter((error) => error.error_type === options.type);
        total = undefined;
    }
    if (options.trace) {
        errors = errors.filter((error) => error.trace_id === options.trace);
        total = undefined;
    }
    return { errors, total };
}
async function fetchMarkers(client, options, start, end) {
    let events = await fetchAllSemanticEvents(client, {
        since: start,
        until: end,
        source: options.source,
        type: options.type,
        severity: options.severity,
        agent: options.agent,
    });
    if (options.name) {
        events = events.filter((event) => (0, filters_js_1.containsInsensitive)(event.name, options.name));
    }
    return (0, transforms_js_1.buildMarkerRecords)(events);
}
//# sourceMappingURL=fetch.js.map