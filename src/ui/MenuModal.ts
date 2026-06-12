import { Modal } from './Modal';
import { Sound } from './Sound';

export interface MenuModalCallbacks {
  onSave: () => void;
  onLoad: () => void;
  onNew: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

/**
 * Ventana centrada de opciones (⚙️): guardar/cargar/exportar la partida,
 * sonido y la ayuda de controles.
 */
export class MenuModal {
  private modal = new Modal('⚙️ Menú');

  constructor(cb: MenuModalCallbacks, sound: Sound) {
    const body = this.modal.body;

    // Input de archivo oculto para importar.
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) cb.onImport(file);
      fileInput.value = '';
    });
    body.appendChild(fileInput);

    const list = document.createElement('div');
    list.className = 'build-list';
    const add = (label: string, desc: string, fn: () => void): void => {
      const btn = document.createElement('button');
      btn.className = 'build-item';
      btn.innerHTML = `<span class="row1"><span>${label}</span></span><span class="desc">${desc}</span>`;
      btn.addEventListener('click', () => {
        this.modal.close();
        fn();
      });
      list.appendChild(btn);
    };
    add('💾 Guardar', 'Guarda la partida en este dispositivo (además se autoguarda cada 15 s).', cb.onSave);
    add('📂 Cargar', 'Vuelve a la última partida guardada.', cb.onLoad);
    add('🆕 Nueva ciudad', 'Empieza de cero (exportá antes si querés conservar la actual).', cb.onNew);
    add('⬇️ Exportar', 'Descarga la partida como archivo (backup o pasarla a otro dispositivo).', cb.onExport);
    add('⬆️ Importar', 'Carga una partida desde un archivo exportado.', () => fileInput.click());
    body.appendChild(list);

    // Sonido (el botón 🔊/🔇 lo aporta Sound).
    const soundRow = document.createElement('div');
    soundRow.style.cssText = 'display:flex; align-items:center; gap:10px; margin-top:10px';
    const soundLbl = document.createElement('span');
    soundLbl.textContent = 'Sonido:';
    soundLbl.style.opacity = '0.85';
    soundRow.appendChild(soundLbl);
    sound.attachButton(soundRow);
    body.appendChild(soundRow);

    // Ayuda de controles (según el dispositivo).
    const help = document.createElement('div');
    help.style.cssText =
      'margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,.12); opacity:.85; font-size:12px; line-height:1.7';
    help.innerHTML = `
      <b>Cómo se juega</b><br>
      <span class="hint-touch">👆 Un dedo: mover la cámara · Tap: seleccionar / construir · Mantené apretado y arrastrá: pintar (calles, zonas) · Dos dedos: zoom y rotar</span>
      <span class="hint-mouse">🖱️ Click izq: seleccionar / construir · Click der: rotar · Rueda: zoom · Click medio: mover · Escape: cancelar</span><br>
      🏗️ <b>Construir</b> abre el catálogo por rubros. Sin nada elegido, tocar un edificio muestra su info (mejorar, reparar, demoler).`;
    body.appendChild(help);
  }

  open(): void {
    this.modal.open();
  }
}
