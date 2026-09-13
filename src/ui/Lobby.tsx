import { useEffect, useRef, useState, type ReactNode } from "react";
import { catalog, difficulties, type PuzzleContent } from "../content/catalog";
import { generatePuzzle } from "../game/puzzle-core/geometry";
import type { SaveGame, PuzzleGeometry } from "../game/puzzle-core/types";
import type { GameRequest } from "./PuzzleGame";
import { Icon } from "./Icon";

function PaperDialog({
  children,
  close,
  title,
}: {
  children: ReactNode;
  close: () => void;
  title: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        ref={ref}
        className="paper-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
          if (e.key !== "Tab") return;
          const nodes = [
            ...ref.current!.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input,a[href]",
            ),
          ];
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <button
          className="round-button dialog-close"
          aria-label="Закрыть"
          onClick={close}
        >
          <Icon name="close" />
        </button>
        {children}
      </section>
    </div>
  );
}

function TablePuzzle({ content }: { content: PuzzleContent }) {
  const [geometry, setGeometry] = useState<PuzzleGeometry>();
  useEffect(() => {
    let alive = true;
    const image = new Image();
    image.onload = () => {
      if (alive)
        setGeometry(
          generatePuzzle({
            contentId: content.id,
            seed: 17,
            requestedCount: 12,
            imageWidth: image.naturalWidth,
            imageHeight: image.naturalHeight,
          }),
        );
    };
    image.src = content.image;
    return () => {
      alive = false;
      image.onload = null;
    };
  }, [content]);
  if (!geometry)
    return <img className="table-puzzle-loading" src={content.image} alt="" />;
  const g = geometry;
  return (
    <svg
      className="table-puzzle"
      viewBox={`-75 -45 ${g.width + 200} ${g.height + 170}`}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="lobby-art"
          patternUnits="userSpaceOnUse"
          width={g.width}
          height={g.height}
        >
          <image href={content.image} width={g.width} height={g.height} />
        </pattern>
        <filter id="piece-shadow" x="-30%" y="-30%" width="170%" height="170%">
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="3"
            floodColor="#3a382d"
            floodOpacity=".27"
          />
        </filter>
      </defs>
      <rect
        x="-10"
        y="-10"
        width={g.width + 20}
        height={g.height + 20}
        rx="6"
        fill="#b2c3b9"
        opacity=".6"
      />
      <image
        href={content.image}
        width={g.width}
        height={g.height}
        opacity=".16"
      />
      {g.pieces.map((piece) => {
        const loose = piece.id === 3 || piece.id === 10;
        const transform =
          piece.id === 3
            ? `translate(80 40) rotate(13 ${piece.targetX + 80} ${piece.targetY + 80})`
            : piece.id === 10
              ? `translate(-50 82) rotate(-12 ${piece.targetX + 80} ${piece.targetY + 80})`
              : "";
        const points = piece.points.map(
          (n, i) => n + (i % 2 ? piece.targetY : piece.targetX),
        );
        return (
          <polygon
            key={piece.id}
            transform={transform}
            points={points.reduce((s, n, i) => s + n + (i % 2 ? " " : ","), "")}
            fill="url(#lobby-art)"
            filter={loose ? "url(#piece-shadow)" : undefined}
            stroke="#fff"
            strokeOpacity=".24"
            strokeWidth=".65"
          />
        );
      })}
    </svg>
  );
}

export function Lobby({
  save,
  notice,
  start,
}: {
  save?: SaveGame;
  notice: string;
  start: (request: GameRequest) => void;
}) {
  const [screen, setScreen] = useState<"home" | "collections">("home");
  const [selection, setSelection] = useState<PuzzleContent>();
  const [settings, setSettings] = useState(false),
    [count, setCount] = useState(48);
  const [message, setMessage] = useState("");
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const first = catalog[0],
    resumable = save && catalog.find((c) => c.id === save.config.contentId);
  const progress =
    save?.pieces.filter((p) => p.location === "placed").length ?? 0;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !selection && !settings) setScreen("home");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, settings]);
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setMessage("Полный экран недоступен в этом окне.");
    }
  };
  return (
    <div className="tabletop">
      <div className="desk-light" aria-hidden="true" />
      <header className="lobby-hud">
        <div className="mini-brand">
          <span className="brand-token">
            <Icon name="puzzle" />
          </span>
          <span>МИР ПАЗЛОВ</span>
        </div>
        <div className="hud-actions">
          {save && (
            <span className="save-indicator">
              <i /> Прогресс сохранён
            </span>
          )}
          <button
            className="round-button"
            aria-label="Полный экран"
            title="Полный экран"
            onClick={() => void fullscreen()}
          >
            <Icon name="fullscreen" />
          </button>
          <button
            className="round-button"
            aria-label="Настройки"
            title="Настройки"
            onClick={() => setSettings(true)}
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>
      <main
        className={`felt-table ${screen === "collections" ? "collection-table" : ""}`}
      >
        {((notice && !noticeDismissed) || message) && (
          <div className="notice" role="status">
            {message || notice}
            <button
              className="subtle"
              aria-label="Закрыть сообщение"
              onClick={() => {
                setMessage("");
                setNoticeDismissed(true);
              }}
            >
              <Icon name="close" />
            </button>
          </div>
        )}
        {screen === "home" ? (
          <div className="lobby-layout">
            <section className="main-menu">
              <span className="menu-kicker">ВРЕМЯ ДЛЯ СЕБЯ</span>
              <h1 className="game-title">
                Мир
                <br />
                <span>пазлов</span>
              </h1>
              <p className="menu-subtitle">Всё начинается с одной детали.</p>
              <div className="menu-buttons">
                {resumable && save && (
                  <button
                    className="menu-button primary"
                    onClick={() =>
                      start({
                        content: resumable,
                        count: save.config.requestedCount,
                        save,
                      })
                    }
                  >
                    <span className="button-symbol" aria-hidden="true">
                      <Icon name="play" />
                    </span>
                    <span>
                      Продолжить
                      <small>
                        {progress} из {save.pieces.length} деталей
                      </small>
                    </span>
                    <span className="button-arrow" aria-hidden="true">
                      <Icon name="next" />
                    </span>
                  </button>
                )}
                <button
                  disabled={!first}
                  className={`menu-button ${resumable ? "" : "primary"}`}
                  aria-label="Играть"
                  onClick={() => setSelection(first)}
                >
                  <span className="button-symbol" aria-hidden="true">
                    <Icon name={resumable ? "plus" : "play"} />
                  </span>
                  <span>{resumable ? "Новый пазл" : "Играть"}</span>
                  <span className="button-arrow" aria-hidden="true">
                    <Icon name="next" />
                  </span>
                </button>
                <button
                  className="menu-button"
                  onClick={() => setScreen("collections")}
                >
                  <span className="button-symbol" aria-hidden="true">
                    <Icon name="puzzle" />
                  </span>
                  <span>Коллекции</span>
                  <span className="button-arrow" aria-hidden="true">
                    <Icon name="next" />
                  </span>
                </button>
              </div>
            </section>
            <section className="puzzle-display">
              <div className="table-label">
                <span className="label-pin" />
                На вашем столе
              </div>
              {first && (
                <button
                  className="featured-puzzle"
                  aria-label={`Выбрать пазл: ${first.title}`}
                  onClick={() => setSelection(first)}
                >
                  <TablePuzzle content={first} />
                </button>
              )}
              {first && (
                <div className="puzzle-caption">
                  <span className="caption-tag">{first.collection}</span>
                  <h2>{first.title}</h2>
                  <span>12 — 3000 деталей</span>
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="collection-screen">
            <div className="collection-heading">
              <button
                className="round-button"
                aria-label="Главное меню"
                onClick={() => setScreen("home")}
              >
                <Icon name="back" />
              </button>
              <div>
                <span className="menu-kicker">ВАША ПОЛКА</span>
                <h1>Коллекции</h1>
              </div>
              <span className="collection-total">
                {catalog.length} {catalog.length === 1 ? "пазл" : "пазлов"}
              </span>
            </div>
            <div className="collection-scroll">
              <div className="catalog-grid">
                {catalog.map((content) => (
                  <button
                    className="content-card"
                    key={content.id}
                    onClick={() => setSelection(content)}
                  >
                    <div className="card-art">
                      <img src={content.image} alt="" loading="lazy" />
                      <span className="card-piece-count">
                        <Icon name="puzzle" />
                        12–3000
                      </span>
                    </div>
                    <div className="card-caption">
                      <small>{content.collection}</small>
                      <h2>{content.title}</h2>
                      <span className="card-play">
                        <Icon name="play" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {!catalog.length && <p>На полке пока нет пазлов.</p>}
            </div>
          </section>
        )}
      </main>
      {selection && (
        <PaperDialog
          close={() => setSelection(undefined)}
          title="Выбор сложности"
        >
          <div className="difficulty-layout">
            <div className="difficulty-picture">
              <img src={selection.image} alt={selection.title} />
              <span className="caption-tag">{selection.collection}</span>
            </div>
            <div className="difficulty-options">
              <span className="menu-kicker">ВАШ СЛЕДУЮЩИЙ ПАЗЛ</span>
              <h2>{selection.title}</h2>
              <p>Сколько деталей соберём?</p>
              <div className="difficulty-grid">
                {difficulties.map((n) => (
                  <button
                    key={n}
                    aria-pressed={count === n}
                    className={count === n ? "selected" : ""}
                    onClick={() => setCount(n)}
                  >
                    {n >= 2000 ? "~" : ""}
                    {n}
                    <small>деталей</small>
                  </button>
                ))}
              </div>
              <p className="difficulty-note">
                Для больших пазлов — большой стол.
                <br />
                Масштаб всегда можно изменить.
              </p>
              {save && (
                <small className="replace-note">
                  Новый пазл заменит текущее сохранение.
                </small>
              )}
              <button
                className="start-button primary"
                onClick={() => start({ content: selection, count })}
              >
                Собирать пазл{" "}
                <span>
                  <Icon name="play" />
                </span>
              </button>
            </div>
          </div>
        </PaperDialog>
      )}
      {settings && (
        <PaperDialog close={() => setSettings(false)} title="Настройки">
          <div className="settings-sheet">
            <span className="menu-kicker">УСТРАИВАЙТЕСЬ ПОУДОБНЕЕ</span>
            <h2>Настройки</h2>
            <div className="settings-row">
              <span className="settings-symbol">
                <Icon name="check" />
              </span>
              <div>
                <strong>Автосохранение</strong>
                <p>
                  Ваш пазл остаётся на этом устройстве. Вернуться можно в любой
                  момент.
                </p>
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-symbol">
                <Icon name="fullscreen" />
              </span>
              <div>
                <strong>Управление столом</strong>
                <p>
                  Колесо мыши — масштаб. Тяните свободное место, чтобы двигать
                  поле. На сенсорном экране — два пальца.
                </p>
              </div>
            </div>
            <button className="primary" onClick={() => setSettings(false)}>
              Всё понятно
            </button>
          </div>
        </PaperDialog>
      )}
    </div>
  );
}
