import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execFile, execFileSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Resolve the diagnostics-otel plugin directory dynamically.
 * Derives path from `which openclaw` so it works regardless of install method
 * (homebrew, npm global, nvm, volta, custom prefix, etc.)
 */
function getOtelPluginDir(): string | null {
  try {
    const openclaw = execFileSync('which', ['openclaw'], { encoding: 'utf8' }).trim();
    // openclaw binary is at <prefix>/bin/openclaw
    // extensions are at <prefix>/lib/node_modules/openclaw/extensions/
    const prefix = resolve(dirname(openclaw), '..');
    return join(prefix, 'lib', 'node_modules', 'openclaw', 'extensions', 'diagnostics-otel');
  } catch {
    return null;
  }
}

/**
 * Checks if the diagnostics-otel plugin exists and has its npm dependencies installed.
 * If deps are missing, runs npm install automatically. Non-blocking on failure.
 */
export async function ensureOtelPluginDeps(): Promise<void> {
  const OTEL_PLUGIN_DIR = getOtelPluginDir();
  if (!OTEL_PLUGIN_DIR || !existsSync(OTEL_PLUGIN_DIR)) {
    return; // Plugin not installed or openclaw not found, skip silently
  }

  const markerPath = join(OTEL_PLUGIN_DIR, 'node_modules', '@opentelemetry', 'api');
  if (existsSync(markerPath)) {
    return; // Dependencies already present
  }

  const spinner = ora('Installing diagnostics-otel dependencies...').start();
  try {
    await new Promise<void>((resolve, reject) => {
      execFile('npm', ['install'], { cwd: OTEL_PLUGIN_DIR }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    spinner.succeed(chalk.green('OTEL plugin dependencies installed'));
  } catch (err) {
    spinner.warn(`Could not install diagnostics-otel deps: ${(err as Error).message}`);
  }
}
