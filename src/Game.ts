import { SceneManager } from './render/SceneManager';
import { CityRenderer } from './render/CityRenderer';
import { Picker } from './input/Picker';
import { Toolbar, isPaintTool } from './ui/Toolbar';
import { Hud } from './ui/Hud';
import { Inspector } from './ui/Inspector';
import { Notifications } from './ui/Notifications';
import { SaveMenu } from './ui/SaveMenu';
import { Sound } from './ui/Sound';
import { DisasterMenu } from './ui/DisasterMenu';
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
const SPONTANEOUS_FIRE_CHANCE = 0.015; // prob. por mes de un incendio espontáneo (si están activadas)
const BUBBLE_INTERVAL_MS = 3200; // cada cuánto rotan las burbujas de opinión de los vecinos
const MAX_BUBBLES = 4; // cuántas burbujas se ven a la vez (para no saturar)
const DEMOLISH_REFUND = 0.5; // al demoler se recupera este % del costo (para no quedar trabado)

/**
 * El director de orquesta: crea la simulación, el render, el picking y la UI,
 * los conecta y corre el bucle principal (render a 60fps + simulación a ticks
 * de tiempo fijo, independientes entre sí).
 */
export class Game {
  private grid: GridSpec = { width: 48, height: 48, tileSize: 1 };

  private city: City;
  private sim: Simulation;
  private scene: SceneManager;
  private cityRenderer: CityRenderer;
  private picker: Picker;
  private toolbar: Toolbar;
  private hud: Hud;
  private inspector: Inspector;
  private notifications: Notifications;
  private sound = new Sound();
  private disastersRandom = false; // ¿se desatan catástrofes al azar?

  // Burbujas de opinión de los vecinos (se renuevan cada tanto).
  private bubbles: Array<{ x: number; z: number; text: string; mood: 'good' | 'bad' }> = [];
  private nextBubbleAt = 0;

  private painting = false;
  private dragPath: DragStep[] = []; // trazo del arrastre actual (permite retroceder)
  private selected: Coord | null = null;

  // Touch (celular): gesto en curso, para distinguir un TAP de un arrastre de cámara.
  private touchDown: { x: number; y: number; coord: Coord | null } | null = null;
  private touchCount = 0; // dedos apoyados (2+ = gesto de cámara, no construye)

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
    this.scene.setPanLimit((Math.max(this.grid.width, this.grid.height) * this.grid.tileSize) / 2 + 6);
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
      onRepair: () => this.repairSelected(),
      onUnlock: () => this.unlockSelectedTerritory(),
      onDemolish: () => this.demolishSelected(),
      onStart: () => this.startSelected(),
      onExportKeep: (delta) => this.sim.setExportKeep(this.sim.exportKeep + delta),
      onClose: () => this.deselect(),
    });
    this.notifications = new Notifications();
    new DisasterMenu(document.getElementById('disasterbar') ?? document.body, {
      onTriggerFire: () => this.triggerFire(),
      onTriggerMeteor: () => this.triggerMeteor(),
      onTriggerTornado: () => this.triggerTornado(),
      onTriggerHurricane: () => this.triggerHurricane(),
      onToggleRandom: (enabled) => {
        this.disastersRandom = enabled;
      },
    });
    const saveMenu = new SaveMenu(document.getElementById('savebar') ?? hudContainer, {
      onSave: () => this.save(),
      onLoad: () => this.loadSaved(),
      onNew: () => this.newCity(),
      onExport: () => exportFile(this.buildSaveData()),
      onImport: (file) => this.importCity(file),
    });
    this.sound.attachButton(saveMenu.panel);

    const dom = this.scene.renderer.domElement;
    dom.addEventListener('pointermove', (e) => this.onPointerMove(e));
    dom.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') this.onTouchUp(e);
      if (this.painting) this.cityRenderer.refreshOcean(); // por si pintaste agua hasta un borde
      this.painting = false;
      this.dragPath = [];
      this.roadDragging = false;
      this.roadDragStart = null;
    });
    window.addEventListener('pointercancel', () => {
      this.cancelPaint();
      this.touchDown = null;
      this.touchCount = 0;
      this.roadDragging = false;
      this.roadDragStart = null;
    });
    // En touch, el gesto de un dedo depende de la herramienta activa.
    this.toolbar.onToolChange = (tool) => this.scene.setTouchCameraPan(tool === 'select');
    this.scene.setTouchCameraPan(this.toolbar.current === 'select');
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
      this.cityRenderer.setLockedRegions(this.city.lockedRegions());
      this.cityRenderer.refreshOcean();
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
    if (tool === 'select') {
      // Selección: ilumina el edificio bajo el cursor; si no hay, marca el piso.
      const lit = this.cityRenderer.setHighlight(coord);
      this.cityRenderer.setHover(lit ? null : coord);
      return;
    }
    this.cityRenderer.setHighlight(null); // otras herramientas: sin glow de selección
    if (coord === null) {
      this.cityRenderer.setHover(null);
      return;
    }
    if (isPaintTool(tool)) {
      this.cityRenderer.setHover(coord, 1, this.canPaintTerrain(coord) ? 'normal' : 'invalid');
      return;
    }
    const size = TILE_DEF[tool].size ?? 1;
    // Edificios (ploppables): verde/rojo según si se puede abrir la obra (terreno libre + calle).
    if (this.requiresRoad(tool)) {
      this.cityRenderer.setHover(coord, size, this.canPlaceSite(coord, size) ? 'valid' : 'invalid');
    } else if (tool !== TileType.Empty && this.isProtected(this.city.getTile(coord.x, coord.z))) {
      this.cityRenderer.setHover(coord, 1, 'invalid'); // pintar acá pisaría un edificio
    } else if (tool !== TileType.Empty && !this.terrainAllows(tool, coord.x, coord.z)) {
      this.cityRenderer.setHover(coord, 1, 'invalid'); // no se construye en agua/montaña (salvo puente)
    } else {
      this.cityRenderer.setHover(coord, size, 'normal'); // zonas, calles, demoler
    }
  }

  /** ¿Este tipo necesita una calle al lado para construirse? (no las zonas, calles ni decoración) */
  private requiresRoad(type: TileType): boolean {
    return type !== TileType.Empty && type !== TileType.Road && !isZone(type) && !TILE_DEF[type].decoration;
  }

  /**
   * ¿El terreno admite esta herramienta? Las CALLES pueden cruzar agua (se vuelven
   * un PUENTE) pero no montaña; el resto solo va en tierra/playa.
   */
  private terrainAllows(tool: TileType, x: number, z: number): boolean {
    if (!this.city.isUnlocked(x, z)) return false; // territorio bloqueado: hay que abrirlo primero
    if (tool === TileType.Road) return this.city.getTerrain(x, z) !== 'mountain';
    return this.city.isBuildable(x, z);
  }

  /** ¿Se puede pintar terreno (agua/tierra) en esta casilla? (libre + desbloqueada). */
  private canPaintTerrain(coord: Coord): boolean {
    return (
      this.city.inBounds(coord.x, coord.z) &&
      this.city.isUnlocked(coord.x, coord.z) &&
      this.city.getTile(coord.x, coord.z).type === TileType.Empty // no bajo edificios/calles
    );
  }

  /** Pinta agua (con orillas de arena) o vuelve a tierra. Para ríos/lagos a mano. */
  private paintTerrain(coord: Coord, kind: 'water' | 'land'): void {
    if (!this.canPaintTerrain(coord)) return;
    const { x, z } = coord;
    if (kind === 'land') {
      this.city.setTerrain(x, z, 'land');
      return;
    }
    this.city.setTerrain(x, z, 'water');
    // Orillas: la tierra libre alrededor del agua se vuelve arena.
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = x + dx;
        const nz = z + dz;
        if (
          this.city.inBounds(nx, nz) &&
          this.city.getTile(nx, nz).type === TileType.Empty &&
          this.city.getTerrain(nx, nz) === 'land'
        ) {
          this.city.setTerrain(nx, nz, 'beach');
        }
      }
    }
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
        if (!this.city.isUnlocked(cx, cz)) return false; // territorio bloqueado
        if (!this.city.isBuildable(cx, cz)) return false; // no en agua ni montaña
        if (this.city.getTile(cx, cz).type !== TileType.Empty) return false;
      }
    }
    // Represas/puertos: tienen que tocar el agua.
    if (TILE_DEF[this.toolbar.current as TileType]?.needsWater && !this.city.isNextToWater(coord.x, coord.z, size)) {
      return false;
    }
    return this.footprintHasRoad(coord, size); // los edificios necesitan calle
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      this.onTouchDown(e);
      return;
    }
    if (e.button !== 0) return; // botón izquierdo
    if (this.dismissBubbleAt(e)) return; // clickear una burbuja la cierra (no construye/selecciona)
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

    // Pintar terreno (ríos/lagos a mano): arrastrar.
    if (isPaintTool(tool)) {
      this.painting = true;
      this.dragPath = [];
      this.paintAt(coord);
      return;
    }

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

  // --- Touch (celular) ---
  // Un dedo: con 🔍 mueve la cámara y un TAP selecciona; con calles/zonas/demoler
  // el dedo PINTA (la cámara pasa a dos dedos); los edificios se plopean al soltar
  // (tap), así un arrastre que empieza sobre el mapa no construye sin querer.

  private onTouchDown(e: PointerEvent): void {
    this.touchCount++;
    if (this.touchCount > 1) {
      // Llegó un segundo dedo: era un gesto de cámara → deshacer lo pintado.
      this.cancelPaint();
      this.touchDown = null;
      this.roadDragging = false;
      this.roadDragStart = null;
      return;
    }
    const coord = this.picker.tileAt(e);
    this.touchDown = { x: e.clientX, y: e.clientY, coord };
    const tool = this.toolbar.current;
    if (tool === 'select' || !coord) return;
    if (isPaintTool(tool) || !this.requiresRoad(tool)) {
      this.painting = true;
      this.dragPath = [];
      this.paintAt(coord);
    }
  }

  private onTouchUp(e: PointerEvent): void {
    this.touchCount = Math.max(0, this.touchCount - 1);
    const down = this.touchDown;
    this.touchDown = null;
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 14) return; // fue un arrastre (cámara o pintado), no un tap
    if (this.dismissBubbleAt(e)) return;
    const tool = this.toolbar.current;
    const coord = this.picker.tileAt(e) ?? down.coord;
    if (!coord) {
      if (tool === 'select') this.deselect();
      return;
    }
    if (tool === 'select') {
      if (this.city.getTile(coord.x, coord.z).type === TileType.Road) {
        // Tap en una calle: selecciona el tramo recto completo para mejorar.
        this.roadSelection = this.sim.roadSegmentCells(coord.x, coord.z);
        this.selected = coord;
        this.inspector.show();
        this.refreshSelection();
      } else {
        this.roadSelection = [];
        this.select(coord);
      }
      return;
    }
    if (!isPaintTool(tool) && this.requiresRoad(tool)) {
      this.placeConstructionSite(coord, tool, TILE_DEF[tool].size ?? 1);
    }
  }

  /** Deshace el trazo de pintado en curso (era un gesto de cámara, no una obra). */
  private cancelPaint(): void {
    if (!this.painting) return;
    for (let i = this.dragPath.length - 1; i >= 0; i--) {
      const step = this.dragPath[i];
      if (step.prevBuilding) {
        this.city.setType(step.x, step.z, TileType.Empty); // no recrear un edificio a medias
      } else {
        this.city.setType(step.x, step.z, step.prevType);
        this.city.setLevel(step.x, step.z, step.prevLevel);
      }
      this.sim.money += step.cost;
    }
    this.painting = false;
    this.dragPath = [];
    this.cityRenderer.refreshOcean();
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

    // Pintar terreno (agua/tierra) a mano — no usa el trazo de obras ni cuesta dinero.
    if (isPaintTool(tool)) {
      this.paintTerrain(coord, tool === 'terrain_water' ? 'water' : 'land');
      return;
    }

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

    // Residencial sobre residencial: solo CAMBIA el estilo del barrio (gratis), así
    // se puede "pintar" un distrito de un estilo arrastrando sobre lo ya zonificado.
    if (tool === TileType.Residential) {
      const t = this.city.getTile(coord.x, coord.z);
      if (t.type === TileType.Residential && t.style !== this.toolbar.currentResStyle) {
        this.city.setResidentialStyle(coord.x, coord.z, this.toolbar.currentResStyle);
        return;
      }
    }

    // Casilla nueva: colocar (si alcanza el dinero y tiene calle si hace falta).
    const cost = TILE_DEF[tool].cost;
    if (cost > 0 && this.sim.money < cost) return;
    if (this.requiresRoad(tool) && !this.city.hasRoadAccess(coord.x, coord.z)) return;

    const tile = this.city.getTile(coord.x, coord.z);
    if (tool !== TileType.Empty && this.isProtected(tile)) return; // no destruir un edificio al pintar
    if (tool !== TileType.Empty && !this.terrainAllows(tool, coord.x, coord.z)) return; // agua/montaña (calle = puente)

    const prevType = tile.type;
    const prevLevel = tile.level;
    const prevBuilding = tile.anchor !== null;
    if (this.city.setType(coord.x, coord.z, tool)) {
      this.sound.play(tool === TileType.Empty ? 'demolish' : 'build');
      this.sim.spend(cost);
      // Al zonificar residencial, le aplico el estilo de barrio elegido.
      if (tool === TileType.Residential) this.city.setResidentialStyle(coord.x, coord.z, this.toolbar.currentResStyle);
      // Demoler reintegra parte del costo de lo que había (anti-trabarse sin dinero).
      if (tool === TileType.Empty && prevType !== TileType.Empty) {
        const refund = Math.round(TILE_DEF[prevType].cost * DEMOLISH_REFUND);
        if (refund > 0) this.sim.money += refund;
      }
      path.push({ x: coord.x, z: coord.z, prevType, prevLevel, prevBuilding, cost });
    }
  }

  // --- Selección e inspector ---

  private select(coord: Coord): void {
    // Si tocó una celda secundaria de un edificio grande, seleccionar su ancla.
    const anchor = this.city.getTile(coord.x, coord.z).anchor;
    this.selected = anchor ? { x: anchor.x, z: anchor.z } : coord;
    this.sound.play('select');
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
      this.cityRenderer.setCoverage(null, 0, 0); // las calles no tienen área de influencia
      this.inspector.update(this.sim.inspect(this.selected.x, this.selected.z), this.sim.money, {
        cells: cells.length,
        cost: this.sim.roadUpgradeCost(cells),
      });
      return;
    }

    const region = { x: this.selected.x, z: this.selected.z, w: tile.size, h: tile.size };
    this.cityRenderer.setSelected(region);
    // Si el edificio cubre un área (servicio/comercio/amenidad…), mostrarla.
    const inf = this.coverageInfluence(tile.type);
    this.cityRenderer.setCoverage(inf ? this.selected : null, inf?.radius ?? 0, inf?.color ?? 0);
    this.inspector.update(this.sim.inspect(this.selected.x, this.selected.z), this.sim.money);
  }

  /**
   * Área cuadrada a marcar al seleccionar (null si no aplica). Ahora el ÁREA es
   * para lo espacial: contaminación (la zona a evitar), amenidades (valor del
   * suelo) y transporte. Los servicios (seguridad/salud/educación/comida) son por
   * población → no tienen área (se ven en los medidores del HUD).
   */
  private coverageInfluence(type: TileType): { radius: number; color: number } | null {
    const def = TILE_DEF[type];
    if (def.pollution) return { radius: def.pollution.radius, color: 0xd32f2f }; // contaminación (rojo: no construir casas)
    if (def.amenity) return { radius: def.amenity.radius, color: 0x00e676 }; // valor del suelo (verde intenso)
    if (def.transit) return { radius: def.transit.radius, color: 0x00e5ff }; // transporte (turquesa intenso)
    return null;
  }

  private deselect(): void {
    this.selected = null;
    this.roadSelection = [];
    this.cityRenderer.setSelected(null);
    this.cityRenderer.setCoverage(null, 0, 0);
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

  /** Desbloquea la parcela de territorio seleccionada (gasta fichas 🗝️). */
  private unlockSelectedTerritory(): void {
    if (!this.selected) return;
    if (this.sim.unlockTerritory(this.selected.x, this.selected.z)) {
      this.notifications.toast('🗝️', '¡Nuevo territorio desbloqueado!');
      this.sound.play('unlock');
      this.cityRenderer.setLockedRegions(this.city.lockedRegions());
      this.refreshSelection();
    } else {
      this.notifications.toast('🔒', 'Faltan fichas o no es contigua a tu ciudad.');
      this.sound.play('error');
    }
  }

  /** Repara el edificio dañado seleccionado (cobra el costo de reparación). */
  private repairSelected(): void {
    if (!this.selected) return;
    if (this.sim.repair(this.selected.x, this.selected.z)) {
      this.notifications.toast('🛠️', '¡Edificio reparado!');
      this.sound.play('repair');
    }
  }

  /** Da el OK a la obra seleccionada (cobra dinero + materiales y empieza a construir). */
  private startSelected(): void {
    if (this.selected && this.sim.startConstruction(this.selected.x, this.selected.z)) {
      this.sound.play('build');
    }
  }

  /** Inicia todas las obras pendientes que se puedan pagar (botón "Iniciar obras"). */
  private startAllConstruction(): void {
    this.sim.startAllConstruction();
  }

  private demolishSelected(): void {
    if (!this.selected) return;
    const prevType = this.city.getTile(this.selected.x, this.selected.z).type;
    if (this.city.setType(this.selected.x, this.selected.z, TileType.Empty) && prevType !== TileType.Empty) {
      this.sound.play('demolish');
      const refund = Math.round(TILE_DEF[prevType].cost * DEMOLISH_REFUND);
      if (refund > 0) this.sim.money += refund;
    }
    this.deselect();
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
    this.cityRenderer.setLockedRegions(this.city.lockedRegions());
    this.cityRenderer.refreshOcean();
    this.deselect();
  }

  private loadSaved(): void {
    const data = loadLocal();
    if (data) {
      this.applySave(data);
      this.notifications.toast('📂', 'Partida cargada.');
    } else {
      this.notifications.toast('🤷', 'No hay nada guardado todavía.');
    }
  }

  private newCity(): void {
    const ok = window.confirm(
      '¿Empezar una ciudad nueva? Se perderá la actual (exportala antes si querés conservarla).',
    );
    if (!ok) return;
    this.city.clear();
    this.generateTerrain();
    this.sim.reset();
    this.cityRenderer.setLockedRegions(this.city.lockedRegions());
    this.cityRenderer.refreshOcean();
    this.deselect();
  }

  /**
   * Terreno de una ciudad nueva. Ahora el relieve (cordillera, mar, colinas) lo
   * provee el PAISAJE único `landscape.glb`, cuya área jugable central es una
   * meseta PLANA de pasto. Por eso la grilla arranca toda en `land` (plana): el
   * jugador construye sobre la meseta y el paisaje rodea la escena. Los ríos
   * manuales y el mar in-game se reintroducen cuando alineemos el dato a la malla.
   */
  private generateTerrain(): void {
    // Sin features procedurales: meseta plana que calza con landscape.glb.
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
        this.maybeSpontaneousDisaster(); // catástrofes al azar (si están activadas)
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
      this.sound.play('unlock');
    }
    if (this.sim.drainBuilt().length) {
      this.notifications.toast('🏗️', '¡Obra terminada!');
      this.sound.play('done');
    }
    for (const mission of this.sim.drainCompletedMissions()) {
      const r = mission.reward;
      const reward = [r.money ? `$${r.money}` : '', r.tokens ? `${r.tokens} 🗝️` : ''].filter(Boolean).join(' + ');
      this.notifications.toast('🎯', `¡Misión cumplida: ${mission.name}! Ganaste ${reward}.`);
      this.sound.play('mission');
    }

    this.cityRenderer.setMarkers(this.sim.getMarkers()); // nubes: obras + sugerencias de mejora
    const burning = this.sim.disasters.burningCells();
    this.cityRenderer.setFires(burning); // fuego sobre las casillas en llamas
    this.cityRenderer.setHero(this.sim.hasHero, burning[0] ?? null); // el héroe acude al incendio

    // Atracciones y aeronaves: cada cosa sale de su edificio.
    const tracks: Array<{ x: number; z: number; size: number }> = [];
    const airports: Array<{ x: number; z: number; size: number }> = [];
    const docks: Array<{ x: number; z: number; size: number }> = [];
    const ports: Array<{ x: number; z: number; size: number }> = [];
    this.city.forEach((tile, x, z) => {
      if (this.city.isSubCell(x, z) || tile.damaged) return;
      const def = TILE_DEF[tile.type];
      if (def.raceTrack) tracks.push({ x, z, size: tile.size });
      if (tile.type === TileType.Airport) airports.push({ x, z, size: tile.size });
      if (def.launchesBlimp) docks.push({ x, z, size: tile.size });
      if (def.launchesBalloons) ports.push({ x, z, size: tile.size });
    });
    this.cityRenderer.setRace(this.sim.raceActive, tracks);
    this.cityRenderer.setAirSources(airports, docks, ports);
    if (this.sim.drainRaceStart()) this.notifications.toast('🏁', '¡Fin de semana de carreras! 🏎️');

    const burned = this.sim.disasters.drainDestroyed();
    if (burned.length) this.notifications.toast('🔥', `¡${burned.length} edificio(s) se quemaron!`);

    // Burbujas de opinión: se renuevan cada tanto (no en pausa) y se reposicionan cada frame.
    if (!this.paused && now >= this.nextBubbleAt) {
      this.refreshBubbles();
      this.nextBubbleAt = now + BUBBLE_INTERVAL_MS;
    }
    this.cityRenderer.setBubbles(this.bubbles);
    this.cityRenderer.animate(now); // pulso del resaltado de selección
    this.hud.update(this.sim.getStats());
    this.hud.setTech(this.sim.getTechStatus());
    this.hud.setMissions(this.sim.getMissions());
    this.notifications.update(this.sim.getAlerts());
    this.scene.render();
  };

  // --- Catástrofes ---

  /**
   * Mantiene las burbujas de opinión: poda las que ya no corresponden (casa
   * demolida) y, si hay lugar, agrega nuevas casas al azar. Las burbujas NO se
   * van solas: quedan hasta que el jugador las cierra clickeándolas.
   */
  private refreshBubbles(): void {
    // Poda: quitar burbujas cuya casa ya no es residencial habitada.
    this.bubbles = this.bubbles.filter((b) => {
      const t = this.city.getTile(b.x, b.z);
      return t.type === TileType.Residential && t.level > 0;
    });
    if (this.bubbles.length >= MAX_BUBBLES) return; // ya hay suficientes; esperan a que las cierren

    const taken = new Set(this.bubbles.map((b) => `${b.x},${b.z}`));
    const homes: Coord[] = [];
    this.city.forEach((tile, x, z) => {
      if (tile.type === TileType.Residential && tile.level > 0 && !taken.has(`${x},${z}`)) homes.push({ x, z });
    });
    while (this.bubbles.length < MAX_BUBBLES && homes.length > 0) {
      const pick = homes.splice(Math.floor(Math.random() * homes.length), 1)[0];
      const op = this.sim.opinionAt(pick.x, pick.z);
      if (op) this.bubbles.push({ x: pick.x, z: pick.z, text: op.text, mood: op.mood });
    }
  }

  /** Si el click cayó sobre una burbuja, la cierra y devuelve true (consume el click). */
  private dismissBubbleAt(e: PointerEvent): boolean {
    const idx = this.cityRenderer.pickBubble(this.picker.rayFrom(e));
    if (idx < 0 || idx >= this.bubbles.length) return false;
    this.bubbles.splice(idx, 1);
    this.cityRenderer.setBubbles(this.bubbles);
    return true;
  }

  /** Provoca un incendio en un edificio al azar (botón / prueba). */
  private triggerFire(): void {
    this.sim.recordDisaster();
    const cell = this.sim.disasters.igniteRandom(Math.random);
    if (cell) {
      this.notifications.toast('🔥', '¡Se desató un incendio!');
      this.sound.play('disaster');
    } else this.notifications.toast('🤷', 'No hay edificios para incendiar.');
  }

  /** Lanza un meteorito: cae sobre un objetivo y, al impactar, arrasa e incendia. */
  private triggerMeteor(): void {
    this.sim.recordDisaster();
    const target = this.sim.disasters.pickMeteorTarget(Math.random);
    this.notifications.toast('🌠', '¡Meteorito en camino!');
    this.sound.play('disaster');
    this.cityRenderer.playMeteor(target.x, target.z, () => {
      const r = this.sim.disasters.strikeMeteor(target.x, target.z);
      this.notifications.toast('💥', `¡Impacto! ${r.destroyed.length} edificio(s) dañado(s) — reparalos.`);
    });
  }

  /** Desata un tornado que cruza el mapa serpenteando. */
  private triggerTornado(): void {
    this.sim.recordDisaster();
    const r = this.sim.disasters.spawnTornado(Math.random);
    this.cityRenderer.playTornado(r.path ?? []);
    this.notifications.toast('🌪️', `¡Tornado! ${r.destroyed.length} edificio(s) dañado(s) — reparalos.`);
    this.sound.play('disaster');
  }

  /** Desata un huracán que castiga toda la ciudad. */
  private triggerHurricane(): void {
    this.sim.recordDisaster();
    const r = this.sim.disasters.spawnHurricane(Math.random);
    this.cityRenderer.playHurricane();
    this.notifications.toast('🌀', `¡Huracán! ${r.destroyed.length} edificio(s) dañado(s) — reparalos.`);
    this.sound.play('disaster');
  }

  /**
   * Con las catástrofes al azar activadas, de vez en cuando se desata una: casi
   * siempre un incendio (la más común), y rara vez algo mayor.
   */
  private maybeSpontaneousDisaster(): void {
    if (!this.disastersRandom) return;
    if (Math.random() >= SPONTANEOUS_FIRE_CHANCE) return;
    const roll = Math.random();
    if (roll < 0.7) {
      this.sim.recordDisaster();
      this.sim.disasters.igniteRandom(Math.random);
    } else if (roll < 0.85) this.triggerMeteor();
    else if (roll < 0.96) this.triggerTornado();
    else this.triggerHurricane();
  }
}
