"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkspace = createWorkspace;
exports.discoverWorkspaces = discoverWorkspaces;
exports.workspaceExists = workspaceExists;
exports.installClawiqSkill = installClawiqSkill;
exports.appendClawiqTools = appendClawiqTools;
exports.removeClawiqTools = removeClawiqTools;
exports.removeClawiqSkill = removeClawiqSkill;
const fs_1 = require("fs");
const path_1 = require("path");
const openclaw_js_1 = require("./openclaw.js");
const personas_js_1 = require("./personas.js");
const openclaw_js_2 = require("./openclaw.js");
function createWorkspace(agent) {
    const workspaceDir = (0, path_1.join)(openclaw_js_1.OPENCLAW_DIR, `workspace-${agent.id}`);
    // Create workspace directory
    (0, fs_1.mkdirSync)(workspaceDir, { recursive: true });
    // Create memory directory
    (0, fs_1.mkdirSync)((0, path_1.join)(workspaceDir, 'memory'), { recursive: true });
    // Create .openclaw directory with workspace state
    const dotOpenClaw = (0, path_1.join)(workspaceDir, '.openclaw');
    (0, fs_1.mkdirSync)(dotOpenClaw, { recursive: true });
    (0, fs_1.writeFileSync)((0, path_1.join)(dotOpenClaw, 'workspace-state.json'), JSON.stringify({
        version: 1,
        onboardingCompletedAt: new Date().toISOString(),
    }, null, 2));
    // Write all workspace files
    (0, fs_1.writeFileSync)((0, path_1.join)(workspaceDir, 'IDENTITY.md'), (0, personas_js_1.generateIdentity)(agent));
    (0, fs_1.writeFileSync)((0, path_1.join)(workspaceDir, 'SOUL.md'), (0, personas_js_1.generateSoul)(agent));
    (0, fs_1.writeFileSync)((0, path_1.join)(workspaceDir, 'AGENTS.md'), (0, personas_js_1.generateAgents)(agent));
    (0, fs_1.writeFileSync)((0, path_1.join)(workspaceDir, 'HEARTBEAT.md'), (0, personas_js_1.generateHeartbeat)(agent));
    (0, fs_1.writeFileSync)((0, path_1.join)(workspaceDir, 'TOOLS.md'), (0, personas_js_1.generateTools)(agent));
    (0, fs_1.writeFileSync)((0, path_1.join)(workspaceDir, 'USER.md'), (0, personas_js_1.generateUser)());
    (0, fs_1.writeFileSync)((0, path_1.join)(workspaceDir, 'BOOTSTRAP.md'), (0, personas_js_1.generateBootstrap)(agent));
    // Seed MEMORY.md with system topology from openclaw.json
    const config = (0, openclaw_js_2.loadOpenClawConfig)();
    const otherAgents = (config.agents?.list ?? [])
        .filter(a => a.id !== agent.id)
        .map(a => ({ id: a.id, workspace: a.workspace }));
    (0, fs_1.writeFileSync)((0, path_1.join)(workspaceDir, 'MEMORY.md'), (0, personas_js_1.generateMemory)(otherAgents));
    return workspaceDir;
}
function discoverWorkspaces() {
    if (!(0, fs_1.existsSync)(openclaw_js_1.OPENCLAW_DIR)) {
        return [];
    }
    return (0, fs_1.readdirSync)(openclaw_js_1.OPENCLAW_DIR)
        .filter((entry) => {
        const full = (0, path_1.join)(openclaw_js_1.OPENCLAW_DIR, entry);
        return entry.startsWith('workspace') && (0, fs_1.lstatSync)(full).isDirectory();
    })
        .map((entry) => (0, path_1.join)(openclaw_js_1.OPENCLAW_DIR, entry));
}
function workspaceExists(agentId) {
    return (0, fs_1.existsSync)((0, path_1.join)(openclaw_js_1.OPENCLAW_DIR, `workspace-${agentId}`));
}
const CLAWIQ_TOOLS_MARKER = '<!-- clawiq-tools -->';
const CLAWIQ_TOOLS_END_MARKER = '<!-- /clawiq-tools -->';
const CLAWIQ_TOOLS_SECTION = `
${CLAWIQ_TOOLS_MARKER}
## ClawIQ CLI

Report and query semantic events, traces, and errors.

### Emit
\`\`\`bash
clawiq emit <type> <name> [options]
\`\`\`
Types: task, output, correction, error, feedback, health, note

Common flags: \`--severity <level>\`, \`--quality-tags <tags>\`, \`--agent <id>\` (optional override), \`-q\` (quiet)
Agent resolution order: \`--agent\` → \`CLAWIQ_AGENT\` env → current \`workspace-<agent>\` path → default from \`clawiq init\`.

**Run \`clawiq emit\` as a standalone shell command. Never wrap it in \`python3 -c\`, heredocs, or \`os.system(...)\` blocks.**

**Emit as a reflex — before fixing, not after.**

\`\`\`bash
# Task completed successfully
clawiq emit task task-name -q --action-tags completed
# You did something wrong — emit BEFORE fixing it
clawiq emit error what-went-wrong -q --severity warn
clawiq emit correction what-was-corrected -q --quality-tags user-corrected
# Unexpected observation
clawiq emit note observation -q --severity info
\`\`\`

**When to emit an error:** Any time you make a mistake — wrong output, bad assumption, hallucinated data, unverifiable claim stated as fact, work that needed to be undone. Emit the error, then fix it. Don't skip this step because you're focused on the fix.

Tag categories:
- \`--action-tags\` — free-form outcome tags: \`completed\`, \`failed\`, \`delegated\`, \`skipped\`
- \`--quality-tags\` — problem flags only: \`hallucination\`, \`wrong-recipient\`, \`wrong-data\`, \`self-corrected\`, \`user-corrected\`, \`retry\`, \`fallback\`, \`slow\`, \`started\`
- \`--domain-tags\` — free-form topic tags (e.g., \`family\`, \`consulting\`, \`clawiq\`)
- Valid severities: \`info\`, \`warn\`, \`error\`

### Pull
\`\`\`bash
clawiq pull all --since 24h        # unified timeline
clawiq pull traces --since 24h     # OTEL traces
clawiq pull errors --since 24h     # error records
clawiq pull semantic --since 24h   # semantic events
clawiq pull markers --since 24h    # aggregated markers
\`\`\`

Common flags: \`--agent <id>\`, \`--since <time>\`, \`--json\`, \`--compact\`

### Tags
\`\`\`bash
clawiq tags                        # list all tags
\`\`\`

### Report
\`\`\`bash
clawiq report issue --agent <id> --impact <low|medium|high|critical> --title "..." [options]
clawiq report list --since 7d      # list recent issues
clawiq report show <issue-id>      # full UUID = exact API lookup
clawiq report show <id-prefix>     # prefix fallback for convenience
\`\`\`
Use full issue IDs when possible. Exact UUID lookup works reliably for older issues.

Common flags: \`--agent <id>\`, \`--impact <level>\`, \`--json\`, \`-q\` (quiet)
${CLAWIQ_TOOLS_END_MARKER}
`;
const SHARED_SKILLS_DIR = (0, path_1.join)(openclaw_js_1.OPENCLAW_DIR, 'workspace', 'skills');
const CLAWIQ_SKILL = `---
name: clawiq
description: Emit semantic events to ClawIQ for agent analytics. Use after completing tasks, when errors occur, or when receiving feedback.
---

# ClawIQ Event Reporting

You have \`clawiq emit\`

## When to Emit

1. **Complete a request** → \`task\`
2. **Something breaks or fails** → \`error\`
3. **Fix a mistake** → \`correction\`
4. **Receive feedback** → \`feedback\`
5. **Produce an artifact** (send message, create file) → \`output\`
6. **User leaves a bookmark or observation** → \`note\`

## Usage

\`\`\`bash
clawiq emit <type> <name> -q [options]
\`\`\`

- **ALWAYS use \`-q\`** — suppress output
- **Use \`--agent\` only when needed** — normally auto-detected from workspace/default config
- **Run as a standalone shell command** — never inside \`python3 -c\`, heredocs, or \`os.system(...)\`
- **Foreground by default** — avoid \`&\` unless you explicitly need background execution

## Event Types

| Type | When |
|------|------|
| \`task\` | Completed work (includes decisions, handoffs, research) |
| \`error\` | Something failed |
| \`correction\` | Fixed a mistake (yours or user-caught) |
| \`feedback\` | User responded positively or negatively |
| \`output\` | Sent a message or produced an artifact |
| \`health\` | System status (startup, heartbeat) |
| \`note\` | User-initiated bookmark, observation, or annotation |

## Task Lifecycle

For multi-step tasks, emit start AND completion:

\`\`\`bash
# Starting a complex task
clawiq emit task research-topic -q --quality-tags started

# Completing the task
clawiq emit task research-topic -q

# If it fails, emit error instead of completion
clawiq emit error research-failed -q --meta '{"reason":"API unavailable"}'
\`\`\`

**Use \`started\` tag for:**
- Tasks with multiple tool calls
- Tasks that might fail partway through

**Skip \`started\` for:**
- Quick single-tool responses
- Trivial lookups

## Options

**Required:**
- \`-q\` - Quiet mode

**Agent selection (optional override):**
- \`--agent <name>\` - Explicit agent ID (highest priority)
- \`CLAWIQ_AGENT=<name>\` - Environment override for shell/session

**Common:**
- \`--channel <ch>\` - imessage, telegram, slack, email
- \`--target <recipient>\` - Who received the message
- \`--severity <lvl>\` - info (default), warn, error
- \`--meta '<json>'\` - Context explaining what happened
- \`--quality-tags\` - started, self-corrected, user-corrected, retry, fallback
- \`--action-tags\` - What you did: poll, reminder, summary, handoff, research
- \`--domain-tags\` - Context: family, work, finance, health

**ALWAYS run \`clawiq tags\` before inventing new tags.** Reuse existing ones.

## Examples

\`\`\`bash
# Completed a task
clawiq emit task explain-feature -q --meta '{"topic":"OTEL"}'

# Sent a message (output)
clawiq emit output dinner-poll -q --channel imessage --target "Family"

# Handed off to sub-agent (just a task with meta)
clawiq emit task spawn-research -q --action-tags handoff --meta '{"sub_agent":"scout"}'

# Fixed my mistake
clawiq emit correction wrong-date -q --quality-tags self-corrected

# User corrected me
clawiq emit correction name-fix -q --quality-tags user-corrected

# Something failed
clawiq emit error api-timeout -q --severity error --meta '{"service":"weather"}'

# User said thanks
clawiq emit feedback positive -q --channel imessage

# User bookmarks something for later
clawiq emit note interesting-pattern -q --meta '{"observation":"model switches mid-session"}'
\`\`\`
`;
/**
 * Install or refresh the shared clawiq skill at workspace/skills/clawiq/SKILL.md.
 * Returns true if created/updated, false if already current.
 */
function installClawiqSkill() {
    const skillDir = (0, path_1.join)(SHARED_SKILLS_DIR, 'clawiq');
    const skillPath = (0, path_1.join)(skillDir, 'SKILL.md');
    (0, fs_1.mkdirSync)(skillDir, { recursive: true });
    if ((0, fs_1.existsSync)(skillPath)) {
        const existing = (0, fs_1.readFileSync)(skillPath, 'utf-8');
        if (existing === CLAWIQ_SKILL) {
            return false;
        }
    }
    (0, fs_1.writeFileSync)(skillPath, CLAWIQ_SKILL);
    return true;
}
/**
 * Upsert ClawIQ CLI reference inside a workspace's TOOLS.md.
 * Returns true if the file was updated, false if already current or no TOOLS.md.
 */
function appendClawiqTools(workspacePath) {
    const toolsPath = (0, path_1.join)(workspacePath, 'TOOLS.md');
    if (!(0, fs_1.existsSync)(toolsPath)) {
        return false;
    }
    const existing = (0, fs_1.readFileSync)(toolsPath, 'utf-8');
    const markerIndex = existing.indexOf(CLAWIQ_TOOLS_MARKER);
    const replacement = CLAWIQ_TOOLS_SECTION.trimEnd();
    let updated;
    if (markerIndex === -1) {
        updated = existing.trimEnd() + '\n' + replacement + '\n';
    }
    else {
        const endMarkerIndex = existing.indexOf(CLAWIQ_TOOLS_END_MARKER, markerIndex);
        const sectionEnd = endMarkerIndex === -1
            ? existing.length
            : endMarkerIndex + CLAWIQ_TOOLS_END_MARKER.length;
        const before = existing.slice(0, markerIndex).trimEnd();
        const after = existing.slice(sectionEnd).trimStart();
        updated = '';
        if (before.length > 0) {
            updated += before + '\n';
        }
        updated += replacement;
        if (after.length > 0) {
            updated += '\n' + after;
        }
        updated = updated.trimEnd() + '\n';
    }
    if (updated === existing) {
        return false;
    }
    (0, fs_1.writeFileSync)(toolsPath, updated);
    return true;
}
/**
 * Remove ClawIQ CLI reference from a workspace's TOOLS.md.
 * Returns true if the file was updated, false if no change.
 */
function removeClawiqTools(workspacePath) {
    const toolsPath = (0, path_1.join)(workspacePath, 'TOOLS.md');
    if (!(0, fs_1.existsSync)(toolsPath)) {
        return false;
    }
    const existing = (0, fs_1.readFileSync)(toolsPath, 'utf-8');
    const markerIndex = existing.indexOf(CLAWIQ_TOOLS_MARKER);
    if (markerIndex === -1) {
        return false;
    }
    const endIndex = existing.indexOf(CLAWIQ_TOOLS_END_MARKER, markerIndex);
    if (endIndex !== -1) {
        const after = endIndex + CLAWIQ_TOOLS_END_MARKER.length;
        const updated = (existing.slice(0, markerIndex) + existing.slice(after)).trimEnd();
        (0, fs_1.writeFileSync)(toolsPath, updated.length ? updated + '\n' : '');
        return true;
    }
    const updated = existing.slice(0, markerIndex).trimEnd();
    (0, fs_1.writeFileSync)(toolsPath, updated.length ? updated + '\n' : '');
    return true;
}
/**
 * Remove the shared clawiq skill directory if present.
 * Returns true if removed, false if not found.
 */
function removeClawiqSkill() {
    const skillDir = (0, path_1.join)(SHARED_SKILLS_DIR, 'clawiq');
    if (!(0, fs_1.existsSync)(skillDir)) {
        return false;
    }
    (0, fs_1.rmSync)(skillDir, { recursive: true, force: true });
    return true;
}
//# sourceMappingURL=workspace.js.map