import * as THREE from 'three';
import { City } from '../sim/City';
import { GridSpec, worldToTile } from '../grid';

/** Coordenada de casilla. */
export interface TileCoord {
  x: number;
  z: number;
}

/**
 * Convierte la posición del mouse en una casilla de la cuadrícula.
 *
 * Lanza un rayo desde la cámara a través del cursor y mira dónde corta el plano
 * del suelo (y = 0). Ese punto del mundo se traduce a coordenadas de casilla.
 */
export class Picker {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y = 0
  private hitPoint = new THREE.Vector3();

  constructor(
    private camera: THREE.Camera,
    private dom: HTMLElement,
    private city: City,
    private grid: GridSpec,
  ) {}

  /** Devuelve la casilla bajo el cursor, o null si apunta fuera de la cuadrícula. */
  tileAt(event: PointerEvent): TileCoord | null {
    const rect = this.dom.getBoundingClientRect();
    // Coordenadas normalizadas del dispositivo: -1..+1 en ambos ejes.
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.hitPoint)) {
      return null; // el rayo no corta el suelo (mirando al cielo)
    }

    const { x, z } = worldToTile(this.hitPoint.x, this.hitPoint.z, this.grid);
    return this.city.inBounds(x, z) ? { x, z } : null;
  }
}
