/**
 * Ventana modal CENTRADA en la pantalla con fondo oscurecido. Todos los menús
 * del juego (construir, misiones, tecnología, catástrofes, opciones) usan esta
 * base: mismo look, mismo cierre (✕ / tocar afuera / Escape) y botón ← opcional
 * para volver un paso atrás (p. ej. de la lista de edificios a los rubros).
 */
export class Modal {
  /** Acá va el contenido de la ventana (lo llena cada menú). */
  readonly body: HTMLElement;
  /** Se llama al cerrarse (por ✕, tocar afuera o Escape). */
  onClose: (() => void) | null = null;

  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private backBtn: HTMLButtonElement;
  private onBack: (() => void) | null = null;

  constructor(title: string) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.style.display = 'none';
    this.overlay.addEventListener('click', () => this.close());

    const win = document.createElement('div');
    win.className = 'modal panel';
    win.addEventListener('click', (e) => e.stopPropagation());

    const head = document.createElement('div');
    head.className = 'modal-head';

    this.backBtn = document.createElement('button');
    this.backBtn.className = 'modal-nav';
    this.backBtn.textContent = '←';
    this.backBtn.title = 'Volver';
    this.backBtn.style.display = 'none';
    this.backBtn.addEventListener('click', () => this.onBack?.());
    head.appendChild(this.backBtn);

    this.titleEl = document.createElement('span');
    this.titleEl.className = 'modal-title';
    this.titleEl.textContent = title;
    head.appendChild(this.titleEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-nav';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Cerrar';
    closeBtn.addEventListener('click', () => this.close());
    head.appendChild(closeBtn);

    this.body = document.createElement('div');
    this.body.className = 'modal-body';

    win.appendChild(head);
    win.appendChild(this.body);
    this.overlay.appendChild(win);
    document.body.appendChild(this.overlay);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return this.overlay.style.display !== 'none';
  }

  setTitle(title: string): void {
    this.titleEl.textContent = title;
  }

  /** Muestra (u oculta, con null) el botón ← de "volver un paso". */
  setBack(fn: (() => void) | null): void {
    this.onBack = fn;
    this.backBtn.style.display = fn ? '' : 'none';
  }

  open(): void {
    this.overlay.style.display = '';
  }

  close(): void {
    if (!this.isOpen) return;
    this.overlay.style.display = 'none';
    this.onClose?.();
  }
}
