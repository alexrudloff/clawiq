#!/usr/bin/env node

import { Command } from 'commander';
import { createEmitCommand } from './commands/emit.js';
import { createTagsCommand } from './commands/tags.js';

import { createInitCommand } from './commands/init.js';
import { createPullCommand } from './commands/pull.js';
import { createReportCommand } from './commands/report.js';

const program = new Command();

program
  .name('clawiq')
  .description('Automated performance reviews for your OpenClaw agent team')
  .version('0.1.0');

program.addCommand(createEmitCommand());
program.addCommand(createTagsCommand());

program.addCommand(createInitCommand());
program.addCommand(createPullCommand());
program.addCommand(createReportCommand());

program.parse();
