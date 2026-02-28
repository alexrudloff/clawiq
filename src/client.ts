import { ClawIQClient } from './api.js';
import { API_ENDPOINT, CLI_VERSION, loadConfig, requireApiKey } from './config.js';

export function buildClient(apiKeyFlag?: string): ClawIQClient {
  const config = loadConfig();
  const apiKey = requireApiKey(config, apiKeyFlag);
  return new ClawIQClient(API_ENDPOINT, apiKey, CLI_VERSION);
}
