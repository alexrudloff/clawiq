"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUninstallCommand = createUninstallCommand;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const config_js_1 = require("../config.js");
const openclaw_js_1 = require("../openclaw.js");
const personas_js_1 = require("../personas.js");
const workspace_js_1 = require("../workspace.js");
const format_js_1 = require("../format.js");
const cli_js_1 = require("../cli.js");
const openclaw_service_js_1 = require("../openclaw_service.js");
function createUninstallCommand() {
    const cmd = new commander_1.Command('uninstall')
        .description('Remove ClawIQ configuration and workspace setup')
        .option('--non-interactive', 'Skip prompts, use defaults')
        .option('--keep-config', 'Keep ~/.clawiq/config.json')
        .option('--keep-workspace', 'Keep ClawIQ agent workspace')
        .option('--keep-openclaw', 'Do not modify openclaw.json')
        .option('--skip-backup-restore', 'Do not restore openclaw.pre-clawiq.json if present')
        .action(async (options) => {
        try {
            const config = (0, config_js_1.loadConfig)();
            const clawiqConfigDir = (0, path_1.join)((0, os_1.homedir)(), '.clawiq');
            const clawiqWorkspace = (0, path_1.join)((0, os_1.homedir)(), `.openclaw/workspace-${personas_js_1.CLAWIQ_AGENT.id}`);
            let keepConfig = options.keepConfig ?? false;
            let keepWorkspace = options.keepWorkspace ?? false;
            let keepOpenClaw = options.keepOpenclaw ?? false;
            let restoreBackup = false;
            if (!options.nonInteractive) {
                console.log(chalk_1.default.bold('\n🧹 ClawIQ Uninstall\n'));
                const shouldRemove = await (0, cli_js_1.confirm)('Remove ClawIQ setup from this machine? (y/N): ');
                if (!shouldRemove) {
                    console.log(chalk_1.default.dim('Uninstall cancelled.'));
                    return;
                }
                if ((0, openclaw_js_1.hasPreClawiqBackup)() && !options.skipBackupRestore) {
                    restoreBackup = await (0, cli_js_1.confirm)('Restore openclaw.pre-clawiq.json backup? (y/N): ');
                }
                else {
                    const modify = await (0, cli_js_1.confirm)('Remove ClawIQ changes from openclaw.json? (y/N): ');
                    keepOpenClaw = !modify;
                }
                const deleteWorkspace = await (0, cli_js_1.confirm)(`Delete ClawIQ workspace (${clawiqWorkspace})? (y/N): `);
                keepWorkspace = !deleteWorkspace;
                const deleteConfig = await (0, cli_js_1.confirm)(`Delete ClawIQ config (${clawiqConfigDir})? (y/N): `);
                keepConfig = !deleteConfig;
            }
            else {
                restoreBackup = (0, openclaw_js_1.hasPreClawiqBackup)() && !options.skipBackupRestore;
            }
            // ── [1] Restore or update openclaw.json ───────────────
            if (!keepOpenClaw) {
                if (restoreBackup) {
                    const restoreSpinner = (0, ora_1.default)('Restoring openclaw.pre-clawiq.json...').start();
                    if ((0, openclaw_js_1.restorePreClawiqBackup)()) {
                        restoreSpinner.succeed('openclaw.json restored from backup');
                    }
                    else {
                        restoreSpinner.warn('Backup not found; skipping restore');
                    }
                }
                else {
                    const openclawSpinner = (0, ora_1.default)('Removing ClawIQ settings from openclaw.json...').start();
                    const openclawConfig = (0, openclaw_js_1.loadOpenClawConfig)();
                    (0, openclaw_service_js_1.removeClawiqConfig)(openclawConfig, config_js_1.API_ENDPOINT, personas_js_1.CLAWIQ_AGENT.id);
                    (0, openclaw_js_1.saveOpenClawConfig)(openclawConfig);
                    openclawSpinner.succeed('openclaw.json updated');
                }
            }
            // ── [2] Remove TOOLS.md references ─────────────────────
            const workspaces = (0, workspace_js_1.discoverWorkspaces)();
            let updated = 0;
            for (const ws of workspaces) {
                if ((0, workspace_js_1.removeClawiqTools)(ws)) {
                    updated++;
                }
            }
            if (updated > 0) {
                console.log(chalk_1.default.green('✓') + ` Removed ClawIQ from TOOLS.md in ${updated} workspace(s)`);
            }
            // ── [3] Remove shared skill ────────────────────────────
            if ((0, workspace_js_1.removeClawiqSkill)()) {
                console.log(chalk_1.default.green('✓') + ' Removed shared clawiq skill');
            }
            // ── [4] Remove ClawIQ workspace ────────────────────────
            if (!keepWorkspace) {
                if ((0, fs_1.existsSync)(clawiqWorkspace)) {
                    (0, fs_1.rmSync)(clawiqWorkspace, { recursive: true, force: true });
                    console.log(chalk_1.default.green('✓') + ` Removed workspace ${clawiqWorkspace}`);
                }
            }
            // ── [5] Remove local CLI config ────────────────────────
            if (!keepConfig) {
                if ((0, fs_1.existsSync)(clawiqConfigDir)) {
                    (0, fs_1.rmSync)(clawiqConfigDir, { recursive: true, force: true });
                    console.log(chalk_1.default.green('✓') + ` Removed ${clawiqConfigDir}`);
                }
            }
            console.log(chalk_1.default.bold.green('\n✅ Uninstall complete.\n'));
            if (config.apiKey) {
                console.log(chalk_1.default.dim('Note: API key still exists server-side. Revoke it from ClawIQ if needed.'));
            }
        }
        catch (error) {
            (0, format_js_1.handleError)(error);
        }
    });
    return cmd;
}
//# sourceMappingURL=uninstall.js.map