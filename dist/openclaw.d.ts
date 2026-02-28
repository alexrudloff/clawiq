export declare const OPENCLAW_DIR: string;
export declare const OPENCLAW_CONFIG: string;
export interface OpenClawAgent {
    id: string;
    workspace: string;
    model?: {
        primary: string;
    };
}
export interface OpenClawConfig {
    [key: string]: unknown;
    diagnostics?: {
        enabled?: boolean;
        otel?: {
            enabled?: boolean;
            endpoint?: string;
            headers?: Record<string, string>;
            traces?: boolean;
            metrics?: boolean;
            logs?: boolean;
        };
    };
    plugins?: {
        entries?: Record<string, {
            enabled?: boolean;
        }>;
    };
    agents?: {
        defaults?: Record<string, unknown>;
        list?: OpenClawAgent[];
    };
}
export declare function loadOpenClawConfig(): OpenClawConfig;
export declare function backupOpenClawConfig(): boolean;
export declare function saveOpenClawConfig(config: OpenClawConfig): void;
export declare function agentExists(config: OpenClawConfig, id: string): boolean;
//# sourceMappingURL=openclaw.d.ts.map