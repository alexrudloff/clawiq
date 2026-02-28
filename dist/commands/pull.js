"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPullCommand = createPullCommand;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const api_js_1 = require("../api.js");
const config_js_1 = require("../config.js");
const time_js_1 = require("../time.js");
const format_js_1 = require("../format.js");
function validatePositiveInt(value, name) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`--${name} must be a positive integer`);
    }
    return value;
}
function validateNonNegativeInt(value, name) {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`--${name} must be a non-negative integer`);
    }
    return value;
}
function computePageInfo(options, defaultLimit = 50) {
    const limit = validatePositiveInt(options.limit ?? defaultLimit, 'limit');
    const offsetFromPage = options.page !== undefined
        ? (validatePositiveInt(options.page, 'page') - 1) * limit
        : 0;
    const offset = validateNonNegativeInt(options.offset ?? offsetFromPage, 'offset');
    return {
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
    };
}
function getAgentFromSession(sessionId) {
    const parts = sessionId.split(':');
    if (parts.length >= 2 && parts[0] === 'agent') {
        return parts[1];
    }
    return sessionId || '-';
}
function matchesAgent(sessionId, agent) {
    return sessionId.includes(`agent:${agent}:`);
}
function containsInsensitive(text, query) {
    return text.toLowerCase().includes(query.toLowerCase());
}
function simplifyStatus(statusCode) {
    if (statusCode === 'STATUS_CODE_ERROR') {
        return 'error';
    }
    if (statusCode === 'STATUS_CODE_OK' || statusCode === 'STATUS_CODE_UNSET') {
        return 'success';
    }
    return statusCode;
}
function printPaginationFooter(label, itemCount, page, total) {
    if (total !== undefined) {
        console.log(chalk_1.default.dim(`\nShowing ${itemCount} of ${total} ${label} (page ${page.page}, limit ${page.limit}, offset ${page.offset})`));
        if (page.offset + itemCount < total) {
            console.log(chalk_1.default.dim(`Next page: --offset ${page.offset + page.limit}`));
        }
        return;
    }
    console.log(chalk_1.default.dim(`\nShowing ${itemCount} ${label} (page ${page.page}, limit ${page.limit}, offset ${page.offset})`));
    if (itemCount === page.limit) {
        console.log(chalk_1.default.dim(`Next page: --offset ${page.offset + page.limit}`));
    }
}
function printTracesCompact(items) {
    for (const trace of items) {
        const time = new Date(trace.start_time).toLocaleTimeString();
        const status = simplifyStatus(trace.status);
        const statusText = status === 'error' ? chalk_1.default.red(status) : chalk_1.default.green(status);
        const model = trace.model || '-';
        console.log(`${chalk_1.default.dim(time)} ${statusText} ${trace.trace_id} ${chalk_1.default.cyan(model)} ${chalk_1.default.dim(trace.channel || '-')}`);
    }
}
function printTracesTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Status'),
            chalk_1.default.dim('Trace'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Channel'),
            chalk_1.default.dim('Model'),
            chalk_1.default.dim('Tokens'),
            chalk_1.default.dim('Duration'),
        ],
        style: { head: [], border: [] },
    });
    for (const trace of items) {
        const status = simplifyStatus(trace.status);
        const statusText = status === 'error' ? chalk_1.default.red(status) : chalk_1.default.green(status);
        const agent = trace.agent_id || (trace.session_id ? getAgentFromSession(trace.session_id) : '-');
        table.push([
            chalk_1.default.dim(new Date(trace.start_time).toLocaleString()),
            statusText,
            trace.trace_id,
            agent,
            trace.channel || '-',
            trace.model || '-',
            `${trace.tokens_input + trace.tokens_output}`,
            `${Math.round(trace.duration_ms)}ms`,
        ]);
    }
    console.log(table.toString());
}
function printErrorsCompact(items) {
    for (const error of items) {
        const time = new Date(error.timestamp).toLocaleTimeString();
        console.log(`${chalk_1.default.dim(time)} ${chalk_1.default.red(error.error_type)} ${error.trace_id} ${chalk_1.default.dim(error.channel || '-')}`);
    }
}
function printErrorsTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Type'),
            chalk_1.default.dim('Trace'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Channel'),
            chalk_1.default.dim('Message'),
        ],
        style: { head: [], border: [] },
        wordWrap: true,
    });
    for (const error of items) {
        const agent = error.agent_id || (error.session_id ? getAgentFromSession(error.session_id) : '-');
        table.push([
            chalk_1.default.dim(new Date(error.timestamp).toLocaleString()),
            chalk_1.default.red(error.error_type),
            error.trace_id,
            agent,
            error.channel || '-',
            error.message || '-',
        ]);
    }
    console.log(table.toString());
}
function printSpanEventsCompact(items) {
    for (const event of items) {
        const time = new Date(event.start_time).toLocaleTimeString();
        const status = simplifyStatus(event.status_code);
        const statusText = status === 'error' ? chalk_1.default.red(status) : chalk_1.default.green(status);
        const agent = event.agent_id || getAgentFromSession(event.session_id);
        console.log(`${chalk_1.default.dim(time)} ${statusText} ${chalk_1.default.cyan(event.name)} ${chalk_1.default.dim(agent)} ${chalk_1.default.dim(event.channel || '-')}`);
    }
}
function printSpanEventsTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Status'),
            chalk_1.default.dim('Name'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Channel'),
            chalk_1.default.dim('Model'),
            chalk_1.default.dim('Outcome'),
            chalk_1.default.dim('Duration'),
        ],
        style: { head: [], border: [] },
        wordWrap: true,
    });
    for (const event of items) {
        const status = simplifyStatus(event.status_code);
        const statusText = status === 'error' ? chalk_1.default.red(status) : chalk_1.default.green(status);
        const agent = event.agent_id || getAgentFromSession(event.session_id);
        table.push([
            chalk_1.default.dim(new Date(event.start_time).toLocaleString()),
            statusText,
            chalk_1.default.cyan(event.name),
            agent,
            event.channel || '-',
            event.model || '-',
            event.outcome || '-',
            `${Math.round(event.duration_ms)}ms`,
        ]);
    }
    console.log(table.toString());
}
function printSemanticCompact(items) {
    for (const event of items) {
        const icon = format_js_1.TYPE_ICONS[event.type] || '•';
        const severity = event.severity === 'error'
            ? chalk_1.default.red(event.severity)
            : event.severity === 'warn'
                ? chalk_1.default.yellow(event.severity)
                : chalk_1.default.blue(event.severity);
        const time = new Date(event.timestamp).toLocaleTimeString();
        const agent = event.agent_id ? chalk_1.default.dim(` (${event.agent_id})`) : '';
        console.log(`${chalk_1.default.dim(time)} ${icon} ${severity} ${chalk_1.default.cyan(event.name)}${agent}`);
    }
}
function printSemanticTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Type'),
            chalk_1.default.dim('Name'),
            chalk_1.default.dim('Severity'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Channel'),
        ],
        style: { head: [], border: [] },
        wordWrap: true,
    });
    for (const event of items) {
        const icon = format_js_1.TYPE_ICONS[event.type] || '•';
        const severity = event.severity === 'error'
            ? chalk_1.default.red(event.severity)
            : event.severity === 'warn'
                ? chalk_1.default.yellow(event.severity)
                : chalk_1.default.blue(event.severity);
        table.push([
            chalk_1.default.dim(new Date(event.timestamp).toLocaleString()),
            `${icon} ${event.type}`,
            chalk_1.default.cyan(event.name),
            severity,
            event.agent_id || '-',
            event.channel || '-',
        ]);
    }
    console.log(table.toString());
}
function printMarkersCompact(items) {
    for (const marker of items) {
        const time = new Date(marker.timestamp).toLocaleTimeString();
        const severity = marker.severity === 'error'
            ? chalk_1.default.red(marker.severity)
            : marker.severity === 'warn'
                ? chalk_1.default.yellow(marker.severity)
                : chalk_1.default.blue(marker.severity);
        console.log(`${chalk_1.default.dim(time)} ${severity} ${marker.type}:${chalk_1.default.cyan(marker.name)} x${marker.count}`);
    }
}
function printMarkersTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Type'),
            chalk_1.default.dim('Name'),
            chalk_1.default.dim('Severity'),
            chalk_1.default.dim('Count'),
        ],
        style: { head: [], border: [] },
    });
    for (const marker of items) {
        const severity = marker.severity === 'error'
            ? chalk_1.default.red(marker.severity)
            : marker.severity === 'warn'
                ? chalk_1.default.yellow(marker.severity)
                : chalk_1.default.blue(marker.severity);
        table.push([
            chalk_1.default.dim(new Date(marker.timestamp).toLocaleString()),
            marker.type,
            chalk_1.default.cyan(marker.name),
            severity,
            marker.count.toString(),
        ]);
    }
    console.log(table.toString());
}
function kindLabel(kind) {
    if (kind === 'error') {
        return chalk_1.default.red('error');
    }
    if (kind === 'marker') {
        return chalk_1.default.yellow('marker');
    }
    return chalk_1.default.blue('trace');
}
function printTimelineCompact(items) {
    for (const item of items) {
        const time = new Date(item.timestamp).toLocaleTimeString();
        const channel = item.channel ? chalk_1.default.dim(item.channel) : chalk_1.default.dim('-');
        console.log(`${chalk_1.default.dim(time)} ${kindLabel(item.kind)} ${item.summary} ${channel}`);
    }
}
function printTimelineTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Kind'),
            chalk_1.default.dim('Summary'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Channel'),
            chalk_1.default.dim('Model'),
            chalk_1.default.dim('Trace'),
        ],
        style: { head: [], border: [] },
        wordWrap: true,
    });
    for (const item of items) {
        table.push([
            chalk_1.default.dim(new Date(item.timestamp).toLocaleString()),
            kindLabel(item.kind),
            item.summary,
            item.agent || '-',
            item.channel || '-',
            item.model || '-',
            item.trace_id || '-',
        ]);
    }
    console.log(table.toString());
}
function buildClient(options) {
    const config = (0, config_js_1.loadConfig)();
    const apiKey = (0, config_js_1.requireApiKey)(config, options.apiKey);
    return new api_js_1.ClawIQClient(config_js_1.API_ENDPOINT, apiKey, config_js_1.CLI_VERSION);
}
function toTraceRecord(event) {
    return {
        trace_id: event.trace_id,
        start_time: event.start_time,
        duration_ms: event.duration_ms,
        channel: event.channel,
        model: event.model,
        session_id: event.session_id,
        agent_id: event.agent_id || undefined,
        tokens_input: event.tokens_input,
        tokens_output: event.tokens_output,
        status: event.status_code,
        error: event.error_type || undefined,
    };
}
function toErrorRecord(event) {
    return {
        timestamp: event.start_time,
        trace_id: event.trace_id,
        channel: event.channel,
        error_type: event.error_type || 'unknown',
        message: event.error_type || event.status_code,
        session_id: event.session_id,
        agent_id: event.agent_id || undefined,
        model: event.model,
    };
}
function bucket5m(iso) {
    const date = new Date(iso);
    date.setUTCSeconds(0, 0);
    date.setUTCMinutes(date.getUTCMinutes() - (date.getUTCMinutes() % 5));
    return date.toISOString();
}
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
function buildMarkerRecords(events) {
    const markerMap = new Map();
    for (const event of events) {
        const timestamp = bucket5m(event.timestamp);
        const key = `${timestamp}|${event.type}|${event.name}|${event.severity}`;
        const existing = markerMap.get(key);
        if (existing) {
            existing.count += 1;
        }
        else {
            markerMap.set(key, {
                timestamp,
                type: event.type,
                name: event.name,
                severity: event.severity,
                count: 1,
            });
        }
    }
    return [...markerMap.values()].sort((a, b) => {
        if (a.timestamp === b.timestamp) {
            return b.count - a.count;
        }
        return a.timestamp < b.timestamp ? 1 : -1;
    });
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
            events = events.filter((event) => matchesAgent(event.session_id, options.agent));
            total = undefined;
        }
        if (options.agent && options.search) {
            events = events.filter((event) => containsInsensitive(event.name, options.search) ||
                containsInsensitive(event.model, options.search) ||
                containsInsensitive(event.session_id, options.search));
            total = undefined;
        }
        return {
            traces: events.map(toTraceRecord),
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
            events = events.filter((event) => matchesAgent(event.session_id, options.agent));
            total = undefined;
        }
        if (options.agent && options.search) {
            events = events.filter((event) => containsInsensitive(event.name, options.search) ||
                containsInsensitive(event.model, options.search) ||
                containsInsensitive(event.session_id, options.search));
            total = undefined;
        }
        errors = events.map(toErrorRecord);
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
        events = events.filter((event) => containsInsensitive(event.name, options.name));
    }
    return buildMarkerRecords(events);
}
function buildAllCommand() {
    return new commander_1.Command('all')
        .description('Pull a unified timeline of traces, errors, and markers')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--since <time>', 'Start time (relative like 24h, or ISO)', '24h')
        .option('--until <time>', 'End time (relative or ISO)')
        .option('--channel <channel>', 'Filter by channel')
        .option('--model <model>', 'Filter by model')
        .option('--status <status>', 'Trace/event status filter (success|error)')
        .option('--trace <id>', 'Filter errors by trace ID')
        .option('--session <id>', 'Filter by session ID')
        .option('--agent <id>', 'Filter by agent (matches session_id)')
        .option('--search <text>', 'Search in name/session/model where supported')
        .option('--source <source>', 'Marker source filter')
        .option('--type <type>', 'Marker type filter')
        .option('--severity <severity>', 'Marker severity filter')
        .option('--name <text>', 'Marker name filter (contains)')
        .option('--limit <n>', 'Results per page', format_js_1.parseIntOption, 50)
        .option('--offset <n>', 'Pagination offset', format_js_1.parseIntOption)
        .option('--page <n>', 'Pagination page (1-based)', format_js_1.parseIntOption)
        .option('--json', 'Output as JSON')
        .option('--compact', 'Compact output')
        .action(async (options) => {
        try {
            const client = buildClient(options);
            const page = computePageInfo(options);
            const range = (0, time_js_1.resolveTimeRange)(options.since, options.until, '24h');
            // Fetch enough rows from each source so merged pagination remains accurate.
            const mergeWindow = Math.max(page.limit + page.offset, page.limit);
            const [traceResult, errorResult, markers] = await Promise.all([
                fetchTraceRecords(client, options, range.start, range.end, mergeWindow, 0),
                fetchErrorRecords(client, options, range.start, range.end, mergeWindow, 0),
                fetchMarkers(client, options, range.start, range.end),
            ]);
            const traceItems = traceResult.traces.map((trace) => ({
                kind: 'trace',
                timestamp: trace.start_time,
                summary: `${simplifyStatus(trace.status)} ${trace.model || '-'} ${Math.round(trace.duration_ms)}ms`,
                trace_id: trace.trace_id,
                channel: trace.channel,
                model: trace.model,
                agent: trace.agent_id || (trace.session_id ? getAgentFromSession(trace.session_id) : undefined),
            }));
            const errorItems = errorResult.errors.map((error) => ({
                kind: 'error',
                timestamp: error.timestamp,
                summary: `${error.error_type}${error.message ? `: ${error.message}` : ''}`,
                trace_id: error.trace_id,
                channel: error.channel,
                model: error.model,
                agent: error.agent_id || (error.session_id ? getAgentFromSession(error.session_id) : undefined),
                severity: 'error',
            }));
            const markerItems = markers.map((marker) => ({
                kind: 'marker',
                timestamp: marker.timestamp,
                summary: `${marker.severity} ${marker.type}:${marker.name} x${marker.count}`,
                severity: marker.severity,
            }));
            const merged = [...traceItems, ...errorItems, ...markerItems].sort((a, b) => a.timestamp < b.timestamp ? 1 : -1);
            const pageItems = merged.slice(page.offset, page.offset + page.limit);
            const limitedSourceMayHaveMore = traceResult.traces.length === mergeWindow || errorResult.errors.length === mergeWindow;
            const hasMore = limitedSourceMayHaveMore || merged.length > page.offset + page.limit;
            const total = limitedSourceMayHaveMore ? undefined : merged.length;
            if (options.json) {
                console.log(JSON.stringify({
                    items: pageItems,
                    scanned: {
                        traces: traceItems.length,
                        errors: errorItems.length,
                        markers: markerItems.length,
                        merged: merged.length,
                    },
                    pagination: {
                        ...page,
                        total,
                        has_more: hasMore,
                    },
                }, null, 2));
                return;
            }
            if (pageItems.length === 0) {
                console.log(chalk_1.default.dim('No timeline items found'));
                return;
            }
            if (options.compact) {
                printTimelineCompact(pageItems);
            }
            else {
                printTimelineTable(pageItems);
            }
            printPaginationFooter('timeline items', pageItems.length, page, total);
            if (total === undefined && hasMore && pageItems.length < page.limit) {
                console.log(chalk_1.default.dim(`Next page: --offset ${page.offset + page.limit}`));
            }
        }
        catch (error) {
            (0, format_js_1.handleError)(error);
        }
    });
}
function buildEventsCommand() {
    return new commander_1.Command('events')
        .description('Pull span events from ClawIQ')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--since <time>', 'Start time (relative like 24h, or ISO)', '24h')
        .option('--until <time>', 'End time (relative or ISO)')
        .option('--channel <channel>', 'Filter by channel')
        .option('--model <model>', 'Filter by model')
        .option('--status <status>', 'Filter by status (success|error)')
        .option('--session <id>', 'Filter by session ID')
        .option('--agent <id>', 'Filter by agent (matches session_id)')
        .option('--search <text>', 'Search in name/session/model')
        .option('--limit <n>', 'Results per page', format_js_1.parseIntOption, 50)
        .option('--offset <n>', 'Pagination offset', format_js_1.parseIntOption)
        .option('--page <n>', 'Pagination page (1-based)', format_js_1.parseIntOption)
        .option('--json', 'Output as JSON')
        .option('--compact', 'Compact output')
        .action(async (options) => {
        try {
            const client = buildClient(options);
            const page = computePageInfo(options);
            const range = (0, time_js_1.resolveTimeRange)(options.since, options.until, '24h');
            const serverSearch = options.agent ? `agent:${options.agent}:` : options.search;
            const result = await client.getEvents({
                since: range.start,
                until: range.end,
                channel: options.channel,
                model: options.model,
                status: options.status,
                session: options.session,
                search: serverSearch,
                limit: page.limit,
                offset: page.offset,
            });
            let events = result.events ?? [];
            let total = result.total;
            if (options.agent) {
                events = events.filter((event) => matchesAgent(event.session_id, options.agent));
                total = undefined;
            }
            if (options.agent && options.search) {
                events = events.filter((event) => containsInsensitive(event.name, options.search) ||
                    containsInsensitive(event.model, options.search) ||
                    containsInsensitive(event.session_id, options.search));
                total = undefined;
            }
            if (options.json) {
                console.log(JSON.stringify({
                    events,
                    pagination: {
                        ...page,
                        total,
                    },
                }, null, 2));
                return;
            }
            if (events.length === 0) {
                console.log(chalk_1.default.dim('No events found'));
                return;
            }
            if (options.compact) {
                printSpanEventsCompact(events);
            }
            else {
                printSpanEventsTable(events);
            }
            printPaginationFooter('events', events.length, page, total);
        }
        catch (error) {
            (0, format_js_1.handleError)(error);
        }
    });
}
function buildSemanticCommand() {
    return new commander_1.Command('semantic')
        .description('Pull semantic events from ClawIQ')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--since <time>', 'Start time (relative like 24h, or ISO)', '24h')
        .option('--until <time>', 'End time (relative or ISO)')
        .option('--source <source>', 'Filter by source')
        .option('--type <type>', 'Filter by event type')
        .option('--severity <severity>', 'Filter by severity')
        .option('--agent <id>', 'Filter by agent ID')
        .option('--name <text>', 'Filter by event name (contains)')
        .option('--limit <n>', 'Results per page', format_js_1.parseIntOption, 50)
        .option('--offset <n>', 'Pagination offset', format_js_1.parseIntOption)
        .option('--page <n>', 'Pagination page (1-based)', format_js_1.parseIntOption)
        .option('--json', 'Output as JSON')
        .option('--compact', 'Compact output')
        .action(async (options) => {
        try {
            const client = buildClient(options);
            const page = computePageInfo(options);
            const range = (0, time_js_1.resolveTimeRange)(options.since, options.until, '24h');
            const response = await client.getSemanticEvents({
                since: range.start,
                until: range.end,
                source: options.source,
                type: options.type,
                severity: options.severity,
                agent: options.agent,
                limit: page.limit,
                offset: page.offset,
            });
            let events = response.events;
            let total = response.total;
            if (options.name) {
                events = events.filter((event) => containsInsensitive(event.name, options.name));
                total = undefined;
            }
            if (options.json) {
                console.log(JSON.stringify({
                    events,
                    pagination: {
                        ...page,
                        total,
                    },
                }, null, 2));
                return;
            }
            if (events.length === 0) {
                console.log(chalk_1.default.dim('No semantic events found'));
                return;
            }
            if (options.compact) {
                printSemanticCompact(events);
            }
            else {
                printSemanticTable(events);
            }
            printPaginationFooter('semantic events', events.length, page, total);
        }
        catch (error) {
            (0, format_js_1.handleError)(error);
        }
    });
}
function buildTracesCommand() {
    return new commander_1.Command('traces')
        .description('Pull traces from ClawIQ')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--since <time>', 'Start time (relative like 24h, or ISO)', '24h')
        .option('--until <time>', 'End time (relative or ISO)')
        .option('--channel <channel>', 'Filter by channel')
        .option('--status <status>', 'Filter by status (success|error|STATUS_CODE_*)')
        .option('--model <model>', 'Filter by model')
        .option('--session <id>', 'Filter by session ID')
        .option('--agent <id>', 'Filter by agent (matches session_id)')
        .option('--search <text>', 'Search in name/session/model')
        .option('--limit <n>', 'Results per page', format_js_1.parseIntOption, 50)
        .option('--offset <n>', 'Pagination offset', format_js_1.parseIntOption)
        .option('--page <n>', 'Pagination page (1-based)', format_js_1.parseIntOption)
        .option('--json', 'Output as JSON')
        .option('--compact', 'Compact output')
        .action(async (options) => {
        try {
            const client = buildClient(options);
            const page = computePageInfo(options);
            const range = (0, time_js_1.resolveTimeRange)(options.since, options.until, '24h');
            const result = await fetchTraceRecords(client, options, range.start, range.end, page.limit, page.offset);
            const traces = result.traces ?? [];
            const total = result.total ?? 0;
            if (options.json) {
                console.log(JSON.stringify({
                    traces,
                    pagination: {
                        ...page,
                        total,
                    },
                }, null, 2));
                return;
            }
            if (traces.length === 0) {
                console.log(chalk_1.default.dim('No traces found'));
                return;
            }
            if (options.compact) {
                printTracesCompact(traces);
            }
            else {
                printTracesTable(traces);
            }
            printPaginationFooter('traces', traces.length, page, total);
        }
        catch (error) {
            (0, format_js_1.handleError)(error);
        }
    });
}
function buildErrorsCommand() {
    return new commander_1.Command('errors')
        .description('Pull error records from ClawIQ')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--since <time>', 'Start time (relative like 24h, or ISO)', '24h')
        .option('--until <time>', 'End time (relative or ISO)')
        .option('--channel <channel>', 'Filter by channel')
        .option('--type <errorType>', 'Filter by error type')
        .option('--trace <id>', 'Filter by trace ID')
        .option('--model <model>', 'Filter by model')
        .option('--session <id>', 'Filter by session ID')
        .option('--agent <id>', 'Filter by agent (matches session_id)')
        .option('--search <text>', 'Search in name/session/model')
        .option('--limit <n>', 'Results per page', format_js_1.parseIntOption, 50)
        .option('--offset <n>', 'Pagination offset', format_js_1.parseIntOption)
        .option('--page <n>', 'Pagination page (1-based)', format_js_1.parseIntOption)
        .option('--json', 'Output as JSON')
        .option('--compact', 'Compact output')
        .action(async (options) => {
        try {
            const client = buildClient(options);
            const page = computePageInfo(options);
            const range = (0, time_js_1.resolveTimeRange)(options.since, options.until, '24h');
            const result = await fetchErrorRecords(client, options, range.start, range.end, page.limit, page.offset);
            const errors = result.errors ?? [];
            const total = result.total ?? 0;
            if (options.json) {
                console.log(JSON.stringify({
                    errors,
                    pagination: {
                        ...page,
                        total,
                    },
                }, null, 2));
                return;
            }
            if (errors.length === 0) {
                console.log(chalk_1.default.dim('No errors found'));
                return;
            }
            if (options.compact) {
                printErrorsCompact(errors);
            }
            else {
                printErrorsTable(errors);
            }
            printPaginationFooter('errors', errors.length, page, total);
        }
        catch (error) {
            (0, format_js_1.handleError)(error);
        }
    });
}
function buildMarkersCommand() {
    return new commander_1.Command('markers')
        .description('Pull semantic event markers (aggregated in 5m buckets)')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--since <time>', 'Start time (relative like 24h, or ISO)', '24h')
        .option('--until <time>', 'End time (relative or ISO)')
        .option('--source <source>', 'Filter by source')
        .option('--type <type>', 'Filter by event type')
        .option('--severity <severity>', 'Filter by severity')
        .option('--agent <id>', 'Filter by agent ID')
        .option('--name <text>', 'Filter by event name (contains)')
        .option('--limit <n>', 'Results per page', format_js_1.parseIntOption, 50)
        .option('--offset <n>', 'Pagination offset', format_js_1.parseIntOption)
        .option('--page <n>', 'Pagination page (1-based)', format_js_1.parseIntOption)
        .option('--json', 'Output as JSON')
        .option('--compact', 'Compact output')
        .action(async (options) => {
        try {
            const client = buildClient(options);
            const page = computePageInfo(options);
            const range = (0, time_js_1.resolveTimeRange)(options.since, options.until, '24h');
            const markers = await fetchMarkers(client, options, range.start, range.end);
            const total = markers.length;
            const pageItems = markers.slice(page.offset, page.offset + page.limit);
            if (options.json) {
                console.log(JSON.stringify({
                    markers: pageItems,
                    pagination: {
                        ...page,
                        total,
                    },
                }, null, 2));
                return;
            }
            if (pageItems.length === 0) {
                console.log(chalk_1.default.dim('No markers found'));
                return;
            }
            if (options.compact) {
                printMarkersCompact(pageItems);
            }
            else {
                printMarkersTable(pageItems);
            }
            printPaginationFooter('markers', pageItems.length, page, total);
        }
        catch (error) {
            (0, format_js_1.handleError)(error);
        }
    });
}
function createPullCommand() {
    const cmd = new commander_1.Command('pull').description('Pull telemetry and annotations from ClawIQ');
    cmd.addCommand(buildAllCommand());
    cmd.addCommand(buildTracesCommand());
    cmd.addCommand(buildErrorsCommand());
    cmd.addCommand(buildEventsCommand());
    cmd.addCommand(buildSemanticCommand());
    cmd.addCommand(buildMarkersCommand());
    return cmd;
}
//# sourceMappingURL=pull.js.map