import { mkdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const OPENCLAW_DOCS_INDEX_URL = 'https://docs.openclaw.ai/llms.txt';
const OPENCLAW_DOCS_HOST = 'docs.openclaw.ai';
const OPENCLAW_DOCS_DIRNAME = 'openclaw-docs';
const OPENCLAW_DOCS_TMP_DIRNAME = '.openclaw-docs-sync-tmp';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_FAILURES_RECORDED = 50;
const DOWNLOAD_CONCURRENCY = 8;

export interface OpenClawDocsSyncResult {
  destinationDir: string;
  manifestPath: string;
  totalReferenced: number;
  downloaded: number;
  failed: number;
  failures: string[];
}

export async function syncOpenClawDocs(memoryDir: string): Promise<OpenClawDocsSyncResult> {
  const destinationDir = join(memoryDir, OPENCLAW_DOCS_DIRNAME);
  const tmpDir = join(memoryDir, OPENCLAW_DOCS_TMP_DIRNAME);
  mkdirSync(memoryDir, { recursive: true });
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  const llmsText = await fetchText(OPENCLAW_DOCS_INDEX_URL);
  writeFileSync(join(tmpDir, 'llms.txt'), llmsText);

  const urls = extractDocUrls(llmsText);
  let downloaded = 0;
  let failed = 0;
  const failures: string[] = [];
  let cursor = 0;

  await Promise.all(
    Array.from({ length: DOWNLOAD_CONCURRENCY }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= urls.length) {
          return;
        }

        const url = urls[index];
        try {
          const body = await fetchText(url);
          const relativePath = urlToRelativePath(url);
          const fullPath = join(tmpDir, relativePath);
          mkdirSync(dirname(fullPath), { recursive: true });
          writeFileSync(fullPath, body);
          downloaded++;
        } catch (err) {
          failed++;
          if (failures.length < MAX_FAILURES_RECORDED) {
            failures.push(`${url}: ${formatError(err)}`);
          }
        }
      }
    }),
  );

  const manifest = {
    source_index: OPENCLAW_DOCS_INDEX_URL,
    generated_at: new Date().toISOString(),
    total_referenced: urls.length,
    downloaded,
    failed,
    failures,
  };
  const manifestPath = join(tmpDir, '_manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  rmSync(destinationDir, { recursive: true, force: true });
  renameSync(tmpDir, destinationDir);

  return {
    destinationDir,
    manifestPath: join(destinationDir, '_manifest.json'),
    totalReferenced: urls.length,
    downloaded,
    failed,
    failures,
  };
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'clawiq-cli/openclaw-docs-sync',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractDocUrls(text: string): string[] {
  const candidates: string[] = [];
  const markdownLinkRegex = /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g;
  const bareUrlRegex = /https?:\/\/[^\s)]+/g;

  let match: RegExpExecArray | null;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    candidates.push(match[1]);
  }
  while ((match = bareUrlRegex.exec(text)) !== null) {
    candidates.push(match[0]);
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== OPENCLAW_DOCS_HOST) {
      continue;
    }
    const normalized = `${parsed.origin}${parsed.pathname}${parsed.search}`;
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function urlToRelativePath(url: string): string {
  const parsed = new URL(url);
  let pathname = parsed.pathname;
  if (pathname.startsWith('/')) {
    pathname = pathname.slice(1);
  }
  if (pathname === '') {
    pathname = 'index.md';
  }
  if (pathname.endsWith('/')) {
    pathname += 'index.md';
  }

  const parts = pathname
    .split('/')
    .filter(Boolean)
    .map(sanitizePathPart);
  let relative = parts.join('/');
  if (!relative) {
    relative = 'index.md';
  }

  if (parsed.search) {
    const queryTag = sanitizePathPart(parsed.search.slice(1));
    const dot = relative.lastIndexOf('.');
    if (dot > 0) {
      relative = `${relative.slice(0, dot)}--${queryTag}${relative.slice(dot)}`;
    } else {
      relative = `${relative}--${queryTag}`;
    }
  }

  return relative;
}

function sanitizePathPart(input: string): string {
  const cleaned = input
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : 'doc';
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
