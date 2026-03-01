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
const openclaw_js_1 = require("../openclaw.js");
const personas_js_1 = require("../personas.js");
function createUpdateCommand() {
    const cmd = new commander_1.Command('update')
        .description('Update Lenny to the latest version (preserves memory and user config)')
        .action(async () => {
        const agentId = personas_js_1.CLAWIQ_AGENT.id;
        const workspaceDir = (0, path_1.join)(openclaw_js_1.OPENCLAW_DIR, `workspace-${agentId}`);
        if (!(0, fs_1.existsSync)(workspaceDir)) {
            console.error(chalk_1.default.red(`No ClawIQ workspace found at ${workspaceDir}. Run 'clawiq init' first.`));
            process.exit(1);
        }
        console.log(chalk_1.default.bold(`\n🦞 Updating ${personas_js_1.CLAWIQ_AGENT.name}...\n`));
        // Update persona files (NOT memory, NOT user config)
        const updates = [
            { file: 'IDENTITY.md', generator: () => (0, personas_js_1.generateIdentity)(personas_js_1.CLAWIQ_AGENT) },
            { file: 'SOUL.md', generator: () => (0, personas_js_1.generateSoul)(personas_js_1.CLAWIQ_AGENT) },
            { file: 'AGENTS.md', generator: () => (0, personas_js_1.generateAgents)(personas_js_1.CLAWIQ_AGENT) },
            { file: 'HEARTBEAT.md', generator: () => (0, personas_js_1.generateHeartbeat)(personas_js_1.CLAWIQ_AGENT) },
            { file: 'TOOLS.md', generator: () => (0, personas_js_1.generateTools)(personas_js_1.CLAWIQ_AGENT) },
        ];
        // Files we never touch
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
        console.log(chalk_1.default.bold(`\n🦞 ${personas_js_1.CLAWIQ_AGENT.name} updated. Claws sharpened.\n`));
    });
    return cmd;
}
//# sourceMappingURL=update.js.map