# Web migration — 2026-09-13

Название: «Мир пазлов». Production-проект полностью заменён на Vite + React + strict TypeScript + PixiJS 8 / WebGL.

Удалено: project.godot, scenes/main.tscn, scripts/main.gd, main_v2.gd, main_v3.gd, puzzle_piece.gd, puzzle_piece_v2.gd, puzzle_piece_v3.gd. Удалены устаревшие инструкции запуска и сохранения прототипа. История доступна в Git.

Сохранён assets/puzzles/test.jpeg без изменения байтов: Git blob 88546d791f20677011aa935b2cc8e6891dd965aa совпадает до и после миграции.

Созданы: Vite/React bootstrap, UI четырёх базовых экранов и настроек, content catalog, независимая модель PuzzleSession, shared-edge Bézier geometry / Worker / earcut, PixiJS renderer с UV и viewport culling / batching, zoom/pan/pinch, виртуальный вертикальный tray, snap / завершение, формат и валидация локальных сохранений, platform adapters local / pikabu / vk / ok, lockfile и GitHub Actions checks.

Обновлены README, DESIGN_DOC, TECH_DECISION_WEB, NEXT_SESSION и описание ассетов. Яндекс SDK отсутствует.

## Выполненная проверка

- npm run test: 13/13. Повторяемость seed/shuffle, точные соседние стыки, UV, площадь триангуляции всех сложностей, hit testing, snap/locking, save validation/restore и zoom anchor.
- npm run build: TypeScript и production-сборка проходят.
- npm run test:e2e: 2/2 в Chromium с software WebGL. Полная сборка 12 деталей, сохранение и продолжение после reload; режим ~3000 создаёт 65 × 46 = 2990 деталей, виртуальный tray, фильтр краёв, camera controls, мобильный viewport. Отдельный save fixture проверяет реальную отрисовку всех 2990 meshes, zoom и выход в меню без pageerror.
- Скриншоты главной, завершения, большого стола и mobile просмотрены. Browser screenshots / reports находятся в игнорируемом test-results и не являются runtime-ассетами.
- npm audit: 0 vulnerabilities. git diff --cached --check проходит.

Проверка software WebGL подтверждает работоспособность, а не обещает FPS на реальных устройствах. Init платформ реализован по официальной документации, но реальные контейнеры не тестировались: нужны зарегистрированные приложения. Cloud save, ads, payments = false; локальные сохранения работают для всех адаптеров. Магазин, daily, экономика, свободные группы деталей остаются следующими этапами.

Работа выполнена в отдельной чистой копии main: первоначальный локальный checkout имел незакоммиченную замену test.jpeg на test.png и оставлен нетронутым.
