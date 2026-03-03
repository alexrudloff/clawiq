"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureOtelPluginDeps = ensureOtelPluginDeps;
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
/**
 * Resolve the diagnostics-otel plugin directory dynamically.
 * Derives path from `which openclaw` so it works regardless of install method
 * (homebrew, npm global, nvm, volta, custom prefix, etc.)
 */
function getOtelPluginDir() {
    try {
        const openclawBin = (0, child_process_1.execSync)('which openclaw', { encoding: 'utf8' }).trim();
        // Resolve symlinks to get the real path
        const realBin = (0, child_process_1.execSync)(`readlink -f "${openclawBin}" 2>/dev/null || echo "${openclawBin}"`, { encoding: 'utf8' }).trim();
        // From /path/to/bin/openclaw → /path/to/lib/node_modules/openclaw/extensions/diagnostics-otel
        const binDir = (0, path_1.dirname)(realBin);
        const installRoot = (0, path_1.resolve)(binDir, '..', 'lib', 'node_modules', 'openclaw');
        return (0, path_1.join)(installRoot, 'extensions', 'diagnostics-otel');
    }
    catch {
        // Fallback: try npm root -g
        try {
            const npmRoot = (0, child_process_1.execSync)('npm root -g', { encoding: 'utf8' }).trim();
            return (0, path_1.join)(npmRoot, 'openclaw', 'extensions', 'diagnostics-otel');
        }
        catch {
            return ''; // plugin not found, caller should handle
        }
    }
}
/**
 * Checks if the diagnostics-otel plugin exists and has its npm dependencies installed.
 * If deps are missing, runs npm install automatically. Non-blocking on failure.
 */
async function ensureOtelPluginDeps() {
    const OTEL_PLUGIN_DIR = getOtelPluginDir();
    if (!OTEL_PLUGIN_DIR || !(0, fs_1.existsSync)(OTEL_PLUGIN_DIR)) {
        return; // Plugin not installed or openclaw not found, skip silently
    }
    const markerPath = (0, path_1.join)(OTEL_PLUGIN_DIR, 'node_modules', '@opentelemetry', 'api');
    if ((0, fs_1.existsSync)(markerPath)) {
        return; // Dependencies already present
    }
    const spinner = (0, ora_1.default)('Installing diagnostics-otel dependencies...').start();
    try {
        await new Promise((resolve, reject) => {
            (0, child_process_1.execFile)('npm', ['install'], { cwd: OTEL_PLUGIN_DIR }, (error) => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
        });
        spinner.succeed(chalk_1.default.green('OTEL plugin dependencies installed'));
    }
    catch (err) {
        spinner.warn(`Could not install diagnostics-otel deps: ${err.message}`);
    }
}
//# sourceMappingURL=otel-plugin.js.map