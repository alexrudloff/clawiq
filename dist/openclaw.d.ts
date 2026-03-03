export declare const OPENCLAW_DIR: string;
export declare const OPENCLAW_CONFIG: string;
export interface OpenClawAgent {
    id: string;
    workspace: string;
    model?: {
        primary: string;
    };
}
export interface OpenClawBinding {
    agentId?: string;
    match?: {
        channel?: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
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
        load?: {
            paths?: string[];
        };
        entries?: Record<string, {
            enabled?: boolean;
            config?: Record<string, unknown>;
        }>;
    };
    agents?: {
        defaults?: Record<string, unknown>;
        list?: OpenClawAgent[];
    };
    channels?: Record<string, Record<string, unknown>>;
    bindings?: OpenClawBinding[];
}
export declare function loadOpenClawConfig(): OpenClawConfig;
export declare function backupOpenClawConfig(): boolean;
export declare function hasPreClawiqBackup(): boolean;
export declare function restorePreClawiqBackup(): boolean;
export declare function saveOpenClawConfig(config: OpenClawConfig): void;
export declare function agentExists(config: OpenClawConfig, id: string): boolean;
//# sourceMappingURL=openclaw.d.ts.map