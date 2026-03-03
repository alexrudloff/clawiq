import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { clawiqWebChannel } from "./src/channel.js";
import { setClawiqWebRuntime } from "./src/runtime.js";

const plugin = {
  id: "clawiq-web",
  name: "ClawIQ Web",
  description: "Bridge ClawIQ web chat to a local Lenny agent runtime.",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setClawiqWebRuntime(api.runtime);
    api.registerChannel({ plugin: clawiqWebChannel });
  },
};

export default plugin;
