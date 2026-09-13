import type { Camera, Point } from "../puzzle-core/types";
export const MIN_ZOOM = 0.025,
  MAX_ZOOM = 3;
export function screenToWorld(camera: Camera, p: Point): Point {
  return {
    x: (p.x - camera.x) / camera.zoom,
    y: (p.y - camera.y) / camera.zoom,
  };
}
export function zoomAt(camera: Camera, p: Point, factor: number): Camera {
  const world = screenToWorld(camera, p);
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor));
  return { x: p.x - world.x * zoom, y: p.y - world.y * zoom, zoom };
}
export function fitCamera(
  width: number,
  height: number,
  boardWidth: number,
  boardHeight: number,
): Camera {
  const zoom = Math.max(
    MIN_ZOOM,
    Math.min(1, (width - 64) / boardWidth, (height - 64) / boardHeight),
  );
  return {
    x: (width - boardWidth * zoom) / 2,
    y: (height - boardHeight * zoom) / 2,
    zoom,
  };
}
