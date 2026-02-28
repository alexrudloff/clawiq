import { ErrorRecord, SemanticEvent, SpanEvent, TraceRecord } from '../../api.js';
import { Marker, TimelineItem } from './types.js';
export declare function printTracesCompact(items: TraceRecord[]): void;
export declare function printTracesTable(items: TraceRecord[]): void;
export declare function printErrorsCompact(items: ErrorRecord[]): void;
export declare function printErrorsTable(items: ErrorRecord[]): void;
export declare function printSpanEventsCompact(items: SpanEvent[]): void;
export declare function printSpanEventsTable(items: SpanEvent[]): void;
export declare function printSemanticCompact(items: SemanticEvent[]): void;
export declare function printSemanticTable(items: SemanticEvent[]): void;
export declare function printMarkersCompact(items: Marker[]): void;
export declare function printMarkersTable(items: Marker[]): void;
export declare function printTimelineCompact(items: TimelineItem[]): void;
export declare function printTimelineTable(items: TimelineItem[]): void;
//# sourceMappingURL=formatters.d.ts.map