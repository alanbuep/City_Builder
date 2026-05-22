import { Alert } from '../sim/Simulation';

/**
 * Muestra los avisos activos (qué le falta a la ciudad) abajo a la derecha.
 * Solo se redibuja cuando cambia el conjunto de avisos (evita parpadeo).
 */
export class Notifications {
  private root: HTMLElement;
  private toastRoot: HTMLElement;
  private lastKey = '';

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'notifications';
    document.body.appendChild(this.root);

    // Contenedor aparte para los avisos temporales (desbloqueos): así no se
    // borran cuando se re-renderizan los avisos persistentes.
    this.toastRoot = document.createElement('div');
    this.toastRoot.id = 'toasts';
    document.body.appendChild(this.toastRoot);
  }

  update(alerts: Alert[]): void {
    const key = alerts.map((a) => a.id).join(',');
    if (key === this.lastKey) return; // sin cambios
    this.lastKey = key;
    this.root.innerHTML = alerts
      .map((a) => `<div class="notif ${a.level}"><span>${a.icon}</span><span>${a.text}</span></div>`)
      .join('');
  }

  /** Aviso temporal arriba al centro (p. ej. un desbloqueo). Desaparece solo. */
  toast(icon: string, text: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="toast-icon">${icon}</span><span>${text}</span>`;
    this.toastRoot.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show')); // dispara la transición de entrada
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 6000);
  }
}
