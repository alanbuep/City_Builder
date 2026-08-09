import { Modal } from './Modal';
import { icon } from './icons';
import { MissionStatus } from '../sim/Missions';

/**
 * Ventana centrada de misiones (🎯): muestra TODAS las misiones — primero las
 * pendientes con su barra de progreso y premio, después las cumplidas.
 */
export class MissionsModal {
  private modal = new Modal('Misiones', 'target');
  private sig = ''; // para no reconstruir el DOM si nada cambió

  open(): void {
    this.sig = ''; // fuerza el re-render con datos frescos
    this.modal.open();
  }

  /** Se llama cada frame; solo re-renderiza si está abierta y algo cambió. */
  update(missions: MissionStatus[]): void {
    if (!this.modal.isOpen) return;
    const done = missions.filter((m) => m.done);
    const active = missions.filter((m) => !m.done);
    const sig = `${done.length}|${active.map((m) => `${m.def.id}:${Math.round(m.progress * 100)}`).join(',')}`;
    if (sig === this.sig) return;
    this.sig = sig;

    const reward = (m: MissionStatus) =>
      [m.def.reward.money ? `$${m.def.reward.money.toLocaleString('es')}` : '', m.def.reward.tokens ? `${m.def.reward.tokens} fichas` : '']
        .filter(Boolean)
        .join(' + ');

    let html = `<div class="tech-count">Cumplidas: ${done.length} / ${missions.length}</div>`;
    if (!active.length) {
      html += '<div style="margin:6px 0"><b style="color:#7CFC9A">¡Todas las misiones cumplidas!</b></div>';
    }
    for (const m of active) {
      html +=
        `<div class="mission-row">` +
        `<div class="bi-name">${icon('target', 16)}<b>${m.def.name}</b> <span style="opacity:.7; font-size:11px">(premio: ${reward(m)})</span></div>` +
        `<div style="opacity:.75; font-size:12px">${m.def.desc}</div>` +
        `<div class="tech-bar" style="margin-top:4px"><div class="tech-fill" style="width:${Math.round(m.progress * 100)}%"></div></div>` +
        `</div>`;
    }
    if (done.length) {
      html += `<div class="tech-count" style="margin-top:8px">Cumplidas</div>`;
      for (const m of done) {
        html += `<div class="mission-row done bi-name">${icon('star', 15)}<span>${m.def.name}</span> <span style="opacity:.6; font-size:11px">(${reward(m)})</span></div>`;
      }
    }
    this.modal.body.innerHTML = html;
  }
}
