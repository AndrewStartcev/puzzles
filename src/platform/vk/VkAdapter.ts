import { LocalAdapter } from "../local/LocalAdapter";
import { withTimeout } from "../loadScript";
export class VkAdapter extends LocalAdapter {
  constructor() {
    super("vk");
  }
  override async init() {
    const { default: bridge } = await import("@vkontakte/vk-bridge");
    await withTimeout(bridge.send("VKWebAppInit"));
  }
}
