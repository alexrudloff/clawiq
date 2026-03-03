/**
 * Session JSONL minifier for LLM analysis.
 *
 * Strips redundant metadata and truncates large tool results to achieve
 * >50% token reduction with no analysis quality loss.
 *
 * Session JSONL format (OpenClaw):
 *   Each line is one of: session | model_change | thinking_level_change | message | custom
 *   Messages have roles: user | assistant | toolResult
 *
 * What we keep:  role, content (trimmed), tool name, tool args (trimmed),
 *                stop reason, input/output token counts, isError when true
 * What we strip: UUIDs, envelope metadata, per-message model/provider/api,
 *                cost fields, null/empty fields, non-message records
 */
export interface MinifyResult {
    minified: string;
    stats: {
        originalBytes: number;
        minifiedBytes: number;
        originalLines: number;
        minifiedLines: number;
        reductionPct: number;
        estimatedOriginalTokens: number;
        estimatedMinifiedTokens: number;
        tokenReductionPct: number;
    };
}
/**
 * Minify a session JSONL string for LLM consumption.
 *
 * Strips metadata, truncates tool results, and produces a compact
 * one-JSON-object-per-line output preserving conversation structure.
 */
export declare function minifySession(jsonlContent: string): MinifyResult;
/**
 * Minify a session JSONL file by path.
 */
export declare function minifySessionFile(filePath: string): Promise<MinifyResult>;
//# sourceMappingURL=minify-session.d.ts.map