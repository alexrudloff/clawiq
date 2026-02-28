#!/usr/bin/env node

import { Command } from 'commander';
import { createEmitCommand } from './commands/emit.js';
import { createTagsCommand } from './commands/tags.js';

import { createInitCommand } from './commands/init.js';
import { createPullCommand } from './commands/pull.js';
import { createReportCommand } from './commands/report.js';
import { createUninstallCommand } from './commands/uninstall.js';
import { CLI_VERSION } from './config.js';

const program = new Command();

program
  .name('clawiq')
  .description('Automated performance reviews for your OpenClaw agent team')
  .version(CLI_VERSION);

program.addCommand(createEmitCommand());
program.addCommand(createTagsCommand());

program.addCommand(createInitCommand());
program.addCommand(createPullCommand());
program.addCommand(createReportCommand());
program.addCommand(createUninstallCommand());

program.parse();
