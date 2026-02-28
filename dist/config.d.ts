export declare const CLI_VERSION: string;
export interface ClawIQConfig {
    apiKey?: string;
    defaultAgent?: string;
}
export declare const API_ENDPOINT = "https://api.clawiq.md";
/**
 * Load config from environment or ~/.clawiq/config.json
 */
export declare function loadConfig(): ClawIQConfig;
/**
 * Save config to ~/.clawiq/config.json
 */
export declare function saveConfig(config: ClawIQConfig): void;
/**
 * Get API key from config or throw error
 */
export declare function requireApiKey(config: ClawIQConfig, flagApiKey?: string): string;
//# sourceMappingURL=config.d.ts.map