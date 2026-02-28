"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_ENDPOINT = exports.CLI_VERSION = void 0;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.requireApiKey = requireApiKey;
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const pkg = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', 'package.json'), 'utf-8'));
// Compute version from git: YYYY.MM.DD.commits-today
function computeCliVersion() {
    try {
        const { execFileSync } = require('child_process');
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const yesterday = new Date(now.getTime() - 86400000);
        const yYear = yesterday.getFullYear();
        const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
        const yDay = String(yesterday.getDate()).padStart(2, '0');
        const count = execFileSync('git', ['rev-list', '--count', `--after=${yYear}-${yMonth}-${yDay}`, 'HEAD'], {
            cwd: require('path').resolve(__dirname, '..'),
            encoding: 'utf-8',
        }).trim();
        return `${year}.${month}.${day}.${count || '0'}`;
    }
    catch {
        return pkg.version; // fallback to package.json
    }
}
exports.CLI_VERSION = computeCliVersion();
const CONFIG_DIR = (0, path_1.join)((0, os_1.homedir)(), '.clawiq');
const CONFIG_FILE = (0, path_1.join)(CONFIG_DIR, 'config.json');
exports.API_ENDPOINT = 'https://api.clawiq.md';
/**
 * Load config from environment or ~/.clawiq/config.json
 */
function loadConfig() {
    const config = {};
    if ((0, fs_1.existsSync)(CONFIG_FILE)) {
        try {
            const saved = JSON.parse((0, fs_1.readFileSync)(CONFIG_FILE, 'utf-8'));
            if (saved.apiKey)
                config.apiKey = saved.apiKey;
            if (saved.defaultAgent)
                config.defaultAgent = saved.defaultAgent;
        }
        catch {
            // Ignore parse errors
        }
    }
    if (process.env.CLAWIQ_API_KEY) {
        config.apiKey = process.env.CLAWIQ_API_KEY;
    }
    return config;
}
/**
 * Save config to ~/.clawiq/config.json
 */
function saveConfig(config) {
    if (!(0, fs_1.existsSync)(CONFIG_DIR)) {
        (0, fs_1.mkdirSync)(CONFIG_DIR, { recursive: true });
    }
    (0, fs_1.writeFileSync)(CONFIG_FILE, JSON.stringify(config, null, 2));
}
/**
 * Get API key from config or throw error
 */
function requireApiKey(config, flagApiKey) {
    const apiKey = flagApiKey || config.apiKey;
    if (!apiKey) {
        throw new Error('API key required. Set via:\n' +
            '  --api-key flag\n' +
            '  CLAWIQ_API_KEY environment variable\n' +
            '  clawiq init');
    }
    return apiKey;
}
//# sourceMappingURL=config.js.map