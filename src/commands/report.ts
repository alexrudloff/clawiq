import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { ClawIQClient, Finding, FindingSeverity } from '../api.js';
import { API_ENDPOINT, loadConfig, requireApiKey, CLI_VERSION } from '../config.js';
import { resolveTimeRange } from '../time.js';
import { parseIntOption, handleError } from '../format.js';

// ── Constants ──────────────────────────────────────────────────────

const FINDING_SEVERITIES: FindingSeverity[] = ['low', 'medium', 'high', 'critical'];

const SEVERITY_DISPLAY: Record<FindingSeverity, (s: string) => string> = {
  low: (s) => chalk.dim(s),
  medium: (s) => chalk.yellow(s),
  high: (s) => chalk.red(s),
  critical: (s) => chalk.bgRed.white(` ${s} `),
};

const SEVERITY_ICONS: Record<FindingSeverity, string> = {
  low: '○',
  medium: '◐',
  high: '●',
  critical: '◉',
};

// ── Helpers ────────────────────────────────────────────────────────

function validateSeverity(value: string): FindingSeverity {
  if (!FINDING_SEVERITIES.includes(value as FindingSeverity)) {
    throw new Error(
      `Invalid severity "${value}". Must be one of: ${FINDING_SEVERITIES.join(', ')}`
    );
  }
  return value as FindingSeverity;
}

function buildClient(apiKeyFlag?: string): ClawIQClient {
  const config = loadConfig();
  const apiKey = requireApiKey(config, apiKeyFlag);
  return new ClawIQClient(API_ENDPOINT, apiKey, CLI_VERSION);
}

function formatSeverity(severity: FindingSeverity): string {
  const icon = SEVERITY_ICONS[severity] || '•';
  const colorize = SEVERITY_DISPLAY[severity] || ((s: string) => s);
  return `${icon} ${colorize(severity)}`;
}

function printFindingDetail(finding: Finding): void {
  console.log('');
  console.log(chalk.bold(`Finding: ${finding.title}`));
  console.log(chalk.dim('─'.repeat(60)));
  console.log(`  ${chalk.dim('ID:')}       ${finding.id}`);
  console.log(`  ${chalk.dim('Time:')}     ${new Date(finding.timestamp).toLocaleString()}`);
  console.log(`  ${chalk.dim('Severity:')} ${formatSeverity(finding.severity)}`);
  console.log(`  ${chalk.dim('Agent:')}    ${finding.target_agent}`);
  if (finding.agent_id) {
    console.log(`  ${chalk.dim('Reporter:')} ${finding.agent_id}`);
  }

  if (finding.description) {
    console.log('');
    console.log(chalk.dim('  Description:'));
    for (const line of finding.description.split('\n')) {
      console.log(`    ${line}`);
    }
  }

  if (finding.patch) {
    console.log('');
    console.log(chalk.dim('  Suggested Patch:'));
    console.log(chalk.green('  ┌─'));
    for (const line of finding.patch.split('\n')) {
      console.log(chalk.green(`  │ ${line}`));
    }
    console.log(chalk.green('  └─'));
  }

  if (finding.evidence) {
    console.log('');
    console.log(chalk.dim('  Evidence:'));
    for (const line of finding.evidence.split('\n')) {
      console.log(`    ${chalk.dim(line)}`);
    }
  }

  console.log('');
}

function printFindingsCompact(findings: Finding[]): void {
  for (const f of findings) {
    const time = new Date(f.timestamp).toLocaleTimeString();
    const sev = formatSeverity(f.severity);
    const agent = chalk.dim(f.target_agent);
    console.log(`${chalk.dim(time)} ${sev} ${agent} ${f.title}`);
  }
}

function printFindingsTable(findings: Finding[]): void {
  const table = new Table({
    head: [
      chalk.dim('Time'),
      chalk.dim('Severity'),
      chalk.dim('Agent'),
      chalk.dim('Title'),
      chalk.dim('ID'),
    ],
    style: { head: [], border: [] },
    wordWrap: true,
    colWidths: [22, 12, 14, 40, 28],
  });

  for (const f of findings) {
    table.push([
      chalk.dim(new Date(f.timestamp).toLocaleString()),
      formatSeverity(f.severity),
      f.target_agent,
      f.title,
      chalk.dim(f.id.slice(0, 24) + '…'),
    ]);
  }

  console.log(table.toString());
}

// ── Subcommands ────────────────────────────────────────────────────

function buildFindingCommand(): Command {
  return new Command('finding')
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
        const client = buildClient(options.apiKey);
        const config = loadConfig();

        const reporter = options.reporter || config.defaultAgent || 'clawiq';

        // Validate field lengths
        const limits: Record<string, number> = {
          title: 200,
          description: 1000,
          patch: 2000,
          evidence: 1000,
        };
        for (const [field, max] of Object.entries(limits)) {
          const val = options[field] as string | undefined;
          if (val && val.length > max) {
            console.error(chalk.red(`Error: --${field} exceeds ${max} character limit (got ${val.length}). One finding per report — keep it focused.`));
            process.exit(1);
          }
        }

        const spinner = options.quiet ? null : ora('Submitting finding...').start();

        const result = await client.submitFinding({
          agent: reporter,
          targetAgent: options.agent,
          severity,
          title: options.title,
          description: options.description,
          patch: options.patch,
          evidence: options.evidence,
        });

        if (spinner) spinner.stop();

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
            console.log(
              chalk.green('✓') +
              ` Finding submitted: ${chalk.cyan(result.event_ids[0])}`
            );
            console.log(`  ${chalk.dim('agent:')}    ${options.agent}`);
            console.log(`  ${chalk.dim('severity:')} ${formatSeverity(severity)}`);
            console.log(`  ${chalk.dim('title:')}    ${options.title}`);
            if (options.patch) {
              console.log(`  ${chalk.dim('patch:')}    ${chalk.green('included')}`);
            }
          } else {
            console.log(chalk.red('✗') + ' Finding rejected');
            if (result.errors?.length) {
              for (const err of result.errors) {
                console.log(`  ${chalk.red(err.code)}: ${err.message}`);
              }
            }
            process.exit(4);
          }
        }
      } catch (error) {
        if (options.quiet) process.exit(1);
        handleError(error);
      }
    });
}

function buildListCommand(): Command {
  return new Command('list')
    .description('List recent findings')
    .option('--since <time>', 'Start time (relative like 7d, or ISO)', '7d')
    .option('--until <time>', 'End time (relative or ISO)')
    .option('--agent <id>', 'Filter by target agent')
    .option('--severity <level>', 'Filter by severity')
    .option('--limit <n>', 'Results per page', parseIntOption, 20)
    .option('--offset <n>', 'Pagination offset', parseIntOption)
    .option('--api-key <key>', 'ClawIQ API key')
    .option('--json', 'Output as JSON')
    .option('--compact', 'Compact output')
    .option('-q, --quiet', 'Suppress output (just exit code)')
    .action(async (options) => {
      try {
        const client = buildClient(options.apiKey);
        const range = resolveTimeRange(options.since, options.until, '7d');
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
          console.log(chalk.dim('No findings found'));
          return;
        }

        if (options.compact) {
          printFindingsCompact(findings);
        } else {
          printFindingsTable(findings);
        }

        console.log(
          chalk.dim(
            `\nShowing ${findings.length} finding(s) (limit ${options.limit}, offset ${offset})`
          )
        );
        if (findings.length === options.limit) {
          console.log(chalk.dim(`Next page: --offset ${offset + options.limit}`));
        }
      } catch (error) {
        if (options.quiet) process.exit(1);
        handleError(error);
      }
    });
}

function buildShowCommand(): Command {
  return new Command('show')
    .description('Show details of a specific finding')
    .argument('<finding-id>', 'Finding ID (or prefix)')
    .option('--api-key <key>', 'ClawIQ API key')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Suppress output')
    .action(async (findingId: string, options) => {
      try {
        const client = buildClient(options.apiKey);

        // Search recent findings for the ID (or prefix match)
        const response = await client.getFindings({
          since: '90d',
          limit: 500,
        });

        const finding = response.findings.find(
          (f) => f.id === findingId || f.id.startsWith(findingId)
        );

        if (!finding) {
          if (options.quiet) process.exit(1);
          console.error(chalk.red(`Finding not found: ${findingId}`));
          console.error(chalk.dim('Try: clawiq report list --since 30d'));
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
      } catch (error) {
        if (options.quiet) process.exit(1);
        handleError(error);
      }
    });
}

// ── Main command ───────────────────────────────────────────────────

export function createReportCommand(): Command {
  const cmd = new Command('report')
    .description('Submit and query agent performance findings');

  cmd.addCommand(buildFindingCommand());
  cmd.addCommand(buildListCommand());
  cmd.addCommand(buildShowCommand());

  return cmd;
}
