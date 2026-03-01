import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';
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

export function createUpdateCommand(): Command {
  const cmd = new Command('update')
    .description('Update Lenny to the latest version (preserves memory and user config)')
    .action(async () => {
      const agentId = CLAWIQ_AGENT.id;
      const workspaceDir = join(OPENCLAW_DIR, `workspace-${agentId}`);

      if (!existsSync(workspaceDir)) {
        console.error(chalk.red(`No ClawIQ workspace found at ${workspaceDir}. Run 'clawiq init' first.`));
        process.exit(1);
      }

      console.log(chalk.bold(`\n🦞 Updating ${CLAWIQ_AGENT.name}...\n`));

      // Update persona files (NOT memory, NOT user config)
      const updates: Array<{ file: string; generator: () => string }> = [
        { file: 'IDENTITY.md', generator: () => generateIdentity(CLAWIQ_AGENT) },
        { file: 'SOUL.md', generator: () => generateSoul(CLAWIQ_AGENT) },
        { file: 'AGENTS.md', generator: () => generateAgents(CLAWIQ_AGENT) },
        { file: 'HEARTBEAT.md', generator: () => generateHeartbeat(CLAWIQ_AGENT) },
        { file: 'TOOLS.md', generator: () => generateTools(CLAWIQ_AGENT) },
      ];

      // Files we never touch
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
