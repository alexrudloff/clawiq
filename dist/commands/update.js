"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUpdateCommand = createUpdateCommand;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const path_1 = require("path");
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const config_js_1 = require("../config.js");
const openclaw_js_1 = require("../openclaw.js");
const personas_js_1 = require("../personas.js");
const openclaw_service_js_1 = require("../openclaw_service.js");
const clawiq_web_plugin_js_1 = require("../utils/clawiq-web-plugin.js");
const otel_plugin_js_1 = require("../utils/otel-plugin.js");
// __dirname works in CommonJS
function run(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.execFile)(cmd, args, { cwd, encoding: 'utf-8' }, (error, stdout, stderr) => {
            if (error)
                reject(new Error(stderr || error.message));
            else
                resolve(stdout.trim());
        });
    });
}
function createUpdateCommand() {
    const cmd = new commander_1.Command('update')
        .description('Update ClawIQ CLI and Lenny to the latest version')
        .option('--skip-pull', 'Skip git pull (only update agent persona)')
        .action(async (options) => {
        const agentId = personas_js_1.CLAWIQ_AGENT.id;
        const workspaceDir = (0, path_1.join)(openclaw_js_1.OPENCLAW_DIR, `workspace-${agentId}`);
        // CLI repo root is two levels up from dist/commands/
        const repoDir = (0, path_1.join)(__dirname, '..', '..');
        if (!(0, fs_1.existsSync)(workspaceDir)) {
            console.error(chalk_1.default.red(`No ClawIQ workspace found at ${workspaceDir}. Run 'clawiq init' first.`));
            process.exit(1);
        }
        console.log(chalk_1.default.bold(`\n🦞 Updating ${personas_js_1.CLAWIQ_AGENT.name}...\n`));
        // Step 1: git pull + npm install + npm link
        if (!options.skipPull) {
            const pullSpinner = (0, ora_1.default)('Pulling latest from GitHub...').start();
            try {
                const gitDir = (0, fs_1.existsSync)((0, path_1.join)(repoDir, '.git')) ? repoDir : (0, path_1.join)(repoDir, '..');
                await run('git', ['pull'], gitDir);
                pullSpinner.succeed('Pulled latest code');
                const installSpinner = (0, ora_1.default)('Installing dependencies...').start();
                await run('npm', ['install'], gitDir);
                installSpinner.succeed('Dependencies installed');
                const buildSpinner = (0, ora_1.default)('Building...').start();
                await run('npm', ['run', 'build'], gitDir);
                buildSpinner.succeed('Built');
                const linkSpinner = (0, ora_1.default)('Linking CLI...').start();
                await run('npm', ['link', '--force'], gitDir);
                linkSpinner.succeed('CLI linked');
            }
            catch (err) {
                pullSpinner.fail(`Git update failed: ${err.message}`);
                console.log(chalk_1.default.dim('Continuing with current version...'));
            }
        }
        // Step 2: Update persona files (NOT memory, NOT user config)
        const updates = [
            { file: 'IDENTITY.md', generator: () => (0, personas_js_1.generateIdentity)(personas_js_1.CLAWIQ_AGENT) },
            { file: 'SOUL.md', generator: () => (0, personas_js_1.generateSoul)(personas_js_1.CLAWIQ_AGENT) },
            { file: 'AGENTS.md', generator: () => (0, personas_js_1.generateAgents)(personas_js_1.CLAWIQ_AGENT) },
            { file: 'HEARTBEAT.md', generator: () => (0, personas_js_1.generateHeartbeat)(personas_js_1.CLAWIQ_AGENT) },
            { file: 'TOOLS.md', generator: () => (0, personas_js_1.generateTools)(personas_js_1.CLAWIQ_AGENT) },
        ];
        const preserved = ['MEMORY.md', 'USER.md', 'memory/'];
        for (const { file, generator } of updates) {
            const spinner = (0, ora_1.default)(`Updating ${file}...`).start();
            try {
                (0, fs_1.writeFileSync)((0, path_1.join)(workspaceDir, file), generator());
                spinner.succeed(`Updated ${file}`);
            }
            catch (err) {
                spinner.fail(`Failed to update ${file}: ${err.message}`);
            }
        }
        console.log(chalk_1.default.dim(`\nPreserved: ${preserved.join(', ')}`));
        // Ensure diagnostics-otel plugin deps are installed
        await (0, otel_plugin_js_1.ensureOtelPluginDeps)();
        // Ensure clawiq-web plugin is installed and configured
        const pluginInstall = (0, clawiq_web_plugin_js_1.ensureClawiqWebPluginInstalled)();
        if (pluginInstall.installed) {
            console.log(chalk_1.default.green('\u2713') + ` clawiq-web plugin installed at ${pluginInstall.targetDir}`);
        }
        else {
            console.log(chalk_1.default.yellow('!') + ` clawiq-web plugin install skipped: ${pluginInstall.error}`);
        }
        const clawiqConfig = (0, config_js_1.loadConfig)();
        if (clawiqConfig.apiKey) {
            const openclawConfig = (0, openclaw_js_1.loadOpenClawConfig)();
            if ((0, openclaw_service_js_1.configureClawiqWebChannel)(openclawConfig, config_js_1.API_ENDPOINT, clawiqConfig.apiKey, agentId)) {
                (0, openclaw_js_1.saveOpenClawConfig)(openclawConfig);
                console.log(chalk_1.default.green('\u2713') + ' clawiq-web channel configuration refreshed');
            }
        }
        else {
            console.log(chalk_1.default.yellow('!') + ' No ClawIQ API key found; skipping clawiq-web channel config refresh');
        }
        const restartSpinner = (0, ora_1.default)('Restarting OpenClaw gateway...').start();
        try {
            await run('openclaw', ['gateway', 'restart'], process.cwd());
            restartSpinner.succeed('OpenClaw gateway restarted');
        }
        catch (err) {
            restartSpinner.warn(`Could not restart gateway automatically: ${err.message}`);
        }
        console.log(chalk_1.default.bold(`\n🦞 ${personas_js_1.CLAWIQ_AGENT.name} updated. Claws sharpened.\n`));
    });
    return cmd;
}
//# sourceMappingURL=update.js.map