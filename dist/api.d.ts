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
export type IssueImpact = 'low' | 'medium' | 'high' | 'critical';
export interface IssueMeta {
    title: string;
    description?: string;
    patch?: string;
    evidence?: string;
    target_agent: string;
    issue_impact?: IssueImpact;
}
export interface Issue {
    id: string;
    timestamp: string;
    agent_id?: string;
    target_agent: string;
    impact: IssueImpact;
    title: string;
    description?: string;
    patch?: string;
    evidence?: string;
}
export interface IssuesResponse {
    issues: Issue[];
    total: number;
}
export type IssueStatus = 'open' | 'dismissed' | 'resolved' | 'not_helpful';
export interface IssueStateRecord {
    issue_id: string;
    status: IssueStatus;
    last_signal?: string;
    updated_at: string;
}
export interface LennyDiscussionConversation {
    id: string;
    account_id?: string;
    agent_id: string;
    title: string;
    issue_id?: string;
    created_at: string;
    updated_at: string;
}
export interface LennyDiscussionMessage {
    id: string;
    conversation_id: string;
    agent_id: string;
    role: string;
    direction: string;
    content: string;
    status: string;
    error_message?: string;
    replied_to_id?: string;
    created_at: string;
    updated_at: string;
}
export interface LennyIssueDiscussion {
    issue_id: string;
    conversation?: LennyDiscussionConversation;
    messages: LennyDiscussionMessage[];
}
export declare class ClawIQClient {
    private endpoint;
    private apiKey;
    private version?;
    constructor(endpoint: string, apiKey: string, version?: string | undefined);
    private request;
    private shouldEmitServerMetrics;
    private emitServerMetrics;
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
    getSemanticEventByID(eventID: string): Promise<SemanticEvent>;
    getEvents(params: EventsQueryParams): Promise<EventsResponse>;
    getTraces(params: TracesQueryParams): Promise<TracesResponse>;
    getErrors(params: ErrorsQueryParams): Promise<ErrorsResponse>;
    getEventMarkers(hours?: number): Promise<EventMarkersResponse>;
    /**
     * Submit an issue as a semantic event with type='issue'.
     * Uses the existing emit endpoint; backend can add a dedicated endpoint later.
     */
    submitIssue(issue: {
        agent: string;
        targetAgent: string;
        impact: IssueImpact;
        title: string;
        description?: string;
        patch?: string;
        evidence?: string;
    }): Promise<EmitResponse>;
    /**
     * Query issues (semantic events with type='issue').
     */
    getIssues(params: {
        since?: string;
        until?: string;
        agent?: string;
        targetAgent?: string;
        limit?: number;
        offset?: number;
    }): Promise<IssuesResponse>;
    getIssueByID(issueID: string): Promise<Issue>;
    getIssueState(issueID: string): Promise<IssueStateRecord | null>;
    getIssueDiscussion(issueID: string, limit?: number): Promise<LennyIssueDiscussion | null>;
}
//# sourceMappingURL=api.d.ts.map