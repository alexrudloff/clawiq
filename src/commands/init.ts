import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig, ClawIQConfig } from '../config.js';
import { ClawIQClient } from '../api.js';
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

export function createInitCommand(): Command {
  const cmd = new Command('init')
    .description('Initialize ClawIQ configuration')
    .option('--api-key <key>', 'ClawIQ API key')
    .option('--endpoint <url>', 'ClawIQ endpoint')
    .option('--agent <id>', 'Default agent ID')
    .option('--non-interactive', 'Skip prompts, use flags only')
    .action(async (options) => {
      const existingConfig = loadConfig();
      const config: ClawIQConfig = { ...existingConfig };

      try {
        if (options.nonInteractive) {
          // Non-interactive mode: use flags only
          if (options.apiKey) config.apiKey = options.apiKey;
          if (options.endpoint) config.endpoint = options.endpoint;
          if (options.agent) config.defaultAgent = options.agent;
        } else {
          // Interactive mode
          console.log(chalk.bold('\nClawIQ Configuration\n'));

          // API Key
          const currentKey = config.apiKey ? `${config.apiKey.slice(0, 12)}...` : 'not set';
          console.log(chalk.dim(`Current API key: ${currentKey}`));
          const apiKey = options.apiKey || await prompt('API key (enter to keep current): ');
          if (apiKey) config.apiKey = apiKey;

          // Endpoint
          const currentEndpoint = config.endpoint || 'http://localhost:4318';
          console.log(chalk.dim(`Current endpoint: ${currentEndpoint}`));
          const endpoint = options.endpoint || await prompt(`Endpoint (enter for ${currentEndpoint}): `);
          if (endpoint) config.endpoint = endpoint;

          // Default agent
          const currentAgent = config.defaultAgent || 'not set';
          console.log(chalk.dim(`Current default agent: ${currentAgent}`));
          const agent = options.agent || await prompt('Default agent ID (enter to keep current): ');
          if (agent) config.defaultAgent = agent;
        }

        // Validate configuration using API endpoint
        const apiEndpoint = config.apiEndpoint || 'http://localhost:8080';
        if (config.apiKey) {
          console.log(chalk.dim('\nValidating configuration...'));
          const client = new ClawIQClient(apiEndpoint, config.apiKey);
          try {
            await client.getTags(undefined, 1);
            console.log(chalk.green('✓') + ' Connection successful');
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('401') || msg.includes('403')) {
              console.log(chalk.yellow('⚠') + ' Invalid API key');
            } else if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
              console.log(chalk.yellow('⚠') + ' Could not connect to API endpoint');
            } else {
              console.log(chalk.yellow('⚠') + ` Connection test failed: ${msg}`);
            }
          }
        }

        // Save configuration
        saveConfig(config);
        console.log(chalk.green('✓') + ' Configuration saved to ~/.clawiq/config.json');

        // Show summary
        console.log(chalk.bold('\nConfiguration:'));
        console.log(`  ${chalk.dim('API Key:')} ${config.apiKey ? `${config.apiKey.slice(0, 12)}...` : chalk.red('not set')}`);
        console.log(`  ${chalk.dim('Endpoint:')} ${config.endpoint || 'http://localhost:4318'}`);
        console.log(`  ${chalk.dim('Default Agent:')} ${config.defaultAgent || chalk.dim('not set')}`);
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return cmd;
}
