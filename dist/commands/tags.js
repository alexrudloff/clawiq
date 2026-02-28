"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTagsCommand = createTagsCommand;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const client_js_1 = require("../client.js");
const format_js_1 = require("../format.js");
const time_js_1 = require("../time.js");
function createTagsCommand() {
    const cmd = new commander_1.Command('tags')
        .description('List tags used in your events')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--since <duration>', 'Time range (e.g., 24h, 7d, 30d)', '7d')
        .option('--limit <n>', 'Maximum tags per category', format_js_1.parseIntOption, 20)
        .option('--category <cat>', 'Filter by category: quality, action, domain')
        .option('--json', 'Output as JSON')
        .action(async (options) => {
        try {
            const client = (0, client_js_1.buildClient)(options.apiKey);
            const tags = await client.getTags(options.since, options.limit);
            if (options.json) {
                console.log(JSON.stringify(tags, null, 2));
                return;
            }
            const showCategory = (name, items, color) => {
                if (options.category && options.category !== name)
                    return;
                console.log(color.bold(`\n${name.charAt(0).toUpperCase() + name.slice(1)} Tags`));
                if (items.length === 0) {
                    console.log(chalk_1.default.dim('  No tags found'));
                    return;
                }
                const table = new cli_table3_1.default({
                    head: [chalk_1.default.dim('Tag'), chalk_1.default.dim('Count'), chalk_1.default.dim('Last Used')],
                    style: { head: [], border: [] },
                });
                for (const tag of items) {
                    const lastUsed = new Date(tag.last_used);
                    const timeAgo = (0, time_js_1.formatTimeAgo)(lastUsed);
                    table.push([tag.tag, tag.count.toString(), timeAgo]);
                }
                console.log(table.toString());
            };
            showCategory('quality', tags.quality_tags, chalk_1.default.red);
            showCategory('action', tags.action_tags, chalk_1.default.blue);
            showCategory('domain', tags.domain_tags, chalk_1.default.green);
            if (!options.category) {
                const total = tags.quality_tags.length + tags.action_tags.length + tags.domain_tags.length;
                console.log(chalk_1.default.dim(`\n${total} unique tags found`));
            }
        }
        catch (error) {
            (0, format_js_1.handleError)(error);
        }
    });
    return cmd;
}
//# sourceMappingURL=tags.js.map