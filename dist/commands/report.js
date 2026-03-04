"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReportCommand = createReportCommand;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const ora_1 = __importDefault(require("ora"));
const client_js_1 = require("../client.js");
const time_js_1 = require("../time.js");
const config_js_1 = require("../config.js");
const format_js_1 = require("../format.js");
// ── Constants ──────────────────────────────────────────────────────
const ISSUE_IMPACTS = ['low', 'medium', 'high', 'critical'];
const IMPACT_DISPLAY = {
    low: (s) => chalk_1.default.dim(s),
    medium: (s) => chalk_1.default.yellow(s),
    high: (s) => chalk_1.default.red(s),
    critical: (s) => chalk_1.default.bgRed.white(` ${s} `),
};
const IMPACT_ICONS = {
    low: '○',
    medium: '◐',
    high: '●',
    critical: '◉',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ── Helpers ────────────────────────────────────────────────────────
function validateImpact(value) {
    if (!ISSUE_IMPACTS.includes(value)) {
        throw new Error(`Invalid impact "${value}". Must be one of: ${ISSUE_IMPACTS.join(', ')}`);
    }
    return value;
}
function formatImpact(impact) {
    const icon = IMPACT_ICONS[impact] || '•';
    const colorize = IMPACT_DISPLAY[impact] || ((s) => s);
    return `${icon} ${colorize(impact)}`;
}
function isNotFoundError(error) {
    return error instanceof Error && error.message.includes('API error (404)');
}
function formatIssueStatus(state) {
    if (!state) {
        return chalk_1.default.green('open');
    }
    const normalized = (state.status || '').toLowerCase();
    if (normalized === 'resolved')
        return chalk_1.default.green('resolved');
    if (normalized === 'dismissed')
        return chalk_1.default.dim('dismissed');
    if (normalized === 'not_helpful')
        return chalk_1.default.yellow('not_helpful');
    return chalk_1.default.green(normalized || 'open');
}
function printIssueDetail(issue, context) {
    const state = context?.state ?? null;
    const discussion = context?.discussion ?? null;
    console.log('');
    console.log(chalk_1.default.bold(`Issue: ${issue.title}`));
    console.log(chalk_1.default.dim('─'.repeat(60)));
    console.log(`  ${chalk_1.default.dim('ID:')}       ${issue.id}`);
    console.log(`  ${chalk_1.default.dim('Time:')}     ${new Date(issue.timestamp).toLocaleString()}`);
    console.log(`  ${chalk_1.default.dim('Impact:')}   ${formatImpact(issue.impact)}`);
    console.log(`  ${chalk_1.default.dim('Status:')}   ${formatIssueStatus(state)}`);
    if (state?.last_signal) {
        console.log(`  ${chalk_1.default.dim('Signal:')}   ${state.last_signal}`);
    }
    console.log(`  ${chalk_1.default.dim('Agent:')}    ${issue.target_agent}`);
    if (issue.agent_id) {
        console.log(`  ${chalk_1.default.dim('Reporter:')} ${issue.agent_id}`);
    }
    if (issue.description) {
        console.log('');
        console.log(chalk_1.default.dim('  Description:'));
        for (const line of issue.description.split('\n')) {
            console.log(`    ${line}`);
        }
    }
    if (issue.patch) {
        console.log('');
        console.log(chalk_1.default.dim('  Suggested Patch:'));
        console.log(chalk_1.default.green('  ┌─'));
        for (const line of issue.patch.split('\n')) {
            console.log(chalk_1.default.green(`  │ ${line}`));
        }
        console.log(chalk_1.default.green('  └─'));
    }
    if (issue.evidence) {
        console.log('');
        console.log(chalk_1.default.dim('  Evidence:'));
        for (const line of issue.evidence.split('\n')) {
            console.log(`    ${chalk_1.default.dim(line)}`);
        }
    }
    console.log('');
    console.log(chalk_1.default.dim('  Discussion Transcript:'));
    if (!discussion?.conversation || discussion.messages.length === 0) {
        console.log(chalk_1.default.dim('    (no discussion history yet)'));
    }
    else {
        console.log(`    ${chalk_1.default.dim('Thread:')} ${discussion.conversation.title}`);
        for (const message of discussion.messages) {
            const ts = new Date(message.created_at).toLocaleString();
            const role = message.role === 'assistant' ? 'Lenny' : 'User';
            const roleColor = message.role === 'assistant' ? chalk_1.default.magenta : chalk_1.default.cyan;
            console.log(`    ${chalk_1.default.dim(`[${ts}]`)} ${roleColor(role)}${chalk_1.default.dim(':')}`);
            for (const line of (message.content || '').split('\n')) {
                console.log(`      ${line}`);
            }
            if (message.status === 'failed' && message.error_message) {
                console.log(`      ${chalk_1.default.red(`(failed: ${message.error_message})`)}`);
            }
        }
    }
    console.log('');
}
function printIssuesCompact(issues) {
    for (const issue of issues) {
        const time = new Date(issue.timestamp).toLocaleTimeString();
        const impact = formatImpact(issue.impact);
        const agent = chalk_1.default.dim(issue.target_agent);
        console.log(`${chalk_1.default.dim(time)} ${impact} ${agent} ${issue.title}`);
    }
}
function printIssuesTable(issues) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Impact'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Title'),
            chalk_1.default.dim('ID'),
        ],
        style: { head: [], border: [] },
        wordWrap: true,
        colWidths: [22, 12, 14, 40, 28],
    });
    for (const issue of issues) {
        table.push([
            chalk_1.default.dim(new Date(issue.timestamp).toLocaleString()),
            formatImpact(issue.impact),
            issue.target_agent,
            issue.title,
            chalk_1.default.dim(issue.id.slice(0, 24) + '…'),
        ]);
    }
    console.log(table.toString());
}
// ── Subcommands ────────────────────────────────────────────────────
function buildIssueCommand() {
    return new commander_1.Command('issue')
        .description('Submit an issue for an agent')
        .requiredOption('--agent <id>', 'Target agent the issue is about')
        .requiredOption('--impact <level>', `Impact: ${ISSUE_IMPACTS.join(', ')}`)
        .requiredOption('--title <text>', 'Short description of the issue')
        .option('--description <text>', 'Detailed explanation')
        .option('--patch <text>', 'Suggested fix or behavioral patch text')
        .option('--evidence <text>', 'Supporting data or observations')
        .option('--reporter <id>', 'Agent submitting the issue (defaults to config default)')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--json', 'Output as JSON')
        .option('-q, --quiet', 'Suppress output')
        .action(async (options) => {
        try {
            const impact = validateImpact(options.impact);
            const client = (0, client_js_1.buildClient)(options.apiKey);
            const config = (0, config_js_1.loadConfig)();
            const reporter = options.reporter || config.defaultAgent || 'clawiq';
            // Validate field lengths
            const limits = {
                title: 200,
                description: 1000,
                patch: 2000,
                evidence: 1000,
            };
            for (const [field, max] of Object.entries(limits)) {
                const val = options[field];
                if (val && val.length > max) {
                    console.error(chalk_1.default.red(`Error: --${field} exceeds ${max} character limit (got ${val.length}). One issue per report — keep it focused.`));
                    process.exit(1);
                }
            }
            const spinner = options.quiet ? null : (0, ora_1.default)('Submitting issue...').start();
            const result = await client.submitIssue({
                agent: reporter,
                targetAgent: options.agent,
                impact,
                title: options.title,
                description: options.description,
                patch: options.patch,
                evidence: options.evidence,
            });
            if (spinner)
                spinner.stop();
            if (options.json) {
                console.log(JSON.stringify({
                    accepted: result.accepted,
                    event_ids: result.event_ids,
                    issue: {
                        agent: options.agent,
                        impact,
                        title: options.title,
                    },
                }, null, 2));
                return;
            }
            if (!options.quiet) {
                if (result.accepted > 0) {
                    console.log(chalk_1.default.green('✓') +
                        ` Issue submitted: ${chalk_1.default.cyan(result.event_ids[0])}`);
                    console.log(`  ${chalk_1.default.dim('agent:')}    ${options.agent}`);
                    console.log(`  ${chalk_1.default.dim('impact:')}   ${formatImpact(impact)}`);
                    console.log(`  ${chalk_1.default.dim('title:')}    ${options.title}`);
                    if (options.patch) {
                        console.log(`  ${chalk_1.default.dim('patch:')}    ${chalk_1.default.green('included')}`);
                    }
                }
                else {
                    console.log(chalk_1.default.red('✗') + ' Issue rejected');
                    if (result.errors?.length) {
                        for (const err of result.errors) {
                            console.log(`  ${chalk_1.default.red(err.code)}: ${err.message}`);
                        }
                    }
                    process.exit(4);
                }
            }
        }
        catch (error) {
            if (options.quiet)
                process.exit(1);
            (0, format_js_1.handleError)(error);
        }
    });
}
function buildListCommand() {
    return new commander_1.Command('list')
        .description('List recent issues')
        .option('--since <time>', 'Start time (relative like 7d, or ISO)', '7d')
        .option('--until <time>', 'End time (relative or ISO)')
        .option('--agent <id>', 'Filter by target agent')
        .option('--impact <level>', 'Filter by impact')
        .option('--limit <n>', 'Results per page', format_js_1.parseIntOption, 20)
        .option('--offset <n>', 'Pagination offset', format_js_1.parseIntOption)
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--json', 'Output as JSON')
        .option('--compact', 'Compact output')
        .option('-q, --quiet', 'Suppress output (just exit code)')
        .action(async (options) => {
        try {
            const client = (0, client_js_1.buildClient)(options.apiKey);
            const range = (0, time_js_1.resolveTimeRange)(options.since, options.until, '7d');
            const offset = options.offset ?? 0;
            const response = await client.getIssues({
                since: range.start,
                until: range.end,
                targetAgent: options.agent,
                limit: options.limit,
                offset,
            });
            let issues = response.issues;
            // Client-side impact filter
            const impactFilter = options.impact;
            if (impactFilter) {
                const impact = validateImpact(impactFilter);
                issues = issues.filter((issue) => issue.impact === impact);
            }
            if (options.quiet) {
                process.exit(issues.length > 0 ? 0 : 1);
            }
            if (options.json) {
                console.log(JSON.stringify({
                    issues,
                    total: response.total,
                    pagination: {
                        limit: options.limit,
                        offset,
                    },
                }, null, 2));
                return;
            }
            if (issues.length === 0) {
                console.log(chalk_1.default.dim('No issues found'));
                return;
            }
            if (options.compact) {
                printIssuesCompact(issues);
            }
            else {
                printIssuesTable(issues);
            }
            console.log(chalk_1.default.dim(`\nShowing ${issues.length} issue(s) (limit ${options.limit}, offset ${offset})`));
            if (issues.length === options.limit) {
                console.log(chalk_1.default.dim(`Next page: --offset ${offset + options.limit}`));
            }
        }
        catch (error) {
            if (options.quiet)
                process.exit(1);
            (0, format_js_1.handleError)(error);
        }
    });
}
function buildShowCommand() {
    return new commander_1.Command('show')
        .description('Show details of a specific issue')
        .argument('<issue-id>', 'Issue ID (or prefix)')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--json', 'Output as JSON')
        .option('-q, --quiet', 'Suppress output')
        .action(async (issueId, options) => {
        try {
            const client = (0, client_js_1.buildClient)(options.apiKey);
            const normalizedID = issueId.trim();
            let issue;
            if (UUID_RE.test(normalizedID)) {
                try {
                    issue = await client.getIssueByID(normalizedID);
                }
                catch (error) {
                    if (!isNotFoundError(error)) {
                        throw error;
                    }
                }
            }
            else {
                // Prefix lookup fallback for convenience.
                const response = await client.getIssues({
                    since: '365d',
                    limit: 5000,
                });
                issue = response.issues.find((entry) => entry.id.startsWith(normalizedID));
            }
            if (!issue) {
                if (options.quiet)
                    process.exit(1);
                console.error(chalk_1.default.red(`Issue not found: ${issueId}`));
                if (!UUID_RE.test(normalizedID)) {
                    console.error(chalk_1.default.dim('Try a full UUID for exact lookup.'));
                }
                else {
                    console.error(chalk_1.default.dim('Try: clawiq report list --since 30d'));
                }
                process.exit(1);
            }
            if (options.quiet) {
                process.exit(0);
            }
            const [issueState, issueDiscussion] = await Promise.all([
                client.getIssueState(issue.id),
                client.getIssueDiscussion(issue.id, 500),
            ]);
            if (options.json) {
                console.log(JSON.stringify({
                    issue,
                    state: issueState,
                    discussion: issueDiscussion,
                }, null, 2));
                return;
            }
            printIssueDetail(issue, {
                state: issueState,
                discussion: issueDiscussion,
            });
        }
        catch (error) {
            if (options.quiet)
                process.exit(1);
            (0, format_js_1.handleError)(error);
        }
    });
}
// ── Main command ───────────────────────────────────────────────────
function createReportCommand() {
    const cmd = new commander_1.Command('report')
        .description('Submit and query agent performance issues');
    cmd.addCommand(buildIssueCommand());
    cmd.addCommand(buildListCommand());
    cmd.addCommand(buildShowCommand());
    return cmd;
}
//# sourceMappingURL=report.js.map