import { generatePuzzle } from "./geometry";
import type { PuzzleConfig } from "./types";

self.onmessage = (event: MessageEvent<PuzzleConfig>) => {
  try {
    self.postMessage({ geometry: generatePuzzle(event.data) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Ошибка генерации",
    });
  }
};
