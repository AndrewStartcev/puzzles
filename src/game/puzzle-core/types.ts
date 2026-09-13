export interface Point {
  x: number;
  y: number;
}
export interface Camera extends Point {
  zoom: number;
}
export interface PuzzleConfig {
  contentId: string;
  seed: number;
  requestedCount: number;
  imageWidth: number;
  imageHeight: number;
}
export interface PieceGeometry {
  id: number;
  row: number;
  col: number;
  targetX: number;
  targetY: number;
  points: number[];
  indices: number[];
}
export interface PuzzleGeometry {
  config: PuzzleConfig;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  width: number;
  height: number;
  pieces: PieceGeometry[];
  trayOrder: number[];
}
export interface PieceState extends Point {
  id: number;
  location: "tray" | "board" | "placed";
}
export interface SaveGame {
  version: 1;
  geometryVersion: 1;
  config: PuzzleConfig;
  camera: Camera;
  pieces: PieceState[];
  elapsedSeconds: number;
  updatedAt: number;
}
