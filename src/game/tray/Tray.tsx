import { useEffect, useRef, useState } from "react";
import type { PuzzleSession } from "../puzzle-core/session";
import type { PieceGeometry, PuzzleGeometry } from "../puzzle-core/types";
import { Icon } from "../../ui/Icon";

export function PiecePreview({
  piece,
  geometry,
  image,
}: {
  piece: PieceGeometry;
  geometry: PuzzleGeometry;
  image: string;
}) {
  const clip = `piece-${piece.id}`;
  const pad = Math.min(geometry.cellWidth, geometry.cellHeight) * 0.24;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${geometry.cellWidth + pad * 2} ${geometry.cellHeight + pad * 2}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <polygon
            points={piece.points.reduce(
              (s, n, i) => s + n + (i % 2 ? " " : ","),
              "",
            )}
          />
        </clipPath>
      </defs>
      <image
        href={image}
        x={-piece.targetX}
        y={-piece.targetY}
        width={geometry.width}
        height={geometry.height}
        clipPath={`url(#${clip})`}
      />
    </svg>
  );
}

const ROW = 126;
export function Tray({
  session,
  image,
  revision,
  take,
}: {
  session: PuzzleSession;
  image: string;
  revision: number;
  take: (id: number, event: PointerEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0),
    [height, setHeight] = useState(600),
    [edges, setEdges] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setHeight(entries[0].contentRect.height),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const g = session.geometry;
  const ids = g.trayOrder.filter((id) => {
    const p = g.pieces[id];
    return (
      session.states[id].location === "tray" &&
      (!edges ||
        p.row === 0 ||
        p.col === 0 ||
        p.row === g.rows - 1 ||
        p.col === g.columns - 1)
    );
  });
  useEffect(() => {
    if (ref.current && scroll > Math.max(0, ids.length * ROW - height))
      ref.current.scrollTop = Math.max(0, ids.length * ROW - height);
  }, [ids.length, height, scroll, revision]);
  const start = Math.max(0, Math.floor(scroll / ROW) - 2),
    end = Math.min(ids.length, Math.ceil((scroll + height) / ROW) + 2);
  return (
    <aside className="tray">
      <div className="tray-heading">
        <strong>Детали</strong>
        <span>{ids.length}</span>
      </div>
      <label className="edge-filter">
        <input
          type="checkbox"
          checked={edges}
          onChange={(e) => {
            setEdges(e.target.checked);
            if (ref.current) ref.current.scrollTop = 0;
          }}
        />
        <Icon name="puzzle" size={14} /> Только края
      </label>
      <div
        className="tray-scroll"
        ref={ref}
        onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
      >
        <div style={{ height: ids.length * ROW, position: "relative" }}>
          {ids.slice(start, end).map((id, i) => (
            <button
              key={id}
              className="tray-piece"
              aria-label={`Деталь ${id + 1}`}
              style={{
                position: "absolute",
                top: (start + i) * ROW,
                height: ROW - 10,
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                take(id, e.nativeEvent);
              }}
            >
              <PiecePreview piece={g.pieces[id]} geometry={g} image={image} />
              <span>{id + 1}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
