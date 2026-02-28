import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, rmSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { loadConfig, API_ENDPOINT } from '../config.js';
import {
  loadOpenClawConfig,
  saveOpenClawConfig,
  hasPreClawiqBackup,
  restorePreClawiqBackup,
} from '../openclaw.js';
import { CLAWIQ_AGENT } from '../personas.js';
import { discoverWorkspaces, removeClawiqTools, removeClawiqSkill } from '../workspace.js';
import { handleError } from '../format.js';
import * as readline from 'readline';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function isYes(answer: string): boolean {
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

export function createUninstallCommand(): Command {
  const cmd = new Command('uninstall')
    .description('Remove ClawIQ configuration and workspace setup')
    .option('--non-interactive', 'Skip prompts, use defaults')
    .option('--keep-config', 'Keep ~/.clawiq/config.json')
    .option('--keep-workspace', 'Keep ClawIQ agent workspace')
    .option('--keep-openclaw', 'Do not modify openclaw.json')
    .option('--skip-backup-restore', 'Do not restore openclaw.pre-clawiq.json if present')
    .action(async (options) => {
      try {
        const config = loadConfig();
        const clawiqConfigDir = join(homedir(), '.clawiq');
        const clawiqWorkspace = join(homedir(), `.openclaw/workspace-${CLAWIQ_AGENT.id}`);

        let keepConfig = options.keepConfig ?? false;
        let keepWorkspace = options.keepWorkspace ?? false;
        let keepOpenClaw = options.keepOpenclaw ?? false;
        let restoreBackup = false;

        if (!options.nonInteractive) {
          console.log(chalk.bold('\n🧹 ClawIQ Uninstall\n'));
          const confirm = await prompt('Remove ClawIQ setup from this machine? (y/N): ');
          if (!isYes(confirm)) {
            console.log(chalk.dim('Uninstall cancelled.'));
            return;
          }

          if (hasPreClawiqBackup() && !options.skipBackupRestore) {
            const restore = await prompt('Restore openclaw.pre-clawiq.json backup? (y/N): ');
            restoreBackup = isYes(restore);
          } else {
            const modify = await prompt('Remove ClawIQ changes from openclaw.json? (y/N): ');
            keepOpenClaw = !isYes(modify);
          }

          const deleteWorkspace = await prompt(`Delete ClawIQ workspace (${clawiqWorkspace})? (y/N): `);
          keepWorkspace = !isYes(deleteWorkspace);

          const deleteConfig = await prompt(`Delete ClawIQ config (${clawiqConfigDir})? (y/N): `);
          keepConfig = !isYes(deleteConfig);
        } else {
          restoreBackup = hasPreClawiqBackup() && !options.skipBackupRestore;
        }

        // ── [1] Restore or update openclaw.json ───────────────
        if (!keepOpenClaw) {
          if (restoreBackup) {
            const restoreSpinner = ora('Restoring openclaw.pre-clawiq.json...').start();
            if (restorePreClawiqBackup()) {
              restoreSpinner.succeed('openclaw.json restored from backup');
            } else {
              restoreSpinner.warn('Backup not found; skipping restore');
            }
          } else {
            const openclawSpinner = ora('Removing ClawIQ settings from openclaw.json...').start();
            const openclawConfig = loadOpenClawConfig();

            if (openclawConfig.diagnostics?.otel?.endpoint === API_ENDPOINT) {
              if (openclawConfig.diagnostics?.otel?.headers?.Authorization?.startsWith('Bearer ')) {
                delete openclawConfig.diagnostics.otel.headers.Authorization;
              }
              delete openclawConfig.diagnostics.otel.endpoint;
              delete openclawConfig.diagnostics.otel.traces;
              delete openclawConfig.diagnostics.otel.metrics;
              delete openclawConfig.diagnostics.otel.logs;
              delete openclawConfig.diagnostics.otel.enabled;
            }

            if (openclawConfig.plugins?.entries?.['diagnostics-otel']?.enabled) {
              if (openclawConfig.diagnostics?.otel?.endpoint === undefined) {
                openclawConfig.plugins.entries['diagnostics-otel'].enabled = false;
              }
            }

            if (openclawConfig.agents?.list) {
              openclawConfig.agents.list = openclawConfig.agents.list.filter(
                (agent) => agent.id !== CLAWIQ_AGENT.id,
              );
            }

            saveOpenClawConfig(openclawConfig);
            openclawSpinner.succeed('openclaw.json updated');
          }
        }

        // ── [2] Remove TOOLS.md references ─────────────────────
        const workspaces = discoverWorkspaces();
        let updated = 0;
        for (const ws of workspaces) {
          if (removeClawiqTools(ws)) {
            updated++;
          }
        }
        if (updated > 0) {
          console.log(chalk.green('✓') + ` Removed ClawIQ from TOOLS.md in ${updated} workspace(s)`);
        }

        // ── [3] Remove shared skill ────────────────────────────
        if (removeClawiqSkill()) {
          console.log(chalk.green('✓') + ' Removed shared clawiq skill');
        }

        // ── [4] Remove ClawIQ workspace ────────────────────────
        if (!keepWorkspace) {
          if (existsSync(clawiqWorkspace)) {
            rmSync(clawiqWorkspace, { recursive: true, force: true });
            console.log(chalk.green('✓') + ` Removed workspace ${clawiqWorkspace}`);
          }
        }

        // ── [5] Remove local CLI config ────────────────────────
        if (!keepConfig) {
          if (existsSync(clawiqConfigDir)) {
            rmSync(clawiqConfigDir, { recursive: true, force: true });
            console.log(chalk.green('✓') + ` Removed ${clawiqConfigDir}`);
          }
        }

        console.log(chalk.bold.green('\n✅ Uninstall complete.\n'));
        if (config.apiKey) {
          console.log(chalk.dim('Note: API key still exists server-side. Revoke it from ClawIQ if needed.'));
        }
      } catch (error) {
        handleError(error);
      }
    });

  return cmd;
}
