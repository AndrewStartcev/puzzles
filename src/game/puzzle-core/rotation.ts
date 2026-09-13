import type { PieceState, Point, PuzzleGeometry } from "./types";
export function pieceLocal(
  state: PieceState,
  point: Point,
  geometry: PuzzleGeometry,
): Point {
  const cx = geometry.cellWidth / 2,
    cy = geometry.cellHeight / 2;
  const angle = (-(state.rotation ?? 0) * Math.PI) / 2;
  const x = point.x - state.x - cx,
    y = point.y - state.y - cy;
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle) + cx,
    y: x * Math.sin(angle) + y * Math.cos(angle) + cy,
  };
}
