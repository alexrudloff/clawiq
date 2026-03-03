"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionCommand = createSessionCommand;
const commander_1 = require("commander");
const minify_session_js_1 = require("../utils/minify-session.js");
const format_js_1 = require("../format.js");
function createSessionCommand() {
    const session = new commander_1.Command('session')
        .description('Read session transcripts (automatically minified for analysis)')
        .argument('<path>', 'Path to .jsonl session file')
        .action(async (filePath) => {
        try {
            const result = await (0, minify_session_js_1.minifySessionFile)(filePath);
            process.stdout.write(result.minified);
        }
        catch (err) {
            (0, format_js_1.handleError)(err);
        }
    });
    return session;
}
//# sourceMappingURL=session.js.map