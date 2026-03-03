"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureClawiqWebPluginInstalled = ensureClawiqWebPluginInstalled;
const fs_1 = require("fs");
const path_1 = require("path");
const openclaw_js_1 = require("../openclaw.js");
const CLAWIQ_WEB_PLUGIN_ID = 'clawiq-web';
function ensureClawiqWebPluginInstalled() {
    const targetDir = (0, path_1.join)(openclaw_js_1.OPENCLAW_DIR, 'extensions', CLAWIQ_WEB_PLUGIN_ID);
    const sourceDir = resolveBundledClawiqWebPluginDir();
    if (!sourceDir) {
        return {
            installed: false,
            targetDir,
            error: 'Bundled clawiq-web plugin source not found',
        };
    }
    try {
        (0, fs_1.mkdirSync)((0, path_1.join)(openclaw_js_1.OPENCLAW_DIR, 'extensions'), { recursive: true });
        (0, fs_1.rmSync)(targetDir, { recursive: true, force: true });
        (0, fs_1.cpSync)(sourceDir, targetDir, { recursive: true, force: true });
        return {
            installed: true,
            targetDir,
            sourceDir,
        };
    }
    catch (err) {
        return {
            installed: false,
            targetDir,
            sourceDir,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
function resolveBundledClawiqWebPluginDir() {
    const candidates = [
        (0, path_1.join)(__dirname, '..', '..', 'extensions', CLAWIQ_WEB_PLUGIN_ID),
        (0, path_1.join)(process.cwd(), 'extensions', CLAWIQ_WEB_PLUGIN_ID),
    ];
    for (const candidate of candidates) {
        if ((0, fs_1.existsSync)((0, path_1.join)(candidate, 'openclaw.plugin.json')) && (0, fs_1.existsSync)((0, path_1.join)(candidate, 'package.json'))) {
            return candidate;
        }
    }
    return null;
}
//# sourceMappingURL=clawiq-web-plugin.js.map