import { registerAppMention } from "./events/app-mention.js";
import { registerMessage } from "./events/message.js";
import { registerMemoryCommand } from "./commands/memory.js";

export function registerListeners(app) {
  registerAppMention(app);
  registerMessage(app);
  registerMemoryCommand(app);
}
