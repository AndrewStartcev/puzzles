import { describe, expect, it } from "vitest";
import {
  generatePuzzle,
  contains,
  random,
} from "../src/game/puzzle-core/geometry";
import { pieceLocal } from "../src/game/puzzle-core/rotation";
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
  it.each([12, 300, 3000])(
    "scatters %i loose pieces within the board and preserves installed pieces",
    (count) => {
      const session = new PuzzleSession(
        generatePuzzle({ ...config, requestedCount: count }),
      );
      session.drop(0, 0, 0, 1);
      const installed = { ...session.states[0] };
      session.scatter(random(31));
      expect(session.states[0]).toEqual(installed);
      const area = session.workspace,
        g = session.geometry;
      let valid = true;
      for (const p of session.states.slice(1))
        valid &&=
          p.location === "board" &&
          p.rotatable === true &&
          p.rotation! >= 0 &&
          p.rotation! <= 3 &&
          p.x > area.x &&
          p.y > area.y &&
          p.x + g.cellWidth < area.x + area.width &&
          p.y + g.cellHeight < area.y + area.height;
      expect(valid).toBe(true);
    },
  );
  it("allows click rotation only after scattering and snaps only at zero rotation", () => {
    const s = new PuzzleSession(generatePuzzle(config));
    expect(s.rotate(0)).toBe(false);
    s.drop(0, 200, 200, 1);
    expect(s.rotate(0)).toBe(false);
    s.scatter(random(9));
    s.states[0].rotation = 1;
    expect(s.drop(0, 0, 0, 1)).toBe(false);
    for (let i = 0; i < 3; i++) expect(s.rotate(0)).toBe(true);
    expect(s.states[0].rotation).toBe(0);
    expect(s.drop(0, 0, 0, 1)).toBe(true);
    expect(s.rotate(0)).toBe(false);
  });
  it("transforms hit tests around a rotated non-square piece centre", () => {
    const g = generatePuzzle(config),
      state = { id: 0, x: 50, y: 70, rotation: 1, location: "board" as const };
    const local = { x: 20, y: 30 },
      cx = g.cellWidth / 2,
      cy = g.cellHeight / 2;
    const world = {
      x: state.x + cx - (local.y - cy),
      y: state.y + cy + (local.x - cx),
    };
    const actual = pieceLocal(state, world, g);
    expect(actual.x).toBeCloseTo(local.x);
    expect(actual.y).toBeCloseTo(local.y);
  });
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
    session.scatter(random(6));
    const rotatedSave = {
      ...save,
      pieces: session.states,
      hintOpacity: 0.62,
      guideVisible: true,
    };
    const parsed = parseSave(JSON.stringify(rotatedSave))!;
    expect(parsed.hintOpacity).toBe(0.62);
    expect(parsed.pieces).toEqual(session.states);
    expect(
      parseSave(JSON.stringify({ ...rotatedSave, hintOpacity: 2 })),
    ).toBeUndefined();
    expect(
      parseSave(
        JSON.stringify({
          ...rotatedSave,
          pieces: session.states.map((p) => ({ ...p, rotation: 9 })),
        }),
      ),
    ).toBeUndefined();
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
