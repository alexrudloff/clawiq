import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { Issue, IssueImpact, IssueStateRecord, LennyIssueDiscussion } from '../api.js';
import { buildClient } from '../client.js';
import { resolveTimeRange } from '../time.js';
import { loadConfig } from '../config.js';
import { parseIntOption, handleError } from '../format.js';

// ── Constants ──────────────────────────────────────────────────────

const ISSUE_IMPACTS: IssueImpact[] = ['low', 'medium', 'high', 'critical'];

const IMPACT_DISPLAY: Record<IssueImpact, (s: string) => string> = {
  low: (s) => chalk.dim(s),
  medium: (s) => chalk.yellow(s),
  high: (s) => chalk.red(s),
  critical: (s) => chalk.bgRed.white(` ${s} `),
};

const IMPACT_ICONS: Record<IssueImpact, string> = {
  low: '○',
  medium: '◐',
  high: '●',
  critical: '◉',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Helpers ────────────────────────────────────────────────────────

function validateImpact(value: string): IssueImpact {
  if (!ISSUE_IMPACTS.includes(value as IssueImpact)) {
    throw new Error(
      `Invalid impact "${value}". Must be one of: ${ISSUE_IMPACTS.join(', ')}`
    );
  }
  return value as IssueImpact;
}

function formatImpact(impact: IssueImpact): string {
  const icon = IMPACT_ICONS[impact] || '•';
  const colorize = IMPACT_DISPLAY[impact] || ((s: string) => s);
  return `${icon} ${colorize(impact)}`;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('API error (404)');
}

function formatIssueStatus(state: IssueStateRecord | null): string {
  if (!state) {
    return chalk.green('open');
  }

  const normalized = (state.status || '').toLowerCase();
  if (normalized === 'resolved') return chalk.green('resolved');
  if (normalized === 'dismissed') return chalk.dim('dismissed');
  if (normalized === 'not_helpful') return chalk.yellow('not_helpful');
  return chalk.green(normalized || 'open');
}

function printIssueDetail(
  issue: Issue,
  context?: {
    state: IssueStateRecord | null;
    discussion: LennyIssueDiscussion | null;
  },
): void {
  const state = context?.state ?? null;
  const discussion = context?.discussion ?? null;

  console.log('');
  console.log(chalk.bold(`Issue: ${issue.title}`));
  console.log(chalk.dim('─'.repeat(60)));
  console.log(`  ${chalk.dim('ID:')}       ${issue.id}`);
  console.log(`  ${chalk.dim('Time:')}     ${new Date(issue.timestamp).toLocaleString()}`);
  console.log(`  ${chalk.dim('Impact:')}   ${formatImpact(issue.impact)}`);
  console.log(`  ${chalk.dim('Status:')}   ${formatIssueStatus(state)}`);
  if (state?.last_signal) {
    console.log(`  ${chalk.dim('Signal:')}   ${state.last_signal}`);
  }
  console.log(`  ${chalk.dim('Agent:')}    ${issue.target_agent}`);
  if (issue.agent_id) {
    console.log(`  ${chalk.dim('Reporter:')} ${issue.agent_id}`);
  }

  if (issue.description) {
    console.log('');
    console.log(chalk.dim('  Description:'));
    for (const line of issue.description.split('\n')) {
      console.log(`    ${line}`);
    }
  }

  if (issue.patch) {
    console.log('');
    console.log(chalk.dim('  Suggested Patch:'));
    console.log(chalk.green('  ┌─'));
    for (const line of issue.patch.split('\n')) {
      console.log(chalk.green(`  │ ${line}`));
    }
    console.log(chalk.green('  └─'));
  }

  if (issue.evidence) {
    console.log('');
    console.log(chalk.dim('  Evidence:'));
    for (const line of issue.evidence.split('\n')) {
      console.log(`    ${chalk.dim(line)}`);
    }
  }

  console.log('');
  console.log(chalk.dim('  Discussion Transcript:'));
  if (!discussion?.conversation || discussion.messages.length === 0) {
    console.log(chalk.dim('    (no discussion history yet)'));
  } else {
    console.log(`    ${chalk.dim('Thread:')} ${discussion.conversation.title}`);
    for (const message of discussion.messages) {
      const ts = new Date(message.created_at).toLocaleString();
      const role = message.role === 'assistant' ? 'Lenny' : 'User';
      const roleColor = message.role === 'assistant' ? chalk.magenta : chalk.cyan;
      console.log(`    ${chalk.dim(`[${ts}]`)} ${roleColor(role)}${chalk.dim(':')}`);
      for (const line of (message.content || '').split('\n')) {
        console.log(`      ${line}`);
      }
      if (message.status === 'failed' && message.error_message) {
        console.log(`      ${chalk.red(`(failed: ${message.error_message})`)}`);
      }
    }
  }

  console.log('');
}

function printIssuesCompact(issues: Issue[]): void {
  for (const issue of issues) {
    const time = new Date(issue.timestamp).toLocaleTimeString();
    const impact = formatImpact(issue.impact);
    const agent = chalk.dim(issue.target_agent);
    console.log(`${chalk.dim(time)} ${impact} ${agent} ${issue.title}`);
  }
}

function printIssuesTable(issues: Issue[]): void {
  const table = new Table({
    head: [
      chalk.dim('Time'),
      chalk.dim('Impact'),
      chalk.dim('Agent'),
      chalk.dim('Title'),
      chalk.dim('ID'),
    ],
    style: { head: [], border: [] },
    wordWrap: true,
    colWidths: [22, 12, 14, 40, 28],
  });

  for (const issue of issues) {
    table.push([
      chalk.dim(new Date(issue.timestamp).toLocaleString()),
      formatImpact(issue.impact),
      issue.target_agent,
      issue.title,
      chalk.dim(issue.id.slice(0, 24) + '…'),
    ]);
  }

  console.log(table.toString());
}

// ── Subcommands ────────────────────────────────────────────────────

function buildIssueCommand(): Command {
  return new Command('issue')
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
            console.error(chalk.red(`Error: --${field} exceeds ${max} character limit (got ${val.length}). One issue per report — keep it focused.`));
            process.exit(1);
          }
        }

        const spinner = options.quiet ? null : ora('Submitting issue...').start();

        const result = await client.submitIssue({
          agent: reporter,
          targetAgent: options.agent,
          impact,
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
            console.log(
              chalk.green('✓') +
              ` Issue submitted: ${chalk.cyan(result.event_ids[0])}`
            );
            console.log(`  ${chalk.dim('agent:')}    ${options.agent}`);
            console.log(`  ${chalk.dim('impact:')}   ${formatImpact(impact)}`);
            console.log(`  ${chalk.dim('title:')}    ${options.title}`);
            if (options.patch) {
              console.log(`  ${chalk.dim('patch:')}    ${chalk.green('included')}`);
            }
          } else {
            console.log(chalk.red('✗') + ' Issue rejected');
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
    .description('List recent issues')
    .option('--since <time>', 'Start time (relative like 7d, or ISO)', '7d')
    .option('--until <time>', 'End time (relative or ISO)')
    .option('--agent <id>', 'Filter by target agent')
    .option('--impact <level>', 'Filter by impact')
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
          console.log(chalk.dim('No issues found'));
          return;
        }

        if (options.compact) {
          printIssuesCompact(issues);
        } else {
          printIssuesTable(issues);
        }

        console.log(
          chalk.dim(
            `\nShowing ${issues.length} issue(s) (limit ${options.limit}, offset ${offset})`
          )
        );
        if (issues.length === options.limit) {
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
    .description('Show details of a specific issue')
    .argument('<issue-id>', 'Issue ID (or prefix)')
    .option('--api-key <key>', 'ClawIQ API key')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Suppress output')
    .action(async (issueId: string, options) => {
      try {
        const client = buildClient(options.apiKey);
        const normalizedID = issueId.trim();
        let issue: Issue | undefined;

        if (UUID_RE.test(normalizedID)) {
          try {
            issue = await client.getIssueByID(normalizedID);
          } catch (error) {
            if (!isNotFoundError(error)) {
              throw error;
            }
          }
        } else {
          // Prefix lookup fallback for convenience.
          const response = await client.getIssues({
            since: '365d',
            limit: 5000,
          });
          issue = response.issues.find((entry) => entry.id.startsWith(normalizedID));
        }

        if (!issue) {
          if (options.quiet) process.exit(1);
          console.error(chalk.red(`Issue not found: ${issueId}`));
          if (!UUID_RE.test(normalizedID)) {
            console.error(chalk.dim('Try a full UUID for exact lookup.'));
          } else {
            console.error(chalk.dim('Try: clawiq report list --since 30d'));
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
      } catch (error) {
        if (options.quiet) process.exit(1);
        handleError(error);
      }
    });
}

// ── Main command ───────────────────────────────────────────────────

export function createReportCommand(): Command {
  const cmd = new Command('report')
    .description('Submit and query agent performance issues');

  cmd.addCommand(buildIssueCommand());
  cmd.addCommand(buildListCommand());
  cmd.addCommand(buildShowCommand());

  return cmd;
}
