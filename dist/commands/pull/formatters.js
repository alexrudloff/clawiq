"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.printTracesCompact = printTracesCompact;
exports.printTracesTable = printTracesTable;
exports.printErrorsCompact = printErrorsCompact;
exports.printErrorsTable = printErrorsTable;
exports.printSpanEventsCompact = printSpanEventsCompact;
exports.printSpanEventsTable = printSpanEventsTable;
exports.printSemanticCompact = printSemanticCompact;
exports.printSemanticTable = printSemanticTable;
exports.printMarkersCompact = printMarkersCompact;
exports.printMarkersTable = printMarkersTable;
exports.printTimelineCompact = printTimelineCompact;
exports.printTimelineTable = printTimelineTable;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const format_js_1 = require("../../format.js");
const filters_js_1 = require("./filters.js");
function printTracesCompact(items) {
    for (const trace of items) {
        const time = new Date(trace.start_time).toLocaleTimeString();
        const status = (0, filters_js_1.simplifyStatus)(trace.status);
        const statusText = status === 'error' ? chalk_1.default.red(status) : chalk_1.default.green(status);
        const model = trace.model || '-';
        console.log(`${chalk_1.default.dim(time)} ${statusText} ${trace.trace_id} ${chalk_1.default.cyan(model)} ${chalk_1.default.dim(trace.channel || '-')}`);
    }
}
function printTracesTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Status'),
            chalk_1.default.dim('Trace'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Channel'),
            chalk_1.default.dim('Model'),
            chalk_1.default.dim('Tokens'),
            chalk_1.default.dim('Duration'),
        ],
        style: { head: [], border: [] },
    });
    for (const trace of items) {
        const status = (0, filters_js_1.simplifyStatus)(trace.status);
        const statusText = status === 'error' ? chalk_1.default.red(status) : chalk_1.default.green(status);
        const agent = trace.agent_id || (trace.session_id ? (0, filters_js_1.getAgentFromSession)(trace.session_id) : '-');
        table.push([
            chalk_1.default.dim(new Date(trace.start_time).toLocaleString()),
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
function printErrorsCompact(items) {
    for (const error of items) {
        const time = new Date(error.timestamp).toLocaleTimeString();
        console.log(`${chalk_1.default.dim(time)} ${chalk_1.default.red(error.error_type)} ${error.trace_id} ${chalk_1.default.dim(error.channel || '-')}`);
    }
}
function printErrorsTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Type'),
            chalk_1.default.dim('Trace'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Channel'),
            chalk_1.default.dim('Message'),
        ],
        style: { head: [], border: [] },
        wordWrap: true,
    });
    for (const error of items) {
        const agent = error.agent_id || (error.session_id ? (0, filters_js_1.getAgentFromSession)(error.session_id) : '-');
        table.push([
            chalk_1.default.dim(new Date(error.timestamp).toLocaleString()),
            chalk_1.default.red(error.error_type),
            error.trace_id,
            agent,
            error.channel || '-',
            error.message || '-',
        ]);
    }
    console.log(table.toString());
}
function printSpanEventsCompact(items) {
    for (const event of items) {
        const time = new Date(event.start_time).toLocaleTimeString();
        const status = (0, filters_js_1.simplifyStatus)(event.status_code);
        const statusText = status === 'error' ? chalk_1.default.red(status) : chalk_1.default.green(status);
        const agent = event.agent_id || (0, filters_js_1.getAgentFromSession)(event.session_id);
        console.log(`${chalk_1.default.dim(time)} ${statusText} ${chalk_1.default.cyan(event.name)} ${chalk_1.default.dim(agent)} ${chalk_1.default.dim(event.channel || '-')}`);
    }
}
function printSpanEventsTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Status'),
            chalk_1.default.dim('Name'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Channel'),
            chalk_1.default.dim('Model'),
            chalk_1.default.dim('Outcome'),
            chalk_1.default.dim('Duration'),
        ],
        style: { head: [], border: [] },
        wordWrap: true,
    });
    for (const event of items) {
        const status = (0, filters_js_1.simplifyStatus)(event.status_code);
        const statusText = status === 'error' ? chalk_1.default.red(status) : chalk_1.default.green(status);
        const agent = event.agent_id || (0, filters_js_1.getAgentFromSession)(event.session_id);
        table.push([
            chalk_1.default.dim(new Date(event.start_time).toLocaleString()),
            statusText,
            chalk_1.default.cyan(event.name),
            agent,
            event.channel || '-',
            event.model || '-',
            event.outcome || '-',
            `${Math.round(event.duration_ms)}ms`,
        ]);
    }
    console.log(table.toString());
}
function printSemanticCompact(items) {
    for (const event of items) {
        const icon = format_js_1.TYPE_ICONS[event.type] || '•';
        const severity = event.severity === 'error'
            ? chalk_1.default.red(event.severity)
            : event.severity === 'warn'
                ? chalk_1.default.yellow(event.severity)
                : chalk_1.default.blue(event.severity);
        const time = new Date(event.timestamp).toLocaleTimeString();
        const agent = event.agent_id ? chalk_1.default.dim(` (${event.agent_id})`) : '';
        console.log(`${chalk_1.default.dim(time)} ${icon} ${severity} ${chalk_1.default.cyan(event.name)}${agent}`);
    }
}
function printSemanticTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Type'),
            chalk_1.default.dim('Name'),
            chalk_1.default.dim('Severity'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Channel'),
        ],
        style: { head: [], border: [] },
        wordWrap: true,
    });
    for (const event of items) {
        const icon = format_js_1.TYPE_ICONS[event.type] || '•';
        const severity = event.severity === 'error'
            ? chalk_1.default.red(event.severity)
            : event.severity === 'warn'
                ? chalk_1.default.yellow(event.severity)
                : chalk_1.default.blue(event.severity);
        table.push([
            chalk_1.default.dim(new Date(event.timestamp).toLocaleString()),
            `${icon} ${event.type}`,
            chalk_1.default.cyan(event.name),
            severity,
            event.agent_id || '-',
            event.channel || '-',
        ]);
    }
    console.log(table.toString());
}
function printMarkersCompact(items) {
    for (const marker of items) {
        const time = new Date(marker.timestamp).toLocaleTimeString();
        const severity = marker.severity === 'error'
            ? chalk_1.default.red(marker.severity)
            : marker.severity === 'warn'
                ? chalk_1.default.yellow(marker.severity)
                : chalk_1.default.blue(marker.severity);
        console.log(`${chalk_1.default.dim(time)} ${severity} ${marker.type}:${chalk_1.default.cyan(marker.name)} x${marker.count}`);
    }
}
function printMarkersTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Type'),
            chalk_1.default.dim('Name'),
            chalk_1.default.dim('Severity'),
            chalk_1.default.dim('Count'),
        ],
        style: { head: [], border: [] },
    });
    for (const marker of items) {
        const severity = marker.severity === 'error'
            ? chalk_1.default.red(marker.severity)
            : marker.severity === 'warn'
                ? chalk_1.default.yellow(marker.severity)
                : chalk_1.default.blue(marker.severity);
        table.push([
            chalk_1.default.dim(new Date(marker.timestamp).toLocaleString()),
            marker.type,
            chalk_1.default.cyan(marker.name),
            severity,
            marker.count.toString(),
        ]);
    }
    console.log(table.toString());
}
function kindLabel(kind) {
    if (kind === 'error') {
        return chalk_1.default.red('error');
    }
    if (kind === 'marker') {
        return chalk_1.default.yellow('marker');
    }
    return chalk_1.default.blue('trace');
}
function printTimelineCompact(items) {
    for (const item of items) {
        const time = new Date(item.timestamp).toLocaleTimeString();
        const channel = item.channel ? chalk_1.default.dim(item.channel) : chalk_1.default.dim('-');
        console.log(`${chalk_1.default.dim(time)} ${kindLabel(item.kind)} ${item.summary} ${channel}`);
    }
}
function printTimelineTable(items) {
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.dim('Time'),
            chalk_1.default.dim('Kind'),
            chalk_1.default.dim('Summary'),
            chalk_1.default.dim('Agent'),
            chalk_1.default.dim('Channel'),
            chalk_1.default.dim('Model'),
            chalk_1.default.dim('Trace'),
        ],
        style: { head: [], border: [] },
        wordWrap: true,
    });
    for (const item of items) {
        table.push([
            chalk_1.default.dim(new Date(item.timestamp).toLocaleString()),
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
//# sourceMappingURL=formatters.js.map