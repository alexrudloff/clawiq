"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePageInfo = computePageInfo;
exports.printPaginationFooter = printPaginationFooter;
const chalk_1 = __importDefault(require("chalk"));
function validatePositiveInt(value, name) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`--${name} must be a positive integer`);
    }
    return value;
}
function validateNonNegativeInt(value, name) {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`--${name} must be a non-negative integer`);
    }
    return value;
}
function computePageInfo(options, defaultLimit = 50) {
    const limit = validatePositiveInt(options.limit ?? defaultLimit, 'limit');
    const offsetFromPage = options.page !== undefined
        ? (validatePositiveInt(options.page, 'page') - 1) * limit
        : 0;
    const offset = validateNonNegativeInt(options.offset ?? offsetFromPage, 'offset');
    return {
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
    };
}
function printPaginationFooter(label, itemCount, page, total) {
    if (total !== undefined) {
        console.log(chalk_1.default.dim(`\nShowing ${itemCount} of ${total} ${label} (page ${page.page}, limit ${page.limit}, offset ${page.offset})`));
        if (page.offset + itemCount < total) {
            console.log(chalk_1.default.dim(`Next page: --offset ${page.offset + page.limit}`));
        }
        return;
    }
    console.log(chalk_1.default.dim(`\nShowing ${itemCount} ${label} (page ${page.page}, limit ${page.limit}, offset ${page.offset})`));
    if (itemCount === page.limit) {
        console.log(chalk_1.default.dim(`Next page: --offset ${page.offset + page.limit}`));
    }
}
//# sourceMappingURL=pagination.js.map