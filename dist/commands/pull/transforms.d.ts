import { ErrorRecord, SemanticEvent, SpanEvent, TraceRecord } from '../../api.js';
import { Marker } from './types.js';
export declare function toTraceRecord(event: SpanEvent): TraceRecord;
export declare function toErrorRecord(event: SpanEvent): ErrorRecord;
export declare function buildMarkerRecords(events: SemanticEvent[]): Marker[];
//# sourceMappingURL=transforms.d.ts.map