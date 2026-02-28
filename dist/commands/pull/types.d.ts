export interface CommonPullOptions {
    apiKey?: string;
    since?: string;
    until?: string;
    limit?: number;
    offset?: number;
    page?: number;
    json?: boolean;
    compact?: boolean;
}
export interface PullEventsOptions extends CommonPullOptions {
    channel?: string;
    model?: string;
    status?: string;
    session?: string;
    search?: string;
    agent?: string;
}
export interface PullSemanticOptions extends CommonPullOptions {
    source?: string;
    type?: string;
    severity?: string;
    agent?: string;
    name?: string;
}
export interface PullTracesOptions extends CommonPullOptions {
    channel?: string;
    status?: string;
    model?: string;
    session?: string;
    search?: string;
    agent?: string;
}
export interface PullErrorsOptions extends CommonPullOptions {
    channel?: string;
    type?: string;
    trace?: string;
    model?: string;
    session?: string;
    search?: string;
    agent?: string;
}
export interface PullMarkersOptions extends CommonPullOptions {
    source?: string;
    type?: string;
    severity?: string;
    agent?: string;
    name?: string;
}
export interface PullAllOptions extends CommonPullOptions {
    channel?: string;
    model?: string;
    status?: string;
    session?: string;
    search?: string;
    agent?: string;
    source?: string;
    type?: string;
    trace?: string;
    severity?: string;
    name?: string;
}
export interface PageInfo {
    limit: number;
    offset: number;
    page: number;
}
export interface Marker {
    timestamp: string;
    type: string;
    name: string;
    severity: string;
    count: number;
}
export type TimelineKind = 'trace' | 'error' | 'marker';
export interface TimelineItem {
    kind: TimelineKind;
    timestamp: string;
    summary: string;
    trace_id?: string;
    channel?: string;
    model?: string;
    agent?: string;
    severity?: string;
}
//# sourceMappingURL=types.d.ts.map