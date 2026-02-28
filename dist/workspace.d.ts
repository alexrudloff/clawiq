import { Agent } from './personas.js';
export declare function createWorkspace(agent: Agent): string;
export declare function discoverWorkspaces(): string[];
export declare function workspaceExists(agentId: string): boolean;
/**
 * Install the clawiq shared skill at workspace/skills/clawiq/SKILL.md.
 * Returns true if written, false if already exists.
 */
export declare function installClawiqSkill(): boolean;
/**
 * Append ClawIQ CLI reference to a workspace's TOOLS.md.
 * Returns true if the file was updated, false if already present or no TOOLS.md.
 */
export declare function appendClawiqTools(workspacePath: string): boolean;
/**
 * Remove ClawIQ CLI reference from a workspace's TOOLS.md.
 * Returns true if the file was updated, false if no change.
 */
export declare function removeClawiqTools(workspacePath: string): boolean;
/**
 * Remove the shared clawiq skill directory if present.
 * Returns true if removed, false if not found.
 */
export declare function removeClawiqSkill(): boolean;
//# sourceMappingURL=workspace.d.ts.map