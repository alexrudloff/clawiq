import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export const OPENCLAW_DIR = join(homedir(), '.openclaw');
export const OPENCLAW_CONFIG = join(OPENCLAW_DIR, 'openclaw.json');

export interface OpenClawAgent {
  id: string;
  workspace: string;
  model?: { primary: string };
}

export interface OpenClawConfig {
  [key: string]: unknown;
  diagnostics?: {
    enabled?: boolean;
    otel?: {
      enabled?: boolean;
      endpoint?: string;
      headers?: Record<string, string>;
      traces?: boolean;
      metrics?: boolean;
      logs?: boolean;
    };
  };
  agents?: {
    defaults?: Record<string, unknown>;
    list?: OpenClawAgent[];
  };
}

export function loadOpenClawConfig(): OpenClawConfig {
  if (!existsSync(OPENCLAW_CONFIG)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'));
  } catch {
    return {};
  }
}

const PRE_CLAWIQ_BACKUP = join(OPENCLAW_DIR, 'openclaw.pre-clawiq.json');

export function backupOpenClawConfig(): boolean {
  if (existsSync(OPENCLAW_CONFIG) && !existsSync(PRE_CLAWIQ_BACKUP)) {
    copyFileSync(OPENCLAW_CONFIG, PRE_CLAWIQ_BACKUP);
    return true;
  }
  return false;
}

export function saveOpenClawConfig(config: OpenClawConfig): void {
  if (!existsSync(OPENCLAW_DIR)) {
    mkdirSync(OPENCLAW_DIR, { recursive: true });
  }

  writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
}

export function agentExists(config: OpenClawConfig, id: string): boolean {
  const list = config.agents?.list ?? [];
  return list.some((a) => a.id === id);
}
