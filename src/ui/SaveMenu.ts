export interface SaveMenuCallbacks {
  onSave: () => void;
  onLoad: () => void;
  onNew: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

/** Botonera de guardado: guardar / cargar / nueva / exportar / importar. */
export class SaveMenu {
  /** El panel de botones (para colgarle extras, como el de sonido). */
  readonly panel: HTMLElement;

  constructor(container: HTMLElement, callbacks: SaveMenuCallbacks) {
    const panel = document.createElement('div');
    panel.className = 'panel controls';
    this.panel = panel;

    // Input de archivo oculto para importar.
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) callbacks.onImport(file);
      fileInput.value = '';
    });

    const button = (label: string, title: string, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.className = 'ctrl';
      btn.textContent = label;
      btn.title = title;
      btn.addEventListener('click', onClick);
      panel.appendChild(btn);
    };

    button('💾', 'Guardar', callbacks.onSave);
    button('📂', 'Cargar lo guardado', callbacks.onLoad);
    button('🆕', 'Nueva ciudad', callbacks.onNew);
    button('⬇️', 'Exportar a archivo', callbacks.onExport);
    button('⬆️', 'Importar archivo', () => fileInput.click());

    panel.appendChild(fileInput);
    container.appendChild(panel);
  }
}
