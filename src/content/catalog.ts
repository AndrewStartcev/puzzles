export interface PuzzleContent {
  id: string;
  title: string;
  collection: string;
  image: string;
}

const images = import.meta.glob<string>(
  "../../assets/puzzles/**/*.{png,jpg,jpeg,webp}",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

export const catalog: PuzzleContent[] = Object.entries(images)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, image], i) => ({
    id: path.split("/assets/puzzles/")[1],
    title:
      i === 0
        ? "Первое путешествие"
        : path
            .split("/")
            .pop()!
            .replace(/\.[^.]+$/, ""),
    collection: "Первые открытия",
    image,
  }));

export const difficulties = [12, 48, 108, 300, 768, 1200, 2000, 3000] as const;
