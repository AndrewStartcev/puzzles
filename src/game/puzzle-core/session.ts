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
      Math.hypot(x - piece.targetX, y - piece.targetY) <= tolerance;
    Object.assign(state, {
      x: placed ? piece.targetX : x,
      y: placed ? piece.targetY : y,
      location: placed ? "placed" : "board",
    });
    return placed;
  }
}
