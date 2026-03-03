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
const OTEL_PLUGIN_DIR = '/opt/homebrew/lib/node_modules/openclaw/extensions/diagnostics-otel';
/**
 * Checks if the diagnostics-otel plugin exists and has its npm dependencies installed.
 * If deps are missing, runs npm install automatically. Non-blocking on failure.
 */
async function ensureOtelPluginDeps() {
    if (!(0, fs_1.existsSync)(OTEL_PLUGIN_DIR)) {
        return; // Plugin not installed, skip silently
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