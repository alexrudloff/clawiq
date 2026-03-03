import { Command } from 'commander';
import chalk from 'chalk';
import { minifySessionFile } from '../utils/minify-session.js';
import { handleError } from '../format.js';

export function createSessionCommand(): Command {
  const session = new Command('session').description('Session transcript tools');

  session
    .command('minify')
    .description('Minify a session JSONL file for LLM analysis')
    .argument('<path>', 'Path to .jsonl session file')
    .option('--dry-run', 'Show before/after stats without outputting content')
    .action(async (filePath: string, opts: { dryRun?: boolean }) => {
      try {
        const result = await minifySessionFile(filePath);
        const s = result.stats;

        if (opts.dryRun) {
          console.error(chalk.bold('Session minification (dry run)'));
          console.error(chalk.dim('─'.repeat(48)));
          console.error(`  File:         ${filePath}`);
          console.error(`  Lines:        ${s.originalLines} → ${s.minifiedLines}`);
          console.error(
            `  Bytes:        ${fmtBytes(s.originalBytes)} → ${fmtBytes(s.minifiedBytes)} (${chalk.green(`-${s.reductionPct}%`)})`,
          );
          console.error(
            `  Est. tokens:  ${fmtNum(s.estimatedOriginalTokens)} → ${fmtNum(s.estimatedMinifiedTokens)} (${chalk.green(`-${s.tokenReductionPct}%`)})`,
          );
        } else {
          // Stats to stderr so stdout is clean minified content
          console.error(
            chalk.dim(
              `[minify] ${fmtBytes(s.originalBytes)} → ${fmtBytes(s.minifiedBytes)} (-${s.reductionPct}%) | ~${fmtNum(s.estimatedOriginalTokens)} → ~${fmtNum(s.estimatedMinifiedTokens)} tokens (-${s.tokenReductionPct}%)`,
            ),
          );
          process.stdout.write(result.minified);
        }
      } catch (err) {
        handleError(err);
      }
    });

  return session;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}
