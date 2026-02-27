const RELATIVE_TIME_RE = /^(\d+)\s*([smhdw])$/i;

function durationToMilliseconds(value: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'w':
      return value * 7 * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

export function parseTimeValue(input: string, reference: Date = new Date()): Date {
  const value = input.trim();
  if (value.length === 0) {
    throw new Error('Time value cannot be empty');
  }

  if (value.toLowerCase() === 'now') {
    return reference;
  }

  const relativeMatch = value.match(RELATIVE_TIME_RE);
  if (relativeMatch) {
    const amount = Number.parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const deltaMs = durationToMilliseconds(amount, unit);
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      throw new Error(`Invalid relative time: "${input}"`);
    }
    return new Date(reference.getTime() - deltaMs);
  }

  const absolute = new Date(value);
  if (!Number.isNaN(absolute.getTime())) {
    return absolute;
  }

  throw new Error(
    `Invalid time value "${input}". Use ISO time or relative values like 15m, 24h, 7d.`
  );
}

export function resolveTimeRange(
  since: string | undefined,
  until: string | undefined,
  defaultSince: string
): { start: string; end: string } {
  const referenceNow = new Date();
  const endDate = until ? parseTimeValue(until, referenceNow) : referenceNow;
  const startDate = parseTimeValue(since || defaultSince, endDate);

  if (startDate.getTime() > endDate.getTime()) {
    throw new Error('`since` must be earlier than `until`');
  }

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}
