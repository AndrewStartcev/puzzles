import { useCallback, useEffect, useState } from "react";
import { catalog, difficulties, type PuzzleContent } from "../content/catalog";
import { createPlatform } from "../platform";
import { LocalAdapter } from "../platform/local/LocalAdapter";
import type { PlatformAdapter } from "../platform/types";
import type { SaveGame } from "../game/puzzle-core/types";
import { parseSave, SAVE_KEY } from "../game/save/save";
import { PuzzleGame, type GameRequest } from "../ui/PuzzleGame";

export function App() {
  const [platform, setPlatform] = useState<PlatformAdapter>(),
    [platformError, setPlatformError] = useState("");
  const [save, setSave] = useState<SaveGame>(),
    [request, setRequest] = useState<GameRequest>();
  const [selection, setSelection] = useState<PuzzleContent>(),
    [count, setCount] = useState(48);
  const [tab, setTab] = useState("Главная");
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
  const first = catalog[0],
    resumable = save && catalog.find((c) => c.id === save.config.contentId);
  return (
    <div className="shell">
      <header className="site-header">
        <a className="brand" href="#" onClick={() => setTab("Главная")}>
          <span>✦</span> Мир пазлов
        </a>
        <nav>
          {["Главная", "Коллекции", "Настройки"].map((t) => (
            <button
              key={t}
              className={tab === t ? "nav-active" : "subtle"}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <span className="profile">Ваше пространство</span>
      </header>
      <main>
        {platformError && (
          <p className="notice" role="status">
            {platformError}
          </p>
        )}
        {tab === "Настройки" ? (
          <section className="settings">
            <p className="eyebrow">ВАШЕ ПРОСТРАНСТВО</p>
            <h1>Настройки</h1>
            <p>
              Прогресс автоматически сохраняется на этом устройстве. Платформа:{" "}
              {platform.id}.
            </p>
            <p>
              Двигайте поле по свободному месту или правой / средней кнопкой
              мыши. На сенсорном экране используйте два пальца для масштаба.
            </p>
            <button onClick={() => setTab("Главная")}>На главную</button>
          </section>
        ) : (
          <>
            {tab === "Главная" && (
              <section className="hero">
                <div className="hero-copy">
                  <p className="eyebrow">МАЛЕНЬКИЕ ДЕТАЛИ. БОЛЬШИЕ ОТКРЫТИЯ.</p>
                  <h1>
                    Соберите свой
                    <br />
                    <em>мир.</em>
                  </h1>
                  <p>
                    Остановитесь на минуту. Найдите знакомый уголок — и сложите
                    целую историю из маленьких деталей.
                  </p>
                  <div className="hero-actions">
                    <button
                      disabled={!first}
                      onClick={() => setSelection(first)}
                    >
                      Начать путешествие ↗
                    </button>
                    {resumable && save && (
                      <button
                        className="secondary"
                        onClick={() =>
                          setRequest({
                            content: resumable,
                            count: save.config.requestedCount,
                            save,
                          })
                        }
                      >
                        Продолжить ·{" "}
                        {
                          save.pieces.filter((p) => p.location === "placed")
                            .length
                        }
                        /{save.pieces.length}
                      </button>
                    )}
                  </div>
                  <span className="hero-note">
                    От 12 до 3000 деталей · В вашем темпе
                  </span>
                </div>
                <div className="hero-image">
                  {first && <img src={first.image} alt={first.title} />}
                  <span className="image-caption">
                    Каждая деталь — часть истории
                  </span>
                </div>
              </section>
            )}
            <section className="collections">
              <div className="section-title">
                <div>
                  <p className="eyebrow">ВЫБЕРИТЕ СВОЁ НАСТРОЕНИЕ</p>
                  <h2>Коллекции</h2>
                </div>
                <span>
                  {catalog.length}{" "}
                  {catalog.length === 1 ? "изображение" : "изображений"}
                </span>
              </div>
              <div className="catalog-grid">
                {catalog.map((content) => (
                  <button
                    className="content-card"
                    key={content.id}
                    onClick={() => setSelection(content)}
                  >
                    <div>
                      <img src={content.image} alt="" loading="lazy" />
                      <span>12–3000 деталей</span>
                    </div>
                    <small>{content.collection}</small>
                    <h3>
                      {content.title} <span>↗</span>
                    </h3>
                  </button>
                ))}
              </div>
              {!catalog.length && (
                <p>
                  Добавьте изображение в assets/puzzles и перезапустите
                  приложение.
                </p>
              )}
            </section>
          </>
        )}
      </main>
      <footer className="site-footer">
        <span>Мир пазлов</span>
        <span>Пикабу Игры · VK · Одноклассники</span>
      </footer>
      {selection && (
        <div className="modal-backdrop" onClick={() => setSelection(undefined)}>
          <section
            className="difficulty-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="difficulty-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelection(undefined);
            }}
          >
            <button
              autoFocus
              className="modal-close subtle"
              aria-label="Закрыть"
              onClick={() => setSelection(undefined)}
            >
              ×
            </button>
            <img src={selection.image} alt="" />
            <p className="eyebrow">ВЫБЕРИТЕ СЛОЖНОСТЬ</p>
            <h2 id="difficulty-title">{selection.title}</h2>
            <div className="difficulty-grid">
              {difficulties.map((n) => (
                <button
                  key={n}
                  aria-pressed={count === n}
                  className={count === n ? "selected" : "secondary"}
                  onClick={() => setCount(n)}
                >
                  {n >= 2000 ? "~" : ""}
                  {n}
                  <small>деталей</small>
                </button>
              ))}
            </div>
            <p>
              Сетка подстраивается под изображение. В больших пазлах растёт
              стол, а детали остаются удобными.
            </p>
            {save && <small>Новый пазл заменит текущее сохранение.</small>}
            <button
              className="start-button"
              onClick={() => {
                setRequest({ content: selection, count });
                setSelection(undefined);
              }}
            >
              Собирать пазл →
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
