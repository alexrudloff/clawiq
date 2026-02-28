"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildClient = buildClient;
const api_js_1 = require("./api.js");
const config_js_1 = require("./config.js");
function buildClient(apiKeyFlag) {
    const config = (0, config_js_1.loadConfig)();
    const apiKey = (0, config_js_1.requireApiKey)(config, apiKeyFlag);
    return new api_js_1.ClawIQClient(config_js_1.API_ENDPOINT, apiKey, config_js_1.CLI_VERSION);
}
//# sourceMappingURL=client.js.map