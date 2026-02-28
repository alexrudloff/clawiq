"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const readline = __importStar(require("readline"));
function prompt(question) {
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
                const inputKey = options.apiKey || await prompt('API key (enter to keep current): ');
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
            if (!openclawConfig.diagnostics) {
                openclawConfig.diagnostics = {};
            }
            if (!openclawConfig.diagnostics.otel) {
                openclawConfig.diagnostics.otel = {};
            }
            openclawConfig.diagnostics.enabled = true;
            openclawConfig.diagnostics.otel.enabled = true;
            openclawConfig.diagnostics.otel.endpoint = config_js_1.API_ENDPOINT;
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
                console.log(chalk_1.default.green('\u2713') + ' diagnostics-otel plugin enabled');
            }
            console.log(chalk_1.default.green('\u2713') + ' OTEL diagnostics configured');
            // ── [4] Create ClawIQ agent workspace ────────────────────
            const agentId = personas_js_1.CLAWIQ_AGENT.id;
            if ((0, workspace_js_1.workspaceExists)(agentId)) {
                if (!options.nonInteractive) {
                    const overwrite = await prompt(chalk_1.default.yellow(`\nWorkspace for ${personas_js_1.CLAWIQ_AGENT.name} already exists. Overwrite? (y/N): `));
                    if (overwrite.toLowerCase() !== 'y') {
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
            if (!openclawConfig.agents) {
                openclawConfig.agents = {};
            }
            if (!openclawConfig.agents.list) {
                openclawConfig.agents.list = [];
            }
            const workspacePath = `~/.openclaw/workspace-${agentId}`;
            if (!(0, openclaw_js_1.agentExists)(openclawConfig, agentId)) {
                openclawConfig.agents.list.push({
                    id: agentId,
                    workspace: workspacePath,
                });
                console.log(chalk_1.default.green('\u2713') + ` Creating Lex the Lobster and registering in openclaw.json`);
            }
            else {
                const existing = openclawConfig.agents.list.find((a) => a.id === agentId);
                if (existing) {
                    existing.workspace = workspacePath;
                }
                console.log(chalk_1.default.dim(`  Lex the Lobster already in openclaw.json (updated)`));
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
                        (0, child_process_1.execFile)('openclaw', ['gateway', 'status'], (error) => {
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
                await new Promise((resolve, reject) => {
                    const cronPayload = JSON.stringify({
                        name: 'Lex Nightly Performance Review',
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
                    (0, child_process_1.execFile)('openclaw', ['cron', 'add', '--agent', agentId, '--json', cronPayload], (error, stdout) => {
                        if (error)
                            reject(error);
                        else
                            resolve();
                    });
                });
                cronSpinner.succeed('Nightly review scheduled (3:00 AM daily)');
            }
            catch {
                // Fallback: try via the gateway API directly
                try {
                    await new Promise((resolve, reject) => {
                        const addCmd = `curl -s -X POST http://localhost:3456/api/cron/jobs -H "Content-Type: application/json" -d '${JSON.stringify({
                            agentId,
                            name: 'Lex Nightly Performance Review',
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
                        (0, child_process_1.execFile)('sh', ['-c', addCmd], (error) => {
                            if (error)
                                reject(error);
                            else
                                resolve();
                        });
                    });
                    cronSpinner.succeed('Nightly review scheduled (3:00 AM daily)');
                }
                catch {
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
            console.log(chalk_1.default.bold('\n🦞 Lex is ready. First review runs tonight at 3 AM. Claws out.\n'));
        }
        catch (error) {
            (0, format_js_1.handleError)(error);
        }
    });
    return cmd;
}
//# sourceMappingURL=init.js.map