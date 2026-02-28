import { OpenClawConfig } from './openclaw.js';
export declare function configureOtelDiagnostics(config: OpenClawConfig, apiKey: string, endpoint: string): void;
export declare function ensureDiagnosticsPlugin(config: OpenClawConfig): boolean;
export declare function upsertAgent(config: OpenClawConfig, agentId: string, workspacePath: string): {
    added: boolean;
    updated: boolean;
};
export declare function removeClawiqConfig(config: OpenClawConfig, endpoint: string, agentId: string): {
    removedOtel: boolean;
    removedAgent: boolean;
    disabledPlugin: boolean;
};
//# sourceMappingURL=openclaw_service.d.ts.map