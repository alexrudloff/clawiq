#!/usr/bin/env node

import { Command } from 'commander';
import { createEmitCommand } from './commands/emit.js';
import { createTagsCommand } from './commands/tags.js';
import { createQueryCommand } from './commands/query.js';
import { createInitCommand } from './commands/init.js';
import { createPullCommand } from './commands/pull.js';

const program = new Command();

program
  .name('clawiq')
  .description('CLI for reporting semantic events to ClawIQ')
  .version('0.1.0');

program.addCommand(createEmitCommand());
program.addCommand(createTagsCommand());
program.addCommand(createQueryCommand());
program.addCommand(createInitCommand());
program.addCommand(createPullCommand());

program.parse();
