import type { PieceState, PuzzleGeometry, SaveGame } from "./types";

export class PuzzleSession {
  readonly states: PieceState[];
  constructor(
    readonly geometry: PuzzleGeometry,
    save?: SaveGame,
  ) {
    this.states = save
      ? save.pieces.map((p) => ({ ...p }))
      : geometry.pieces.map((p) => ({
          id: p.id,
          x: 0,
          y: 0,
          location: "tray",
        }));
  }
  get placed() {
    return this.states.reduce((n, p) => n + Number(p.location === "placed"), 0);
  }
  get workspace() {
    const g = this.geometry;
    return {
      x: -g.width * 0.6,
      y: -g.height * 0.6,
      width: g.width * 2.2,
      height: g.height * 2.2,
    };
  }
  scatter(rng: () => number = Math.random) {
    const g = this.geometry,
      area = this.workspace;
    const size = Math.max(g.cellWidth, g.cellHeight),
      pad = size * 0.7;
    const slots: { x: number; y: number }[] = [];
    for (
      let y = area.y + pad;
      y <= area.y + area.height - pad;
      y += size * 1.05
    )
      for (
        let x = area.x + pad;
        x <= area.x + area.width - pad;
        x += size * 1.05
      )
        if (
          x < -size * 0.35 ||
          x > g.width + size * 0.35 ||
          y < -size * 0.35 ||
          y > g.height + size * 0.35
        )
          slots.push({ x, y });
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    let i = 0;
    for (const state of this.states) {
      if (state.location === "placed") continue;
      const slot = slots[i++ % slots.length];
      if (!slot) continue;
      Object.assign(state, {
        x: slot.x - g.cellWidth / 2 + (rng() - 0.5) * size * 0.15,
        y: slot.y - g.cellHeight / 2 + (rng() - 0.5) * size * 0.15,
        location: "board",
        rotation: Math.floor(rng() * 4),
        rotatable: true,
      });
    }
  }
  rotate(id: number) {
    const state = this.states[id];
    if (!state || state.location !== "board" || !state.rotatable) return false;
    state.rotation = ((state.rotation ?? 0) + 1) % 4;
    return true;
  }
  drop(id: number, x: number, y: number, zoom: number) {
    const state = this.states[id],
      piece = this.geometry.pieces[id];
    if (
      !state ||
      state.location === "placed" ||
      ![x, y, zoom].every(Number.isFinite) ||
      zoom <= 0
    )
      return false;
    const tolerance = Math.min(
      28 / zoom,
      Math.min(this.geometry.cellWidth, this.geometry.cellHeight) * 0.28,
    );
    const placed =
      (state.rotation ?? 0) === 0 &&
      Math.hypot(x - piece.targetX, y - piece.targetY) <= tolerance;
    Object.assign(state, {
      x: placed ? piece.targetX : x,
      y: placed ? piece.targetY : y,
      location: placed ? "placed" : "board",
    });
    return placed;
  }
}
