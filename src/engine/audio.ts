import type { StrikeZone } from '../game/types';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(next: boolean): void {
    this.muted = next;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.buildNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 1.2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private getReadyCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  public playSwing(zone: StrikeZone, pitchJitter = 1): void {
    const ctx = this.getReadyCtx();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq = zone === 'chest' ? 1150 : zone === 'head' ? 680 : 880;
    filter.frequency.setValueAtTime(baseFreq * 0.65 * pitchJitter, now);
    filter.frequency.exponentialRampToValueAtTime(baseFreq * 1.9 * pitchJitter, now + 0.08);
    filter.frequency.exponentialRampToValueAtTime(baseFreq * 0.45 * pitchJitter, now + 0.19);
    filter.Q.value = 2.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + 0.22);
  }

  public playSteelClang(intensity = 1.0, isParry = false): void {
    const ctx = this.getReadyCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const jitter = 0.94 + Math.random() * 0.12;
    const partials = isParry ? [1180, 1890, 2740, 3920] : [960, 1520, 2310];

    partials.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(freq * jitter * 0.96, now + 0.35);

      const amp = (0.14 / (idx + 1)) * intensity;
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + (isParry ? 0.55 : 0.32));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.56);
    });

    // Crisp transient spark burst
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2600;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.18 * intensity, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      noise.connect(hp);
      hp.connect(ng);
      ng.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.08);
    }
  }

  public playHitImpact(heavy = false, isPlayerHurt = false): void {
    const ctx = this.getReadyCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startFreq = isPlayerHurt ? 140 : heavy ? 190 : 165;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);

    gain.gain.setValueAtTime(heavy ? 0.34 : 0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);

    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = isPlayerHurt ? 620 : 1200;
      lp.Q.value = 1.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(heavy ? 0.22 : 0.14, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      noise.connect(lp);
      lp.connect(ng);
      ng.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.12);
    }
  }

  public playRetreatStep(): void {
    const ctx = this.getReadyCtx();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.14);
  }

  public playWindupTelegraph(zone: StrikeZone): void {
    const ctx = this.getReadyCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = zone === 'head' ? 420 : zone === 'chest' ? 540 : 480;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.45, now + 0.16);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playRiposteReady(): void {
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      gain.gain.setValueAtTime(0.12, now + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.3);
    });
  }

  public playExhaustedClick(): void {
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.07);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playOutcomeFanfare(victory: boolean): void {
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = victory ? [392, 493.88, 587.33, 783.99] : [261.63, 233.08, 196.0, 146.83];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = victory ? 'triangle' : 'sawtooth';
      const start = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(victory ? 0.14 : 0.08, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.58);
    });
  }
}

export const soundEngine = new SoundEngine();
