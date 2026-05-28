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
import { TILE_DEF, TileType, isZone, Tile } from './sim/types';
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

  // Selección de carretera para mejorar: tramo recto elegido arrastrando.
  private roadSelection: Coord[] = [];
  private roadDragging = false;
  private roadDragStart: Coord | null = null;

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
      onStartAll: () => this.startAllConstruction(),
    });
    this.inspector = new Inspector(inspectorContainer, {
      onUpgrade: () => this.upgradeSelected(),
      onDemolish: () => this.demolishSelected(),
      onStart: () => this.startSelected(),
      onExportKeep: (delta) => this.sim.setExportKeep(this.sim.exportKeep + delta),
      onClose: () => this.deselect(),
    });
    this.notifications = new Notifications();
    new SaveMenu(document.getElementById('savebar') ?? hudContainer, {
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
      this.roadDragging = false;
      this.roadDragStart = null;
    });
    window.addEventListener('keydown', (e) => {
      // Escape: vuelve a la herramienta de selección 🔍 (para clickear edificios y ver su info).
      if (e.key === 'Escape') {
        this.toolbar.useSelect();
        this.deselect();
      }
    });

    // Carga la última partida (persiste entre recargas) y activa el autoguardado.
    const saved = loadLocal();
    if (saved) {
      this.applySave(saved);
    } else {
      // Ciudad nueva: arranca en modo Constructor (vos dirigís cada obra) + terreno natural.
      this.sim.mode = 'manual';
      this.hud.setMode('manual');
      this.generateTerrain();
    }
    setInterval(() => this.save(), AUTOSAVE_MS);

    this.loop();
  }

  // --- Entrada del jugador ---

  private onPointerMove(e: PointerEvent): void {
    const coord = this.picker.tileAt(e);
    this.updateHover(coord);
    if (this.roadDragging && coord) {
      this.updateRoadDrag(coord);
      return;
    }
    if (this.painting && coord) this.paintAt(coord);
  }

  /** Extiende el tramo recto de carretera seleccionado desde el inicio del arrastre. */
  private updateRoadDrag(coord: Coord): void {
    const start = this.roadDragStart!;
    const cells: Coord[] = [{ x: start.x, z: start.z }];
    const dx = coord.x - start.x;
    const dz = coord.z - start.z;
    const horiz = Math.abs(dx) >= Math.abs(dz);
    const step = horiz ? Math.sign(dx) : Math.sign(dz);
    if (step !== 0) {
      let cx = start.x;
      let cz = start.z;
      const target = horiz ? coord.x : coord.z;
      while ((horiz ? cx : cz) !== target) {
        if (horiz) cx += step;
        else cz += step;
        if (!this.city.inBounds(cx, cz)) break;
        if (this.city.getTile(cx, cz).type !== TileType.Road) break; // se corta en el primer no-calle
        cells.push({ x: cx, z: cz });
      }
    }
    this.roadSelection = cells;
    this.selected = { x: start.x, z: start.z };
    this.refreshSelection();
  }

  /** Resalta bajo el cursor; con un edificio grande, muestra TODO su footprint. */
  private updateHover(coord: Coord | null): void {
    const tool = this.toolbar.current;
    if (tool === 'select' || coord === null) {
      this.cityRenderer.setHover(coord);
      return;
    }
    const size = TILE_DEF[tool].size ?? 1;
    // Edificios (ploppables): verde/rojo según si se puede abrir la obra (terreno libre + calle).
    if (this.requiresRoad(tool)) {
      this.cityRenderer.setHover(coord, size, this.canPlaceSite(coord, size) ? 'valid' : 'invalid');
    } else if (tool !== TileType.Empty && this.isProtected(this.city.getTile(coord.x, coord.z))) {
      this.cityRenderer.setHover(coord, 1, 'invalid'); // pintar acá pisaría un edificio
    } else if (tool !== TileType.Empty && !this.city.isBuildable(coord.x, coord.z)) {
      this.cityRenderer.setHover(coord, 1, 'invalid'); // no se construye en agua ni montaña
    } else {
      this.cityRenderer.setHover(coord, size, 'normal'); // zonas, calles, demoler
    }
  }

  /** ¿Este tipo necesita una calle al lado para construirse? (no las zonas ni las calles) */
  private requiresRoad(type: TileType): boolean {
    return type !== TileType.Empty && type !== TileType.Road && !isZone(type);
  }

  /** ¿Hay algo que NO se debe pisar pintando (edificio, o zona ya construida)? */
  private isProtected(tile: Tile): boolean {
    if (tile.anchor !== null) return true; // parte de un edificio multi-casilla
    if (this.requiresRoad(tile.type)) return true; // servicio/fábrica/planta/negocio/etc.
    if (isZone(tile.type) && tile.level > 0) return true; // zona ya desarrollada
    return false;
  }

  /** ¿Alguna casilla del footprint S×S toca una calle? */
  private footprintHasRoad(coord: Coord, size: number): boolean {
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        if (this.city.hasRoadAccess(coord.x + dx, coord.z + dz)) return true;
      }
    }
    return false;
  }

  /** ¿Se puede ABRIR una obra de S×S en (coord)? (terreno libre + calle al lado). Es gratis. */
  private canPlaceSite(coord: Coord, size: number): boolean {
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        const cx = coord.x + dx;
        const cz = coord.z + dz;
        if (!this.city.inBounds(cx, cz)) return false;
        if (!this.city.isBuildable(cx, cz)) return false; // no en agua ni montaña
        if (this.city.getTile(cx, cz).type !== TileType.Empty) return false;
      }
    }
    return this.footprintHasRoad(coord, size); // los edificios necesitan calle
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return; // botón izquierdo
    const coord = this.picker.tileAt(e);
    const tool = this.toolbar.current;

    // Herramienta de selección.
    if (tool === 'select') {
      if (coord && this.city.getTile(coord.x, coord.z).type === TileType.Road) {
        // Carretera: empieza un arrastre para elegir el tramo a mejorar.
        this.roadDragging = true;
        this.roadDragStart = coord;
        this.roadSelection = [coord];
        this.selected = coord;
        this.inspector.show();
        this.refreshSelection();
      } else if (coord) {
        this.roadSelection = [];
        this.select(coord);
      } else {
        this.roadSelection = [];
        this.deselect();
      }
      return;
    }

    if (!coord) return;

    // Edificios: se abre una OBRA de un click (gratis). Se paga al darle el OK.
    if (this.requiresRoad(tool)) {
      this.placeConstructionSite(coord, tool, TILE_DEF[tool].size ?? 1);
      return;
    }

    // Calles, zonas y demoler: pintado con arrastre.
    this.painting = true;
    this.dragPath = [];
    this.paintAt(coord);
  }

  /** Abre una obra (cartel) de S×S: ocupa el terreno gratis; se construye al dar el OK. */
  private placeConstructionSite(coord: Coord, type: TileType, size: number): void {
    if (!this.canPlaceSite(coord, size)) return;
    if (this.city.placeBuilding(coord.x, coord.z, TileType.Construction, size)) {
      this.sim.addSite(coord.x, coord.z, size, type);
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

    // Casilla nueva: colocar (si alcanza el dinero y tiene calle si hace falta).
    const cost = TILE_DEF[tool].cost;
    if (cost > 0 && this.sim.money < cost) return;
    if (this.requiresRoad(tool) && !this.city.hasRoadAccess(coord.x, coord.z)) return;

    const tile = this.city.getTile(coord.x, coord.z);
    if (tool !== TileType.Empty && this.isProtected(tile)) return; // no destruir un edificio al pintar
    if (tool !== TileType.Empty && !this.city.isBuildable(coord.x, coord.z)) return; // no en agua ni montaña

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

    if (tile.type === TileType.Road) {
      const cells = this.roadSelection.length ? this.roadSelection : [this.selected];
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
      this.cityRenderer.setSelected({ x: minX, z: minZ, w: maxX - minX + 1, h: maxZ - minZ + 1 });
      this.inspector.update(this.sim.inspect(this.selected.x, this.selected.z), this.sim.money, {
        cells: cells.length,
        cost: this.sim.roadUpgradeCost(cells),
      });
      return;
    }

    const region = { x: this.selected.x, z: this.selected.z, w: tile.size, h: tile.size };
    this.cityRenderer.setSelected(region);
    this.inspector.update(this.sim.inspect(this.selected.x, this.selected.z), this.sim.money);
  }

  private deselect(): void {
    this.selected = null;
    this.roadSelection = [];
    this.cityRenderer.setSelected(null);
    this.inspector.hide();
  }

  private upgradeSelected(): void {
    if (!this.selected) return;
    const tile = this.city.getTile(this.selected.x, this.selected.z);
    if (tile.type === TileType.Road) {
      this.sim.upgradeRoadCells(this.roadSelection.length ? this.roadSelection : [this.selected]);
    } else {
      this.sim.tryUpgrade(this.selected.x, this.selected.z);
    }
  }

  /** Da el OK a la obra seleccionada (cobra dinero + materiales y empieza a construir). */
  private startSelected(): void {
    if (this.selected) this.sim.startConstruction(this.selected.x, this.selected.z);
  }

  /** Inicia todas las obras pendientes que se puedan pagar (botón "Iniciar obras"). */
  private startAllConstruction(): void {
    this.sim.startAllConstruction();
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
    this.hud.setMode(this.sim.mode); // sincroniza el botón de modo con lo cargado
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
    this.generateTerrain();
    this.sim.reset();
    this.deselect();
  }

  /**
   * Genera el terreno natural de una ciudad nueva: un lago, un grupo de montañas
   * y (a veces) un río que NO cruza todo el mapa — todavía no hay puentes, así que
   * dejo siempre tierra alrededor para poder trazar calles. No se puede construir
   * sobre agua/montaña; las casillas junto al agua valen más (vista al lago/río).
   */
  private generateTerrain(): void {
    const { width, height } = this.grid;
    const clampX = (v: number) => Math.max(0, Math.min(width - 1, v));

    // Lago: una mancha circular de borde irregular, en el centro del mapa.
    const lakeX = 5 + Math.floor(Math.random() * (width - 10));
    const lakeZ = 5 + Math.floor(Math.random() * (height - 10));
    const lakeR = 2.5 + Math.random() * 2.5;
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        if (Math.hypot(x - lakeX, z - lakeZ) + (Math.random() - 0.5) * 1.6 < lakeR) {
          this.city.setTerrain(x, z, 'water');
        }
      }
    }

    // Río (50%): serpentea desde el borde superior hacia abajo, pero se corta antes
    // de llegar al fondo para no partir el mapa en dos (no hay puentes aún).
    if (Math.random() < 0.5) {
      let rx = clampX(Math.floor(width * (0.2 + Math.random() * 0.6)));
      const stop = Math.floor(height * (0.55 + Math.random() * 0.25));
      for (let z = 0; z < stop; z++) {
        rx = clampX(rx + Math.round((Math.random() - 0.5) * 2));
        this.city.setTerrain(rx, z, 'water');
        if (Math.random() < 0.4) this.city.setTerrain(clampX(rx + 1), z, 'water'); // ancho variable
      }
    }

    // Montañas: un grupo compacto en una esquina al azar (no pisa el agua).
    const mx = Math.random() < 0.5 ? 0 : width - 1;
    const mz = Math.random() < 0.5 ? 0 : height - 1;
    const mr = 2.5 + Math.random() * 2;
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        if (
          Math.hypot(x - mx, z - mz) + (Math.random() - 0.5) * 1.4 < mr &&
          this.city.getTerrain(x, z) === 'land'
        ) {
          this.city.setTerrain(x, z, 'mountain');
        }
      }
    }
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

    // Tecnología: refresca qué edificios están disponibles y avisa los nuevos.
    this.toolbar.setUnlocked(this.sim.unlockedTypes());
    for (const tech of this.sim.drainUnlocks()) {
      this.notifications.toast(tech.icon, `¡Desbloqueado: ${tech.name}!`);
    }
    if (this.sim.drainBuilt().length) this.notifications.toast('🏗️', '¡Obra terminada!');

    this.cityRenderer.setMarkers(this.sim.getMarkers()); // nubes: obras + sugerencias de mejora
    this.cityRenderer.animate(now); // pulso del resaltado de selección
    this.hud.update(this.sim.getStats());
    this.hud.setTech(this.sim.getTechStatus());
    this.notifications.update(this.sim.getAlerts());
    this.scene.render();
  };
}
