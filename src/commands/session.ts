import { Command } from 'commander';
import { minifySessionFile } from '../utils/minify-session.js';
import { handleError } from '../format.js';

export function createSessionCommand(): Command {
  const session = new Command('session')
    .description('Read session transcripts (automatically minified for analysis)')
    .argument('<path>', 'Path to .jsonl session file')
    .action(async (filePath: string) => {
      try {
        const result = await minifySessionFile(filePath);
        process.stdout.write(result.minified);
      } catch (err) {
        handleError(err);
      }
    });

  return session;
}
