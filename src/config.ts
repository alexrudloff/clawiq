import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')) as { version: string };
// Compute version from git: YYYY.MM.DD.commits-today
function computeCliVersion(): string {
  try {
    const { execFileSync } = require('child_process');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const yesterday = new Date(now.getTime() - 86400000);
    const yYear = yesterday.getFullYear();
    const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yDay = String(yesterday.getDate()).padStart(2, '0');
    const count = execFileSync('git', ['rev-list', '--count', `--after=${yYear}-${yMonth}-${yDay}`, 'HEAD'], {
      cwd: require('path').resolve(__dirname, '..'),
      encoding: 'utf-8',
    }).trim();
    return `${year}.${month}.${day}.${count || '0'}`;
  } catch {
    return pkg.version; // fallback to package.json
  }
}
export const CLI_VERSION: string = computeCliVersion();

export interface ClawIQConfig {
  apiKey?: string;
  defaultAgent?: string;
}

const CONFIG_DIR = join(homedir(), '.clawiq');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export const API_ENDPOINT = 'https://api.clawiq.md';

/**
 * Load config from environment or ~/.clawiq/config.json
 */
export function loadConfig(): ClawIQConfig {
  const config: ClawIQConfig = {};

  if (existsSync(CONFIG_FILE)) {
    try {
      const saved = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      if (saved.apiKey) config.apiKey = saved.apiKey;
      if (saved.defaultAgent) config.defaultAgent = saved.defaultAgent;
    } catch {
      // Ignore parse errors
    }
  }

  if (process.env.CLAWIQ_API_KEY) {
    config.apiKey = process.env.CLAWIQ_API_KEY;
  }

  return config;
}

/**
 * Save config to ~/.clawiq/config.json
 */
export function saveConfig(config: ClawIQConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Get API key from config or throw error
 */
export function requireApiKey(config: ClawIQConfig, flagApiKey?: string): string {
  const apiKey = flagApiKey || config.apiKey;
  if (!apiKey) {
    throw new Error(
      'API key required. Set via:\n' +
      '  --api-key flag\n' +
      '  CLAWIQ_API_KEY environment variable\n' +
      '  clawiq init'
    );
  }
  return apiKey;
}
