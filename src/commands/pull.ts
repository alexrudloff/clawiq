import { Command } from 'commander';
import chalk from 'chalk';
import { ErrorRecord, TraceRecord } from '../api.js';
import { buildClient } from '../client.js';
import { resolveTimeRange } from '../time.js';
import { parseIntOption, handleError } from '../format.js';
import {
  PullAllOptions,
  PullErrorsOptions,
  PullEventsOptions,
  PullMarkersOptions,
  PullSemanticOptions,
  PullTracesOptions,
  TimelineItem,
} from './pull/types.js';
import { computePageInfo, printPaginationFooter } from './pull/pagination.js';
import {
  containsInsensitive,
  getAgentFromSession,
  matchesAgent,
  simplifyStatus,
} from './pull/filters.js';
import {
  printErrorsCompact,
  printErrorsTable,
  printMarkersCompact,
  printMarkersTable,
  printSemanticCompact,
  printSemanticTable,
  printSpanEventsCompact,
  printSpanEventsTable,
  printTimelineCompact,
  printTimelineTable,
  printTracesCompact,
  printTracesTable,
} from './pull/formatters.js';
import { fetchErrorRecords, fetchMarkers, fetchTraceRecords } from './pull/fetch.js';

function buildAllCommand(): Command {
  return new Command('all')
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
    .option('--limit <n>', 'Results per page', parseIntOption, 50)
    .option('--offset <n>', 'Pagination offset', parseIntOption)
    .option('--page <n>', 'Pagination page (1-based)', parseIntOption)
    .option('--json', 'Output as JSON')
    .option('--compact', 'Compact output')
    .action(async (options: PullAllOptions) => {
      try {
        const client = buildClient(options.apiKey);
        const page = computePageInfo(options);
        const range = resolveTimeRange(options.since, options.until, '24h');

        // Fetch enough rows from each source so merged pagination remains accurate.
        const mergeWindow = Math.max(page.limit + page.offset, page.limit);

        const [traceResult, errorResult, markers] = await Promise.all([
          fetchTraceRecords(client, options, range.start, range.end, mergeWindow, 0),
          fetchErrorRecords(client, options, range.start, range.end, mergeWindow, 0),
          fetchMarkers(client, options, range.start, range.end),
        ]);

        const traceItems: TimelineItem[] = traceResult.traces.map((trace: TraceRecord) => ({
          kind: 'trace',
          timestamp: trace.start_time,
          summary: `${simplifyStatus(trace.status)} ${trace.model || '-'} ${Math.round(trace.duration_ms)}ms`,
          trace_id: trace.trace_id,
          channel: trace.channel,
          model: trace.model,
          agent: trace.agent_id || (trace.session_id ? getAgentFromSession(trace.session_id) : undefined),
        }));

        const errorItems: TimelineItem[] = errorResult.errors.map((error: ErrorRecord) => ({
          kind: 'error',
          timestamp: error.timestamp,
          summary: `${error.error_type}${error.message ? `: ${error.message}` : ''}`,
          trace_id: error.trace_id,
          channel: error.channel,
          model: error.model,
          agent: error.agent_id || (error.session_id ? getAgentFromSession(error.session_id) : undefined),
          severity: 'error',
        }));

        const markerItems: TimelineItem[] = markers.map((marker) => ({
          kind: 'marker',
          timestamp: marker.timestamp,
          summary: `${marker.severity} ${marker.type}:${marker.name} x${marker.count}`,
          severity: marker.severity,
        }));

        const merged = [...traceItems, ...errorItems, ...markerItems].sort((a, b) =>
          a.timestamp < b.timestamp ? 1 : -1
        );

        const pageItems = merged.slice(page.offset, page.offset + page.limit);
        const limitedSourceMayHaveMore =
          traceResult.traces.length === mergeWindow || errorResult.errors.length === mergeWindow;
        const hasMore = limitedSourceMayHaveMore || merged.length > page.offset + page.limit;
        const total = limitedSourceMayHaveMore ? undefined : merged.length;

        if (options.json) {
          console.log(
            JSON.stringify(
              {
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
              },
              null,
              2
            )
          );
          return;
        }

        if (pageItems.length === 0) {
          console.log(chalk.dim('No timeline items found'));
          return;
        }

        if (options.compact) {
          printTimelineCompact(pageItems);
        } else {
          printTimelineTable(pageItems);
        }

        printPaginationFooter('timeline items', pageItems.length, page, total);
        if (total === undefined && hasMore && pageItems.length < page.limit) {
          console.log(chalk.dim(`Next page: --offset ${page.offset + page.limit}`));
        }
      } catch (error) {
        handleError(error);
      }
    });
}

function buildEventsCommand(): Command {
  return new Command('events')
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
    .option('--limit <n>', 'Results per page', parseIntOption, 50)
    .option('--offset <n>', 'Pagination offset', parseIntOption)
    .option('--page <n>', 'Pagination page (1-based)', parseIntOption)
    .option('--json', 'Output as JSON')
    .option('--compact', 'Compact output')
    .action(async (options: PullEventsOptions) => {
      try {
        const client = buildClient(options.apiKey);
        const page = computePageInfo(options);
        const range = resolveTimeRange(options.since, options.until, '24h');

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
        let total: number | undefined = result.total;

        if (options.agent) {
          events = events.filter((event) => matchesAgent(event.session_id, options.agent!));
          total = undefined;
        }
        if (options.agent && options.search) {
          events = events.filter(
            (event) =>
              containsInsensitive(event.name, options.search!) ||
              containsInsensitive(event.model, options.search!) ||
              containsInsensitive(event.session_id, options.search!)
          );
          total = undefined;
        }

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                events,
                pagination: {
                  ...page,
                  total,
                },
              },
              null,
              2
            )
          );
          return;
        }

        if (events.length === 0) {
          console.log(chalk.dim('No events found'));
          return;
        }

        if (options.compact) {
          printSpanEventsCompact(events);
        } else {
          printSpanEventsTable(events);
        }

        printPaginationFooter('events', events.length, page, total);
      } catch (error) {
        handleError(error);
      }
    });
}

function buildSemanticCommand(): Command {
  return new Command('semantic')
    .description('Pull semantic events from ClawIQ')
    .option('--api-key <key>', 'ClawIQ API key')

    .option('--since <time>', 'Start time (relative like 24h, or ISO)', '24h')
    .option('--until <time>', 'End time (relative or ISO)')
    .option('--source <source>', 'Filter by source')
    .option('--type <type>', 'Filter by event type')
    .option('--severity <severity>', 'Filter by severity')
    .option('--agent <id>', 'Filter by agent ID')
    .option('--name <text>', 'Filter by event name (contains)')
    .option('--limit <n>', 'Results per page', parseIntOption, 50)
    .option('--offset <n>', 'Pagination offset', parseIntOption)
    .option('--page <n>', 'Pagination page (1-based)', parseIntOption)
    .option('--json', 'Output as JSON')
    .option('--compact', 'Compact output')
    .action(async (options: PullSemanticOptions) => {
      try {
        const client = buildClient(options.apiKey);
        const page = computePageInfo(options);
        const range = resolveTimeRange(options.since, options.until, '24h');

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
        let total: number | undefined = response.total;
        if (options.name) {
          events = events.filter((event) => containsInsensitive(event.name, options.name!));
          total = undefined;
        }

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                events,
                pagination: {
                  ...page,
                  total,
                },
              },
              null,
              2
            )
          );
          return;
        }

        if (events.length === 0) {
          console.log(chalk.dim('No semantic events found'));
          return;
        }

        if (options.compact) {
          printSemanticCompact(events);
        } else {
          printSemanticTable(events);
        }

        printPaginationFooter('semantic events', events.length, page, total);
      } catch (error) {
        handleError(error);
      }
    });
}

function buildTracesCommand(): Command {
  return new Command('traces')
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
    .option('--limit <n>', 'Results per page', parseIntOption, 50)
    .option('--offset <n>', 'Pagination offset', parseIntOption)
    .option('--page <n>', 'Pagination page (1-based)', parseIntOption)
    .option('--json', 'Output as JSON')
    .option('--compact', 'Compact output')
    .action(async (options: PullTracesOptions) => {
      try {
        const client = buildClient(options.apiKey);
        const page = computePageInfo(options);
        const range = resolveTimeRange(options.since, options.until, '24h');
        const result = await fetchTraceRecords(
          client,
          options,
          range.start,
          range.end,
          page.limit,
          page.offset
        );
        const traces = result.traces ?? [];
        const total = result.total ?? 0;

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                traces,
                pagination: {
                  ...page,
                  total,
                },
              },
              null,
              2
            )
          );
          return;
        }

        if (traces.length === 0) {
          console.log(chalk.dim('No traces found'));
          return;
        }

        if (options.compact) {
          printTracesCompact(traces);
        } else {
          printTracesTable(traces);
        }

        printPaginationFooter('traces', traces.length, page, total);
      } catch (error) {
        handleError(error);
      }
    });
}

function buildErrorsCommand(): Command {
  return new Command('errors')
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
    .option('--limit <n>', 'Results per page', parseIntOption, 50)
    .option('--offset <n>', 'Pagination offset', parseIntOption)
    .option('--page <n>', 'Pagination page (1-based)', parseIntOption)
    .option('--json', 'Output as JSON')
    .option('--compact', 'Compact output')
    .action(async (options: PullErrorsOptions) => {
      try {
        const client = buildClient(options.apiKey);
        const page = computePageInfo(options);
        const range = resolveTimeRange(options.since, options.until, '24h');
        const result = await fetchErrorRecords(
          client,
          options,
          range.start,
          range.end,
          page.limit,
          page.offset
        );
        const errors = result.errors ?? [];
        const total = result.total ?? 0;

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                errors,
                pagination: {
                  ...page,
                  total,
                },
              },
              null,
              2
            )
          );
          return;
        }

        if (errors.length === 0) {
          console.log(chalk.dim('No errors found'));
          return;
        }

        if (options.compact) {
          printErrorsCompact(errors);
        } else {
          printErrorsTable(errors);
        }

        printPaginationFooter('errors', errors.length, page, total);
      } catch (error) {
        handleError(error);
      }
    });
}

function buildMarkersCommand(): Command {
  return new Command('markers')
    .description('Pull semantic event markers (aggregated in 5m buckets)')
    .option('--api-key <key>', 'ClawIQ API key')

    .option('--since <time>', 'Start time (relative like 24h, or ISO)', '24h')
    .option('--until <time>', 'End time (relative or ISO)')
    .option('--source <source>', 'Filter by source')
    .option('--type <type>', 'Filter by event type')
    .option('--severity <severity>', 'Filter by severity')
    .option('--agent <id>', 'Filter by agent ID')
    .option('--name <text>', 'Filter by event name (contains)')
    .option('--limit <n>', 'Results per page', parseIntOption, 50)
    .option('--offset <n>', 'Pagination offset', parseIntOption)
    .option('--page <n>', 'Pagination page (1-based)', parseIntOption)
    .option('--json', 'Output as JSON')
    .option('--compact', 'Compact output')
    .action(async (options: PullMarkersOptions) => {
      try {
        const client = buildClient(options.apiKey);
        const page = computePageInfo(options);
        const range = resolveTimeRange(options.since, options.until, '24h');
        const markers = await fetchMarkers(client, options, range.start, range.end);

        const total = markers.length;
        const pageItems = markers.slice(page.offset, page.offset + page.limit);

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                markers: pageItems,
                pagination: {
                  ...page,
                  total,
                },
              },
              null,
              2
            )
          );
          return;
        }

        if (pageItems.length === 0) {
          console.log(chalk.dim('No markers found'));
          return;
        }

        if (options.compact) {
          printMarkersCompact(pageItems);
        } else {
          printMarkersTable(pageItems);
        }

        printPaginationFooter('markers', pageItems.length, page, total);
      } catch (error) {
        handleError(error);
      }
    });
}

export function createPullCommand(): Command {
  const cmd = new Command('pull').description('Pull telemetry and annotations from ClawIQ');
  cmd.addCommand(buildAllCommand());
  cmd.addCommand(buildTracesCommand());
  cmd.addCommand(buildErrorsCommand());
  cmd.addCommand(buildEventsCommand());
  cmd.addCommand(buildSemanticCommand());
  cmd.addCommand(buildMarkersCommand());
  return cmd;
}
