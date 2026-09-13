import { useEffect, useRef, useState } from "react";
import type { PuzzleContent } from "../content/catalog";
import { PuzzleSession } from "../game/puzzle-core/session";
import type {
  PuzzleConfig,
  PuzzleGeometry,
  SaveGame,
} from "../game/puzzle-core/types";
import { SAVE_KEY } from "../game/save/save";
import { Tray } from "../game/tray/Tray";
import type { PlatformAdapter } from "../platform/types";
import type { PuzzleRenderer } from "../game/renderer/PuzzleRenderer";

export interface GameRequest {
  content: PuzzleContent;
  count: number;
  save?: SaveGame;
}
export function PuzzleGame({
  request,
  platform,
  back,
  saved,
}: {
  request: GameRequest;
  platform: PlatformAdapter;
  back: () => void;
  saved: (save: SaveGame) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    renderer = useRef<PuzzleRenderer | null>(null);
  const [session, setSession] = useState<PuzzleSession>(),
    [revision, setRevision] = useState(0);
  const [error, setError] = useState(""),
    [status, setStatus] = useState("Подготовка деталей…");
  const [seconds, setSeconds] = useState(request.save?.elapsedSeconds ?? 0);
  const elapsed = useRef(seconds),
    persist = useRef<() => void>(() => {});
  useEffect(() => {
    let disposed = false,
      worker: Worker | undefined,
      engine: PuzzleRenderer | undefined;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    const image = new Image();
    const snapshot = () => {
      if (!engine || disposed) return;
      const save: SaveGame = {
        version: 1,
        geometryVersion: 1,
        config: engine.session.geometry.config,
        camera: { ...engine.camera },
        pieces: engine.snapshotStates(),
        elapsedSeconds: elapsed.current,
        updatedAt: Date.now(),
      };
      try {
        platform.flush(SAVE_KEY, JSON.stringify(save));
        saved(save);
        setStatus("Сохранено на устройстве");
      } catch {
        setStatus("Сохранение недоступно: проверьте хранилище браузера");
      }
    };
    persist.current = snapshot;
    const onChange = () => {
      if (disposed) return;
      setRevision((v) => v + 1);
      setStatus("Сохраняем…");
      clearTimeout(saveTimer);
      saveTimer = setTimeout(snapshot, 350);
    };
    const start = async (geometry: PuzzleGeometry) => {
      try {
        const { PuzzleRenderer: Renderer } =
          await import("../game/renderer/PuzzleRenderer");
        if (disposed || !host.current) return;
        const s = new PuzzleSession(geometry, request.save);
        engine = new Renderer(host.current, s, onChange);
        renderer.current = engine;
        await engine.init(request.content.image, request.save?.camera);
        if (disposed) return;
        setSession(s);
        setStatus("Готово");
        platform.ready();
        snapshot();
        interval = setInterval(() => {
          if (
            document.visibilityState === "visible" &&
            s.placed < s.states.length
          ) {
            elapsed.current++;
            setSeconds(elapsed.current);
            if (elapsed.current % 10 === 0) snapshot();
          }
        }, 1000);
      } catch (e) {
        if (!disposed)
          setError(
            e instanceof Error ? e.message : "Не удалось запустить WebGL",
          );
      }
    };
    image.onload = () => {
      if (disposed) return;
      if (
        request.save &&
        (request.save.config.imageWidth !== image.naturalWidth ||
          request.save.config.imageHeight !== image.naturalHeight)
      ) {
        setError("Изображение изменилось. Начните новый пазл.");
        return;
      }
      const config: PuzzleConfig = request.save?.config ?? {
        contentId: request.content.id,
        requestedCount: request.count,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
        imageWidth: image.naturalWidth,
        imageHeight: image.naturalHeight,
      };
      worker = new Worker(
        new URL("../game/puzzle-core/geometry.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (
        event: MessageEvent<{ geometry?: PuzzleGeometry; error?: string }>,
      ) => {
        worker?.terminate();
        if (event.data.error) setError(event.data.error);
        else if (event.data.geometry) void start(event.data.geometry);
      };
      worker.onerror = () => {
        worker?.terminate();
        if (!disposed) setError("Не удалось сгенерировать детали");
      };
      worker.postMessage(config);
    };
    image.onerror = () => {
      if (!disposed) setError("Не удалось загрузить изображение");
    };
    image.src = request.content.image;
    const onHide = () => snapshot();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      snapshot();
      disposed = true;
      worker?.terminate();
      image.onload = null;
      image.onerror = null;
      clearTimeout(saveTimer);
      clearInterval(interval);
      engine?.destroy();
      renderer.current = null;
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [request, platform, saved]);
  const placed = session?.placed ?? 0,
    count = session?.states.length ?? 0;
  return (
    <section className="game">
      <header className="game-header">
        <button
          className="subtle"
          onClick={() => {
            persist.current();
            back();
          }}
        >
          ← Меню
        </button>
        <div>
          <h2>{request.content.title}</h2>
          <small>
            {count
              ? `${session!.geometry.columns} × ${session!.geometry.rows} · ${count} деталей`
              : status}
          </small>
        </div>
        <div className="game-progress">
          <strong>
            {placed} / {count}
          </strong>
          <span>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
        </div>
      </header>
      <div className="workspace">
        <div className="board-wrap">
          <div className="board" ref={host} />
          {!session && !error && (
            <div className="board-message" role="status">
              {status}
            </div>
          )}
          {error && (
            <div className="board-message" role="alert">
              <strong>Не удалось открыть пазл</strong>
              <p>{error}</p>
              <button onClick={back}>Вернуться</button>
            </div>
          )}
          <div className="camera-controls">
            <button
              aria-label="Уменьшить"
              onClick={() => renderer.current?.zoom(1 / 1.25)}
            >
              −
            </button>
            <button onClick={() => renderer.current?.fit()}>Весь пазл</button>
            <button
              aria-label="Увеличить"
              onClick={() => renderer.current?.zoom(1.25)}
            >
              +
            </button>
          </div>
          {count > 0 && placed === count && (
            <div className="completion" role="status">
              <span>✦</span>
              <h2>Картина собрана!</h2>
              <p>Ещё одно открытие в вашем мире.</p>
              <button onClick={back}>В меню</button>
            </div>
          )}
        </div>
        {session && (
          <Tray
            session={session}
            image={request.content.image}
            revision={revision}
            take={(id, event) => renderer.current?.takeFromTray(id, event)}
          />
        )}
      </div>
      <footer className="game-footer">
        <span>
          Перенесите детали на стол · Колесо — масштаб · Свободное место —
          перемещение · F — весь пазл
        </span>
        <span aria-live="polite">{status}</span>
      </footer>
    </section>
  );
}
