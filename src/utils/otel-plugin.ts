import { existsSync } from 'fs';
import { join } from 'path';
import { execFile } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

const OTEL_PLUGIN_DIR = '/opt/homebrew/lib/node_modules/openclaw/extensions/diagnostics-otel';

/**
 * Checks if the diagnostics-otel plugin exists and has its npm dependencies installed.
 * If deps are missing, runs npm install automatically. Non-blocking on failure.
 */
export async function ensureOtelPluginDeps(): Promise<void> {
  if (!existsSync(OTEL_PLUGIN_DIR)) {
    return; // Plugin not installed, skip silently
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
