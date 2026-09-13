# Нарисованные UI-ассеты «Мира пазлов»

Созданы 2026-09-13 встроенным инструментом imagegen (built-in mode). Новая оригинальная генерация, без внешних изображений. Оригиналы скопированы в проект без изменения; тестовый пазл assets/puzzles/test.jpeg не менялся.

- `room-background.png`: 1672×941, RGB, самостоятельный фон комнаты / стола. Используется в CSS за игровыми слоями.
- `puzzle-board.png`: 1672×940, RGBA, отдельная деревянная доска с прозрачным окружением. В игре — NineSliceSprite, в меню — отдельный CSS-фон.

Иконки — [Phosphor React](https://github.com/phosphor-icons/react), лицензия MIT, стиль duotone. Компонент src/ui/Icon.tsx импортирует только используемые SVG-иконки.

## Промпт фона

Use case: stylized-concept. Asset type: 16:9 raster background for the full-screen Russian jigsaw game Мир пазлов. Primary request: draw an original premium light tabletop-game environment background, independent from the playable table and board that will be composited by the app. Scene/backdrop: softly illustrated sunlit craft room viewed mostly from above, a pale warm ivory paper-like work surface in the central 85 percent, with a few tasteful painterly hints of linen, soft sage foliage and warm pale oak along the outermost edges only. Style/medium: high-quality hand-painted casual PC game background, tactile natural materials, gentle brush texture and softly rounded forms, warm daylight from upper left. Composition: wide landscape 16:9, very quiet spacious center for separately composited UI/table/board. No table frame, no playable board, no puzzle pieces, no buttons, no icons, no lettering, no text, no logo, no mock UI. Keep any edge decoration understated and cropped, no busy objects in center, no perspective-heavy furniture. Palette: creamy ivory, very pale honey oak, sage accents, warm paper, subtle powder-blue reflections. Avoid website hero aesthetic, vector flat fills, dense repeating grid texture, dark vignette, orange saturation. Generate the standalone background art.

## Промпт доски

Use case: stylized-concept. Asset type: separate transparent-background puzzle board sprite for a light tactile tabletop PC game, independent from room background. Draw a single large top-down rectangular removable jigsaw work board, landscape 16:9, perfectly orthographic, very thin pale honey-oak beveled rounded wooden rim and a calm smooth sage linen inner surface. Premium softly painted casual game material rendering, warm daylight upper left, subtle grain on rim, small realistic contact shadows and bevel, almost invisible fine linen texture not a harsh grid. The interior must be completely empty and uniform, for puzzle pieces and guide image to be composited on it. Whole board fully visible centered, straight aligned horizontal edges, board fills 96% of canvas with small padding. Transparent outside the board, genuine alpha. No background, no room, no other objects, no puzzle pieces, no text, no icons, no buttons, no perspective tilt, no floral decoration. The wooden border should stay narrow and elegant, about 3% of the board width.
