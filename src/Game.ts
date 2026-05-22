import { SceneManager } from './render/SceneManager';
import { CityRenderer } from './render/CityRenderer';
import { Picker } from './input/Picker';
import { Toolbar } from './ui/Toolbar';
import { Hud } from './ui/Hud';
import { Inspector } from './ui/Inspector';
import { Notifications } from './ui/Notifications';
import { SaveMenu } from './ui/SaveMenu';
import { City } from './sim/City';
import { Simulation } from './sim/Simulation';
import { TILE_DEF, TileType } from './sim/types';
import { SaveData, SAVE_VERSION, saveLocal, loadLocal, exportFile, importFile } from './storage/SaveStore';
import { GridSpec } from './grid';

const AUTOSAVE_MS = 15000; // autoguardado cada 15 s

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
  private notifications: Notifications;

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
    this.notifications = new Notifications();
    new SaveMenu(hudContainer, {
      onSave: () => this.save(),
      onLoad: () => this.loadSaved(),
      onNew: () => this.newCity(),
      onExport: () => exportFile(this.buildSaveData()),
      onImport: (file) => this.importCity(file),
    });

    const dom = this.scene.renderer.domElement;
    dom.addEventListener('pointermove', (e) => this.onPointerMove(e));
    dom.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointerup', () => {
      this.painting = false;
      this.dragPath = [];
    });

    // Carga la última partida (persiste entre recargas) y activa el autoguardado.
    const saved = loadLocal();
    if (saved) this.applySave(saved);
    setInterval(() => this.save(), AUTOSAVE_MS);

    this.loop();
  }

  // --- Entrada del jugador ---

  private onPointerMove(e: PointerEvent): void {
    const coord = this.picker.tileAt(e);
    this.updateHover(coord);
    if (this.painting && coord) this.paintAt(coord);
  }

  /** Resalta bajo el cursor; con un edificio grande, muestra TODO su footprint. */
  private updateHover(coord: Coord | null): void {
    const tool = this.toolbar.current;
    if (tool === 'select' || coord === null) {
      this.cityRenderer.setHover(coord);
      return;
    }
    const size = TILE_DEF[tool].size ?? 1;
    if (size > 1) {
      const valid = this.canPlaceBuilding(coord, size, TILE_DEF[tool].cost);
      this.cityRenderer.setHover(coord, size, valid ? 'valid' : 'invalid');
    } else {
      this.cityRenderer.setHover(coord, 1, 'normal');
    }
  }

  /** ¿Se puede colocar un edificio de S×S en (coord)? (área libre, dentro, plata) */
  private canPlaceBuilding(coord: Coord, size: number, cost: number): boolean {
    if (this.sim.money < cost) return false;
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        const cx = coord.x + dx;
        const cz = coord.z + dz;
        if (!this.city.inBounds(cx, cz)) return false;
        if (this.city.getTile(cx, cz).type !== TileType.Empty) return false;
      }
    }
    return true;
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
    this.inspector.show();
    this.refreshSelection();
  }

  /**
   * Recalcula el resaltado y el panel de lo seleccionado. Para una carretera
   * resalta TODO el tramo recto (lo que se mejorará); para un edificio, su
   * footprint. Se llama cada frame por si el estado cambió (mejora, etc.).
   */
  private refreshSelection(): void {
    if (!this.selected) return;
    const tile = this.city.getTile(this.selected.x, this.selected.z);

    let region: { x: number; z: number; w: number; h: number };
    if (tile.type === TileType.Road) {
      const cells = this.sim.roadSegmentCells(this.selected.x, this.selected.z);
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const c of cells) {
        minX = Math.min(minX, c.x);
        maxX = Math.max(maxX, c.x);
        minZ = Math.min(minZ, c.z);
        maxZ = Math.max(maxZ, c.z);
      }
      region = { x: minX, z: minZ, w: maxX - minX + 1, h: maxZ - minZ + 1 };
    } else {
      region = { x: this.selected.x, z: this.selected.z, w: tile.size, h: tile.size };
    }

    this.cityRenderer.setSelected(region);
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

  // --- Guardado ---

  private buildSaveData(): SaveData {
    return {
      version: SAVE_VERSION,
      name: 'Mi ciudad',
      savedAt: new Date().toISOString(),
      city: this.city.serialize(),
      sim: this.sim.serialize(),
    };
  }

  private save(): void {
    saveLocal(this.buildSaveData());
  }

  private applySave(data: SaveData): void {
    this.city.load(data.city); // marca todo sucio → el render se re-sincroniza en el loop
    this.sim.load(data.sim);
    this.deselect();
  }

  private loadSaved(): void {
    const data = loadLocal();
    if (data) this.applySave(data);
  }

  private newCity(): void {
    const ok = window.confirm(
      '¿Empezar una ciudad nueva? Se perderá la actual (exportala antes si querés conservarla).',
    );
    if (!ok) return;
    this.city.clear();
    this.sim.reset();
    this.deselect();
  }

  private importCity(file: File): void {
    void importFile(file).then((data) => {
      if (data) this.applySave(data);
      else window.alert('No se pudo importar: archivo inválido o de otra versión.');
    });
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

    // Mantiene el resaltado y el panel al día si hay algo seleccionado.
    this.refreshSelection();

    this.cityRenderer.animate(now); // pulso del resaltado de selección
    this.hud.update(this.sim.getStats());
    this.notifications.update(this.sim.getAlerts());
    this.scene.render();
  };
}
