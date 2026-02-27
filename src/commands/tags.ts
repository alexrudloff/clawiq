import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { loadConfig, requireApiKey, getApiEndpoint } from '../config.js';
import { ClawIQClient } from '../api.js';

export function createTagsCommand(): Command {
  const cmd = new Command('tags')
    .description('List tags used in your events')
    .option('--api-key <key>', 'ClawIQ API key')
    .option('--endpoint <url>', 'ClawIQ endpoint')
    .option('--since <duration>', 'Time range (e.g., 24h, 7d, 30d)', '7d')
    .option('--limit <n>', 'Maximum tags per category', parseInt, 20)
    .option('--category <cat>', 'Filter by category: quality, action, domain')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const config = loadConfig();

      try {
        const apiKey = requireApiKey(config, options.apiKey);
        const endpoint = getApiEndpoint(config, options.endpoint);
        const client = new ClawIQClient(endpoint, apiKey);

        const tags = await client.getTags(options.since, options.limit);

        if (options.json) {
          console.log(JSON.stringify(tags, null, 2));
          return;
        }

        const showCategory = (name: string, items: typeof tags.quality_tags, color: typeof chalk.red) => {
          if (options.category && options.category !== name) return;

          console.log(color.bold(`\n${name.charAt(0).toUpperCase() + name.slice(1)} Tags`));

          if (items.length === 0) {
            console.log(chalk.dim('  No tags found'));
            return;
          }

          const table = new Table({
            head: [chalk.dim('Tag'), chalk.dim('Count'), chalk.dim('Last Used')],
            style: { head: [], border: [] },
          });

          for (const tag of items) {
            const lastUsed = new Date(tag.last_used);
            const timeAgo = formatTimeAgo(lastUsed);
            table.push([tag.tag, tag.count.toString(), timeAgo]);
          }

          console.log(table.toString());
        };

        showCategory('quality', tags.quality_tags, chalk.red);
        showCategory('action', tags.action_tags, chalk.blue);
        showCategory('domain', tags.domain_tags, chalk.green);

        if (!options.category) {
          const total = tags.quality_tags.length + tags.action_tags.length + tags.domain_tags.length;
          console.log(chalk.dim(`\n${total} unique tags found`));
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return cmd;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
