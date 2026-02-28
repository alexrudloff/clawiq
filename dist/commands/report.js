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
const format_js_1 = require("../format.js");
// ── Constants ──────────────────────────────────────────────────────
const FINDING_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const SEVERITY_DISPLAY = {
    low: (s) => chalk_1.default.dim(s),
    medium: (s) => chalk_1.default.yellow(s),
    high: (s) => chalk_1.default.red(s),
    critical: (s) => chalk_1.default.bgRed.white(` ${s} `),
};
const SEVERITY_ICONS = {
    low: '○',
    medium: '◐',
    high: '●',
    critical: '◉',
};
// ── Helpers ────────────────────────────────────────────────────────
function validateSeverity(value) {
    if (!FINDING_SEVERITIES.includes(value)) {
        throw new Error(`Invalid severity "${value}". Must be one of: ${FINDING_SEVERITIES.join(', ')}`);
    }
    return value;
}
function formatSeverity(severity) {
    const icon = SEVERITY_ICONS[severity] || '•';
    const colorize = SEVERITY_DISPLAY[severity] || ((s) => s);
    return `${icon} ${colorize(severity)}`;
}
function printFindingDetail(finding) {
    console.log('');
    console.log(chalk_1.default.bold(`Finding: ${finding.title}`));
    console.log(chalk_1.default.dim('─'.repeat(60)));
    console.log(`  ${chalk_1.default.dim('ID:')}       ${finding.id}`);
    console.log(`  ${chalk_1.default.dim('Time:')}     ${new Date(finding.timestamp).toLocaleString()}`);
    console.log(`  ${chalk_1.default.dim('Severity:')} ${formatSeverity(finding.severity)}`);
    console.log(`  ${chalk_1.default.dim('Agent:')}    ${finding.target_agent}`);
    if (finding.agent_id) {
        console.log(`  ${chalk_1.default.dim('Reporter:')} ${finding.agent_id}`);
    }
    if (finding.description) {
        console.log('');
        console.log(chalk_1.default.dim('  Description:'));
        for (const line of finding.description.split('\n')) {
            console.log(`    ${line}`);
        }
    }
    if (finding.patch) {
        console.log('');
        console.log(chalk_1.default.dim('  Suggested Patch:'));
        console.log(chalk_1.default.green('  ┌─'));
        for (const line of finding.patch.split('\n')) {
            console.log(chalk_1.default.green(`  │ ${line}`));
        }
        console.log(chalk_1.default.green('  └─'));
    }
    if (finding.evidence) {
        console.log('');
        console.log(chalk_1.default.dim('  Evidence:'));
        for (const line of finding.evidence.split('\n')) {
            console.log(`    ${chalk_1.default.dim(line)}`);
        }
    }
    console.log('');
}
function printFindingsCompact(findings) {
    for (const f of findings) {
        const time = new Date(f.timestamp).toLocaleTimeString();
        const sev = formatSeverity(f.severity);
        const agent = chalk_1.default.dim(f.target_agent);
        console.log(`${chalk_1.default.dim(time)} ${sev} ${agent} ${f.title}`);
    }
}
function printFindingsTable(findings) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Severity'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Title'),
            chalk_1.default.dim('ID'),
        ],
        style: { head: [], border: [] },
        wordWrap: true,
        colWidths: [22, 12, 14, 40, 28],
    });
    for (const f of findings) {
        table.push([
            chalk_1.default.dim(new Date(f.timestamp).toLocaleString()),
            formatSeverity(f.severity),
            f.target_agent,
            f.title,
            chalk_1.default.dim(f.id.slice(0, 24) + '…'),
        ]);
    }
    console.log(table.toString());
}
// ── Subcommands ────────────────────────────────────────────────────
function buildFindingCommand() {
    return new commander_1.Command('finding')
        .description('Submit a finding for an agent')
        .requiredOption('--agent <id>', 'Target agent the finding is about')
        .requiredOption('--severity <level>', `Severity: ${FINDING_SEVERITIES.join(', ')}`)
        .requiredOption('--title <text>', 'Short description of the finding')
        .option('--description <text>', 'Detailed explanation')
        .option('--patch <text>', 'Suggested fix or behavioral patch text')
        .option('--evidence <text>', 'Supporting data or observations')
        .option('--reporter <id>', 'Agent submitting the finding (defaults to config default)')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--json', 'Output as JSON')
        .option('-q, --quiet', 'Suppress output')
        .action(async (options) => {
        try {
            const severity = validateSeverity(options.severity);
            const client = (0, client_js_1.buildClient)(options.apiKey);
            const config = loadConfig();
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
                    console.error(chalk_1.default.red(`Error: --${field} exceeds ${max} character limit (got ${val.length}). One finding per report — keep it focused.`));
                    process.exit(1);
                }
            }
            const spinner = options.quiet ? null : (0, ora_1.default)('Submitting finding...').start();
            const result = await client.submitFinding({
                agent: reporter,
                targetAgent: options.agent,
                severity,
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
                    finding: {
                        agent: options.agent,
                        severity,
                        title: options.title,
                    },
                }, null, 2));
                return;
            }
            if (!options.quiet) {
                if (result.accepted > 0) {
                    console.log(chalk_1.default.green('✓') +
                        ` Finding submitted: ${chalk_1.default.cyan(result.event_ids[0])}`);
                    console.log(`  ${chalk_1.default.dim('agent:')}    ${options.agent}`);
                    console.log(`  ${chalk_1.default.dim('severity:')} ${formatSeverity(severity)}`);
                    console.log(`  ${chalk_1.default.dim('title:')}    ${options.title}`);
                    if (options.patch) {
                        console.log(`  ${chalk_1.default.dim('patch:')}    ${chalk_1.default.green('included')}`);
                    }
                }
                else {
                    console.log(chalk_1.default.red('✗') + ' Finding rejected');
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
        .description('List recent findings')
        .option('--since <time>', 'Start time (relative like 7d, or ISO)', '7d')
        .option('--until <time>', 'End time (relative or ISO)')
        .option('--agent <id>', 'Filter by target agent')
        .option('--severity <level>', 'Filter by severity')
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
            const response = await client.getFindings({
                since: range.start,
                until: range.end,
                targetAgent: options.agent,
                limit: options.limit,
                offset,
            });
            let findings = response.findings;
            // Client-side severity filter
            if (options.severity) {
                const sev = validateSeverity(options.severity);
                findings = findings.filter((f) => f.severity === sev);
            }
            if (options.quiet) {
                process.exit(findings.length > 0 ? 0 : 1);
            }
            if (options.json) {
                console.log(JSON.stringify({
                    findings,
                    total: response.total,
                    pagination: {
                        limit: options.limit,
                        offset,
                    },
                }, null, 2));
                return;
            }
            if (findings.length === 0) {
                console.log(chalk_1.default.dim('No findings found'));
                return;
            }
            if (options.compact) {
                printFindingsCompact(findings);
            }
            else {
                printFindingsTable(findings);
            }
            console.log(chalk_1.default.dim(`\nShowing ${findings.length} finding(s) (limit ${options.limit}, offset ${offset})`));
            if (findings.length === options.limit) {
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
        .description('Show details of a specific finding')
        .argument('<finding-id>', 'Finding ID (or prefix)')
        .option('--api-key <key>', 'ClawIQ API key')
        .option('--json', 'Output as JSON')
        .option('-q, --quiet', 'Suppress output')
        .action(async (findingId, options) => {
        try {
            const client = (0, client_js_1.buildClient)(options.apiKey);
            // Search recent findings for the ID (or prefix match)
            const response = await client.getFindings({
                since: '90d',
                limit: 500,
            });
            const finding = response.findings.find((f) => f.id === findingId || f.id.startsWith(findingId));
            if (!finding) {
                if (options.quiet)
                    process.exit(1);
                console.error(chalk_1.default.red(`Finding not found: ${findingId}`));
                console.error(chalk_1.default.dim('Try: clawiq report list --since 30d'));
                process.exit(1);
            }
            if (options.quiet) {
                process.exit(0);
            }
            if (options.json) {
                console.log(JSON.stringify(finding, null, 2));
                return;
            }
            printFindingDetail(finding);
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
        .description('Submit and query agent performance findings');
    cmd.addCommand(buildFindingCommand());
    cmd.addCommand(buildListCommand());
    cmd.addCommand(buildShowCommand());
    return cmd;
}
//# sourceMappingURL=report.js.map