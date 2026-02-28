"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLI_VERSION = void 0;
const child_process_1 = require("child_process");
const path_1 = require("path");
const url_1 = require("url");
function computeVersion() {
    try {
        const __dirname = (0, path_1.dirname)((0, url_1.fileURLToPath)(import.meta.url));
        // Get today's date
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        // Count commits today
        const count = (0, child_process_1.execFileSync)('git', ['rev-list', '--count', `--since=${dateStr}`, 'HEAD'], {
            cwd: __dirname,
            encoding: 'utf-8',
        }).trim();
        return `${year}.${month}.${day}.${count || '0'}`;
    }
    catch {
        // Fallback: use package.json version
        return '0.0.0';
    }
}
// Cache it at module load
exports.CLI_VERSION = computeVersion();
//# sourceMappingURL=version.js.map