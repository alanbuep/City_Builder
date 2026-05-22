import { SceneManager } from './render/SceneManager';
import { CityRenderer } from './render/CityRenderer';
import { Picker } from './input/Picker';
import { Toolbar } from './ui/Toolbar';
import { Hud } from './ui/Hud';
import { Inspector } from './ui/Inspector';
import { City } from './sim/City';
import { Simulation } from './sim/Simulation';
import { TILE_DEF, TileType } from './sim/types';
import { GridSpec } from './grid';

interface Coord {
  x: number;
  z: number;
}

/** Un paso del trazo actual: dónde se pintó y qué había antes (para deshacer). */
interface DragStep {
  x: number;
  z: number;
  prevType: TileType;
  prevLevel: number;
  prevBuilding: boolean; // si lo pintado tapó un edificio multi-casilla (no se recrea al deshacer)
  cost: number;
}

const TICK_INTERVAL_MS = 1000; // 1 mes de juego por segundo (a velocidad 1x)
const MAX_CATCHUP = 5; // máx. de meses a "recuperar" si la pestaña se congela

/**
 * El director de orquesta: crea la simulación, el render, el picking y la UI,
 * los conecta y corre el bucle principal (render a 60fps + simulación a ticks
 * de tiempo fijo, independientes entre sí).
 */
export class Game {
  private grid: GridSpec = { width: 32, height: 32, tileSize: 1 };

  private city: City;
  private sim: Simulation;
  private scene: SceneManager;
  private cityRenderer: CityRenderer;
  private picker: Picker;
  private toolbar: Toolbar;
  private hud: Hud;
  private inspector: Inspector;

  private painting = false;
  private dragPath: DragStep[] = []; // trazo del arrastre actual (permite retroceder)
  private selected: Coord | null = null;

  // Reloj de simulación.
  private paused = false;
  private speed = 1;
  private accumulator = 0;
  private lastTime = performance.now();

  constructor(
    canvasContainer: HTMLElement,
    toolbarContainer: HTMLElement,
    hudContainer: HTMLElement,
    inspectorContainer: HTMLElement,
  ) {
    this.city = new City(this.grid.width, this.grid.height);
    this.sim = new Simulation(this.city);
    this.scene = new SceneManager(canvasContainer);
    this.cityRenderer = new CityRenderer(this.scene.scene, this.city, this.grid);
    this.picker = new Picker(this.scene.camera, this.scene.renderer.domElement, this.city, this.grid);
    this.toolbar = new Toolbar(toolbarContainer);
    this.hud = new Hud(hudContainer, {
      onTogglePause: () => this.togglePause(),
      onSetSpeed: (s) => this.setSpeed(s),
      onToggleMode: () => this.toggleMode(),
    });
    this.inspector = new Inspector(inspectorContainer, {
      onUpgrade: () => this.upgradeSelected(),
      onDemolish: () => this.demolishSelected(),
      onClose: () => this.deselect(),
    });

    const dom = this.scene.renderer.domElement;
    dom.addEventListener('pointermove', (e) => this.onPointerMove(e));
    dom.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointerup', () => {
      this.painting = false;
      this.dragPath = [];
    });

    this.loop();
  }

  // --- Entrada del jugador ---

  private onPointerMove(e: PointerEvent): void {
    const coord = this.picker.tileAt(e);
    this.cityRenderer.setHover(coord);
    if (this.painting && coord) this.paintAt(coord);
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return; // botón izquierdo
    const coord = this.picker.tileAt(e);
    const tool = this.toolbar.current;

    // Herramienta de selección: elegir casilla (o deseleccionar si es afuera).
    if (tool === 'select') {
      if (coord) this.select(coord);
      else this.deselect();
      return;
    }

    if (!coord) return;

    // Edificios multi-casilla: se colocan de un click (no se arrastran).
    const size = TILE_DEF[tool].size ?? 1;
    if (size > 1) {
      this.placeBuilding(coord, tool, size);
      return;
    }

    this.painting = true;
    this.dragPath = [];
    this.paintAt(coord);
  }

  /** Coloca un edificio de S×S (cobrando su costo si el área está libre). */
  private placeBuilding(coord: Coord, type: TileType, size: number): void {
    const cost = TILE_DEF[type].cost;
    if (this.sim.money < cost) return;
    if (this.city.placeBuilding(coord.x, coord.z, type, size)) {
      this.sim.spend(cost);
    }
  }

  /**
   * Pinta la herramienta activa en una casilla, registrando el "trazo" del
   * arrastre. Si el cursor vuelve sobre la casilla anterior del trazo, DESHACE
   * el último tramo (con reembolso): así podés corregir la traza sin soltar.
   */
  private paintAt(coord: Coord): void {
    const tool = this.toolbar.current;
    if (tool === 'select') return;

    const path = this.dragPath;
    const last = path[path.length - 1];
    if (last && last.x === coord.x && last.z === coord.z) return; // misma casilla, nada que hacer

    // ¿Volvió sobre la anteúltima casilla? → deshacer el último tramo.
    const prev = path[path.length - 2];
    if (prev && prev.x === coord.x && prev.z === coord.z) {
      const step = path.pop()!;
      if (step.prevBuilding) {
        this.city.setType(step.x, step.z, TileType.Empty); // no recrear un edificio a medias
      } else {
        this.city.setType(step.x, step.z, step.prevType);
        this.city.setLevel(step.x, step.z, step.prevLevel);
      }
      this.sim.money += step.cost; // reembolso
      return;
    }

    // Casilla nueva: colocar (si alcanza el dinero) y guardar para poder deshacer.
    const cost = TILE_DEF[tool].cost;
    if (cost > 0 && this.sim.money < cost) return;

    const tile = this.city.getTile(coord.x, coord.z);
    const prevType = tile.type;
    const prevLevel = tile.level;
    const prevBuilding = tile.anchor !== null;
    if (this.city.setType(coord.x, coord.z, tool)) {
      this.sim.spend(cost);
      path.push({ x: coord.x, z: coord.z, prevType, prevLevel, prevBuilding, cost });
    }
  }

  // --- Selección e inspector ---

  private select(coord: Coord): void {
    // Si tocó una celda secundaria de un edificio grande, seleccionar su ancla.
    const anchor = this.city.getTile(coord.x, coord.z).anchor;
    this.selected = anchor ? { x: anchor.x, z: anchor.z } : coord;
    this.cityRenderer.setSelected(this.selected);
    this.inspector.show();
    this.inspector.update(this.sim.inspect(this.selected.x, this.selected.z), this.sim.money);
  }

  private deselect(): void {
    this.selected = null;
    this.cityRenderer.setSelected(null);
    this.inspector.hide();
  }

  private upgradeSelected(): void {
    if (this.selected) this.sim.tryUpgrade(this.selected.x, this.selected.z);
  }

  private demolishSelected(): void {
    if (this.selected) this.city.setType(this.selected.x, this.selected.z, TileType.Empty);
  }

  // --- Controles de tiempo ---

  private togglePause(): void {
    this.paused = !this.paused;
    this.hud.setPaused(this.paused);
  }

  private setSpeed(speed: number): void {
    this.speed = speed;
    this.hud.setSpeed(speed);
  }

  private toggleMode(): void {
    this.sim.mode = this.sim.mode === 'auto' ? 'manual' : 'auto';
    this.hud.setMode(this.sim.mode);
  }

  // --- Bucle principal ---

  private loop = (): void => {
    requestAnimationFrame(this.loop);

    const now = performance.now();
    const dt = now - this.lastTime;
    this.lastTime = now;

    // Avanza la simulación en pasos de tiempo fijo (independiente de los fps).
    if (!this.paused) {
      this.accumulator = Math.min(
        this.accumulator + dt * this.speed,
        TICK_INTERVAL_MS * MAX_CATCHUP,
      );
      while (this.accumulator >= TICK_INTERVAL_MS) {
        this.accumulator -= TICK_INTERVAL_MS;
        this.sim.tick();
      }
    }

    // Redibuja solo las casillas que cambiaron (por el jugador o la simulación).
    for (const c of this.city.drainDirty()) {
      this.cityRenderer.updateTile(c.x, c.z);
    }

    // Recolorea las carreteras según el tráfico actual.
    this.cityRenderer.refreshTraffic((x, z) => this.sim.getCongestion(x, z));

    // Mantiene el panel al día si hay algo seleccionado.
    if (this.selected) {
      this.inspector.update(this.sim.inspect(this.selected.x, this.selected.z), this.sim.money);
    }

    this.hud.update(this.sim.getStats());
    this.scene.render();
  };
}
