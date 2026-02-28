import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execFile } from 'child_process';
import { loadConfig, saveConfig, ClawIQConfig, API_ENDPOINT, CLI_VERSION } from '../config.js';
import { ClawIQClient } from '../api.js';
import { handleError } from '../format.js';
import { loadOpenClawConfig, saveOpenClawConfig, backupOpenClawConfig } from '../openclaw.js';
import { CLAWIQ_AGENT } from '../personas.js';
import { createWorkspace, discoverWorkspaces, workspaceExists, appendClawiqTools, installClawiqSkill } from '../workspace.js';
import { prompt, confirm } from '../cli.js';
import { configureOtelDiagnostics, ensureDiagnosticsPlugin, upsertAgent } from '../openclaw_service.js';

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
            console.error(chalk.red('\nAPI key is required. Create one at https://clawiq.md/settings/api-keys'));
            process.exit(1);
          }
        }
        config.apiKey = apiKey;

        // Validate API key
        const spinner = ora('Validating API key...').start();
        const client = new ClawIQClient(API_ENDPOINT, apiKey, CLI_VERSION);
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

        configureOtelDiagnostics(openclawConfig, apiKey, API_ENDPOINT);

        // ── [3b] Enable diagnostics-otel plugin ──────────────────
        if (ensureDiagnosticsPlugin(openclawConfig)) {
          console.log(chalk.green('\u2713') + ' diagnostics-otel plugin enabled');
        }

        console.log(chalk.green('\u2713') + ' OTEL diagnostics configured');

        // ── [3c] Check and install OTEL dependencies ─────────────
        const otelSpinner = ora('Checking OTEL dependencies...').start();
        try {
          // Find OpenClaw install directory
          const openclawBin = await new Promise<string>((resolve, reject) => {
            execFile('which', ['openclaw'], (error, stdout) => {
              if (error) reject(error);
              else resolve(stdout.trim());
            });
          });
          // Resolve symlink to get the actual package dir
          const realPath = await new Promise<string>((resolve, reject) => {
            execFile('readlink', ['-f', openclawBin], (error, stdout) => {
              if (error) {
                // macOS readlink doesn't support -f, try realpath
                execFile('realpath', [openclawBin], (error2, stdout2) => {
                  if (error2) reject(error2);
                  else resolve(stdout2.trim());
                });
              } else resolve(stdout.trim());
            });
          });
          // Go up to the package root (from openclaw.mjs or bin/)
          const path = await import('path');
          let openclawDir = path.dirname(realPath);
          // If we landed in a bin/ dir, go up one more
          if (openclawDir.endsWith('/bin')) openclawDir = path.dirname(openclawDir);
          
          // Check if @opentelemetry/api exists in the package
          const otelApiPath = path.join(openclawDir, 'node_modules', '@opentelemetry', 'api');
          const fs = await import('fs');
          if (!fs.existsSync(otelApiPath)) {
            otelSpinner.text = 'Installing OTEL dependencies (this may take a moment)...';
            const otelDeps = [
              '@opentelemetry/api',
              '@opentelemetry/exporter-logs-otlp-http',
              '@opentelemetry/exporter-trace-otlp-http', 
              '@opentelemetry/exporter-metrics-otlp-http',
              '@opentelemetry/sdk-node',
              '@opentelemetry/sdk-trace-node',
              '@opentelemetry/sdk-logs',
              '@opentelemetry/sdk-metrics',
              '@opentelemetry/resources',
              '@opentelemetry/semantic-conventions',
            ];
            await new Promise<void>((resolve, reject) => {
              execFile('npm', ['install', '--no-save', ...otelDeps], { cwd: openclawDir }, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve();
              });
            });
            otelSpinner.succeed('OTEL dependencies installed');
          } else {
            otelSpinner.succeed('OTEL dependencies already installed');
          }
        } catch (err) {
          otelSpinner.warn('Could not verify OTEL dependencies. If traces are missing, run: npm install @opentelemetry/api @opentelemetry/exporter-logs-otlp-http @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http @opentelemetry/sdk-node @opentelemetry/sdk-trace-node @opentelemetry/sdk-logs @opentelemetry/sdk-metrics @opentelemetry/resources @opentelemetry/semantic-conventions in your OpenClaw install directory');
        }

        // ── [4] Create ClawIQ agent workspace ────────────────────
        const agentId = CLAWIQ_AGENT.id;

        if (workspaceExists(agentId)) {
          if (!options.nonInteractive) {
            const overwrite = await confirm(
              chalk.yellow(`\nWorkspace for ${CLAWIQ_AGENT.name} already exists. Overwrite? (y/N): `)
            );
            if (!overwrite) {
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
        const workspacePath = `~/.openclaw/workspace-${agentId}`;
        const agentUpsert = upsertAgent(openclawConfig, agentId, workspacePath);
        if (agentUpsert.added) {
          console.log(chalk.green('\u2713') + ` Creating Lenny the Lobster and registering in openclaw.json`);
        } else if (agentUpsert.updated) {
          console.log(chalk.dim(`  Lenny the Lobster already in openclaw.json (updated)`));
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
              execFile('openclaw', ['cron', 'list', '--json'], (error) => {
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
          const cronMessage = 'Run your nightly performance review. Follow the workflow in HEARTBEAT.md. Pull OTEL data first, identify interesting sessions, read only those, cross-reference, and submit findings via clawiq report finding. Write a summary to memory/ for todays date.';
          await new Promise<void>((resolve, reject) => {
            execFile('openclaw', [
              'cron', 'add',
              '--agent', agentId,
              '--name', `${CLAWIQ_AGENT.name} Nightly Performance Review`,
              '--cron', '0 3 * * *',
              '--tz', 'America/New_York',
              '--session', 'isolated',
              '--message', cronMessage,
              '--timeout-seconds', '600',
              '--no-deliver',
            ], (error, stdout, stderr) => {
              if (error) {
                console.error(chalk.dim(`  Debug: ${error.message}`));
                if (stderr) console.error(chalk.dim(`  Stderr: ${stderr}`));
                reject(error);
              } else {
                resolve();
              }
            });
          });
          cronSpinner.succeed('Nightly review scheduled (3:00 AM daily)');
        } catch {
          cronSpinner.warn('Could not create cron job. Run: openclaw cron add --agent ' + agentId + ' --cron "0 3 * * *" --tz America/New_York --session isolated --message "Run nightly review" --timeout-seconds 600 --no-deliver');
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

        // ── [11] Trigger first review ─────────────────────────────
        const firstRunSpinner = ora('Triggering Lenny\'s first review (findings will appear shortly)...').start();
        try {
          const firstRunMessage = 'This is your first review after being installed. Introduce yourself briefly in your first finding. Then do a quick scan: pull OTEL traces and semantic events from the last 24h, check sessions_list for active agents, and submit findings for anything interesting you see. If data is sparse, report what you can see and what\'s missing. Keep it short — full nightly reviews start tomorrow at 3 AM.';
          await new Promise<void>((resolve, reject) => {
            execFile('openclaw', [
              'cron', 'add',
              '--agent', agentId,
              '--name', 'Lenny First Review',
              '--at', '+30s',
              '--session', 'isolated',
              '--message', firstRunMessage,
              '--timeout-seconds', '300',
              '--no-deliver',
              '--delete-after-run',
            ], (error) => {
              if (error) reject(error);
              else resolve();
            });
          });
          firstRunSpinner.succeed('First review triggered — check findings in a few minutes');
        } catch {
          firstRunSpinner.warn('Could not trigger first review. Lenny will run his first full review tonight at 3 AM.');
        }

        // ── Done ─────────────────────────────────────────────────
        console.log(chalk.bold.green('\n\u2705 Setup complete!\n'));
        console.log(chalk.dim('What was set up:'));
        console.log(`  ${chalk.dim('Agent:')}      ${CLAWIQ_AGENT.name} ${CLAWIQ_AGENT.emoji}`);
        console.log(`  ${chalk.dim('Workspace:')}  ~/.openclaw/workspace-${agentId}/`);
        console.log(`  ${chalk.dim('OTEL:')}       ${API_ENDPOINT}`);
        console.log(`  ${chalk.dim('API Key:')}    ${apiKey.slice(0, 15)}...`);
        console.log('');
        console.log(chalk.bold('\n🦞 Lenny\'s on it. First findings incoming. Claws out.\n'));
      } catch (error) {
        handleError(error);
      }
    });

  return cmd;
}
