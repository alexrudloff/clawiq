"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitCommand = createInitCommand;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const child_process_1 = require("child_process");
const config_js_1 = require("../config.js");
const api_js_1 = require("../api.js");
const format_js_1 = require("../format.js");
const openclaw_js_1 = require("../openclaw.js");
const personas_js_1 = require("../personas.js");
const workspace_js_1 = require("../workspace.js");
const cli_js_1 = require("../cli.js");
const openclaw_service_js_1 = require("../openclaw_service.js");
function createInitCommand() {
    const cmd = new commander_1.Command('init')
        .description('Set up ClawIQ agent, OTEL diagnostics, and agent workspaces')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--non-interactive', 'Skip prompts, use flags only')
        .action(async (options) => {
        const existingConfig = (0, config_js_1.loadConfig)();
        const config = { ...existingConfig };
        try {
            console.log(chalk_1.default.bold('\n\u{1F99E} ClawIQ Setup\n'));
            // ── [1] API Key ────────────────────────────────────────
            let apiKey;
            if (options.nonInteractive) {
                apiKey = options.apiKey || config.apiKey;
                if (!apiKey) {
                    console.error(chalk_1.default.red('Error: --api-key required in non-interactive mode'));
                    process.exit(1);
                }
            }
            else {
                const currentKey = config.apiKey ? `${config.apiKey.slice(0, 15)}...` : 'not set';
                console.log(chalk_1.default.dim(`Current API key: ${currentKey}`));
                const inputKey = options.apiKey || await (0, cli_js_1.prompt)('API key (enter to keep current): ');
                apiKey = inputKey || config.apiKey;
                if (!apiKey) {
                    console.error(chalk_1.default.red('\nAPI key is required. Create one at https://clawiq.md/settings/api-keys'));
                    process.exit(1);
                }
            }
            config.apiKey = apiKey;
            // Validate API key
            const spinner = (0, ora_1.default)('Validating API key...').start();
            const client = new api_js_1.ClawIQClient(config_js_1.API_ENDPOINT, apiKey, config_js_1.CLI_VERSION);
            try {
                await client.getTags(undefined, 1);
                spinner.succeed('API key valid');
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                if (msg.includes('401') || msg.includes('403')) {
                    spinner.fail('Invalid API key');
                    process.exit(1);
                }
                else if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
                    spinner.warn('Could not reach API (continuing anyway)');
                }
                else {
                    spinner.warn(`Connection test: ${msg}`);
                }
            }
            // ── [2] Backup openclaw.json ─────────────────────────────
            if ((0, openclaw_js_1.backupOpenClawConfig)()) {
                console.log(chalk_1.default.green('\u2713') + ' Backed up openclaw.json \u2192 openclaw.pre-clawiq.json');
            }
            // ── [3] Configure OTEL in openclaw.json ──────────────────
            const openclawConfig = (0, openclaw_js_1.loadOpenClawConfig)();
            (0, openclaw_service_js_1.configureOtelDiagnostics)(openclawConfig, apiKey, config_js_1.API_ENDPOINT);
            // ── [3b] Enable diagnostics-otel plugin ──────────────────
            if ((0, openclaw_service_js_1.ensureDiagnosticsPlugin)(openclawConfig)) {
                console.log(chalk_1.default.green('\u2713') + ' diagnostics-otel plugin enabled');
            }
            console.log(chalk_1.default.green('\u2713') + ' OTEL diagnostics configured');
            // ── [3c] Check and install OTEL dependencies ─────────────
            const otelSpinner = (0, ora_1.default)('Checking OTEL dependencies...').start();
            try {
                // Find OpenClaw install directory
                const openclawBin = await new Promise((resolve, reject) => {
                    (0, child_process_1.execFile)('which', ['openclaw'], (error, stdout) => {
                        if (error)
                            reject(error);
                        else
                            resolve(stdout.trim());
                    });
                });
                // Resolve symlink to get the actual package dir
                const realPath = await new Promise((resolve, reject) => {
                    (0, child_process_1.execFile)('readlink', ['-f', openclawBin], (error, stdout) => {
                        if (error) {
                            // macOS readlink doesn't support -f, try realpath
                            (0, child_process_1.execFile)('realpath', [openclawBin], (error2, stdout2) => {
                                if (error2)
                                    reject(error2);
                                else
                                    resolve(stdout2.trim());
                            });
                        }
                        else
                            resolve(stdout.trim());
                    });
                });
                // Go up to the package root (from openclaw.mjs or bin/)
                const path = await import('path');
                let openclawDir = path.dirname(realPath);
                // If we landed in a bin/ dir, go up one more
                if (openclawDir.endsWith('/bin'))
                    openclawDir = path.dirname(openclawDir);
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
                    await new Promise((resolve, reject) => {
                        (0, child_process_1.execFile)('npm', ['install', '--no-save', ...otelDeps], { cwd: openclawDir }, (error, stdout, stderr) => {
                            if (error)
                                reject(error);
                            else
                                resolve();
                        });
                    });
                    otelSpinner.succeed('OTEL dependencies installed');
                }
                else {
                    otelSpinner.succeed('OTEL dependencies already installed');
                }
            }
            catch (err) {
                otelSpinner.warn('Could not verify OTEL dependencies. If traces are missing, run: npm install @opentelemetry/api @opentelemetry/exporter-logs-otlp-http @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http @opentelemetry/sdk-node @opentelemetry/sdk-trace-node @opentelemetry/sdk-logs @opentelemetry/sdk-metrics @opentelemetry/resources @opentelemetry/semantic-conventions in your OpenClaw install directory');
            }
            // ── [4] Create ClawIQ agent workspace ────────────────────
            const agentId = personas_js_1.CLAWIQ_AGENT.id;
            if ((0, workspace_js_1.workspaceExists)(agentId)) {
                if (!options.nonInteractive) {
                    const overwrite = await (0, cli_js_1.confirm)(chalk_1.default.yellow(`\nWorkspace for ${personas_js_1.CLAWIQ_AGENT.name} already exists. Overwrite? (y/N): `));
                    if (!overwrite) {
                        console.log(chalk_1.default.dim('Keeping existing workspace'));
                    }
                    else {
                        const wsSpinner = (0, ora_1.default)(`Creating ${personas_js_1.CLAWIQ_AGENT.name} workspace...`).start();
                        (0, workspace_js_1.createWorkspace)(personas_js_1.CLAWIQ_AGENT);
                        wsSpinner.succeed(`Workspace created: ~/.openclaw/workspace-${agentId}/`);
                    }
                }
            }
            else {
                const wsSpinner = (0, ora_1.default)(`Creating ${personas_js_1.CLAWIQ_AGENT.name} workspace...`).start();
                (0, workspace_js_1.createWorkspace)(personas_js_1.CLAWIQ_AGENT);
                wsSpinner.succeed(`Workspace created: ~/.openclaw/workspace-${agentId}/`);
            }
            // ── [5] Register agent in openclaw.json ──────────────────
            const workspacePath = `~/.openclaw/workspace-${agentId}`;
            const agentUpsert = (0, openclaw_service_js_1.upsertAgent)(openclawConfig, agentId, workspacePath);
            if (agentUpsert.added) {
                console.log(chalk_1.default.green('\u2713') + ` Creating Lenny the Lobster and registering in openclaw.json`);
            }
            else if (agentUpsert.updated) {
                console.log(chalk_1.default.dim(`  Lenny the Lobster already in openclaw.json (updated)`));
            }
            (0, openclaw_js_1.saveOpenClawConfig)(openclawConfig);
            console.log(chalk_1.default.green('\u2713') + ' OpenClaw config saved');
            // ── [6] Update TOOLS.md in all existing workspaces ───────
            const workspaces = (0, workspace_js_1.discoverWorkspaces)();
            let updatedCount = 0;
            for (const ws of workspaces) {
                if ((0, workspace_js_1.appendClawiqTools)(ws)) {
                    updatedCount++;
                }
            }
            if (updatedCount > 0) {
                console.log(chalk_1.default.green('\u2713') + ` ClawIQ added to TOOLS.md in ${updatedCount} workspace(s)`);
            }
            // ── [6b] Install shared clawiq skill ─────────────────────
            if ((0, workspace_js_1.installClawiqSkill)()) {
                console.log(chalk_1.default.green('\u2713') + ' ClawIQ skill installed at workspace/skills/clawiq/');
            }
            // ── [7] Save ClawIQ config ───────────────────────────────
            config.defaultAgent = agentId;
            (0, config_js_1.saveConfig)(config);
            console.log(chalk_1.default.green('\u2713') + ' Configuration saved to ~/.clawiq/config.json');
            // ── [8] Restart openclaw gateway ─────────────────────────
            const gwSpinner = (0, ora_1.default)('Restarting OpenClaw gateway...').start();
            try {
                await new Promise((resolve, reject) => {
                    const child = (0, child_process_1.execFile)('openclaw', ['gateway', 'restart'], (error) => {
                        if (error)
                            reject(error);
                        else
                            resolve();
                    });
                    // gateway restart can be slow — give it 60s
                    setTimeout(() => {
                        child.kill();
                        resolve();
                    }, 60_000);
                });
                gwSpinner.succeed('OpenClaw gateway restarted');
            }
            catch {
                gwSpinner.warn('Could not restart gateway (restart manually with: openclaw gateway restart)');
            }
            // Wait for gateway to be ready after restart
            const readySpinner = (0, ora_1.default)('Waiting for gateway (this can take up to a minute — be patient)...').start();
            let gatewayReady = false;
            for (let i = 0; i < 30; i++) {
                try {
                    await new Promise((resolve, reject) => {
                        (0, child_process_1.execFile)('openclaw', ['cron', 'list', '--json'], (error) => {
                            if (error)
                                reject(error);
                            else
                                resolve();
                        });
                    });
                    gatewayReady = true;
                    break;
                }
                catch {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
            if (gatewayReady) {
                readySpinner.succeed('Gateway is ready');
            }
            else {
                readySpinner.warn('Gateway may not be ready — cron setup might fail');
            }
            // ── [9] Create nightly performance review cron job ──────
            const cronSpinner = (0, ora_1.default)('Creating nightly performance review cron...').start();
            try {
                const cronMessage = 'Run your nightly performance review. Follow the workflow in HEARTBEAT.md. Pull OTEL data first, identify interesting sessions, read only those, cross-reference, and submit findings via clawiq report finding. Write a summary to memory/ for todays date.';
                await new Promise((resolve, reject) => {
                    (0, child_process_1.execFile)('openclaw', [
                        'cron', 'add',
                        '--agent', agentId,
                        '--name', `${personas_js_1.CLAWIQ_AGENT.name} Nightly Performance Review`,
                        '--cron', '0 3 * * *',
                        '--tz', 'America/New_York',
                        '--session', 'isolated',
                        '--message', cronMessage,
                        '--timeout-seconds', '600',
                        '--no-deliver',
                    ], (error, stdout, stderr) => {
                        if (error) {
                            console.error(chalk_1.default.dim(`  Debug: ${error.message}`));
                            if (stderr)
                                console.error(chalk_1.default.dim(`  Stderr: ${stderr}`));
                            reject(error);
                        }
                        else {
                            resolve();
                        }
                    });
                });
                cronSpinner.succeed('Nightly review scheduled (3:00 AM daily)');
            }
            catch {
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
                console.log(chalk_1.default.green('\u2713') + ' Setup marker sent');
            }
            catch {
                console.log(chalk_1.default.dim('  Could not send setup marker (API may be unreachable)'));
            }
            // ── Done ─────────────────────────────────────────────────
            console.log(chalk_1.default.bold.green('\n\u2705 Setup complete!\n'));
            console.log(chalk_1.default.dim('What was set up:'));
            console.log(`  ${chalk_1.default.dim('Agent:')}      ${personas_js_1.CLAWIQ_AGENT.name} ${personas_js_1.CLAWIQ_AGENT.emoji}`);
            console.log(`  ${chalk_1.default.dim('Workspace:')}  ~/.openclaw/workspace-${agentId}/`);
            console.log(`  ${chalk_1.default.dim('OTEL:')}       ${config_js_1.API_ENDPOINT}`);
            console.log(`  ${chalk_1.default.dim('API Key:')}    ${apiKey.slice(0, 15)}...`);
            console.log('');
            console.log(chalk_1.default.bold('\n🦞 Lenny is ready. First review runs tonight at 3 AM. Claws out.\n'));
        }
        catch (error) {
            (0, format_js_1.handleError)(error);
        }
    });
    return cmd;
}
//# sourceMappingURL=init.js.map