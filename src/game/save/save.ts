import { chooseGrid } from "../puzzle-core/geometry";
import type { SaveGame } from "../puzzle-core/types";

export const SAVE_KEY = "mir-pazlov:save:v1";
export function parseSave(raw: string | null): SaveGame | undefined {
  if (!raw || raw.length > 2_000_000) return;
  try {
    const s = JSON.parse(raw) as SaveGame;
    if (
      s.version !== 1 ||
      s.geometryVersion !== 1 ||
      !s.config ||
      typeof s.config.contentId !== "string"
    )
      return;
    const c = s.config;
    if (
      ![c.seed, c.requestedCount, c.imageWidth, c.imageHeight].every(
        Number.isFinite,
      ) ||
      !Number.isInteger(c.seed) ||
      c.imageWidth <= 0 ||
      c.imageHeight <= 0
    )
      return;
    const grid = chooseGrid(c.requestedCount, c.imageWidth / c.imageHeight);
    if (
      !s.camera ||
      ![
        s.camera.x,
        s.camera.y,
        s.camera.zoom,
        s.elapsedSeconds,
        s.updatedAt,
      ].every(Number.isFinite) ||
      s.camera.zoom < 0.025 ||
      s.camera.zoom > 3 ||
      s.elapsedSeconds < 0
    )
      return;
    if (
      !Array.isArray(s.pieces) ||
      s.pieces.length !== grid.columns * grid.rows
    )
      return;
    if (
      !s.pieces.every(
        (p, i) =>
          p &&
          p.id === i &&
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          Math.abs(p.x) < 1e7 &&
          Math.abs(p.y) < 1e7 &&
          ["tray", "board", "placed"].includes(p.location),
      )
    )
      return;
    // Installed pieces always restore to canonical coordinates, never trust saved positions.
    const cellHeight =
      (((160 * grid.columns) / grid.rows) * c.imageHeight) / c.imageWidth;
    s.pieces.forEach((p) => {
      if (p.location === "placed") {
        p.x = (p.id % grid.columns) * 160;
        p.y = Math.floor(p.id / grid.columns) * cellHeight;
      }
    });
    return s;
  } catch {
    return;
  }
}
