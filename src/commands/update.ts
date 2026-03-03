import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { execFile } from 'child_process';
import { API_ENDPOINT, loadConfig } from '../config.js';
import { loadOpenClawConfig, OPENCLAW_DIR, saveOpenClawConfig } from '../openclaw.js';
import {
  CLAWIQ_AGENT,
  generateIdentity,
  generateSoul,
  generateAgents,
  generateHeartbeat,
  generateTools,
} from '../personas.js';
import { configureClawiqWebChannel } from '../openclaw_service.js';
import { ensureClawiqWebPluginInstalled } from '../utils/clawiq-web-plugin.js';
import { ensureOtelPluginDeps } from '../utils/otel-plugin.js';
import { syncOpenClawDocs } from '../utils/openclaw-docs-sync.js';

// __dirname works in CommonJS

function run(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, encoding: 'utf-8' }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(stdout.trim());
    });
  });
}

export function createUpdateCommand(): Command {
  const cmd = new Command('update')
    .description('Update ClawIQ CLI and Lenny to the latest version')
    .option('--skip-pull', 'Skip git pull (only update agent persona)')
    .action(async (options) => {
      const agentId = CLAWIQ_AGENT.id;
      const workspaceDir = join(OPENCLAW_DIR, `workspace-${agentId}`);
      // CLI repo root is two levels up from dist/commands/
      const repoDir = join(__dirname, '..', '..');

      if (!existsSync(workspaceDir)) {
        console.error(chalk.red(`No ClawIQ workspace found at ${workspaceDir}. Run 'clawiq init' first.`));
        process.exit(1);
      }

      console.log(chalk.bold(`\n🦞 Updating ${CLAWIQ_AGENT.name}...\n`));

      // Step 1: git pull + npm install + npm link
      if (!options.skipPull) {
        const pullSpinner = ora('Pulling latest from GitHub...').start();
        try {
          const gitDir = existsSync(join(repoDir, '.git')) ? repoDir : join(repoDir, '..');
          await run('git', ['pull'], gitDir);
          pullSpinner.succeed('Pulled latest code');

          const installSpinner = ora('Installing dependencies...').start();
          await run('npm', ['install'], gitDir);
          installSpinner.succeed('Dependencies installed');

          const buildSpinner = ora('Building...').start();
          await run('npm', ['run', 'build'], gitDir);
          buildSpinner.succeed('Built');

          const linkSpinner = ora('Linking CLI...').start();
          await run('npm', ['link', '--force'], gitDir);
          linkSpinner.succeed('CLI linked');
        } catch (err) {
          pullSpinner.fail(`Git update failed: ${(err as Error).message}`);
          console.log(chalk.dim('Continuing with current version...'));
        }
      }

      // Step 2: Update persona files (NOT memory, NOT user config)
      const updates: Array<{ file: string; generator: () => string }> = [
        { file: 'IDENTITY.md', generator: () => generateIdentity(CLAWIQ_AGENT) },
        { file: 'SOUL.md', generator: () => generateSoul(CLAWIQ_AGENT) },
        { file: 'AGENTS.md', generator: () => generateAgents(CLAWIQ_AGENT) },
        { file: 'HEARTBEAT.md', generator: () => generateHeartbeat(CLAWIQ_AGENT) },
        { file: 'TOOLS.md', generator: () => generateTools(CLAWIQ_AGENT) },
      ];

      const preserved = ['MEMORY.md', 'USER.md', 'memory/'];

      for (const { file, generator } of updates) {
        const spinner = ora(`Updating ${file}...`).start();
        try {
          writeFileSync(join(workspaceDir, file), generator());
          spinner.succeed(`Updated ${file}`);
        } catch (err) {
          spinner.fail(`Failed to update ${file}: ${(err as Error).message}`);
        }
      }

      console.log(chalk.dim(`\nPreserved: ${preserved.join(', ')}`));

      // Step 2b: Refresh OpenClaw docs mirror in Lenny memory
      const docsSpinner = ora('Refreshing OpenClaw docs mirror in memory/...').start();
      try {
        const docs = await syncOpenClawDocs(join(workspaceDir, 'memory'));
        if (docs.failed === 0) {
          docsSpinner.succeed(`OpenClaw docs refreshed (${docs.downloaded} files)`);
        } else {
          docsSpinner.warn(`OpenClaw docs partially refreshed (${docs.downloaded}/${docs.totalReferenced}, ${docs.failed} failed)`);
        }
      } catch (err) {
        docsSpinner.warn(`Could not refresh OpenClaw docs: ${(err as Error).message}`);
      }

      // Ensure diagnostics-otel plugin deps are installed
      await ensureOtelPluginDeps();

      // Ensure clawiq-web plugin is installed and configured
      const pluginInstall = ensureClawiqWebPluginInstalled();
      if (pluginInstall.installed) {
        console.log(chalk.green('\u2713') + ` clawiq-web plugin installed at ${pluginInstall.targetDir}`);
      } else {
        console.log(chalk.yellow('!') + ` clawiq-web plugin install skipped: ${pluginInstall.error}`);
      }

      const clawiqConfig = loadConfig();
      if (clawiqConfig.apiKey) {
        const openclawConfig = loadOpenClawConfig();
        if (configureClawiqWebChannel(openclawConfig, API_ENDPOINT, clawiqConfig.apiKey, agentId)) {
          saveOpenClawConfig(openclawConfig);
          console.log(chalk.green('\u2713') + ' clawiq-web channel configuration refreshed');
        }
      } else {
        console.log(chalk.yellow('!') + ' No ClawIQ API key found; skipping clawiq-web channel config refresh');
      }

      const restartSpinner = ora('Restarting OpenClaw gateway...').start();
      try {
        await run('openclaw', ['gateway', 'restart'], process.cwd());
        restartSpinner.succeed('OpenClaw gateway restarted');
      } catch (err) {
        restartSpinner.warn(`Could not restart gateway automatically: ${(err as Error).message}`);
      }

      console.log(chalk.bold(`\n🦞 ${CLAWIQ_AGENT.name} updated. Claws sharpened.\n`));
    });

  return cmd;
}
