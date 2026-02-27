import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, saveConfig, ClawIQConfig } from '../config.js';
import { ClawIQClient } from '../api.js';
import { loadOpenClawConfig, saveOpenClawConfig, agentExists, OPENCLAW_DIR } from '../openclaw.js';
import { PERSONAS, getPersona, isValidPersona } from '../personas.js';
import { createWorkspace, discoverWorkspaces, ensureClawiqSkillSymlink, workspaceExists } from '../workspace.js';
import * as readline from 'readline';

const PRODUCTION_ENDPOINT = 'https://api.clawiq.md';

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

async function promptPersona(): Promise<string> {
  console.log(chalk.bold('\nChoose your monitoring persona:\n'));

  for (let i = 0; i < PERSONAS.length; i++) {
    const p = PERSONAS[i];
    console.log(`  ${chalk.bold(`${i + 1})`)} ${p.name} ${p.emoji}`);
    console.log(`     ${chalk.dim(p.tagline)}\n`);
  }

  while (true) {
    const answer = await prompt('Select persona (1-3): ');
    const num = parseInt(answer, 10);
    if (num >= 1 && num <= 3) {
      return PERSONAS[num - 1].id;
    }
    // Also accept persona id directly
    if (isValidPersona(answer)) {
      return answer;
    }
    console.log(chalk.yellow('  Please enter 1, 2, or 3'));
  }
}

async function postOnboarding(apiEndpoint: string, apiKey: string, personaId: string): Promise<boolean> {
  try {
    const url = `${apiEndpoint}/v1/onboarding`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ persona: personaId }),
    });

    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try {
        const json = JSON.parse(text);
        message = json.error || text;
      } catch { /* use raw text */ }
      throw new Error(`${response.status}: ${message}`);
    }

    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(chalk.yellow('  \u26a0 Could not persist persona server-side: ') + chalk.dim(msg));
    return false;
  }
}

export function createInitCommand(): Command {
  const cmd = new Command('init')
    .description('Set up ClawIQ with API key, monitoring persona, and agent workspace')
    .option('--api-key <key>', 'ClawIQ API key')
    .option('--persona <id>', 'Monitoring persona (grip, pinchy, clawfucius)')
    .option('--non-interactive', 'Skip prompts, use flags only')
    .action(async (options) => {
      const existingConfig = loadConfig();
      const config: ClawIQConfig = { ...existingConfig };

      try {
        console.log(chalk.bold('\n\u{1F980} ClawIQ Setup\n'));

        // ── [1] API Key ────────────────────────────────────────
        let apiKey: string | undefined;

        if (options.nonInteractive) {
          apiKey = options.apiKey || config.apiKey;
          if (!apiKey) {
            console.error(chalk.red('Error: --api-key required in non-interactive mode'));
            process.exit(1);
          }
        } else {
          const currentKey = config.apiKey ? `${config.apiKey.slice(0, 15)}...` : 'not set';
          console.log(chalk.dim(`Current API key: ${currentKey}`));
          const inputKey = options.apiKey || await prompt('API key (enter to keep current): ');
          apiKey = inputKey || config.apiKey;

          if (!apiKey) {
            console.error(chalk.red('\nAPI key is required. Create one at https://clawiq.dev/settings/api-keys'));
            process.exit(1);
          }
        }
        config.apiKey = apiKey;

        // Use production endpoint
        const apiEndpoint = PRODUCTION_ENDPOINT;
        config.endpoint = apiEndpoint;
        config.apiEndpoint = apiEndpoint;

        // Validate API key
        const spinner = ora('Validating API key...').start();
        const client = new ClawIQClient(apiEndpoint, apiKey);
        try {
          await client.getTags(undefined, 1);
          spinner.succeed('API key valid');
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes('401') || msg.includes('403')) {
            spinner.fail('Invalid API key');
            process.exit(1);
          } else if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
            spinner.warn('Could not reach API (continuing anyway)');
          } else {
            spinner.warn(`Connection test: ${msg}`);
          }
        }

        // ── [2] Persona Selection ──────────────────────────────
        let personaId: string;

        if (options.nonInteractive) {
          personaId = options.persona;
          if (!personaId || !isValidPersona(personaId)) {
            console.error(chalk.red('Error: --persona required in non-interactive mode (grip, pinchy, clawfucius)'));
            process.exit(1);
          }
        } else {
          personaId = await promptPersona();
        }

        const persona = getPersona(personaId)!;
        console.log(chalk.green('\u2713') + ` Selected: ${persona.name} ${persona.emoji}`);

        // Check if workspace already exists
        if (workspaceExists(personaId)) {
          if (!options.nonInteractive) {
            const overwrite = await prompt(
              chalk.yellow(`\nWorkspace for ${persona.name} already exists. Overwrite? (y/N): `)
            );
            if (overwrite.toLowerCase() !== 'y') {
              console.log(chalk.dim('Keeping existing workspace'));
              // Still save config and continue
              saveConfig(config);
              console.log(chalk.green('\u2713') + ' Configuration saved to ~/.clawiq/config.json');
              return;
            }
          }
        }

        // ── [3] POST /v1/onboarding ────────────────────────────
        const onboardSpinner = ora('Persisting persona...').start();
        const persisted = await postOnboarding(apiEndpoint, apiKey, personaId);
        if (persisted) {
          onboardSpinner.succeed('Persona saved to account');
        } else {
          onboardSpinner.warn('Persona saved locally only');
        }

        // ── [4] Configure OTEL in openclaw.json ────────────────
        const openclawConfig = loadOpenClawConfig();

        if (!openclawConfig.diagnostics) {
          openclawConfig.diagnostics = {};
        }
        if (!openclawConfig.diagnostics.otel) {
          openclawConfig.diagnostics.otel = {};
        }

        openclawConfig.diagnostics.enabled = true;
        openclawConfig.diagnostics.otel.enabled = true;
        openclawConfig.diagnostics.otel.endpoint = apiEndpoint;
        if (!openclawConfig.diagnostics.otel.headers) {
          openclawConfig.diagnostics.otel.headers = {};
        }
        openclawConfig.diagnostics.otel.headers.Authorization = `Bearer ${apiKey}`;
        openclawConfig.diagnostics.otel.traces = true;
        openclawConfig.diagnostics.otel.metrics = true;
        openclawConfig.diagnostics.otel.logs = true;

        // ── [5] Discover workspaces, ensure clawiq skill linked ─
        const workspaces = discoverWorkspaces();
        let linkedCount = 0;
        for (const ws of workspaces) {
          if (ensureClawiqSkillSymlink(ws)) {
            linkedCount++;
          }
        }
        if (linkedCount > 0) {
          console.log(chalk.green('\u2713') + ` ClawIQ skill linked in ${linkedCount} workspace(s)`);
        }

        // ── [6] Create agent workspace ─────────────────────────
        const wsSpinner = ora(`Creating ${persona.name}'s workspace...`).start();
        const workspacePath = createWorkspace(persona);
        wsSpinner.succeed(`Workspace created: ~/.openclaw/workspace-${personaId}/`);

        // ── [7] Register agent in openclaw.json ────────────────
        if (!openclawConfig.agents) {
          openclawConfig.agents = {};
        }
        if (!openclawConfig.agents.list) {
          openclawConfig.agents.list = [];
        }

        if (!agentExists(openclawConfig, personaId)) {
          openclawConfig.agents.list.push({
            id: personaId,
            workspace: workspacePath,
          });
          console.log(chalk.green('\u2713') + ` Agent "${personaId}" registered in openclaw.json`);
        } else {
          // Update workspace path in case it changed
          const existing = openclawConfig.agents.list.find((a) => a.id === personaId);
          if (existing) {
            existing.workspace = workspacePath;
          }
          console.log(chalk.dim(`  Agent "${personaId}" already in openclaw.json (updated workspace path)`));
        }

        saveOpenClawConfig(openclawConfig);
        console.log(chalk.green('\u2713') + ' OpenClaw config updated');

        // ── [8] Save ClawIQ config ─────────────────────────────
        config.defaultAgent = personaId;
        saveConfig(config);
        console.log(chalk.green('\u2713') + ' Configuration saved to ~/.clawiq/config.json');

        // ── Done ───────────────────────────────────────────────
        console.log(chalk.bold.green('\n\u2705 Setup complete!\n'));
        console.log(chalk.dim('Your monitoring agent is ready. Here\'s what was set up:'));
        console.log(`  ${chalk.dim('Persona:')}    ${persona.name} ${persona.emoji}`);
        console.log(`  ${chalk.dim('Workspace:')}  ~/.openclaw/workspace-${personaId}/`);
        console.log(`  ${chalk.dim('API Key:')}    ${apiKey.slice(0, 15)}...`);
        console.log(`  ${chalk.dim('Endpoint:')}   ${apiEndpoint}`);
        console.log('');
        console.log(chalk.dim('Try it out:'));
        console.log(`  ${chalk.cyan('clawiq emit task hello-world --agent ' + personaId)}`);
        console.log(`  ${chalk.cyan('clawiq pull all --since 1h')}`);
        console.log('');
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return cmd;
}
