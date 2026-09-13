import { LocalAdapter } from "./local/LocalAdapter";
import type { PlatformAdapter } from "./types";
export async function createPlatform(): Promise<PlatformAdapter> {
  const id =
    import.meta.env.VITE_PLATFORM ||
    new URLSearchParams(location.search).get("platform") ||
    "local";
  switch (id) {
    case "local":
      return new LocalAdapter();
    case "pikabu":
      return new (await import("./pikabu/PikabuAdapter")).PikabuAdapter();
    case "vk":
      return new (await import("./vk/VkAdapter")).VkAdapter();
    case "ok":
      return new (await import("./ok/OkAdapter")).OkAdapter();
    default:
      throw new Error(`Неизвестная платформа: ${id}`);
  }
}
