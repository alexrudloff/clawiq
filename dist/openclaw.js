"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPENCLAW_CONFIG = exports.OPENCLAW_DIR = void 0;
exports.loadOpenClawConfig = loadOpenClawConfig;
exports.backupOpenClawConfig = backupOpenClawConfig;
exports.saveOpenClawConfig = saveOpenClawConfig;
exports.agentExists = agentExists;
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
exports.OPENCLAW_DIR = (0, path_1.join)((0, os_1.homedir)(), '.openclaw');
exports.OPENCLAW_CONFIG = (0, path_1.join)(exports.OPENCLAW_DIR, 'openclaw.json');
function loadOpenClawConfig() {
    if (!(0, fs_1.existsSync)(exports.OPENCLAW_CONFIG)) {
        return {};
    }
    try {
        return JSON.parse((0, fs_1.readFileSync)(exports.OPENCLAW_CONFIG, 'utf-8'));
    }
    catch {
        return {};
    }
}
const PRE_CLAWIQ_BACKUP = (0, path_1.join)(exports.OPENCLAW_DIR, 'openclaw.pre-clawiq.json');
function backupOpenClawConfig() {
    if ((0, fs_1.existsSync)(exports.OPENCLAW_CONFIG) && !(0, fs_1.existsSync)(PRE_CLAWIQ_BACKUP)) {
        (0, fs_1.copyFileSync)(exports.OPENCLAW_CONFIG, PRE_CLAWIQ_BACKUP);
        return true;
    }
    return false;
}
function saveOpenClawConfig(config) {
    if (!(0, fs_1.existsSync)(exports.OPENCLAW_DIR)) {
        (0, fs_1.mkdirSync)(exports.OPENCLAW_DIR, { recursive: true });
    }
    (0, fs_1.writeFileSync)(exports.OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
}
function agentExists(config, id) {
    const list = config.agents?.list ?? [];
    return list.some((a) => a.id === id);
}
//# sourceMappingURL=openclaw.js.map