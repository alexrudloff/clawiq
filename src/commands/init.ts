import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execFile } from 'child_process';
import { loadConfig, saveConfig, ClawIQConfig, API_ENDPOINT } from '../config.js';
import { ClawIQClient } from '../api.js';
import { handleError } from '../format.js';
import { loadOpenClawConfig, saveOpenClawConfig, backupOpenClawConfig, agentExists } from '../openclaw.js';
import { CLAWIQ_AGENT } from '../personas.js';
import { createWorkspace, discoverWorkspaces, workspaceExists, appendClawiqTools, installClawiqSkill } from '../workspace.js';
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
    .description('Set up ClawIQ agent, OTEL diagnostics, and agent workspaces')
    .option('--api-key <key>', 'ClawIQ API key')
    .option('--non-interactive', 'Skip prompts, use flags only')
    .action(async (options) => {
      const existingConfig = loadConfig();
      const config: ClawIQConfig = { ...existingConfig };

      try {
        console.log(chalk.bold('\n\u{1F99E} ClawIQ Setup\n'));

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

        // Validate API key
        const spinner = ora('Validating API key...').start();
        const client = new ClawIQClient(API_ENDPOINT, apiKey);
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

        // ── [2] Backup openclaw.json ─────────────────────────────
        if (backupOpenClawConfig()) {
          console.log(chalk.green('\u2713') + ' Backed up openclaw.json \u2192 openclaw.pre-clawiq.json');
        }

        // ── [3] Configure OTEL in openclaw.json ──────────────────
        const openclawConfig = loadOpenClawConfig();

        if (!openclawConfig.diagnostics) {
          openclawConfig.diagnostics = {};
        }
        if (!openclawConfig.diagnostics.otel) {
          openclawConfig.diagnostics.otel = {};
        }

        openclawConfig.diagnostics.enabled = true;
        openclawConfig.diagnostics.otel.enabled = true;
        openclawConfig.diagnostics.otel.endpoint = API_ENDPOINT;
        if (!openclawConfig.diagnostics.otel.headers) {
          openclawConfig.diagnostics.otel.headers = {};
        }
        openclawConfig.diagnostics.otel.headers.Authorization = `Bearer ${apiKey}`;
        openclawConfig.diagnostics.otel.traces = true;
        openclawConfig.diagnostics.otel.metrics = true;
        openclawConfig.diagnostics.otel.logs = true;

        // ── [3b] Enable diagnostics-otel plugin ──────────────────
        if (!openclawConfig.plugins) {
          openclawConfig.plugins = {};
        }
        if (!openclawConfig.plugins.entries) {
          openclawConfig.plugins.entries = {};
        }
        if (!openclawConfig.plugins.entries['diagnostics-otel']?.enabled) {
          openclawConfig.plugins.entries['diagnostics-otel'] = { enabled: true };
          console.log(chalk.green('\u2713') + ' diagnostics-otel plugin enabled');
        }

        console.log(chalk.green('\u2713') + ' OTEL diagnostics configured');

        // ── [4] Create ClawIQ agent workspace ────────────────────
        const agentId = CLAWIQ_AGENT.id;

        if (workspaceExists(agentId)) {
          if (!options.nonInteractive) {
            const overwrite = await prompt(
              chalk.yellow(`\nWorkspace for ${CLAWIQ_AGENT.name} already exists. Overwrite? (y/N): `)
            );
            if (overwrite.toLowerCase() !== 'y') {
              console.log(chalk.dim('Keeping existing workspace'));
            } else {
              const wsSpinner = ora(`Creating ${CLAWIQ_AGENT.name} workspace...`).start();
              createWorkspace(CLAWIQ_AGENT);
              wsSpinner.succeed(`Workspace created: ~/.openclaw/workspace-${agentId}/`);
            }
          }
        } else {
          const wsSpinner = ora(`Creating ${CLAWIQ_AGENT.name} workspace...`).start();
          createWorkspace(CLAWIQ_AGENT);
          wsSpinner.succeed(`Workspace created: ~/.openclaw/workspace-${agentId}/`);
        }

        // ── [5] Register agent in openclaw.json ──────────────────
        if (!openclawConfig.agents) {
          openclawConfig.agents = {};
        }
        if (!openclawConfig.agents.list) {
          openclawConfig.agents.list = [];
        }

        const workspacePath = `~/.openclaw/workspace-${agentId}`;
        if (!agentExists(openclawConfig, agentId)) {
          openclawConfig.agents.list.push({
            id: agentId,
            workspace: workspacePath,
          });
          console.log(chalk.green('\u2713') + ` Creating Larry the Lobster and registering in openclaw.json`);
        } else {
          const existing = openclawConfig.agents.list.find((a) => a.id === agentId);
          if (existing) {
            existing.workspace = workspacePath;
          }
          console.log(chalk.dim(`  Larry the Lobster already in openclaw.json (updated)`));
        }

        saveOpenClawConfig(openclawConfig);
        console.log(chalk.green('\u2713') + ' OpenClaw config saved');

        // ── [6] Update TOOLS.md in all existing workspaces ───────
        const workspaces = discoverWorkspaces();
        let updatedCount = 0;
        for (const ws of workspaces) {
          if (appendClawiqTools(ws)) {
            updatedCount++;
          }
        }
        if (updatedCount > 0) {
          console.log(chalk.green('\u2713') + ` ClawIQ added to TOOLS.md in ${updatedCount} workspace(s)`);
        }

        // ── [6b] Install shared clawiq skill ─────────────────────
        if (installClawiqSkill()) {
          console.log(chalk.green('\u2713') + ' ClawIQ skill installed at workspace/skills/clawiq/');
        }

        // ── [7] Save ClawIQ config ───────────────────────────────
        config.defaultAgent = agentId;
        saveConfig(config);
        console.log(chalk.green('\u2713') + ' Configuration saved to ~/.clawiq/config.json');

        // ── [8] Restart openclaw gateway ─────────────────────────
        const gwSpinner = ora('Restarting OpenClaw gateway...').start();
        try {
          await new Promise<void>((resolve, reject) => {
            const child = execFile('openclaw', ['gateway', 'restart'], (error) => {
              if (error) reject(error);
              else resolve();
            });
            // gateway restart can be slow — give it 60s
            setTimeout(() => {
              child.kill();
              resolve();
            }, 60_000);
          });
          gwSpinner.succeed('OpenClaw gateway restarted');
        } catch {
          gwSpinner.warn('Could not restart gateway (restart manually with: openclaw gateway restart)');
        }

        // Wait for gateway to be ready after restart
        const readySpinner = ora('Waiting for gateway (this can take up to a minute — be patient)...').start();
        let gatewayReady = false;
        for (let i = 0; i < 30; i++) {
          try {
            await new Promise<void>((resolve, reject) => {
              execFile('openclaw', ['gateway', 'status'], (error) => {
                if (error) reject(error);
                else resolve();
              });
            });
            gatewayReady = true;
            break;
          } catch {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        if (gatewayReady) {
          readySpinner.succeed('Gateway is ready');
        } else {
          readySpinner.warn('Gateway may not be ready — cron setup might fail');
        }

        // ── [9] Create nightly performance review cron job ──────
        const cronSpinner = ora('Creating nightly performance review cron...').start();
        try {
          await new Promise<void>((resolve, reject) => {
            const cronPayload = JSON.stringify({
              name: 'Larry Nightly Performance Review',
              schedule: {
                kind: 'cron',
                expr: '0 3 * * *',
                tz: 'America/New_York'
              },
              sessionTarget: 'isolated',
              payload: {
                kind: 'agentTurn',
                message: 'Run your nightly performance review. Follow the workflow in HEARTBEAT.md — pull OTEL data first, identify interesting sessions, read only those, cross-reference, and submit findings via clawiq report finding. Write a summary to memory/today\'s date.md.',
                timeoutSeconds: 600
              },
              delivery: {
                mode: 'none'
              },
              enabled: true
            });

            execFile('openclaw', ['cron', 'add', '--agent', agentId, '--json', cronPayload], (error, stdout) => {
              if (error) reject(error);
              else resolve();
            });
          });
          cronSpinner.succeed('Nightly review scheduled (3:00 AM daily)');
        } catch {
          // Fallback: try via the gateway API directly
          try {
            await new Promise<void>((resolve, reject) => {
              const addCmd = `curl -s -X POST http://localhost:3456/api/cron/jobs -H "Content-Type: application/json" -d '${JSON.stringify({
                agentId,
                name: 'Larry Nightly Performance Review',
                schedule: { kind: 'cron', expr: '0 3 * * *', tz: 'America/New_York' },
                sessionTarget: 'isolated',
                payload: {
                  kind: 'agentTurn',
                  message: "Run your nightly performance review. Follow the workflow in HEARTBEAT.md — pull OTEL data first, identify interesting sessions, read only those, cross-reference, and submit findings via clawiq report finding. Write a summary to memory/ for today's date.",
                  timeoutSeconds: 600
                },
                delivery: { mode: 'none' },
                enabled: true
              })}'`;
              execFile('sh', ['-c', addCmd], (error) => {
                if (error) reject(error);
                else resolve();
              });
            });
            cronSpinner.succeed('Nightly review scheduled (3:00 AM daily)');
          } catch {
            cronSpinner.warn('Could not create cron job. Set up manually: openclaw cron add');
          }
        }

        // ── [10] Send setup-complete marker ───────────────────────
        try {
          await client.emit([{
            type: 'health',
            name: 'setup-complete',
            source: 'agent',
            severity: 'info',
            agent_id: agentId,
          }]);
          console.log(chalk.green('\u2713') + ' Setup marker sent');
        } catch {
          console.log(chalk.dim('  Could not send setup marker (API may be unreachable)'));
        }

        // ── Done ─────────────────────────────────────────────────
        console.log(chalk.bold.green('\n\u2705 Setup complete!\n'));
        console.log(chalk.dim('What was set up:'));
        console.log(`  ${chalk.dim('Agent:')}      ${CLAWIQ_AGENT.name} ${CLAWIQ_AGENT.emoji}`);
        console.log(`  ${chalk.dim('Workspace:')}  ~/.openclaw/workspace-${agentId}/`);
        console.log(`  ${chalk.dim('OTEL:')}       ${API_ENDPOINT}`);
        console.log(`  ${chalk.dim('API Key:')}    ${apiKey.slice(0, 15)}...`);
        console.log('');
        console.log(chalk.dim('Try it out:'));
        console.log(`  ${chalk.cyan('clawiq emit task hello-world --agent ' + agentId)}`);
        console.log(`  ${chalk.cyan('clawiq pull all --since 1h')}`);
        console.log('');
      } catch (error) {
        handleError(error);
      }
    });

  return cmd;
}
