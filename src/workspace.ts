import { existsSync, mkdirSync, writeFileSync, readdirSync, lstatSync, symlinkSync, readlinkSync } from 'fs';
import { join, basename } from 'path';
import { OPENCLAW_DIR } from './openclaw.js';
import {
  Persona,
  generateIdentity,
  generateSoul,
  generateAgents,
  generateHeartbeat,
  generateTools,
  generateUser,
  generateBootstrap,
} from './personas.js';

const SHARED_SKILLS_DIR = join(OPENCLAW_DIR, 'workspace', 'skills');

export function createWorkspace(persona: Persona): string {
  const workspaceDir = join(OPENCLAW_DIR, `workspace-${persona.id}`);

  // Create workspace directory
  mkdirSync(workspaceDir, { recursive: true });

  // Create memory directory
  mkdirSync(join(workspaceDir, 'memory'), { recursive: true });

  // Create .openclaw directory with workspace state
  const dotOpenClaw = join(workspaceDir, '.openclaw');
  mkdirSync(dotOpenClaw, { recursive: true });
  writeFileSync(
    join(dotOpenClaw, 'workspace-state.json'),
    JSON.stringify(
      {
        version: 1,
        onboardingCompletedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  // Create skills symlink to shared skills
  const skillsLink = join(workspaceDir, 'skills');
  if (!existsSync(skillsLink) && existsSync(SHARED_SKILLS_DIR)) {
    try {
      symlinkSync(SHARED_SKILLS_DIR, skillsLink);
    } catch {
      // Symlink may fail on some systems — not critical
    }
  }

  // Write all workspace files
  writeFileSync(join(workspaceDir, 'IDENTITY.md'), generateIdentity(persona));
  writeFileSync(join(workspaceDir, 'SOUL.md'), generateSoul(persona));
  writeFileSync(join(workspaceDir, 'AGENTS.md'), generateAgents(persona));
  writeFileSync(join(workspaceDir, 'HEARTBEAT.md'), generateHeartbeat(persona));
  writeFileSync(join(workspaceDir, 'TOOLS.md'), generateTools(persona));
  writeFileSync(join(workspaceDir, 'USER.md'), generateUser());
  writeFileSync(join(workspaceDir, 'BOOTSTRAP.md'), generateBootstrap(persona));

  return workspaceDir;
}

export function discoverWorkspaces(): string[] {
  if (!existsSync(OPENCLAW_DIR)) {
    return [];
  }

  return readdirSync(OPENCLAW_DIR)
    .filter((entry) => {
      const full = join(OPENCLAW_DIR, entry);
      return entry.startsWith('workspace') && lstatSync(full).isDirectory();
    })
    .map((entry) => join(OPENCLAW_DIR, entry));
}

export function ensureClawiqSkillSymlink(workspacePath: string): boolean {
  const skillsDir = join(workspacePath, 'skills');

  // Skip if no skills directory or if it's a symlink to shared skills
  if (!existsSync(skillsDir)) {
    return false;
  }

  // If skills dir is a symlink, check where it points
  try {
    const stat = lstatSync(skillsDir);
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(skillsDir);
      if (target === SHARED_SKILLS_DIR) {
        // It's already pointing to shared skills — check for clawiq skill inside
        const clawiqSkill = join(skillsDir, 'clawiq');
        return existsSync(clawiqSkill);
      }
    }
  } catch {
    return false;
  }

  // Real skills directory — ensure clawiq skill is symlinked
  const clawiqSkill = join(skillsDir, 'clawiq');
  const sharedClawiqSkill = join(SHARED_SKILLS_DIR, 'clawiq');

  if (!existsSync(clawiqSkill) && existsSync(sharedClawiqSkill)) {
    try {
      symlinkSync(sharedClawiqSkill, clawiqSkill);
      return true;
    } catch {
      return false;
    }
  }

  return existsSync(clawiqSkill);
}

export function workspaceExists(personaId: string): boolean {
  return existsSync(join(OPENCLAW_DIR, `workspace-${personaId}`));
}
