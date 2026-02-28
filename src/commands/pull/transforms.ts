import { ErrorRecord, SemanticEvent, SpanEvent, TraceRecord } from '../../api.js';
import { Marker } from './types.js';

export function toTraceRecord(event: SpanEvent): TraceRecord {
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

export function toErrorRecord(event: SpanEvent): ErrorRecord {
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

function bucket5m(iso: string): string {
  const date = new Date(iso);
  date.setUTCSeconds(0, 0);
  date.setUTCMinutes(date.getUTCMinutes() - (date.getUTCMinutes() % 5));
  return date.toISOString();
}

export function buildMarkerRecords(events: SemanticEvent[]): Marker[] {
  const markerMap = new Map<string, Marker>();
  for (const event of events) {
    const timestamp = bucket5m(event.timestamp);
    const key = `${timestamp}|${event.type}|${event.name}|${event.severity}`;
    const existing = markerMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
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
