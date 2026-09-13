import { describe, expect, it } from "vitest";
import { generatePuzzle, contains } from "../src/game/puzzle-core/geometry";
import { PuzzleSession } from "../src/game/puzzle-core/session";
import { parseSave } from "../src/game/save/save";
import { screenToWorld, zoomAt } from "../src/game/camera/camera";
import type { PuzzleConfig, SaveGame } from "../src/game/puzzle-core/types";

const config: PuzzleConfig = {
  contentId: "test.jpeg",
  requestedCount: 48,
  seed: 42,
  imageWidth: 1600,
  imageHeight: 1200,
};
describe("procedural geometry", () => {
  it("reproduces geometry and shuffle from seed", () => {
    expect(generatePuzzle(config)).toEqual(generatePuzzle(config));
    expect(generatePuzzle({ ...config, seed: 43 }).pieces).not.toEqual(
      generatePuzzle(config).pieces,
    );
  });
  it.each([12, 48, 108, 300, 768, 1200, 2000, 3000])(
    "triangulates %i pieces without gaps or overlaps in area",
    (count) => {
      const g = generatePuzzle({ ...config, requestedCount: count });
      expect(g.pieces.length).toBeLessThanOrEqual(3000);
      let area = 0,
        validUvs = true,
        validHitTests = true;
      for (const p of g.pieces) {
        validHitTests &&=
          contains(p.points, g.cellWidth / 2, g.cellHeight / 2) &&
          !contains(p.points, -g.cellWidth, -g.cellHeight);
        for (let i = 0; i < p.indices.length; i += 3) {
          const [a, b, c] = p.indices.slice(i, i + 3).map((n) => n * 2);
          area +=
            Math.abs(
              (p.points[b] - p.points[a]) *
                (p.points[c + 1] - p.points[a + 1]) -
                (p.points[c] - p.points[a]) *
                  (p.points[b + 1] - p.points[a + 1]),
            ) / 2;
        }
        p.points.forEach((n, i) => {
          const uv =
            i % 2 ? (n + p.targetY) / g.height : (n + p.targetX) / g.width;
          validUvs &&= uv >= -1e-9 && uv <= 1 + 1e-9;
        });
      }
      expect(validUvs).toBe(true);
      expect(validHitTests).toBe(true);
      expect(area).toBeCloseTo(g.width * g.height, 3);
    },
  );
  it("uses exactly the same sampled seam on both sides", () => {
    const g = generatePuzzle(config);
    const worldPoints = (id: number) => {
      const p = g.pieces[id];
      return p.points.reduce<string[]>((out, x, i) => {
        if (i % 2 === 0)
          out.push(
            `${(x + p.targetX).toFixed(7)},${(p.points[i + 1] + p.targetY).toFixed(7)}`,
          );
        return out;
      }, []);
    };
    for (const p of g.pieces) {
      for (const neighbour of [
        p.col < g.columns - 1 ? p.id + 1 : -1,
        p.row < g.rows - 1 ? p.id + g.columns : -1,
      ]) {
        if (neighbour < 0) continue;
        const other = new Set(worldPoints(neighbour));
        expect(
          worldPoints(p.id).filter((point) => other.has(point)).length,
        ).toBe(43);
      }
    }
  });
});
describe("session and saving", () => {
  it("snaps nearby pieces, leaves distant pieces free, locks placed pieces", () => {
    const s = new PuzzleSession(generatePuzzle(config));
    expect(s.drop(0, 200, 200, 1)).toBe(false);
    expect(s.states[0].location).toBe("board");
    expect(s.drop(0, 3, 4, 1)).toBe(true);
    expect(s.drop(0, 200, 200, 1)).toBe(false);
    expect(s.states[0]).toEqual({ id: 0, x: 0, y: 0, location: "placed" });
  });
  it("restores compact versioned save and rejects corrupt or incompatible data", () => {
    const session = new PuzzleSession(generatePuzzle(config));
    session.drop(0, 0, 0, 1);
    const save: SaveGame = {
      version: 1,
      geometryVersion: 1,
      config,
      camera: { x: 10, y: 20, zoom: 1 },
      pieces: session.states,
      elapsedSeconds: 12,
      updatedAt: Date.now(),
    };
    expect(
      new PuzzleSession(generatePuzzle(config), parseSave(JSON.stringify(save)))
        .placed,
    ).toBe(1);
    expect(parseSave("garbage")).toBeUndefined();
    expect(parseSave(JSON.stringify({ ...save, version: 2 }))).toBeUndefined();
    expect(parseSave(JSON.stringify({ ...save, pieces: [] }))).toBeUndefined();
    expect(
      parseSave(JSON.stringify({ ...save, camera: { x: 0, y: 0, zoom: 0 } })),
    ).toBeUndefined();
    expect(JSON.stringify(save)).not.toContain("points");
  });
  it("keeps the world point beneath the zoom anchor", () => {
    const camera = { x: 20, y: 30, zoom: 0.7 },
      anchor = { x: 400, y: 300 };
    const before = screenToWorld(camera, anchor),
      after = screenToWorld(zoomAt(camera, anchor, 1.7), anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
});
