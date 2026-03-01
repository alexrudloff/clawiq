import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { join, dirname } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { execFile } from 'child_process';
import { OPENCLAW_DIR } from '../openclaw.js';
import {
  CLAWIQ_AGENT,
  generateIdentity,
  generateSoul,
  generateAgents,
  generateHeartbeat,
  generateTools,
  generateBootstrap,
} from '../personas.js';

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
      console.log(chalk.bold(`\n🦞 ${CLAWIQ_AGENT.name} updated. Claws sharpened.\n`));
    });

  return cmd;
}
