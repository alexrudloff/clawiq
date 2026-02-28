"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentFromSession = getAgentFromSession;
exports.matchesAgent = matchesAgent;
exports.containsInsensitive = containsInsensitive;
exports.simplifyStatus = simplifyStatus;
function getAgentFromSession(sessionId) {
    const parts = sessionId.split(':');
    if (parts.length >= 2 && parts[0] === 'agent') {
        return parts[1];
    }
    return sessionId || '-';
}
function matchesAgent(sessionId, agent) {
    return sessionId.includes(`agent:${agent}:`);
}
function containsInsensitive(text, query) {
    return text.toLowerCase().includes(query.toLowerCase());
}
function simplifyStatus(statusCode) {
    if (statusCode === 'STATUS_CODE_ERROR') {
        return 'error';
    }
    if (statusCode === 'STATUS_CODE_OK' || statusCode === 'STATUS_CODE_UNSET') {
        return 'success';
    }
    return statusCode;
}
//# sourceMappingURL=filters.js.map