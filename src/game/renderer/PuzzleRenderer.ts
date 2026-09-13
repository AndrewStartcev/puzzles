import {
  Application,
  Assets,
  Container,
  Graphics,
  Mesh,
  MeshGeometry,
  Sprite,
  type Texture,
} from "pixi.js";
import { contains } from "../puzzle-core/geometry";
import { PuzzleSession } from "../puzzle-core/session";
import type { Camera, Point, PieceState } from "../puzzle-core/types";
import { fitCamera, screenToWorld, zoomAt } from "../camera/camera";

export class PuzzleRenderer {
  private app = new Application();
  private world = new Container();
  private meshes = new Map<number, Mesh>();
  private texture!: Texture;
  private observer?: ResizeObserver;
  private abort = new AbortController();
  private active?: { id: number; offset: Point; original: PieceState };
  private pointers = new Map<number, Point>();
  private pan?: Point;
  private pinch?: { distance: number; centre: Point };
  private disposed = false;
  private initialized = false;
  private order: number[];
  camera: Camera = { x: 0, y: 0, zoom: 1 };
  constructor(
    private host: HTMLElement,
    readonly session: PuzzleSession,
    private changed: () => void,
  ) {
    this.order = session.states
      .filter((p) => p.location !== "tray")
      .map((p) => p.id);
  }
  async init(image: string, camera?: Camera) {
    await this.app.init({
      resizeTo: this.host,
      preference: "webgl",
      antialias: true,
      backgroundAlpha: 0,
      resolution: Math.min(devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    this.initialized = true;
    if (this.disposed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.texture = await Assets.load<Texture>(image);
    if (this.disposed) return;
    const g = this.session.geometry;
    this.app.stage.addChild(this.world);
    this.world.addChild(
      new Graphics()
        .roundRect(-8, -8, g.width + 16, g.height + 16, 10)
        .fill({ color: 0xcbd7ca, alpha: 0.2 }),
    );
    const guide = new Sprite(this.texture);
    guide.width = g.width;
    guide.height = g.height;
    guide.alpha = 0.14;
    this.world.addChild(guide);
    this.host.append(this.app.canvas);
    this.app.canvas.setAttribute("aria-label", "Игровое поле пазла");
    this.camera = camera ? { ...camera } : this.initialCamera();
    this.sync();
    this.observer = new ResizeObserver(() => {
      if (this.disposed) return;
      this.app.renderer.resize(this.host.clientWidth, this.host.clientHeight);
      this.sync();
    });
    this.observer.observe(this.host);
    const signal = this.abort.signal;
    this.host.addEventListener("wheel", this.wheel, { passive: false, signal });
    this.host.addEventListener("pointerdown", this.down, { signal });
    window.addEventListener("pointermove", this.move, { signal });
    window.addEventListener("pointerup", this.up, { signal });
    window.addEventListener("pointercancel", this.cancel, { signal });
    this.host.addEventListener("contextmenu", (e) => e.preventDefault(), {
      signal,
    });
    window.addEventListener(
      "keydown",
      (e) => {
        if ((e.target as HTMLElement).matches("input,select,textarea,button"))
          return;
        if (e.key.toLowerCase() === "f") this.fit();
      },
      { signal },
    );
  }
  private initialCamera() {
    const fit = fitCamera(
      this.host.clientWidth,
      this.host.clientHeight,
      this.session.geometry.width,
      this.session.geometry.height,
    );
    // Keep large puzzles usable on first opening; F offers a full overview.
    if (this.session.states.length > 300 && fit.zoom < 0.35)
      return { x: 32, y: 32, zoom: 0.35 };
    return fit;
  }
  private point(event: PointerEvent | WheelEvent): Point {
    const rect = this.host.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  private wheel = (event: WheelEvent) => {
    event.preventDefault();
    this.camera = zoomAt(
      this.camera,
      this.point(event),
      Math.exp(-event.deltaY * 0.0015),
    );
    this.sync();
    this.changed();
  };
  private down = (event: PointerEvent) => {
    if (
      this.active &&
      (event.pointerType !== "touch" || this.pointers.size === 0)
    )
      return;
    event.preventDefault();
    this.host.setPointerCapture(event.pointerId);
    const p = this.point(event);
    this.pointers.set(event.pointerId, p);
    if (this.pointers.size === 2) {
      this.restoreActive();
      this.pan = undefined;
      this.updatePinch();
      return;
    }
    const world = screenToWorld(this.camera, p);
    if (event.button === 0) {
      for (let i = this.order.length - 1; i >= 0; i--) {
        const id = this.order[i],
          state = this.session.states[id];
        if (state.location !== "board") continue;
        const piece = this.session.geometry.pieces[id];
        if (contains(piece.points, world.x - state.x, world.y - state.y)) {
          this.startDrag(id, { x: world.x - state.x, y: world.y - state.y });
          return;
        }
      }
    }
    this.pan = p;
  };
  private updatePinch() {
    const [a, b] = [...this.pointers.values()];
    if (a && b)
      this.pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
  }
  private move = (event: PointerEvent) => {
    const p = this.point(event);
    if (this.pointers.has(event.pointerId))
      this.pointers.set(event.pointerId, p);
    if (this.pointers.size >= 2 && this.pinch) {
      const old = this.pinch;
      this.updatePinch();
      this.camera = zoomAt(
        this.camera,
        old.centre,
        this.pinch!.distance / Math.max(1, old.distance),
      );
      this.camera.x += this.pinch!.centre.x - old.centre.x;
      this.camera.y += this.pinch!.centre.y - old.centre.y;
      this.sync();
      return;
    }
    if (this.active) {
      const w = screenToWorld(this.camera, p),
        state = this.session.states[this.active.id];
      state.x = w.x - this.active.offset.x;
      state.y = w.y - this.active.offset.y;
      this.sync();
    } else if (this.pan && this.pointers.has(event.pointerId)) {
      this.camera.x += p.x - this.pan.x;
      this.camera.y += p.y - this.pan.y;
      this.pan = p;
      this.sync();
    }
  };
  private up = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    this.pinch = undefined;
    this.pan = undefined;
    if (this.active) {
      const p = this.point(event),
        id = this.active.id;
      if (
        p.x < 0 ||
        p.y < 0 ||
        p.x > this.host.clientWidth ||
        p.y > this.host.clientHeight
      )
        this.restoreActive();
      else {
        this.move(event);
        const state = this.session.states[id];
        this.session.drop(id, state.x, state.y, this.camera.zoom);
        this.active = undefined;
      }
    }
    this.sync();
    this.changed();
  };
  private cancel = () => {
    this.pointers.clear();
    this.pinch = undefined;
    this.pan = undefined;
    this.restoreActive();
    this.sync();
    this.changed();
  };
  private restoreActive() {
    if (this.active)
      Object.assign(this.session.states[this.active.id], this.active.original);
    this.active = undefined;
  }
  private startDrag(id: number, offset: Point) {
    this.active = { id, offset, original: { ...this.session.states[id] } };
    this.session.states[id].location = "board";
    this.order = this.order.filter((n) => n !== id);
    this.order.push(id);
  }
  takeFromTray(id: number, event: PointerEvent) {
    if (this.active || this.session.states[id].location !== "tray") return;
    this.startDrag(id, {
      x: this.session.geometry.cellWidth / 2,
      y: this.session.geometry.cellHeight / 2,
    });
    this.move(event);
    this.sync();
  }
  snapshotStates() {
    return this.session.states.map((p) => ({
      ...(this.active?.id === p.id ? this.active.original : p),
    }));
  }
  fit() {
    this.camera = fitCamera(
      this.host.clientWidth,
      this.host.clientHeight,
      this.session.geometry.width,
      this.session.geometry.height,
    );
    this.sync();
    this.changed();
  }
  zoom(factor: number) {
    this.camera = zoomAt(
      this.camera,
      { x: this.host.clientWidth / 2, y: this.host.clientHeight / 2 },
      factor,
    );
    this.sync();
    this.changed();
  }
  private mesh(id: number): Mesh {
    const g = this.session.geometry,
      piece = g.pieces[id];
    const uvs = piece.points.map((value, i) =>
      i % 2 === 0
        ? (value + piece.targetX) / g.width
        : (value + piece.targetY) / g.height,
    );
    const geometry = new MeshGeometry({
      positions: new Float32Array(piece.points),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(piece.indices),
    });
    geometry.batchMode = "batch";
    return new Mesh({ geometry, texture: this.texture });
  }
  sync() {
    if (!this.texture || this.disposed) return;
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.camera.zoom);
    const margin =
      Math.max(
        this.session.geometry.cellWidth,
        this.session.geometry.cellHeight,
      ) * 1.4;
    const a = screenToWorld(this.camera, { x: 0, y: 0 }),
      b = screenToWorld(this.camera, {
        x: this.host.clientWidth,
        y: this.host.clientHeight,
      });
    const visible = new Set<number>();
    for (const id of this.order) {
      const p = this.session.states[id];
      if (
        p.location === "tray" ||
        p.x + margin < a.x ||
        p.y + margin < a.y ||
        p.x - margin > b.x ||
        p.y - margin > b.y
      )
        continue;
      visible.add(id);
      let mesh = this.meshes.get(id);
      if (!mesh) {
        mesh = this.mesh(id);
        this.meshes.set(id, mesh);
      }
      mesh.position.set(p.x, p.y);
      this.world.addChild(mesh);
    }
    for (const [id, mesh] of this.meshes)
      if (!visible.has(id)) {
        mesh.geometry.destroy();
        mesh.destroy();
        this.meshes.delete(id);
      }
  }
  destroy() {
    this.disposed = true;
    this.restoreActive();
    this.abort.abort();
    this.observer?.disconnect();
    for (const mesh of this.meshes.values()) mesh.geometry.destroy();
    this.meshes.clear();
    if (this.initialized) this.app.destroy(true, { children: true });
  }
}
