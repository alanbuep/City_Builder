/**
 * Sonido del juego, 100% sintetizado con WebAudio (sin archivos de audio):
 * cada efecto es una combinación corta de osciladores/ruido. El navegador exige
 * un gesto del usuario antes de poder sonar, así que el AudioContext se crea
 * recién en el primer toque. El mute persiste en localStorage.
 */

export type Sfx =
  | 'build' // colocar calle/zona o iniciar una obra
  | 'demolish' // demoler
  | 'done' // obra terminada
  | 'unlock' // desbloqueo (tecnología, territorio)
  | 'mission' // misión cumplida (fanfarria)
  | 'disaster' // catástrofe
  | 'repair' // edificio reparado
  | 'select' // seleccionar una casilla
  | 'error'; // acción inválida

const MUTE_KEY = 'city-builder-muted';
const MASTER_VOLUME = 0.16; // discreto: acompaña sin tapar
const MIN_GAP_MS = 45; // anti-spam al pintar arrastrando

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastPlay = 0;
  muted = localStorage.getItem(MUTE_KEY) === '1';

  constructor() {
    // El primer gesto del usuario habilita el audio (política de los navegadores).
    const arm = () => this.ensure();
    window.addEventListener('pointerdown', arm, { once: true });
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    return this.muted;
  }

  /** Botón 🔊/🔇 para la barra de guardado. */
  attachButton(container: HTMLElement): void {
    const btn = document.createElement('button');
    btn.className = 'ctrl';
    btn.textContent = this.muted ? '🔇' : '🔊';
    btn.title = 'Sonido sí / no';
    btn.addEventListener('click', () => {
      btn.textContent = this.toggleMute() ? '🔇' : '🔊';
    });
    container.appendChild(btn);
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = MASTER_VOLUME;
        this.master.connect(this.ctx.destination);
      } catch {
        return null; // sin WebAudio se juega igual, en silencio
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Un tono simple: frecuencia inicial (y opcional final), duración y forma. */
  private tone(freq: number, dur: number, type: OscillatorType, at = 0, to?: number, vol = 1): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Ráfaga de ruido (golpes, derrumbes). */
  private noise(dur: number, at = 0, vol = 1): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(gain).connect(this.master!);
    src.start(t);
  }

  play(sfx: Sfx): void {
    if (this.muted || !this.ensure()) return;
    const now = performance.now();
    if (now - this.lastPlay < MIN_GAP_MS) return;
    this.lastPlay = now;

    switch (sfx) {
      case 'build':
        this.tone(523, 0.07, 'square', 0, undefined, 0.5);
        this.tone(659, 0.09, 'square', 0.06, undefined, 0.5);
        break;
      case 'demolish':
        this.noise(0.22, 0, 0.8);
        this.tone(160, 0.2, 'sawtooth', 0, 60, 0.6);
        break;
      case 'done':
        this.tone(523, 0.09, 'triangle');
        this.tone(659, 0.09, 'triangle', 0.09);
        this.tone(784, 0.16, 'triangle', 0.18);
        break;
      case 'unlock':
        this.tone(659, 0.1, 'triangle');
        this.tone(880, 0.1, 'triangle', 0.1);
        this.tone(1175, 0.2, 'triangle', 0.2);
        break;
      case 'mission':
        this.tone(523, 0.11, 'triangle');
        this.tone(659, 0.11, 'triangle', 0.11);
        this.tone(784, 0.11, 'triangle', 0.22);
        this.tone(1047, 0.3, 'triangle', 0.33);
        break;
      case 'disaster':
        this.tone(220, 0.5, 'sawtooth', 0, 55, 0.9);
        this.noise(0.5, 0.08, 0.7);
        break;
      case 'repair':
        this.tone(440, 0.06, 'square', 0, undefined, 0.5);
        this.tone(587, 0.1, 'square', 0.07, undefined, 0.5);
        break;
      case 'select':
        this.tone(880, 0.035, 'sine', 0, undefined, 0.6);
        break;
      case 'error':
        this.tone(196, 0.16, 'square', 0, 150, 0.5);
        break;
    }
  }
}
