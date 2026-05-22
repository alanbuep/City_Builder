import { Alert } from '../sim/Simulation';

/**
 * Muestra los avisos activos (qué le falta a la ciudad) abajo a la derecha.
 * Solo se redibuja cuando cambia el conjunto de avisos (evita parpadeo).
 */
export class Notifications {
  private root: HTMLElement;
  private lastKey = '';

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'notifications';
    document.body.appendChild(this.root);
  }

  update(alerts: Alert[]): void {
    const key = alerts.map((a) => a.id).join(',');
    if (key === this.lastKey) return; // sin cambios
    this.lastKey = key;
    this.root.innerHTML = alerts
      .map((a) => `<div class="notif ${a.level}"><span>${a.icon}</span><span>${a.text}</span></div>`)
      .join('');
  }
}
