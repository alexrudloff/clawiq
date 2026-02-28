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
    errors?: Array<{
        index: number;
        code: string;
        message: string;
    }>;
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
export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface FindingMeta {
    title: string;
    description?: string;
    patch?: string;
    evidence?: string;
    target_agent: string;
    finding_severity: FindingSeverity;
}
export interface Finding {
    id: string;
    timestamp: string;
    agent_id?: string;
    target_agent: string;
    severity: FindingSeverity;
    title: string;
    description?: string;
    patch?: string;
    evidence?: string;
}
export interface FindingsResponse {
    findings: Finding[];
    total: number;
}
export declare class ClawIQClient {
    private endpoint;
    private apiKey;
    private version?;
    constructor(endpoint: string, apiKey: string, version?: string | undefined);
    private request;
    /**
     * Emit events to ClawIQ (via measure service)
     */
    emit(events: ClawIQEvent[]): Promise<EmitResponse>;
    /**
     * Get tags (via API service - need different endpoint)
     * Note: OSS mode accepts API-key style auth on the same service.
     */
    getTags(since?: string, limit?: number): Promise<TagsResponse>;
    getSemanticEvents(params: QueryParams): Promise<QueryResponse>;
    getEvents(params: EventsQueryParams): Promise<EventsResponse>;
    getTraces(params: TracesQueryParams): Promise<TracesResponse>;
    getErrors(params: ErrorsQueryParams): Promise<ErrorsResponse>;
    getEventMarkers(hours?: number): Promise<EventMarkersResponse>;
    /**
     * Submit a finding as a semantic event with type='finding'.
     * Uses the existing emit endpoint; backend can add a dedicated endpoint later.
     */
    submitFinding(finding: {
        agent: string;
        targetAgent: string;
        severity: FindingSeverity;
        title: string;
        description?: string;
        patch?: string;
        evidence?: string;
    }): Promise<EmitResponse>;
    /**
     * Query findings (semantic events with type='finding').
     */
    getFindings(params: {
        since?: string;
        until?: string;
        agent?: string;
        targetAgent?: string;
        limit?: number;
        offset?: number;
    }): Promise<FindingsResponse>;
}
//# sourceMappingURL=api.d.ts.map