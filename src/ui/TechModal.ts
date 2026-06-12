import { Modal } from './Modal';
import { TechStatus } from '../sim/Simulation';

const TECH_INFO =
  'Tu ciudad desbloquea edificios nuevos al alcanzar hitos de población, empleo industrial, ' +
  'tesoro o CIENCIA 🔬 (la generan laboratorios, observatorios y parques científicos — necesitan energía). ' +
  'La ciencia se acumula para habilitar lo más avanzado, como el Centro Espacial.';

/** Ventana centrada de tecnología (🔬): hitos logrados y el próximo desbloqueo. */
export class TechModal {
  private modal = new Modal('🔬 Tecnología');
  private sig = '';

  open(): void {
    this.sig = '';
    this.modal.open();
  }

  /** Se llama cada frame; solo re-renderiza si está abierta y algo cambió. */
  update(status: TechStatus, science: { total: number; rate: number }): void {
    if (!this.modal.isOpen) return;
    const n = status.next;
    const sig = `${status.unlocked}|${science.total}|${n ? `${n.name}:${Math.round(n.progress * 100)}` : 'fin'}`;
    if (sig === this.sig) return;
    this.sig = sig;

    let html = `<div style="opacity:.8; font-size:12px; line-height:1.5; margin-bottom:10px">${TECH_INFO}</div>`;
    html += `<div class="stat"><span>🔬 Ciencia acumulada</span><span class="val">${science.total.toLocaleString('es')}${
      science.rate > 0 ? ` <span style="font-size:11px; color:#26c6da">(+${science.rate}/mes)</span>` : ''
    }</span></div>`;
    html += `<div class="stat" style="margin-bottom:8px"><span>🏆 Desbloqueos</span><span class="val">${status.unlocked} / ${status.total}</span></div>`;
    if (!n) {
      html += '<b style="color:#7CFC9A">✓ ¡Todo desbloqueado!</b>';
    } else {
      const fmt = (v: number) => (n.isMoney ? `$${v.toLocaleString('es')}` : v.toLocaleString('es'));
      html +=
        `<div class="tech-next">Próximo: ${n.icon} <b>${n.name}</b><br>` +
        `<span style="opacity:.75">${n.metricLabel}: ${fmt(n.current)} / ${fmt(n.target)}</span></div>` +
        `<div class="tech-bar"><div class="tech-fill" style="width:${Math.round(n.progress * 100)}%"></div></div>`;
    }
    this.modal.body.innerHTML = html;
  }
}
