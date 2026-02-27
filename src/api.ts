export interface ClawIQEvent {
  type: string;
  name: string;
  source?: string;
  severity?: string;
  agent_id?: string;
  session_id?: string;
  channel?: string;
  target?: string;
  quality_tags?: string[];
  action_tags?: string[];
  domain_tags?: string[];
  meta?: Record<string, unknown>;
  duration_ms?: number;
  parent_id?: string;
  trace_id?: string;
  timestamp?: string;
}

export interface EmitResponse {
  accepted: number;
  rejected?: number;
  event_ids: string[];
  errors?: Array<{ index: number; code: string; message: string }>;
}

export interface TagInfo {
  tag: string;
  count: number;
  last_used: string;
}

export interface TagsResponse {
  quality_tags: TagInfo[];
  action_tags: TagInfo[];
  domain_tags: TagInfo[];
}

export interface QueryParams {
  since?: string;
  until?: string;
  source?: string;
  type?: string;
  agent?: string;
  severity?: string;
  channel?: string;
  session?: string;
  search?: string;
  model?: string;
  status?: string;
  limit?: number;
  offset?: number;
  name?: string;
}

export interface SemanticEvent {
  id: string;
  timestamp: string;
  source: string;
  type: string;
  name: string;
  severity: string;
  agent_id?: string;
  session_id?: string;
  channel?: string;
  target?: string;
  quality_tags?: string[];
  action_tags?: string[];
  domain_tags?: string[];
  meta?: string;
}

export interface QueryResponse {
  events: SemanticEvent[];
  total: number;
  filters?: SemanticEventFilterOptions;
}

export interface SemanticEventFilterOptions {
  sources: string[];
  types: string[];
  severities: string[];
}

export interface TraceRecord {
  trace_id: string;
  start_time: string;
  duration_ms: number;
  channel: string;
  model: string;
  session_id?: string;
  agent_id?: string;
  tokens_input: number;
  tokens_output: number;
  status: string;
  error?: string;
}

export interface TracesResponse {
  traces: TraceRecord[];
  total: number;
}

export interface TracesQueryParams {
  since?: string;
  until?: string;
  channel?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ErrorRecord {
  timestamp: string;
  trace_id: string;
  channel: string;
  error_type: string;
  message: string;
  session_id?: string;
  agent_id?: string;
  model?: string;
}

export interface ErrorSummary {
  total: number;
  by_type: Record<string, number>;
}

export interface ErrorsResponse {
  errors: ErrorRecord[];
  summary: ErrorSummary;
}

export interface ErrorsQueryParams {
  since?: string;
  until?: string;
  channel?: string;
  errorType?: string;
  traceId?: string;
  limit?: number;
  offset?: number;
}

export interface SpanEvent {
  trace_id: string;
  span_id: string;
  name: string;
  start_time: string;
  duration_ms: number;
  status_code: string;
  channel: string;
  model: string;
  provider: string;
  session_id: string;
  agent_id: string;
  tokens_input: number;
  tokens_output: number;
  tokens_cache_read: number;
  tokens_cache_write: number;
  cost_usd: number;
  error_type: string;
  openclaw_version: string;
  chat_id: string;
  message_id: string;
  outcome: string;
  session_key: string;
  state: string;
  age_ms: number;
  queue_depth: number;
  tokens_total: number;
}

export interface EventFilterOptions {
  channels: string[];
  models: string[];
  statuses: string[];
}

export interface EventsResponse {
  events: SpanEvent[];
  total: number;
  filters?: EventFilterOptions;
}

export interface EventsQueryParams {
  since?: string;
  until?: string;
  channel?: string;
  model?: string;
  status?: string;
  session?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface EventMarker {
  timestamp: string;
  type: string;
  name: string;
  severity: string;
  count: number;
}

export interface EventMarkersResponse {
  markers: EventMarker[];
}

export class ClawIQClient {
  constructor(
    private endpoint: string,
    private apiKey: string
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.endpoint}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

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
      } catch {
        // Use raw text
      }
      throw new Error(`API error (${response.status}): ${message}`);
    }

    const json = await response.json() as { success?: boolean; error?: string; data?: T };
    // Handle wrapped responses from API service
    if (json.success !== undefined) {
      if (!json.success) {
        throw new Error(json.error || 'Unknown error');
      }
      return json.data as T;
    }
    return json as T;
  }

  /**
   * Emit events to ClawIQ (via measure service)
   */
  async emit(events: ClawIQEvent[]): Promise<EmitResponse> {
    return this.request<EmitResponse>('POST', '/v1/events', { events });
  }

  /**
   * Get tags (via API service - need different endpoint)
   * Note: OSS mode accepts API-key style auth on the same service.
   */
  async getTags(since?: string, limit?: number): Promise<TagsResponse> {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (limit) params.set('limit', limit.toString());
    const query = params.toString();
    return this.request<TagsResponse>('GET', `/v1/tags${query ? `?${query}` : ''}`);
  }

  /**
   * Query semantic events (CLI-generated events)
   */
  async query(params: QueryParams): Promise<QueryResponse> {
    return this.getSemanticEvents(params);
  }

  async getSemanticEvents(params: QueryParams): Promise<QueryResponse> {
    const searchParams = new URLSearchParams();
    if (params.since) searchParams.set('start', params.since);
    if (params.until) searchParams.set('end', params.until);
    if (params.source) searchParams.set('source', params.source);
    if (params.type) searchParams.set('type', params.type);
    if (params.agent) searchParams.set('agent_id', params.agent);
    if (params.severity) searchParams.set('severity', params.severity);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.name) searchParams.set('name', params.name);
    const query = searchParams.toString();
    return this.request<QueryResponse>('GET', `/v1/semantic-events${query ? `?${query}` : ''}`);
  }

  async getEvents(params: EventsQueryParams): Promise<EventsResponse> {
    const searchParams = new URLSearchParams();
    if (params.since) searchParams.set('start', params.since);
    if (params.until) searchParams.set('end', params.until);
    if (params.channel) searchParams.set('channel', params.channel);
    if (params.model) searchParams.set('model', params.model);
    if (params.status) searchParams.set('status', params.status);
    if (params.session) searchParams.set('session_id', params.session);
    if (params.search) searchParams.set('search', params.search);
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.request<EventsResponse>('GET', `/v1/events${query ? `?${query}` : ''}`);
  }

  async getTraces(params: TracesQueryParams): Promise<TracesResponse> {
    const searchParams = new URLSearchParams();
    if (params.since) searchParams.set('start', params.since);
    if (params.until) searchParams.set('end', params.until);
    if (params.channel) searchParams.set('channel', params.channel);
    if (params.status) searchParams.set('status', params.status);
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.request<TracesResponse>('GET', `/v1/traces${query ? `?${query}` : ''}`);
  }

  async getErrors(params: ErrorsQueryParams): Promise<ErrorsResponse> {
    const offset = params.offset || 0;
    const requestedLimit = params.limit || 100;
    const backendLimit = requestedLimit + offset;

    const searchParams = new URLSearchParams();
    if (params.since) searchParams.set('start', params.since);
    if (params.until) searchParams.set('end', params.until);
    searchParams.set('limit', backendLimit.toString());
    const query = searchParams.toString();
    const raw = await this.request<ErrorsResponse>('GET', `/v1/errors${query ? `?${query}` : ''}`);

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
    const byType: Record<string, number> = {};
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

  async getEventMarkers(hours = 24): Promise<EventMarkersResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('hours', hours.toString());
    const query = searchParams.toString();
    return this.request<EventMarkersResponse>('GET', `/v1/event-markers${query ? `?${query}` : ''}`);
  }
}
