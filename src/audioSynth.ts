// Kolmogorov zero-asset Web Audio procedural synthesizer for HungryBlobPlanet.

let audioCtx: AudioContext | null = null;
let mutedFlag = false;

export function setAudioMuted(muted: boolean): void {
  mutedFlag = muted;
}

function getCtx(): AudioContext | null {
  if (mutedFlag || typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Sparkling golden-ratio harmonic chime when two Suika orbs merge. */
export function playSuikaMerge(tier: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const baseFreq = 220 * Math.pow(1.18, Math.min(10, Math.max(0, tier)));

  for (let i = 0; i < 2; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 0 ? "triangle" : "sine";
    const t0 = now + i * 0.055;
    osc.frequency.setValueAtTime(baseFreq * (i === 0 ? 1 : 1.5), t0);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * (i === 0 ? 1.618 : 2.25), t0 + 0.16);
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.26);
  }
}

/** Comical wet gulp + bass burp when Glorb eats a matching orb, or sour kazoo honk on mismatch. */
export function playBlobChomp(cravingMatch: boolean, fatness: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (cravingMatch) {
    // Gulp pop
    const gulp = ctx.createOscillator();
    const gGain = ctx.createGain();
    gulp.type = "sine";
    gulp.frequency.setValueAtTime(280, now);
    gulp.frequency.exponentialRampToValueAtTime(720, now + 0.08);
    gGain.gain.setValueAtTime(0.16, now);
    gGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    gulp.connect(gGain);
    gGain.connect(ctx.destination);
    gulp.start(now);
    gulp.stop(now + 0.11);

    // Bass burp wobble pitched lower as Glorb gets fatter
    const burp = ctx.createOscillator();
    const bGain = ctx.createGain();
    burp.type = "sawtooth";
    const startHz = Math.max(68, 138 - fatness * 42);
    burp.frequency.setValueAtTime(startHz, now + 0.09);
    burp.frequency.exponentialRampToValueAtTime(startHz * 0.62, now + 0.34);
    bGain.gain.setValueAtTime(0.001, now + 0.09);
    bGain.gain.exponentialRampToValueAtTime(0.11, now + 0.13);
    bGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    burp.connect(bGain);
    bGain.connect(ctx.destination);
    burp.start(now + 0.09);
    burp.stop(now + 0.37);
  } else {
    // Sour kazoo bleat
    const honk = ctx.createOscillator();
    const hGain = ctx.createGain();
    honk.type = "sawtooth";
    honk.frequency.setValueAtTime(195, now);
    honk.frequency.linearRampToValueAtTime(140, now + 0.18);
    hGain.gain.setValueAtTime(0.09, now);
    hGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    honk.connect(hGain);
    hGain.connect(ctx.destination);
    honk.start(now);
    honk.stop(now + 0.22);
  }
}

export function playLauncherFire(mode: "suika" | "blaster" | "spawner"): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (mode === "suika") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(175, now + 0.15);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
  } else if (mode === "blaster") {
    osc.type = "square";
    osc.frequency.setValueAtTime(780, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.11);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  } else {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  }
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

export function playShatter(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.18);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1800, now);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(now);
}
