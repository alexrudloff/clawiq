import chalk from 'chalk';
import Table from 'cli-table3';
import { ErrorRecord, SemanticEvent, SpanEvent, TraceRecord } from '../../api.js';
import { TYPE_ICONS } from '../../format.js';
import { getAgentFromSession, simplifyStatus } from './filters.js';
import { Marker, TimelineItem, TimelineKind } from './types.js';

export function printTracesCompact(items: TraceRecord[]): void {
  for (const trace of items) {
    const time = new Date(trace.start_time).toLocaleTimeString();
    const status = simplifyStatus(trace.status);
    const statusText = status === 'error' ? chalk.red(status) : chalk.green(status);
    const model = trace.model || '-';
    console.log(
      `${chalk.dim(time)} ${statusText} ${trace.trace_id} ${chalk.cyan(model)} ${chalk.dim(trace.channel || '-')}`
    );
  }
}

export function printTracesTable(items: TraceRecord[]): void {
  const table = new Table({
    head: [
      chalk.dim('Time'),
      chalk.dim('Status'),
      chalk.dim('Trace'),
      chalk.dim('Agent'),
      chalk.dim('Channel'),
      chalk.dim('Model'),
      chalk.dim('Tokens'),
      chalk.dim('Duration'),
    ],
    style: { head: [], border: [] },
  });

  for (const trace of items) {
    const status = simplifyStatus(trace.status);
    const statusText = status === 'error' ? chalk.red(status) : chalk.green(status);
    const agent = trace.agent_id || (trace.session_id ? getAgentFromSession(trace.session_id) : '-');
    table.push([
      chalk.dim(new Date(trace.start_time).toLocaleString()),
      statusText,
      trace.trace_id,
      agent,
      trace.channel || '-',
      trace.model || '-',
      `${trace.tokens_input + trace.tokens_output}`,
      `${Math.round(trace.duration_ms)}ms`,
    ]);
  }

  console.log(table.toString());
}

export function printErrorsCompact(items: ErrorRecord[]): void {
  for (const error of items) {
    const time = new Date(error.timestamp).toLocaleTimeString();
    console.log(
      `${chalk.dim(time)} ${chalk.red(error.error_type)} ${error.trace_id} ${chalk.dim(error.channel || '-')}`
    );
  }
}

export function printErrorsTable(items: ErrorRecord[]): void {
  const table = new Table({
    head: [
      chalk.dim('Time'),
      chalk.dim('Type'),
      chalk.dim('Trace'),
      chalk.dim('Agent'),
      chalk.dim('Channel'),
      chalk.dim('Message'),
    ],
    style: { head: [], border: [] },
    wordWrap: true,
  });

  for (const error of items) {
    const agent = error.agent_id || (error.session_id ? getAgentFromSession(error.session_id) : '-');
    table.push([
      chalk.dim(new Date(error.timestamp).toLocaleString()),
      chalk.red(error.error_type),
      error.trace_id,
      agent,
      error.channel || '-',
      error.message || '-',
    ]);
  }

  console.log(table.toString());
}

export function printSpanEventsCompact(items: SpanEvent[]): void {
  for (const event of items) {
    const time = new Date(event.start_time).toLocaleTimeString();
    const status = simplifyStatus(event.status_code);
    const statusText = status === 'error' ? chalk.red(status) : chalk.green(status);
    const agent = event.agent_id || getAgentFromSession(event.session_id);
    console.log(
      `${chalk.dim(time)} ${statusText} ${chalk.cyan(event.name)} ${chalk.dim(agent)} ${chalk.dim(event.channel || '-')}`
    );
  }
}

export function printSpanEventsTable(items: SpanEvent[]): void {
  const table = new Table({
    head: [
      chalk.dim('Time'),
      chalk.dim('Status'),
      chalk.dim('Name'),
      chalk.dim('Agent'),
      chalk.dim('Channel'),
      chalk.dim('Model'),
      chalk.dim('Outcome'),
      chalk.dim('Duration'),
    ],
    style: { head: [], border: [] },
    wordWrap: true,
  });

  for (const event of items) {
    const status = simplifyStatus(event.status_code);
    const statusText = status === 'error' ? chalk.red(status) : chalk.green(status);
    const agent = event.agent_id || getAgentFromSession(event.session_id);
    table.push([
      chalk.dim(new Date(event.start_time).toLocaleString()),
      statusText,
      chalk.cyan(event.name),
      agent,
      event.channel || '-',
      event.model || '-',
      event.outcome || '-',
      `${Math.round(event.duration_ms)}ms`,
    ]);
  }

  console.log(table.toString());
}

export function printSemanticCompact(items: SemanticEvent[]): void {
  for (const event of items) {
    const icon = TYPE_ICONS[event.type] || '•';
    const severity =
      event.severity === 'error'
        ? chalk.red(event.severity)
        : event.severity === 'warn'
        ? chalk.yellow(event.severity)
        : chalk.blue(event.severity);
    const time = new Date(event.timestamp).toLocaleTimeString();
    const agent = event.agent_id ? chalk.dim(` (${event.agent_id})`) : '';
    console.log(`${chalk.dim(time)} ${icon} ${severity} ${chalk.cyan(event.name)}${agent}`);
  }
}

export function printSemanticTable(items: SemanticEvent[]): void {
  const table = new Table({
    head: [
      chalk.dim('Time'),
      chalk.dim('Type'),
      chalk.dim('Name'),
      chalk.dim('Severity'),
      chalk.dim('Agent'),
      chalk.dim('Channel'),
    ],
    style: { head: [], border: [] },
    wordWrap: true,
  });

  for (const event of items) {
    const icon = TYPE_ICONS[event.type] || '•';
    const severity =
      event.severity === 'error'
        ? chalk.red(event.severity)
        : event.severity === 'warn'
        ? chalk.yellow(event.severity)
        : chalk.blue(event.severity);
    table.push([
      chalk.dim(new Date(event.timestamp).toLocaleString()),
      `${icon} ${event.type}`,
      chalk.cyan(event.name),
      severity,
      event.agent_id || '-',
      event.channel || '-',
    ]);
  }

  console.log(table.toString());
}

export function printMarkersCompact(items: Marker[]): void {
  for (const marker of items) {
    const time = new Date(marker.timestamp).toLocaleTimeString();
    const severity =
      marker.severity === 'error'
        ? chalk.red(marker.severity)
        : marker.severity === 'warn'
        ? chalk.yellow(marker.severity)
        : chalk.blue(marker.severity);
    console.log(
      `${chalk.dim(time)} ${severity} ${marker.type}:${chalk.cyan(marker.name)} x${marker.count}`
    );
  }
}

export function printMarkersTable(items: Marker[]): void {
  const table = new Table({
    head: [
      chalk.dim('Time'),
      chalk.dim('Type'),
      chalk.dim('Name'),
      chalk.dim('Severity'),
      chalk.dim('Count'),
    ],
    style: { head: [], border: [] },
  });

  for (const marker of items) {
    const severity =
      marker.severity === 'error'
        ? chalk.red(marker.severity)
        : marker.severity === 'warn'
        ? chalk.yellow(marker.severity)
        : chalk.blue(marker.severity);

    table.push([
      chalk.dim(new Date(marker.timestamp).toLocaleString()),
      marker.type,
      chalk.cyan(marker.name),
      severity,
      marker.count.toString(),
    ]);
  }

  console.log(table.toString());
}

function kindLabel(kind: TimelineKind): string {
  if (kind === 'error') {
    return chalk.red('error');
  }
  if (kind === 'marker') {
    return chalk.yellow('marker');
  }
  return chalk.blue('trace');
}

export function printTimelineCompact(items: TimelineItem[]): void {
  for (const item of items) {
    const time = new Date(item.timestamp).toLocaleTimeString();
    const channel = item.channel ? chalk.dim(item.channel) : chalk.dim('-');
    console.log(`${chalk.dim(time)} ${kindLabel(item.kind)} ${item.summary} ${channel}`);
  }
}

export function printTimelineTable(items: TimelineItem[]): void {
  const table = new Table({
    head: [
      chalk.dim('Time'),
      chalk.dim('Kind'),
      chalk.dim('Summary'),
      chalk.dim('Agent'),
      chalk.dim('Channel'),
      chalk.dim('Model'),
      chalk.dim('Trace'),
    ],
    style: { head: [], border: [] },
    wordWrap: true,
  });

  for (const item of items) {
    table.push([
      chalk.dim(new Date(item.timestamp).toLocaleString()),
      kindLabel(item.kind),
      item.summary,
      item.agent || '-',
      item.channel || '-',
      item.model || '-',
      item.trace_id || '-',
    ]);
  }

  console.log(table.toString());
}
