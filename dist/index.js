#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const emit_js_1 = require("./commands/emit.js");
const tags_js_1 = require("./commands/tags.js");
const init_js_1 = require("./commands/init.js");
const pull_js_1 = require("./commands/pull.js");
const report_js_1 = require("./commands/report.js");
const uninstall_js_1 = require("./commands/uninstall.js");
const update_js_1 = require("./commands/update.js");
const config_js_1 = require("./config.js");
const program = new commander_1.Command();
program
    .name('clawiq')
    .description('Automated performance reviews for your OpenClaw agent team')
    .version(config_js_1.CLI_VERSION);
program.addCommand((0, emit_js_1.createEmitCommand)());
program.addCommand((0, tags_js_1.createTagsCommand)());
program.addCommand((0, init_js_1.createInitCommand)());
program.addCommand((0, pull_js_1.createPullCommand)());
program.addCommand((0, report_js_1.createReportCommand)());
program.addCommand((0, uninstall_js_1.createUninstallCommand)());
program.addCommand((0, update_js_1.createUpdateCommand)());
program.parse();
//# sourceMappingURL=index.js.map