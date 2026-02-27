import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { loadConfig, requireApiKey, getApiEndpoint } from '../config.js';
import { ClawIQClient, SemanticEvent } from '../api.js';
import { resolveTimeRange } from '../time.js';

const SEVERITY_COLORS: Record<string, typeof chalk.red> = {
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
};

const TYPE_ICONS: Record<string, string> = {
  task: '●',
  delivery: '→',
  decision: '◆',
  correction: '↩',
  error: '✗',
  coordination: '⇄',
  feedback: '◀',
  health: '♥',
};

function parseIntOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }
  return parsed;
}

export function createQueryCommand(): Command {
  const cmd = new Command('query')
    .description('Query semantic events')
    .option('--api-key <key>', 'ClawIQ API key')
    .option('--endpoint <url>', 'ClawIQ endpoint')
    .option('--since <duration>', 'Start time (e.g., 24h, 7d, 30d)', '24h')
    .option('--until <time>', 'End time (ISO or relative)')
    .option('--type <type>', 'Filter by event type')
    .option('--source <source>', 'Filter by source')
    .option('--severity <level>', 'Filter by severity')
    .option('--agent <id>', 'Filter by agent')
    .option('--name <pattern>', 'Filter by event name')
    .option('--limit <n>', 'Maximum events', parseIntOption, 50)
    .option('--offset <n>', 'Skip events', parseIntOption, 0)
    .option('--page <n>', 'Page number (1-based)', parseIntOption)
    .option('--json', 'Output as JSON')
    .option('--compact', 'Compact output (one line per event)')
    .action(async (options) => {
      const config = loadConfig();

      try {
        const apiKey = requireApiKey(config, options.apiKey);
        const endpoint = getApiEndpoint(config, options.endpoint);
        const client = new ClawIQClient(endpoint, apiKey);
        const limit = options.limit > 0 ? options.limit : 50;
        const offset = options.offset !== undefined && options.offset >= 0
          ? options.offset
          : (options.page && options.page > 0 ? (options.page - 1) * limit : 0);
        const range = resolveTimeRange(options.since, options.until, '24h');

        const result = await client.query({
          since: range.start,
          until: range.end,
          type: options.type,
          source: options.source,
          severity: options.severity,
          agent: options.agent,
          name: options.name,
          limit,
          offset,
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (result.events.length === 0) {
          console.log(chalk.dim('No events found'));
          return;
        }

        if (options.compact) {
          for (const event of result.events) {
            printCompactEvent(event);
          }
        } else {
          printEventTable(result.events);
        }

        const page = Math.floor(offset / limit) + 1;
        console.log(
          chalk.dim(`\nShowing ${result.events.length} of ${result.total} events (page ${page}, limit ${limit}, offset ${offset})`)
        );
        if (offset + result.events.length < result.total) {
          console.log(chalk.dim(`Next page: --offset ${offset + limit}`));
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return cmd;
}

function printCompactEvent(event: SemanticEvent): void {
  const icon = TYPE_ICONS[event.type] || '•';
  const color = SEVERITY_COLORS[event.severity] || chalk.white;
  const time = new Date(event.timestamp).toLocaleTimeString();

  const tags = [
    ...(event.quality_tags || []).map(t => chalk.red(t)),
    ...(event.action_tags || []).map(t => chalk.blue(t)),
    ...(event.domain_tags || []).map(t => chalk.green(t)),
  ];

  const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
  const agent = event.agent_id ? chalk.dim(` (${event.agent_id})`) : '';

  console.log(`${chalk.dim(time)} ${color(icon)} ${event.type}:${chalk.cyan(event.name)}${tagStr}${agent}`);
}

function printEventTable(events: SemanticEvent[]): void {
  const table = new Table({
    head: [
      chalk.dim('Time'),
      chalk.dim('Type'),
      chalk.dim('Name'),
      chalk.dim('Severity'),
      chalk.dim('Agent'),
      chalk.dim('Tags'),
    ],
    style: { head: [], border: [] },
    wordWrap: true,
  });

  for (const event of events) {
    const time = new Date(event.timestamp).toLocaleString();
    const icon = TYPE_ICONS[event.type] || '•';
    const severityColor = SEVERITY_COLORS[event.severity] || chalk.white;

    const tags = [
      ...(event.quality_tags || []),
      ...(event.action_tags || []),
      ...(event.domain_tags || []),
    ].join(', ');

    table.push([
      chalk.dim(time),
      `${icon} ${event.type}`,
      chalk.cyan(event.name),
      severityColor(event.severity),
      event.agent_id || '-',
      tags || '-',
    ]);
  }

  console.log(table.toString());
}
