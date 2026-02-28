import { ClawIQClient, ErrorRecord, TraceRecord } from '../../api.js';
import { PullAllOptions, PullErrorsOptions, PullMarkersOptions, PullTracesOptions, Marker } from './types.js';
export declare function fetchTraceRecords(client: ClawIQClient, options: PullTracesOptions | PullAllOptions, start: string, end: string, limit: number, offset: number): Promise<{
    traces: TraceRecord[];
    total?: number;
}>;
export declare function fetchErrorRecords(client: ClawIQClient, options: PullErrorsOptions | PullAllOptions, start: string, end: string, limit: number, offset: number): Promise<{
    errors: ErrorRecord[];
    total?: number;
}>;
export declare function fetchMarkers(client: ClawIQClient, options: PullMarkersOptions | PullAllOptions, start: string, end: string): Promise<Marker[]>;
//# sourceMappingURL=fetch.d.ts.map