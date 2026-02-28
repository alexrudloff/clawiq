"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEVERITY_COLORS = exports.TYPE_ICONS = void 0;
exports.parseIntOption = parseIntOption;
exports.handleError = handleError;
const chalk_1 = __importDefault(require("chalk"));
const commander_1 = require("commander");
exports.TYPE_ICONS = {
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
exports.SEVERITY_COLORS = {
    info: chalk_1.default.blue,
    warn: chalk_1.default.yellow,
    error: chalk_1.default.red,
};
function parseIntOption(value) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        throw new commander_1.InvalidArgumentError('must be an integer');
    }
    return parsed;
}
function handleError(error) {
    console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
}
//# sourceMappingURL=format.js.map