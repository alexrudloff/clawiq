import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { OPENCLAW_DIR } from '../openclaw.js';

const CLAWIQ_WEB_PLUGIN_ID = 'clawiq-web';

export interface ClawiqWebPluginInstallResult {
  installed: boolean;
  targetDir: string;
  sourceDir?: string;
  error?: string;
}

export function ensureClawiqWebPluginInstalled(): ClawiqWebPluginInstallResult {
  const targetDir = join(OPENCLAW_DIR, 'extensions', CLAWIQ_WEB_PLUGIN_ID);
  const sourceDir = resolveBundledClawiqWebPluginDir();

  if (!sourceDir) {
    return {
      installed: false,
      targetDir,
      error: 'Bundled clawiq-web plugin source not found',
    };
  }

  try {
    mkdirSync(join(OPENCLAW_DIR, 'extensions'), { recursive: true });
    rmSync(targetDir, { recursive: true, force: true });
    cpSync(sourceDir, targetDir, { recursive: true, force: true });
    return {
      installed: true,
      targetDir,
      sourceDir,
    };
  } catch (err) {
    return {
      installed: false,
      targetDir,
      sourceDir,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function resolveBundledClawiqWebPluginDir(): string | null {
  const candidates = [
    join(__dirname, '..', '..', 'extensions', CLAWIQ_WEB_PLUGIN_ID),
    join(process.cwd(), 'extensions', CLAWIQ_WEB_PLUGIN_ID),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'openclaw.plugin.json')) && existsSync(join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  return null;
}
