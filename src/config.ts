import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface ClawIQConfig {
  apiKey?: string;
  endpoint?: string;        // Measure service (ingest) - default :4318
  apiEndpoint?: string;     // API service (queries) - default :8080
  defaultAgent?: string;
  defaultSource?: string;
}

const CONFIG_DIR = join(homedir(), '.clawiq');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const OPENCLAW_CONFIG = join(homedir(), '.openclaw', 'openclaw.json');

const DEFAULT_ENDPOINT = 'https://api.clawiq.md';      // Measure (ingest)
const DEFAULT_API_ENDPOINT = 'https://api.clawiq.md'; // API (queries)

/**
 * Load config from multiple sources in priority order:
 * 1. Environment variables
 * 2. ~/.clawiq/config.json
 * 3. ~/.openclaw/openclaw.json (extract from OTEL headers)
 */
export function loadConfig(): ClawIQConfig {
  const config: ClawIQConfig = {};

  // Try OpenClaw config first (lowest priority)
  if (existsSync(OPENCLAW_CONFIG)) {
    try {
      const openclawConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'));
      const authHeader = openclawConfig?.diagnostics?.otel?.headers?.Authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        config.apiKey = authHeader.slice(7);
      }
      // Extract endpoint if available
      const endpoint = openclawConfig?.diagnostics?.otel?.endpoint;
      if (endpoint) {
        config.endpoint = endpoint;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Try ClawIQ config (medium priority)
  if (existsSync(CONFIG_FILE)) {
    try {
      const clawiqConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      if (clawiqConfig.apiKey) config.apiKey = clawiqConfig.apiKey;
      if (clawiqConfig.endpoint) config.endpoint = clawiqConfig.endpoint;
      if (clawiqConfig.apiEndpoint) config.apiEndpoint = clawiqConfig.apiEndpoint;
      if (clawiqConfig.defaultAgent) config.defaultAgent = clawiqConfig.defaultAgent;
      if (clawiqConfig.defaultSource) config.defaultSource = clawiqConfig.defaultSource;
    } catch {
      // Ignore parse errors
    }
  }

  // Environment variables (highest priority)
  if (process.env.CLAWIQ_API_KEY) {
    config.apiKey = process.env.CLAWIQ_API_KEY;
  }
  if (process.env.CLAWIQ_ENDPOINT) {
    config.endpoint = process.env.CLAWIQ_ENDPOINT;
  }
  if (process.env.CLAWIQ_API_ENDPOINT) {
    config.apiEndpoint = process.env.CLAWIQ_API_ENDPOINT;
  }
  if (process.env.CLAWIQ_AGENT) {
    config.defaultAgent = process.env.CLAWIQ_AGENT;
  }

  // Set defaults
  if (!config.endpoint) {
    config.endpoint = DEFAULT_ENDPOINT;
  }
  if (!config.apiEndpoint) {
    config.apiEndpoint = DEFAULT_API_ENDPOINT;
  }
  if (!config.defaultSource) {
    config.defaultSource = 'agent';
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
      '  clawiq init (saves to ~/.clawiq/config.json)\n' +
      '  ~/.openclaw/openclaw.json (OTEL headers)'
    );
  }
  return apiKey;
}

/**
 * Get measure endpoint from config (for ingest)
 */
export function getEndpoint(config: ClawIQConfig, flagEndpoint?: string): string {
  return flagEndpoint || config.endpoint || DEFAULT_ENDPOINT;
}

/**
 * Get API endpoint from config (for queries/tags)
 */
export function getApiEndpoint(config: ClawIQConfig, flagEndpoint?: string): string {
  return flagEndpoint || config.apiEndpoint || DEFAULT_API_ENDPOINT;
}
