import chalk from 'chalk';
import { InvalidArgumentError } from 'commander';

export const TYPE_ICONS: Record<string, string> = {
  task: '●',
  delivery: '→',
  decision: '◆',
  correction: '↩',
  error: '✗',
  coordination: '⇄',
  feedback: '◀',
  health: '♥',
  note: '✎',
};

export const SEVERITY_COLORS: Record<string, typeof chalk.red> = {
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
};

export function parseIntOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new InvalidArgumentError('must be an integer');
  }
  return parsed;
}

export function handleError(error: unknown): never {
  console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
  process.exit(1);
}
