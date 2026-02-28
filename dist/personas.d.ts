export interface Agent {
    id: string;
    name: string;
    emoji: string;
}
export declare const CLAWIQ_AGENT: Agent;
export declare function generateIdentity(agent: Agent): string;
export declare function generateSoul(agent: Agent): string;
export declare function generateAgents(agent: Agent): string;
export declare function generateHeartbeat(agent: Agent): string;
export declare function generateTools(agent: Agent): string;
export declare function generateUser(): string;
export declare function generateBootstrap(agent: Agent): string;
export declare function generateMemory(agents: Array<{
    id: string;
    workspace: string;
}>): string;
//# sourceMappingURL=personas.d.ts.map