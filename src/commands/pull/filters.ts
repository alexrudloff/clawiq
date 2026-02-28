export function getAgentFromSession(sessionId: string): string {
  const parts = sessionId.split(':');
  if (parts.length >= 2 && parts[0] === 'agent') {
    return parts[1];
  }
  return sessionId || '-';
}

export function matchesAgent(sessionId: string, agent: string): boolean {
  return sessionId.includes(`agent:${agent}:`);
}

export function containsInsensitive(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

export function simplifyStatus(statusCode: string): string {
  if (statusCode === 'STATUS_CODE_ERROR') {
    return 'error';
  }
  if (statusCode === 'STATUS_CODE_OK' || statusCode === 'STATUS_CODE_UNSET') {
    return 'success';
  }
  return statusCode;
}
