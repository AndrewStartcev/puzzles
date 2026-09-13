import { LocalAdapter } from "../local/LocalAdapter";
import { loadScript, withTimeout } from "../loadScript";
interface OkSdk {
  init(
    server: string,
    connection: string,
    success: () => void,
    error: (error: unknown) => void,
  ): void;
}
declare global {
  interface Window {
    FAPI?: OkSdk;
  }
}
export class OkAdapter extends LocalAdapter {
  constructor() {
    super("ok");
  }
  override async init() {
    const params = new URLSearchParams(location.search);
    const server = params.get("api_server"),
      connection = params.get("apiconnection");
    if (!server || !connection)
      throw new Error("Нет параметров запуска Одноклассников");
    await loadScript("https://api.ok.ru/js/fapi5.js");
    if (!window.FAPI) throw new Error("SDK Одноклассников недоступен");
    await withTimeout(
      new Promise<void>((resolve, reject) =>
        window.FAPI!.init(server, connection, resolve, reject),
      ),
    );
  }
}
