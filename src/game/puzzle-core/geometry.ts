import earcut from "earcut";
import type { Point, PuzzleConfig, PuzzleGeometry } from "./types";

export function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function chooseGrid(count: number, aspect: number) {
  if (
    !Number.isFinite(count) ||
    count < 12 ||
    count > 3000 ||
    !Number.isFinite(aspect) ||
    aspect <= 0
  )
    throw new Error("Некорректная сложность или пропорции");
  let best = { columns: 4, rows: 3, score: Infinity };
  for (
    let rows = 2;
    rows <= Math.min(1500, Math.ceil(Math.sqrt(count / aspect) * 2 + 2));
    rows++
  ) {
    const columns = Math.max(2, Math.round(count / rows));
    if (columns * rows > 3000) continue;
    const score =
      Math.abs(columns * rows - count) / count +
      Math.abs(Math.log(columns / rows / aspect)) * 0.35;
    if (score < best.score) best = { columns, rows, score };
  }
  return { columns: best.columns, rows: best.rows };
}

// Every shared edge is sampled once in board coordinates and reversed by its neighbour.
function edge(a: Point, b: Point, depth: number, rng: () => number): Point[] {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy);
  const nx = -dy / length,
    ny = dx / length;
  const centre = 0.5 + (rng() - 0.5) * 0.06;
  const d = depth * (rng() > 0.5 ? 1 : -1) * (0.94 + rng() * 0.12);
  const at = (u: number, v: number): Point => ({
    x: a.x + dx * (u + centre - 0.5) + nx * d * v,
    y: a.y + dy * (u + centre - 0.5) + ny * d * v,
  });
  const segments = [
    [0.36, 0, 0.43, 0, 0.46, 0, 0.46, 0.25],
    [0.46, 0.25, 0.46, 0.4, 0.37, 0.4, 0.37, 0.65],
    [0.37, 0.65, 0.37, 1.12, 0.63, 1.12, 0.63, 0.65],
    [0.63, 0.65, 0.63, 0.4, 0.54, 0.4, 0.54, 0.25],
    [0.54, 0.25, 0.54, 0, 0.57, 0, 0.64, 0],
  ];
  const points = [a, at(0.36, 0)];
  for (const s of segments)
    for (let step = 1; step <= 8; step++) {
      const t = step / 8,
        q = 1 - t;
      points.push(
        at(
          q ** 3 * s[0] +
            3 * q ** 2 * t * s[2] +
            3 * q * t ** 2 * s[4] +
            t ** 3 * s[6],
          q ** 3 * s[1] +
            3 * q ** 2 * t * s[3] +
            3 * q * t ** 2 * s[5] +
            t ** 3 * s[7],
        ),
      );
    }
  points.push(b);
  return points;
}

export function generatePuzzle(config: PuzzleConfig): PuzzleGeometry {
  if (
    ![config.imageWidth, config.imageHeight].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    throw new Error("Некорректное изображение");
  const { columns, rows } = chooseGrid(
    config.requestedCount,
    config.imageWidth / config.imageHeight,
  );
  const cellWidth = 160,
    cellHeight =
      (((cellWidth * columns) / rows) * config.imageHeight) / config.imageWidth;
  const rng = random(config.seed),
    depth = Math.min(cellWidth, cellHeight) * 0.18;
  const h: Point[][][] = [],
    v: Point[][][] = [];
  for (let r = 0; r <= rows; r++) {
    h[r] = [];
    for (let c = 0; c < columns; c++) {
      const a = { x: c * cellWidth, y: r * cellHeight },
        b = { x: (c + 1) * cellWidth, y: a.y };
      h[r][c] = r === 0 || r === rows ? [a, b] : edge(a, b, depth, rng);
    }
  }
  for (let r = 0; r < rows; r++) {
    v[r] = [];
    for (let c = 0; c <= columns; c++) {
      const a = { x: c * cellWidth, y: r * cellHeight },
        b = { x: a.x, y: (r + 1) * cellHeight };
      v[r][c] = c === 0 || c === columns ? [a, b] : edge(a, b, depth, rng);
    }
  }
  const pieces: PuzzleGeometry["pieces"] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const targetX = c * cellWidth,
        targetY = r * cellHeight;
      const sides = [
        h[r][c],
        v[r][c + 1],
        [...h[r + 1][c]].reverse(),
        [...v[r][c]].reverse(),
      ];
      const points = sides
        .flatMap((side) => side.slice(0, -1))
        .flatMap((p) => [p.x - targetX, p.y - targetY]);
      pieces.push({
        id: pieces.length,
        row: r,
        col: c,
        targetX,
        targetY,
        points,
        indices: earcut(points),
      });
    }
  const trayOrder = pieces.map((p) => p.id);
  for (let i = trayOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [trayOrder[i], trayOrder[j]] = [trayOrder[j], trayOrder[i]];
  }
  return {
    config,
    columns,
    rows,
    cellWidth,
    cellHeight,
    width: columns * cellWidth,
    height: rows * cellHeight,
    pieces,
    trayOrder,
  };
}

export function contains(points: number[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i],
      yi = points[i + 1],
      xj = points[j],
      yj = points[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
