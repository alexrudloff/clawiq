import {
  ClawIQClient,
  EventsResponse,
  QueryParams,
  ErrorRecord,
  SemanticEvent,
  TraceRecord,
} from '../../api.js';
import {
  PullAllOptions,
  PullErrorsOptions,
  PullMarkersOptions,
  PullTracesOptions,
  Marker,
} from './types.js';
import { buildMarkerRecords, toErrorRecord, toTraceRecord } from './transforms.js';
import { containsInsensitive, matchesAgent } from './filters.js';

async function fetchAllSemanticEvents(client: ClawIQClient, params: QueryParams): Promise<SemanticEvent[]> {
  const batchSize = 500;
  const maxEvents = 50_000;
  const all: SemanticEvent[] = [];
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

export async function fetchTraceRecords(
  client: ClawIQClient,
  options: PullTracesOptions | PullAllOptions,
  start: string,
  end: string,
  limit: number,
  offset: number
): Promise<{ traces: TraceRecord[]; total?: number }> {
  const needsEventFallback =
    Boolean(options.agent) ||
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
    let total: number | undefined = response.total;
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

export async function fetchErrorRecords(
  client: ClawIQClient,
  options: PullErrorsOptions | PullAllOptions,
  start: string,
  end: string,
  limit: number,
  offset: number
): Promise<{ errors: ErrorRecord[]; total?: number }> {
  const needsEventFallback =
    Boolean(options.agent) ||
    Boolean(options.model) ||
    Boolean(options.session) ||
    Boolean(options.search);

  let errors: ErrorRecord[];
  let total: number | undefined;

  if (needsEventFallback) {
    const serverSearch = options.agent ? `agent:${options.agent}:` : options.search;
    const response: EventsResponse = await client.getEvents({
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

    errors = events.map(toErrorRecord);
  } else {
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

export async function fetchMarkers(
  client: ClawIQClient,
  options: PullMarkersOptions | PullAllOptions,
  start: string,
  end: string
): Promise<Marker[]> {
  let events = await fetchAllSemanticEvents(client, {
    since: start,
    until: end,
    source: options.source,
    type: options.type,
    severity: options.severity,
    agent: options.agent,
  });

  if (options.name) {
    events = events.filter((event) => containsInsensitive(event.name, options.name!));
  }

  return buildMarkerRecords(events);
}
