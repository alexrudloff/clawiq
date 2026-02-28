import chalk from 'chalk';
import { PageInfo, CommonPullOptions } from './types.js';

function validatePositiveInt(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
}

function validateNonNegativeInt(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return value;
}

export function computePageInfo(options: CommonPullOptions, defaultLimit = 50): PageInfo {
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

export function printPaginationFooter(
  label: string,
  itemCount: number,
  page: PageInfo,
  total?: number
): void {
  if (total !== undefined) {
    console.log(
      chalk.dim(
        `\nShowing ${itemCount} of ${total} ${label} (page ${page.page}, limit ${page.limit}, offset ${page.offset})`
      )
    );
    if (page.offset + itemCount < total) {
      console.log(chalk.dim(`Next page: --offset ${page.offset + page.limit}`));
    }
    return;
  }

  console.log(
    chalk.dim(
      `\nShowing ${itemCount} ${label} (page ${page.page}, limit ${page.limit}, offset ${page.offset})`
    )
  );
  if (itemCount === page.limit) {
    console.log(chalk.dim(`Next page: --offset ${page.offset + page.limit}`));
  }
}
