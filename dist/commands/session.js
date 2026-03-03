"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionCommand = createSessionCommand;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const minify_session_js_1 = require("../utils/minify-session.js");
const format_js_1 = require("../format.js");
function createSessionCommand() {
    const session = new commander_1.Command('session').description('Session transcript tools');
    session
        .command('minify')
        .description('Minify a session JSONL file for LLM analysis')
        .argument('<path>', 'Path to .jsonl session file')
        .option('--dry-run', 'Show before/after stats without outputting content')
        .action(async (filePath, opts) => {
        try {
            const result = await (0, minify_session_js_1.minifySessionFile)(filePath);
            const s = result.stats;
            if (opts.dryRun) {
                console.error(chalk_1.default.bold('Session minification (dry run)'));
                console.error(chalk_1.default.dim('─'.repeat(48)));
                console.error(`  File:         ${filePath}`);
                console.error(`  Lines:        ${s.originalLines} → ${s.minifiedLines}`);
                console.error(`  Bytes:        ${fmtBytes(s.originalBytes)} → ${fmtBytes(s.minifiedBytes)} (${chalk_1.default.green(`-${s.reductionPct}%`)})`);
                console.error(`  Est. tokens:  ${fmtNum(s.estimatedOriginalTokens)} → ${fmtNum(s.estimatedMinifiedTokens)} (${chalk_1.default.green(`-${s.tokenReductionPct}%`)})`);
            }
            else {
                // Stats to stderr so stdout is clean minified content
                console.error(chalk_1.default.dim(`[minify] ${fmtBytes(s.originalBytes)} → ${fmtBytes(s.minifiedBytes)} (-${s.reductionPct}%) | ~${fmtNum(s.estimatedOriginalTokens)} → ~${fmtNum(s.estimatedMinifiedTokens)} tokens (-${s.tokenReductionPct}%)`));
                process.stdout.write(result.minified);
            }
        }
        catch (err) {
            (0, format_js_1.handleError)(err);
        }
    });
    return session;
}
function fmtBytes(n) {
    if (n < 1024)
        return `${n}B`;
    if (n < 1024 * 1024)
        return `${(n / 1024).toFixed(1)}KB`;
    return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}
function fmtNum(n) {
    return n.toLocaleString('en-US');
}
//# sourceMappingURL=session.js.map