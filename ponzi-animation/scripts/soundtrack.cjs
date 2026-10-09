#!/usr/bin/env node
/**
 * Bande-son 100 % synthétisée (aucun échantillon externe, aucun droit à gérer).
 *
 *  - Bruitages (pops, billets, tampons, whooshs, effondrement…) calés sur les
 *    repères Ponzi.CUES exportés par src/animation.js → synchronisation exacte.
 *  - Musique de fond électro-pop à 120 BPM qui suit la structure du film
 *    (drop après l'accroche, tension sur l'exponentielle, coupure à l'effondrement).
 *
 * Sorties (48 kHz, normalisées à −14 LUFS, la norme des réseaux sociaux) :
 *   output/ponzi-soundtrack.wav   musique + bruitages
 *   output/ponzi-sfx-only.wav     bruitages seuls (pour ajouter un son tendance dans l'appli)
 *   output/ponzi-soundtrack.m4a   version compressée pour le lecteur index.html
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Ponzi = require('../src/animation.js');

const SR = 48000;
const DUR = Ponzi.DURATION;
const N = Math.ceil((DUR + 0.5) * SR);
const TAU = Math.PI * 2;
const OUT = path.resolve(__dirname, '..', 'output');

// ─── Bus de mixage ──────────────────────────────────────────────────────
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const SFX = bus(), MUS = bus(), REV_SFX = bus(), REV_MUS = bus();

let seed = 0x2545f491;
const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const rnd = () => (noise() + 1) / 2;

function put(target, t, buf, gain = 1, pan = 0, send = 0, sendBus = null) {
  const i0 = Math.round(t * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  for (let i = 0; i < buf.length; i++) {
    const j = i0 + i;
    if (j < 0 || j >= N) continue;
    const v = buf[i];
    target.L[j] += v * gl;
    target.R[j] += v * gr;
    if (send && sendBus) { sendBus.L[j] += v * gl * send; sendBus.R[j] += v * gr * send; }
  }
}
const mk = (sec) => new Float32Array(Math.ceil(sec * SR));

// ─── Filtre biquad (RBJ) ───────────────────────────────────────────────
class Biquad {
  constructor(type, f, q = 0.707) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q = this.q) {
    this.q = q;
    const w = (TAU * Math.min(f, SR * 0.45)) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
    else if (this.type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * cs) / a0; this.a2 = (1 - al) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// ═══ Bruitages ═════════════════════════════════════════════════════════
const S = {
  pop(p = 1) {
    const b = mk(0.18);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR, f = 280 * p + 950 * p * Math.exp(-t * 48);
      ph += (TAU * f) / SR;
      b[i] = Math.sin(ph) * Math.min(1, t / 0.0015) * Math.exp(-t * 30) + noise() * 0.25 * Math.exp(-t * 700);
    }
    return b;
  },
  popBig(p = 1) {
    const b = mk(0.45);
    let ph = 0, ph2 = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR, f = 170 * p + 520 * p * Math.exp(-t * 26);
      ph += (TAU * f) / SR;
      ph2 += (TAU * 70 * p) / SR;
      b[i] = Math.sin(ph) * Math.exp(-t * 11) * 0.8 + Math.sin(ph2) * Math.exp(-t * 14) * 0.5 + noise() * 0.2 * Math.exp(-t * 500);
    }
    return b;
  },
  tick(p = 1) {
    const b = mk(0.06), hp = new Biquad('hp', 4000);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] = Math.sin(TAU * 2600 * p * t) * Math.exp(-t * 110) * 0.6 + hp.run(noise()) * Math.exp(-t * 300) * 0.5;
    }
    return b;
  },
  bubble(p = 1) {
    const a = S.pop(p * 1.1), c = S.pop(p * 1.55), d = Math.round(0.05 * SR), b = mk(0.25);
    for (let i = 0; i < a.length; i++) b[i] += a[i] * 0.8;
    for (let i = 0; i < c.length && i + d < b.length; i++) b[i + d] += c[i] * 0.6;
    return b;
  },
  flick() {
    const b = mk(0.09), bp = new Biquad('bp', 3200, 0.8);
    for (let i = 0; i < b.length; i++) { const u = i / b.length; b[i] = bp.run(noise()) * Math.sin(Math.PI * u) * 1.4; }
    return b;
  },
  swoosh(dur = 0.4, down = false) {
    const b = mk(dur), bp = new Biquad('bp', 800, 1.1);
    for (let i = 0; i < b.length; i++) {
      const u = i / b.length, k = down ? 1 - u : u;
      if (i % 32 === 0) bp.set(500 * Math.pow(8, k), 1.1);
      b[i] = bp.run(noise()) * Math.pow(Math.sin(Math.PI * u), 1.5) * 1.6;
    }
    return b;
  },
  whoosh(dur = 0.55) {
    const b = mk(dur), lp = new Biquad('lp', 400, 0.9), bp = new Biquad('bp', 600, 1.5);
    for (let i = 0; i < b.length; i++) {
      const u = i / b.length;
      if (i % 32 === 0) { lp.set(300 * Math.pow(9, u)); bp.set(400 * Math.pow(6, u), 1.5); }
      const e = u < 0.7 ? Math.pow(u / 0.7, 2) : Math.pow(1 - (u - 0.7) / 0.3, 1.5);
      const n = noise();
      b[i] = (lp.run(n) * 0.9 + bp.run(n) * 0.9) * e;
    }
    return b;
  },
  whooshBig() {
    const w = S.whoosh(0.75), b = mk(1.0);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      ph += (TAU * (40 + 60 * Math.exp(-t * 3))) / SR;
      b[i] = (i < w.length ? w[i] * 1.1 : 0) + Math.sin(ph) * Math.exp(-Math.pow(t - 0.75, 2) * 30) * 0.5;
    }
    return b;
  },
  whooshRev() { return S.whoosh(0.6).reverse(); },
  riser(dur = 0.6) {
    const b = mk(dur), bp = new Biquad('bp', 400, 2);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const u = i / b.length;
      if (i % 32 === 0) bp.set(300 * Math.pow(20, u), 2);
      ph += (TAU * (180 * Math.pow(6, u))) / SR;
      const e = Math.pow(u, 2.2);
      b[i] = (bp.run(noise()) * 1.6 + Math.sin(ph) * 0.25) * e;
    }
    return b;
  },
  impact() {
    const b = mk(1.4), lp = new Biquad('lp', 380, 0.8);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      ph += (TAU * (38 + 40 * Math.exp(-t * 6))) / SR;
      b[i] = Math.tanh(Math.sin(ph) * 1.6) * Math.exp(-t * 3.2) * 0.9 + lp.run(noise()) * Math.exp(-t * 12) * 1.2 + noise() * Math.exp(-t * 250) * 0.4;
    }
    return b;
  },
  stamp(p = 1) {
    const b = mk(0.4), lp = new Biquad('lp', 1800, 0.9);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      ph += (TAU * (55 * p + 110 * p * Math.exp(-t * 30))) / SR;
      b[i] = Math.sin(ph) * Math.exp(-t * 13) + lp.run(noise()) * Math.exp(-t * 45) * 1.1 + Math.sin(TAU * 1250 * p * t) * Math.exp(-t * 90) * 0.35;
    }
    return b;
  },
  coin(p = 1) {
    const b = mk(0.45), d = Math.round(0.045 * SR);
    const tone = (t, f) => (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2.76 * t)) * Math.exp(-t * 12);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] = tone(t, 1975 * p) * 0.45 + (i >= d ? tone((i - d) / SR, 2637 * p) * 0.5 : 0);
      b[i] *= Math.min(1, t / 0.001);
    }
    return b;
  },
  chime(p = 1) {
    const notes = [1046.5, 1318.5, 1568, 2093], b = mk(1.2);
    notes.forEach((f, k) => {
      const d = Math.round(k * 0.075 * SR);
      for (let i = d; i < b.length; i++) {
        const t = (i - d) / SR;
        b[i] += (Math.sin(TAU * f * p * t) + 0.18 * Math.sin(TAU * f * p * 3 * t)) * Math.exp(-t * 5) * 0.32 * Math.min(1, t / 0.002);
      }
    });
    return b;
  },
  buzz() {
    const b = mk(0.36), lp = new Biquad('lp', 1600, 0.8);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR, gate = (t < 0.13 || (t > 0.18 && t < 0.31)) ? 1 : 0;
      const v = Math.tanh(4 * Math.sin(TAU * 98 * t)) * 0.5 + Math.tanh(4 * Math.sin(TAU * 104 * t)) * 0.5;
      b[i] = lp.run(v * gate) * 0.7;
    }
    return b;
  },
  thump(p = 1) {
    const b = mk(0.3);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      ph += (TAU * (52 * p + 90 * p * Math.exp(-t * 35))) / SR;
      b[i] = Math.sin(ph) * Math.exp(-t * 16) + noise() * Math.exp(-t * 400) * 0.3 + Math.sin(TAU * 880 * p * t) * Math.exp(-t * 60) * 0.12;
    }
    return b;
  },
  boom() {
    const b = mk(2.8), lp = new Biquad('lp', 220, 0.7), lp2 = new Biquad('lp', 900, 0.7);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      ph += (TAU * (30 + 45 * Math.exp(-t * 4))) / SR;
      const n = noise();
      b[i] = Math.tanh(Math.sin(ph) * 2.2) * Math.exp(-t * 1.6) * 0.9 + lp.run(n) * Math.exp(-t * 1.8) * 2.2 + lp2.run(n) * Math.exp(-t * 18) * 0.8;
    }
    return b;
  },
  crash() {
    const b = mk(2.2), hp = new Biquad('hp', 3500, 0.7);
    for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = hp.run(noise()) * Math.exp(-t * 2.6) * 0.45; }
    for (let k = 0; k < 26; k++) {
      const t0 = 0.08 + rnd() * 1.3, f = 120 + rnd() * 380, d = Math.round(t0 * SR);
      for (let i = 0; i < 0.12 * SR && d + i < b.length; i++) {
        const t = i / SR;
        b[d + i] += Math.sin(TAU * f * t * (1 + Math.exp(-t * 40))) * Math.exp(-t * 35) * (0.35 * (1 - t0 / 1.6));
      }
    }
    return b;
  },
  zip() {
    const b = mk(0.3), bp = new Biquad('bp', 1000, 1.2);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const u = i / b.length;
      if (i % 32 === 0) bp.set(800 * Math.pow(6, u), 1.2);
      ph += (TAU * (380 * Math.pow(5, u))) / SR;
      const e = Math.sin(Math.PI * u);
      b[i] = (Math.sin(ph) * 0.35 + bp.run(noise()) * 1.3) * e;
    }
    return b;
  },
  airy(dur = 1.2) {
    const b = mk(dur), bp = new Biquad('bp', 1800, 4);
    for (let i = 0; i < b.length; i++) {
      const u = i / b.length, t = i / SR;
      if (i % 64 === 0) bp.set(1500 + 600 * Math.sin(t * 5), 4);
      b[i] = (bp.run(noise()) * 1.5 + Math.sin(TAU * 2217 * t) * 0.08 * (0.5 + 0.5 * Math.sin(t * 30))) * Math.sin(Math.PI * u);
    }
    return b;
  },
  hit(p = 1) {
    const b = mk(0.7), bp = new Biquad('bp', 1500, 0.9);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      ph += (TAU * (45 * p + 100 * p * Math.exp(-t * 25))) / SR;
      b[i] = Math.sin(ph) * Math.exp(-t * 7) + bp.run(noise()) * Math.exp(-t * 16) * 0.9;
    }
    return b;
  },
  alert() {
    const b = mk(0.5);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR, k = Math.floor(t / 0.12), tt = t - k * 0.12;
      const f = k % 2 ? 660 : 880;
      b[i] = k < 4 ? Math.sin(TAU * f * t) * Math.min(1, tt / 0.005) * Math.exp(-tt * 25) * 0.6 : 0;
    }
    return b;
  },
  swell(dur = 0.8, p = 1) {
    const b = mk(dur);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const u = i / b.length;
      ph += (TAU * (330 * p * Math.pow(1.6, u))) / SR;
      b[i] = (Math.sin(ph) + 0.3 * Math.sin(ph * 2)) * Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.35;
    }
    return b;
  },
  sparkle() {
    const b = mk(0.6);
    for (let k = 0; k < 7; k++) {
      const d = Math.round(rnd() * 0.35 * SR), f = 2400 + rnd() * 2600;
      for (let i = 0; i + d < b.length && i < 0.2 * SR; i++) { const t = i / SR; b[i + d] += Math.sin(TAU * f * t) * Math.exp(-t * 28) * 0.3; }
    }
    return b;
  },
};

// Pose des repères
const PAN = { coin: 0.25, pop: -0.1, flick: 0.2, sparkle: 0.3 };
for (const c of Ponzi.CUES) {
  const g = c.gain ?? 0.5, p = c.pitch ?? 1;
  let buf, send = 0.12;
  switch (c.type) {
    case 'popRoll':
      for (let k = 0; k < c.n; k++) put(SFX, c.t + (k / c.n) * c.dur, S.pop(1 + rnd() * 0.7), g * 0.7, (rnd() - 0.5) * 0.8, 0.1, REV_SFX);
      continue;
    case 'swoosh': buf = S.swoosh(c.dur ?? 0.4, c.down); break;
    case 'whoosh': buf = S.whoosh(c.dur ?? 0.55); send = 0.2; break;
    case 'riser': buf = S.riser(c.dur ?? 0.6); break;
    case 'airy': buf = S.airy(c.dur ?? 1.2); send = 0.35; break;
    case 'swell': buf = S.swell(c.dur ?? 0.8, p); send = 0.3; break;
    case 'impact': case 'boom': case 'crash': buf = S[c.type](); send = 0.25; break;
    case 'chime': case 'hit': buf = S[c.type](p); send = 0.35; break;
    default: buf = S[c.type](p);
  }
  if (!buf) throw new Error('Bruitage inconnu : ' + c.type);
  const pan = (PAN[c.type] || 0) * (rnd() < 0.5 ? -1 : 1);
  put(SFX, c.t, buf, g, pan, send, REV_SFX);
}

// ═══ Musique ═══════════════════════════════════════════════════════════
const M = Ponzi.MUSIC;
const BEAT = 60 / M.bpm, BAR = BEAT * 4;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CH = {
  Am: { pad: [57, 60, 64], bass: 33 }, F: { pad: [57, 60, 65], bass: 29 }, C: { pad: [55, 60, 64], bass: 36 },
  G: { pad: [55, 59, 62], bass: 31 }, Dm: { pad: [57, 62, 65], bass: 38 }, E: { pad: [56, 59, 64], bass: 28 },
};
function section(t) {
  if (t < M.drop) return 'hook';
  if (t < M.tension) return 'A';
  if (t < M.stop) return 'T';
  if (t < M.back) return 'X';
  if (t < M.outro) return 'C';
  return 'O';
}
function chordAt(t) {
  const sec = section(t);
  const bar = Math.floor((t - M.drop + 1e-6) / BAR);
  if (sec === 'hook' || sec === 'X') return CH.Am;
  if (sec === 'T') return CH[['Am', 'F', 'Dm', 'E'][((bar % 4) + 4) % 4]];
  if (sec === 'O') return CH[['F', 'G', 'Am', 'Am', 'Am'][Math.min(4, Math.floor((t - M.outro) / BAR))]];
  return CH[['Am', 'F', 'C', 'G'][((bar % 4) + 4) % 4]];
}

// Batterie & notes, posées sur la grille (origine = le « drop »)
const kicks = [];
const kick = () => { const b = mk(0.4); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (TAU * (46 + 110 * Math.exp(-t * 32))) / SR; b[i] = Math.sin(ph) * Math.exp(-t * 9) + noise() * Math.exp(-t * 600) * 0.15; } return b; };
const clap = () => { const b = mk(0.25), bp = new Biquad('bp', 1300, 0.9); for (let i = 0; i < b.length; i++) { const t = i / SR, e = Math.exp(-((t % 0.011) + Math.max(0, t - 0.03)) * 60) * (t < 0.033 ? 0.8 : 1) * Math.exp(-Math.max(0, t - 0.03) * 22); b[i] = bp.run(noise()) * e * 1.6; } return b; };
const hat = (open) => { const b = mk(open ? 0.2 : 0.05), hp = new Biquad('hp', 7500, 0.7); for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = hp.run(noise()) * Math.exp(-t * (open ? 18 : 90)) * 0.6; } return b; };
const KICK = kick(), CLAP = clap(), HAT = hat(false), OHAT = hat(true);
function pluck(f, dur, bright = 1) {
  const b = mk(dur), lp = new Biquad('lp', 2400 * bright, 0.8);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph = (ph + f / SR) % 1;
    const tri = 1 - 4 * Math.abs(ph - 0.5), sq = ph < 0.5 ? 1 : -1;
    b[i] = lp.run(tri * 0.8 + sq * 0.15) * Math.exp(-t * 14) * Math.min(1, t / 0.002);
  }
  return b;
}
function bassNote(f, dur) {
  const b = mk(dur + 0.05), lp = new Biquad('lp', 520, 1.1);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph = (ph + f / SR) % 1;
    const saw = 2 * ph - 1;
    const e = Math.min(1, t / 0.004) * (t < dur ? Math.exp(-t * 3) : Math.exp(-dur * 3) * Math.max(0, 1 - (t - dur) / 0.05));
    b[i] = (lp.run(saw) * 0.8 + Math.sin(TAU * ph) * 0.6) * e;
  }
  return b;
}

const step = BEAT / 4; // double-croche
const firstStep = Math.ceil((0 - M.drop) / step);
for (let k = firstStep; ; k++) {
  const t = M.drop + k * step;
  if (t >= DUR) break;
  if (t < 0) continue;
  const sec = section(t), s16 = ((k % 16) + 16) % 16, ch = chordAt(t + 0.001);
  const arpNotes = [...ch.pad.map((n) => n + 12), ch.pad[0] + 24];
  const gainAt = sec === 'hook' ? Math.min(1, 0.35 + t / 3.45 * 0.65) : 1;
  // Arpège
  const arpOn = sec === 'hook' || sec === 'A' || sec === 'T' || sec === 'C' || (sec === 'O' && s16 % 2 === 0);
  if (arpOn) {
    const oct = sec === 'T' ? 12 : 0;
    const n = arpNotes[s16 % 4] + oct;
    const g = (sec === 'T' ? 0.16 : sec === 'C' ? 0.11 : 0.12) * gainAt * (s16 % 4 === 0 ? 1.15 : 0.85);
    const pb = pluck(mtof(n), 0.3, sec === 'T' ? 1.6 : 1);
    put(MUS, t, pb, g, s16 % 2 ? 0.35 : -0.35, 0.35, REV_MUS);
    put(MUS, t + BEAT * 0.75, pb, g * 0.35, s16 % 2 ? -0.6 : 0.6, 0.2, REV_MUS); // écho pointé
  }
  // Batterie
  const drums = sec === 'A' || sec === 'T' || (sec === 'C' && t >= 48.45);
  if (drums) {
    const fourFloor = sec === 'T';
    const kickOn = fourFloor ? s16 % 4 === 0 : s16 === 0 || s16 === 8 || s16 === 10;
    if (kickOn) { put(MUS, t, KICK, 0.62); kicks.push(t); }
    if (s16 === 4 || s16 === 12) put(MUS, t, CLAP, 0.42, 0, 0.25, REV_MUS);
    if (s16 % 2 === 0) put(MUS, t, s16 % 4 === 2 ? OHAT : HAT, s16 % 4 === 2 ? 0.16 : 0.12, 0.25);
    if (fourFloor && s16 % 2 === 1) put(MUS, t, HAT, 0.08, -0.25);
  } else if (sec === 'hook' && s16 % 2 === 0 && t > 1.45) {
    put(MUS, t, HAT, 0.07, 0.25);
  } else if (sec === 'C' && s16 % 4 === 2) {
    put(MUS, t, HAT, 0.07, 0.25);
  }
  // Basse
  const bassPat = sec === 'T' ? [1, 0, 1, 0] : [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  if ((sec === 'A' || sec === 'T' || (sec === 'C' && t >= 48.45)) && bassPat[s16 % bassPat.length]) {
    const oct = sec === 'T' && s16 % 4 === 2 ? 12 : 0;
    put(MUS, t, bassNote(mtof(ch.bass + 12 + oct), step * 1.6), 0.26);
  }
}
kicks.sort((a, b) => a - b);

// Nappe continue (scies anti-aliasées, glissando entre accords, pompage sur le kick)
(function pad() {
  const blep = (p, dt) => (p < dt ? ((p /= dt), p + p - p * p - 1) : p > 1 - dt ? ((p = (p - 1) / dt), p * p + p + p + 1) : 0);
  const osc = [];
  for (let v = 0; v < 3; v++) for (const det of [-0.08, 0.08]) osc.push({ v, det, ph: rnd(), f: mtof(CH.Am.pad[v]) });
  const lpL = new Biquad('lp', 1200, 0.6), lpR = new Biquad('lp', 1200, 0.6), lp2L = new Biquad('lp', 1200, 0.6), lp2R = new Biquad('lp', 1200, 0.6);
  let ki = 0, vol = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    if (t >= DUR) break;
    const sec = section(t);
    const ch = chordAt(t);
    if (i % 64 === 0) {
      const cutoff = sec === 'T' ? 1300 + 2600 * Math.min(1, (t - M.tension) / (M.stop - M.tension)) : sec === 'X' ? 380 : sec === 'hook' ? 700 + 900 * (t / M.drop) : 1400;
      lpL.set(cutoff); lpR.set(cutoff); lp2L.set(cutoff); lp2R.set(cutoff);
    }
    let target = { hook: 0.55, A: 0.42, T: 0.5, X: 0.0, C: 0.5, O: 0.62 }[sec];
    if (sec === 'O') target *= Math.max(0, Math.min(1, (DUR - 0.15 - t) / 1.6));
    const rate = sec === 'X' && t < M.stop + 0.05 ? 0.02 : 0.00012;
    vol += (target - vol) * rate;
    while (ki < kicks.length - 1 && kicks[ki + 1] <= t) ki++;
    const sinceKick = kicks.length && kicks[ki] <= t ? t - kicks[ki] : 10;
    const duck = 1 - 0.55 * Math.exp(-sinceKick * 9);
    let l = 0, r = 0;
    for (let k = 0; k < osc.length; k++) {
      const o = osc[k];
      const target_f = mtof(ch.pad[o.v] + o.det);
      o.f += (target_f - o.f) * 0.0009;
      const dt = o.f / SR;
      o.ph += dt;
      if (o.ph >= 1) o.ph -= 1;
      const s = 2 * o.ph - 1 - blep(o.ph, dt);
      if (k % 2) r += s; else l += s;
    }
    const sc = 0.09 * vol * duck;
    MUS.L[i] += lp2L.run(lpL.run(l)) * sc;
    MUS.R[i] += lp2R.run(lpR.run(r)) * sc;
  }
})();

// Nappe grave pendant l'effondrement
(function drone() {
  const b = mk(M.back - M.stop + 0.6), lp = new Biquad('lp', 300, 0.7);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR, u = t / (b.length / SR);
    b[i] = (Math.sin(TAU * 55 * t) * 0.6 + lp.run(noise()) * 0.8) * Math.sin(Math.PI * u) * 0.35;
  }
  put(MUS, M.stop + 0.35, b, 0.6, 0, 0.4, REV_MUS);
})();

// Coupure franche de la musique à l'effondrement
(function cut() {
  const i0 = Math.round(M.stop * SR), fade = Math.round(0.03 * SR), i1 = Math.round((M.stop + 0.35) * SR);
  for (let i = i0; i < i1; i++) {
    const g = i < i0 + fade ? 1 - (i - i0) / fade : 0;
    MUS.L[i] *= g; MUS.R[i] *= g; REV_MUS.L[i] *= g; REV_MUS.R[i] *= g;
  }
})();

// ═══ Réverbération (Freeverb simplifié) ════════════════════════════════
function reverb(src, room = 0.82, damp = 0.3) {
  const out = bus();
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
  for (const [ch, spread] of [['L', 0], ['R', 23]]) {
    const x = src[ch], y = out[ch];
    for (const len0 of combs) {
      const len = Math.round(((len0 + spread) * SR) / 44100), buf = new Float32Array(len);
      let idx = 0, store = 0;
      for (let i = 0; i < N; i++) {
        const o = buf[idx];
        store = o * (1 - damp) + store * damp;
        buf[idx] = x[i] * 0.015 + store * room;
        if (++idx >= len) idx = 0;
        y[i] += o;
      }
    }
    for (const len0 of aps) {
      const len = Math.round(((len0 + spread) * SR) / 44100), buf = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < N; i++) {
        const bo = buf[idx], inp = y[i];
        y[i] = -inp + bo;
        buf[idx] = inp + bo * 0.5;
        if (++idx >= len) idx = 0;
      }
    }
  }
  return out;
}

// ═══ Mixage, export ════════════════════════════════════════════════════
function rms(b, a = 0, z = DUR) {
  let s = 0, n = 0;
  for (let i = Math.round(a * SR); i < Math.round(z * SR); i++) { s += b.L[i] * b.L[i] + b.R[i] * b.R[i]; n += 2; }
  return Math.sqrt(s / n);
}
const revS = reverb(REV_SFX), revM = reverb(REV_MUS);
const musRms = rms(MUS, M.drop, M.stop), sfxRms = rms(SFX, 0, DUR);
const musGain = (sfxRms * 0.9) / musRms; // musique sous les bruitages
console.log(`RMS bruitages ${sfxRms.toFixed(4)} · RMS musique ${musRms.toFixed(4)} → gain musique ${musGain.toFixed(3)}`);

function writeWav(file, L, R) {
  let peak = 1e-9;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.89 / peak, data = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    data.writeInt16LE(Math.round(Math.tanh(L[i] * g) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.tanh(R[i] * g) * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}
function master(withMusic) {
  const L = new Float32Array(N), R = new Float32Array(N);
  const hpL = new Biquad('hp', 28), hpR = new Biquad('hp', 28);
  for (let i = 0; i < N; i++) {
    let l = SFX.L[i] + revS.L[i] * 0.9, r = SFX.R[i] + revS.R[i] * 0.9;
    if (withMusic) { l += (MUS.L[i] + revM.L[i] * 0.6) * musGain; r += (MUS.R[i] + revM.R[i] * 0.6) * musGain; }
    L[i] = hpL.run(l); R[i] = hpR.run(r);
  }
  return [L, R];
}
function loudnorm(raw, dest) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-t', String(DUR), dest], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg loudnorm');
}

fs.mkdirSync(OUT, { recursive: true });
if (process.env.STEMS) {
  // Stems de contrôle (même échelle que le mix, sans normalisation)
  const raw = (L, R, f) => {
    const d = Buffer.alloc(N * 4);
    for (let i = 0; i < N; i++) { d.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * 0.3)) * 32767), i * 4); d.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * 0.3)) * 32767), i * 4 + 2); }
    fs.writeFileSync(f, d);
  };
  const [mL, mR] = master(true), [sL, sR] = master(false);
  raw(sL, sR, path.join(OUT, '.stem-sfx.pcm'));
  raw(mL.map((v, i) => v - sL[i]), mR.map((v, i) => v - sR[i]), path.join(OUT, '.stem-music.pcm'));
}
const tmpFull = path.join(OUT, '.raw-full.wav'), tmpSfx = path.join(OUT, '.raw-sfx.wav');
writeWav(tmpFull, ...master(true));
writeWav(tmpSfx, ...master(false));
loudnorm(tmpFull, path.join(OUT, 'ponzi-soundtrack.wav'));
loudnorm(tmpSfx, path.join(OUT, 'ponzi-sfx-only.wav'));
fs.rmSync(tmpFull); fs.rmSync(tmpSfx);
spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(OUT, 'ponzi-soundtrack.wav'), '-c:a', 'aac', '-b:a', '192k', path.join(OUT, 'ponzi-soundtrack.m4a')], { stdio: 'inherit' });
console.log('✓ output/ponzi-soundtrack.wav · output/ponzi-sfx-only.wav · output/ponzi-soundtrack.m4a');
