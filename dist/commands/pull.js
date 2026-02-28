"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPullCommand = createPullCommand;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const client_js_1 = require("../client.js");
const time_js_1 = require("../time.js");
const format_js_1 = require("../format.js");
const pagination_js_1 = require("./pull/pagination.js");
const filters_js_1 = require("./pull/filters.js");
const formatters_js_1 = require("./pull/formatters.js");
const fetch_js_1 = require("./pull/fetch.js");
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
            const client = (0, client_js_1.buildClient)(options.apiKey);
            const page = (0, pagination_js_1.computePageInfo)(options);
            const range = (0, time_js_1.resolveTimeRange)(options.since, options.until, '24h');
            // Fetch enough rows from each source so merged pagination remains accurate.
            const mergeWindow = Math.max(page.limit + page.offset, page.limit);
            const [traceResult, errorResult, markers] = await Promise.all([
                (0, fetch_js_1.fetchTraceRecords)(client, options, range.start, range.end, mergeWindow, 0),
                (0, fetch_js_1.fetchErrorRecords)(client, options, range.start, range.end, mergeWindow, 0),
                (0, fetch_js_1.fetchMarkers)(client, options, range.start, range.end),
            ]);
            const traceItems = traceResult.traces.map((trace) => ({
                kind: 'trace',
                timestamp: trace.start_time,
                summary: `${(0, filters_js_1.simplifyStatus)(trace.status)} ${trace.model || '-'} ${Math.round(trace.duration_ms)}ms`,
                trace_id: trace.trace_id,
                channel: trace.channel,
                model: trace.model,
                agent: trace.agent_id || (trace.session_id ? (0, filters_js_1.getAgentFromSession)(trace.session_id) : undefined),
            }));
            const errorItems = errorResult.errors.map((error) => ({
                kind: 'error',
                timestamp: error.timestamp,
                summary: `${error.error_type}${error.message ? `: ${error.message}` : ''}`,
                trace_id: error.trace_id,
                channel: error.channel,
                model: error.model,
                agent: error.agent_id || (error.session_id ? (0, filters_js_1.getAgentFromSession)(error.session_id) : undefined),
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
                (0, formatters_js_1.printTimelineCompact)(pageItems);
            }
            else {
                (0, formatters_js_1.printTimelineTable)(pageItems);
            }
            (0, pagination_js_1.printPaginationFooter)('timeline items', pageItems.length, page, total);
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
            const client = (0, client_js_1.buildClient)(options.apiKey);
            const page = (0, pagination_js_1.computePageInfo)(options);
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
                events = events.filter((event) => (0, filters_js_1.matchesAgent)(event.session_id, options.agent));
                total = undefined;
            }
            if (options.agent && options.search) {
                events = events.filter((event) => (0, filters_js_1.containsInsensitive)(event.name, options.search) ||
                    (0, filters_js_1.containsInsensitive)(event.model, options.search) ||
                    (0, filters_js_1.containsInsensitive)(event.session_id, options.search));
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
                (0, formatters_js_1.printSpanEventsCompact)(events);
            }
            else {
                (0, formatters_js_1.printSpanEventsTable)(events);
            }
            (0, pagination_js_1.printPaginationFooter)('events', events.length, page, total);
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
            const client = (0, client_js_1.buildClient)(options.apiKey);
            const page = (0, pagination_js_1.computePageInfo)(options);
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
                events = events.filter((event) => (0, filters_js_1.containsInsensitive)(event.name, options.name));
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
                (0, formatters_js_1.printSemanticCompact)(events);
            }
            else {
                (0, formatters_js_1.printSemanticTable)(events);
            }
            (0, pagination_js_1.printPaginationFooter)('semantic events', events.length, page, total);
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
            const client = (0, client_js_1.buildClient)(options.apiKey);
            const page = (0, pagination_js_1.computePageInfo)(options);
            const range = (0, time_js_1.resolveTimeRange)(options.since, options.until, '24h');
            const result = await (0, fetch_js_1.fetchTraceRecords)(client, options, range.start, range.end, page.limit, page.offset);
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
                (0, formatters_js_1.printTracesCompact)(traces);
            }
            else {
                (0, formatters_js_1.printTracesTable)(traces);
            }
            (0, pagination_js_1.printPaginationFooter)('traces', traces.length, page, total);
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
            const client = (0, client_js_1.buildClient)(options.apiKey);
            const page = (0, pagination_js_1.computePageInfo)(options);
            const range = (0, time_js_1.resolveTimeRange)(options.since, options.until, '24h');
            const result = await (0, fetch_js_1.fetchErrorRecords)(client, options, range.start, range.end, page.limit, page.offset);
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
                (0, formatters_js_1.printErrorsCompact)(errors);
            }
            else {
                (0, formatters_js_1.printErrorsTable)(errors);
            }
            (0, pagination_js_1.printPaginationFooter)('errors', errors.length, page, total);
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
            const client = (0, client_js_1.buildClient)(options.apiKey);
            const page = (0, pagination_js_1.computePageInfo)(options);
            const range = (0, time_js_1.resolveTimeRange)(options.since, options.until, '24h');
            const markers = await (0, fetch_js_1.fetchMarkers)(client, options, range.start, range.end);
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
                (0, formatters_js_1.printMarkersCompact)(pageItems);
            }
            else {
                (0, formatters_js_1.printMarkersTable)(pageItems);
            }
            (0, pagination_js_1.printPaginationFooter)('markers', pageItems.length, page, total);
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