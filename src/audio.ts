/**
 * The sound of the works, synthesised: water over the wheel, the rumble of
 * shafting, the clatter of looms, the whirr of spindles and the beat of the
 * engine. Each is a layer whose loudness follows what is running near the view.
 */

export type Layer = 'water' | 'shaft' | 'looms' | 'spindles' | 'engine';
export type Levels = Record<Layer, number>;

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private gains: Partial<Record<Layer, GainNode>> = {};
  private muted = true;

  get running(): boolean {
    return !!this.ctx && !this.muted;
  }

  /** Must be called from a click or key press: browsers will not start audio otherwise. */
  setOn(on: boolean): void {
    this.muted = !on;
    if (on && !this.ctx) this.build();
    if (this.ctx && this.master) {
      if (on) void this.ctx.resume();
      this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.1);
    }
  }

  private build(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    // two seconds of white noise, looped, feeds most layers
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = () => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.start();
      return src;
    };
    const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };
    const layer = (name: Layer) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(master);
      this.gains[name] = g;
      return g;
    };
    /** a gain that pulses at the given rate: for anything with a beat */
    const pulse = (hz: number, depth: number, shape: OscillatorType) => {
      const g = ctx.createGain();
      g.gain.value = 1 - depth;
      const lfo = ctx.createOscillator();
      lfo.type = shape;
      lfo.frequency.value = hz;
      const amt = ctx.createGain();
      amt.gain.value = depth;
      lfo.connect(amt).connect(g.gain);
      lfo.start();
      return g;
    };

    // water: broad hiss with a slow swell
    noise().connect(filter('lowpass', 1100)).connect(pulse(0.23, 0.25, 'sine')).connect(layer('water'));

    // shafting: a low rumble with a faint hum
    const shaft = layer('shaft');
    noise().connect(filter('lowpass', 110)).connect(shaft);
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 43;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.25;
    hum.connect(humGain).connect(shaft);
    hum.start();

    // looms: clatter, two beats slightly out of step so it never quite repeats
    const looms = layer('looms');
    noise().connect(filter('bandpass', 1900, 1.2)).connect(pulse(6.3, 0.85, 'square')).connect(looms);
    noise().connect(filter('bandpass', 900, 2)).connect(pulse(4.7, 0.9, 'square')).connect(looms);

    // spindles: a high whirr
    const spin = layer('spindles');
    noise().connect(filter('bandpass', 3400, 3)).connect(spin);
    const whirr = ctx.createOscillator();
    whirr.type = 'sawtooth';
    whirr.frequency.value = 196;
    const whirrGain = ctx.createGain();
    whirrGain.gain.value = 0.05;
    whirr.connect(filter('lowpass', 900)).connect(whirrGain).connect(spin);
    whirr.start();

    // engine: a slow heavy beat
    noise().connect(filter('lowpass', 260)).connect(pulse(0.53, 0.95, 'sawtooth')).connect(layer('engine'));
  }

  /** Set how loud each layer should be, 0..1. Changes are smoothed. */
  set(levels: Levels): void {
    if (!this.ctx) return;
    const mix: Levels = { water: 0.5, shaft: 0.7, looms: 0.35, spindles: 0.22, engine: 0.8 };
    for (const k of Object.keys(levels) as Layer[]) {
      this.gains[k]?.gain.setTargetAtTime(Math.max(0, Math.min(1, levels[k])) * mix[k], this.ctx.currentTime, 0.25);
    }
  }
}

export const sound = new Soundscape();
