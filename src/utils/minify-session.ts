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

// ── Types ────────────────────────────────────────────────────────

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SessionMessage {
  role: string;
  content?: ContentBlock[];
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  api?: string;
  provider?: string;
  model?: string;
  stopReason?: string;
  timestamp?: number;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    totalTokens?: number;
    cost?: Record<string, number>;
  };
}

interface SessionLine {
  type: string;
  id?: string;
  parentId?: string;
  timestamp?: string;
  message?: SessionMessage;
  [key: string]: unknown;
}

// ── Minified output types ────────────────────────────────────────

interface MinifiedToolCall {
  tool: string;
  args?: Record<string, unknown>;
}

interface MinifiedMessage {
  role: string;
  content?: string;
  toolCalls?: MinifiedToolCall[];
  toolResult?: { tool: string; content: string; error?: true; truncatedFrom?: number };
  tokens?: { in: number; out: number };
  stop?: string;
}

// ── Config ───────────────────────────────────────────────────────

const TOOL_RESULT_MAX_CHARS = 1500;
const TOOL_ARGS_MAX_CHARS = 500;

// ── Core ─────────────────────────────────────────────────────────

function truncate(text: string, maxChars: number): { text: string; truncatedFrom?: number } {
  if (text.length <= maxChars) return { text };
  const half = Math.floor(maxChars / 2);
  const truncated =
    text.slice(0, half) +
    `\n[... truncated ${text.length - maxChars} chars ...]\n` +
    text.slice(-half);
  return { text: truncated, truncatedFrom: text.length };
}

function truncateArgs(args: Record<string, unknown>): Record<string, unknown> {
  const serialized = JSON.stringify(args);
  if (serialized.length <= TOOL_ARGS_MAX_CHARS) return args;

  // Keep the structure but truncate long string values
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string' && v.length > 200) {
      result[k] = v.slice(0, 200) + '...';
    } else {
      result[k] = v;
    }
  }
  return result;
}

function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text!)
    .join('\n');
}

function extractToolCalls(blocks: ContentBlock[]): MinifiedToolCall[] {
  return blocks
    .filter((b) => b.type === 'toolCall')
    .map((b) => {
      const call: MinifiedToolCall = { tool: b.name ?? 'unknown' };
      if (b.arguments && Object.keys(b.arguments).length > 0) {
        call.args = truncateArgs(b.arguments);
      }
      return call;
    });
}

function minifyMessage(msg: SessionMessage): MinifiedMessage | null {
  const out: MinifiedMessage = { role: msg.role };

  if (msg.role === 'user') {
    const text = msg.content ? extractText(msg.content) : '';
    if (text) out.content = text;
    return out;
  }

  if (msg.role === 'assistant') {
    const text = msg.content ? extractText(msg.content) : '';
    const calls = msg.content ? extractToolCalls(msg.content) : [];

    if (text) out.content = text;
    if (calls.length > 0) out.toolCalls = calls;

    if (msg.usage) {
      const inp = msg.usage.input ?? 0;
      const outp = msg.usage.output ?? 0;
      if (inp > 0 || outp > 0) {
        out.tokens = { in: inp, out: outp };
      }
    }
    if (msg.stopReason) out.stop = msg.stopReason;

    return out;
  }

  if (msg.role === 'toolResult') {
    const rawText = msg.content ? extractText(msg.content) : '';
    const { text, truncatedFrom } = truncate(rawText, TOOL_RESULT_MAX_CHARS);

    out.toolResult = {
      tool: msg.toolName ?? 'unknown',
      content: text,
    };
    if (msg.isError) out.toolResult.error = true;
    if (truncatedFrom) out.toolResult.truncatedFrom = truncatedFrom;

    // Flatten role to make output cleaner
    out.role = 'tool';
    return out;
  }

  // Unknown role — keep it as-is with content
  const text = msg.content ? extractText(msg.content) : '';
  if (text) out.content = text;
  return out;
}

// ── Public API ───────────────────────────────────────────────────

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

/** Rough token estimate: ~4 chars per token for English/code mix. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Minify a session JSONL string for LLM consumption.
 *
 * Strips metadata, truncates tool results, and produces a compact
 * one-JSON-object-per-line output preserving conversation structure.
 */
export function minifySession(jsonlContent: string): MinifyResult {
  const lines = jsonlContent.split('\n').filter((l) => l.trim());
  const originalBytes = jsonlContent.length;
  const minifiedLines: string[] = [];

  for (const line of lines) {
    let parsed: SessionLine;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue; // skip malformed lines
    }

    // Only keep message records
    if (parsed.type !== 'message' || !parsed.message) continue;

    const minified = minifyMessage(parsed.message);
    if (!minified) continue;

    minifiedLines.push(JSON.stringify(minified));
  }

  const minifiedStr = minifiedLines.join('\n');
  const minifiedBytes = minifiedStr.length;
  const estOrigTokens = estimateTokens(jsonlContent);
  const estMinTokens = estimateTokens(minifiedStr);

  return {
    minified: minifiedStr,
    stats: {
      originalBytes,
      minifiedBytes,
      originalLines: lines.length,
      minifiedLines: minifiedLines.length,
      reductionPct: Math.round((1 - minifiedBytes / originalBytes) * 100),
      estimatedOriginalTokens: estOrigTokens,
      estimatedMinifiedTokens: estMinTokens,
      tokenReductionPct: Math.round((1 - estMinTokens / estOrigTokens) * 100),
    },
  };
}

/**
 * Minify a session JSONL file by path.
 */
export async function minifySessionFile(filePath: string): Promise<MinifyResult> {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(filePath, 'utf-8');
  return minifySession(content);
}
