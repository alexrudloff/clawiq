import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, requireApiKey, getEndpoint } from '../config.js';
import { ClawIQClient, ClawIQEvent } from '../api.js';

// Valid event types
const EVENT_TYPES = ['task', 'output', 'correction', 'error', 'feedback', 'health', 'note'];

// Valid quality tags
const QUALITY_TAGS = ['hallucination', 'wrong-recipient', 'wrong-data', 'self-corrected', 'user-corrected', 'retry', 'fallback', 'slow', 'started'];

// Valid severities
const SEVERITIES = ['info', 'warn', 'error'];

// Valid sources
const SOURCES = ['agent', 'gateway', 'cron', 'channel', 'user'];

function validateKebabCase(value: string, name: string): void {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`${name} must be lowercase kebab-case (e.g., "my-event-name")`);
  }
}

function validateEventType(type: string): void {
  if (!EVENT_TYPES.includes(type)) {
    throw new Error(`Invalid event type "${type}". Must be one of: ${EVENT_TYPES.join(', ')}`);
  }
}

function validateSeverity(severity: string): void {
  if (!SEVERITIES.includes(severity)) {
    throw new Error(`Invalid severity "${severity}". Must be one of: ${SEVERITIES.join(', ')}`);
  }
}

function validateSource(source: string): void {
  if (!SOURCES.includes(source)) {
    throw new Error(`Invalid source "${source}". Must be one of: ${SOURCES.join(', ')}`);
  }
}

function validateQualityTags(tags: string[]): void {
  for (const tag of tags) {
    if (!QUALITY_TAGS.includes(tag)) {
      throw new Error(`Invalid quality tag "${tag}". Must be one of: ${QUALITY_TAGS.join(', ')}`);
    }
  }
}

function validateTags(tags: string[], name: string): void {
  for (const tag of tags) {
    validateKebabCase(tag, `${name} tag`);
    if (tag.length > 24) {
      throw new Error(`${name} tag "${tag}" exceeds 24 character limit`);
    }
  }
}

function parseTags(value: string): string[] {
  return value.split(',').map(t => t.trim()).filter(t => t.length > 0);
}

function parseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid JSON: ${value}`);
  }
}

export function createEmitCommand(): Command {
  const cmd = new Command('emit')
    .description('Report a semantic event to ClawIQ')
    .argument('<type>', `Event type: ${EVENT_TYPES.join(', ')}`)
    .argument('<name>', 'Event name (kebab-case, e.g., "dinner-poll")')
    .option('--api-key <key>', 'ClawIQ API key')
    .option('--endpoint <url>', 'ClawIQ endpoint')
    .option('--agent <id>', 'Agent ID')
    .option('--source <source>', `Event source: ${SOURCES.join(', ')}`, 'agent')
    .option('--severity <level>', `Severity: ${SEVERITIES.join(', ')}`, 'info')
    .option('--channel <channel>', 'Channel (e.g., imessage, telegram)')
    .option('--target <target>', 'Target recipient')
    .option('--session <id>', 'Session ID')
    .option('--quality-tags <tags>', 'Quality tags (comma-separated)', parseTags)
    .option('--action-tags <tags>', 'Action tags (comma-separated)', parseTags)
    .option('--domain-tags <tags>', 'Domain tags (comma-separated)', parseTags)
    .option('--meta <json>', 'Metadata as JSON object', parseJson)
    .option('--duration <ms>', 'Duration in milliseconds', parseInt)
    .option('--parent <id>', 'Parent event ID')
    .option('--trace <id>', 'OTEL trace ID (32 hex chars)')
    .option('-q, --quiet', 'Suppress output')
    .action(async (type: string, name: string, options) => {
      const config = loadConfig();

      try {
        // Validate inputs
        validateEventType(type);
        validateKebabCase(name, 'Event name');
        if (name.length < 3 || name.length > 50) {
          throw new Error('Event name must be 3-50 characters');
        }
        validateSeverity(options.severity);
        validateSource(options.source);

        if (options.qualityTags) {
          validateQualityTags(options.qualityTags);
        }
        if (options.actionTags) {
          validateTags(options.actionTags, 'Action');
        }
        if (options.domainTags) {
          validateTags(options.domainTags, 'Domain');
        }

        // Count total tags
        const totalTags = (options.qualityTags?.length || 0) +
                         (options.actionTags?.length || 0) +
                         (options.domainTags?.length || 0);
        if (totalTags > 5) {
          throw new Error(`Too many tags (${totalTags}). Maximum is 5 total across all categories.`);
        }

        if (options.channel) {
          validateKebabCase(options.channel, 'Channel');
        }

        if (options.trace && !/^[a-f0-9]{32}$/.test(options.trace)) {
          throw new Error('Trace ID must be 32 hexadecimal characters');
        }

        const apiKey = requireApiKey(config, options.apiKey);
        const endpoint = getEndpoint(config, options.endpoint);
        const client = new ClawIQClient(endpoint, apiKey);

        const event: ClawIQEvent = {
          type,
          name,
          source: options.source,
          severity: options.severity,
          agent_id: options.agent || config.defaultAgent,
          session_id: options.session,
          channel: options.channel,
          target: options.target,
          quality_tags: options.qualityTags,
          action_tags: options.actionTags,
          domain_tags: options.domainTags,
          meta: options.meta,
          duration_ms: options.duration,
          parent_id: options.parent,
          trace_id: options.trace,
        };

        // Remove undefined fields
        Object.keys(event).forEach(key => {
          if (event[key as keyof ClawIQEvent] === undefined) {
            delete event[key as keyof ClawIQEvent];
          }
        });

        const spinner = options.quiet ? null : ora('Sending event...').start();

        const result = await client.emit([event]);

        if (spinner) spinner.stop();

        if (!options.quiet) {
          if (result.accepted > 0) {
            console.log(chalk.green('✓') + ` Event sent: ${chalk.cyan(result.event_ids[0])}`);
            console.log(`  ${chalk.dim('type:')} ${type}`);
            console.log(`  ${chalk.dim('name:')} ${name}`);
            if (options.qualityTags?.length) {
              console.log(`  ${chalk.dim('quality:')} ${options.qualityTags.join(', ')}`);
            }
            if (options.actionTags?.length) {
              console.log(`  ${chalk.dim('action:')} ${options.actionTags.join(', ')}`);
            }
            if (options.domainTags?.length) {
              console.log(`  ${chalk.dim('domain:')} ${options.domainTags.join(', ')}`);
            }
          } else {
            console.log(chalk.red('✗') + ' Event rejected');
            if (result.errors?.length) {
              for (const err of result.errors) {
                console.log(`  ${chalk.red(err.code)}: ${err.message}`);
              }
            }
            process.exit(4);
          }
        }
      } catch (error) {
        if (!options.quiet) {
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        }
        process.exit(1);
      }
    });

  return cmd;
}
