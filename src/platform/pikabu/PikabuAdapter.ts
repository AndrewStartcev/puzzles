import { LocalAdapter } from "../local/LocalAdapter";
import { loadScript, withTimeout } from "../loadScript";
interface PikabuSdk {
  gameStarted(): void;
}
declare global {
  interface Window {
    PkbSDK?: { init(): Promise<PikabuSdk> };
  }
}
export class PikabuAdapter extends LocalAdapter {
  private sdk?: PikabuSdk;
  private notified = false;
  constructor() {
    super("pikabu");
  }
  override async init() {
    await loadScript("https://games.pikabu.ru/sdk/sdk.js");
    if (!window.PkbSDK) throw new Error("SDK Пикабу недоступен");
    this.sdk = await withTimeout(window.PkbSDK.init());
  }
  override ready() {
    if (this.sdk && !this.notified) {
      this.notified = true;
      this.sdk.gameStarted();
    }
  }
}
