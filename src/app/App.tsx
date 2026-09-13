import { useCallback, useEffect, useState } from "react";
import { catalog } from "../content/catalog";
import { createPlatform } from "../platform";
import { LocalAdapter } from "../platform/local/LocalAdapter";
import type { PlatformAdapter } from "../platform/types";
import type { SaveGame } from "../game/puzzle-core/types";
import { parseSave, SAVE_KEY } from "../game/save/save";
import { PuzzleGame, type GameRequest } from "../ui/PuzzleGame";
import { Lobby } from "../ui/Lobby";

export function App() {
  const [platform, setPlatform] = useState<PlatformAdapter>(),
    [platformError, setPlatformError] = useState("");
  const [save, setSave] = useState<SaveGame>(),
    [request, setRequest] = useState<GameRequest>();
  const onSaved = useCallback((s: SaveGame) => setSave(s), []);
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      let adapter: PlatformAdapter;
      try {
        adapter = await createPlatform();
        await adapter.init();
      } catch (e) {
        setPlatformError(
          `Платформа недоступна (${e instanceof Error ? e.message : "ошибка"}). Открыт локальный режим.`,
        );
        adapter = new LocalAdapter();
      }
      let restored: SaveGame | undefined;
      try {
        restored = parseSave(await adapter.load(SAVE_KEY));
      } catch {
        setPlatformError(
          "Хранилище браузера недоступно. Игра работает без сохранений.",
        );
      }
      if (cancelled) return;
      if (restored && catalog.some((c) => c.id === restored.config.contentId))
        setSave(restored);
      setPlatform(adapter);
      adapter.ready();
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, []);
  if (!platform)
    return (
      <div className="loading" role="status">
        Открываем Мир пазлов…
      </div>
    );
  if (request)
    return (
      <PuzzleGame
        request={request}
        platform={platform}
        back={() => setRequest(undefined)}
        saved={onSaved}
      />
    );
  return <Lobby save={save} notice={platformError} start={setRequest} />;
}
