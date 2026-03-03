export interface OpenClawDocsSyncResult {
    destinationDir: string;
    manifestPath: string;
    totalReferenced: number;
    downloaded: number;
    failed: number;
    failures: string[];
}
export declare function syncOpenClawDocs(memoryDir: string): Promise<OpenClawDocsSyncResult>;
//# sourceMappingURL=openclaw-docs-sync.d.ts.map