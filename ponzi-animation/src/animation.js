/*!
 * « La pyramide de Ponzi » — animation motion design verticale 9:16 (1080 × 1920).
 *
 * Tout le film est une fonction pure du temps : render(ctx, t) dessine l'image
 * exacte à l'instant t (en secondes). Le lecteur (index.html) et le moteur de
 * rendu vidéo (scripts/render.cjs) appellent la même fonction, ce qui garantit
 * une synchronisation parfaite entre l'aperçu, la vidéo et la bande-son
 * (les repères sonores sont exportés dans CUES).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Ponzi = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════════
  //  Constantes & direction artistique
  // ════════════════════════════════════════════════════════════════════
  const W = 1080, H = 1920, FPS = 60, DURATION = 60;
  const FD = 'PZDisplay', FT = 'PZText';
  const FONTS = [
    `900 100px ${FD}`, `800 100px ${FD}`, `700 100px ${FD}`,
    `600 100px ${FT}`, `700 100px ${FT}`,
  ];

  const COL = {
    bgTop: '#141842', bgBot: '#070918',
    ink: '#F5F7FF', mute: '#A3AAD6', dark: '#0B0E22',
    yellow: '#FFD23F', green: '#2EE59D', greenD: '#0E9A5E', greenL: '#C8FFE6',
    red: '#FF4D5E', blue: '#5B8CFF', violet: '#A78BFA', orange: '#FF9F43',
    card: '#1B2050', hat: '#161936', gold: '#E9AE3C',
  };
  const PAL = { y: COL.yellow, g: COL.green, r: COL.red, b: COL.blue, v: COL.violet, o: COL.orange, w: COL.ink };

  // ════════════════════════════════════════════════════════════════════
  //  Outils mathématiques
  // ════════════════════════════════════════════════════════════════════
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const Ease = {
    lin: (u) => u,
    inQuad: (u) => u * u,
    outQuad: (u) => 1 - (1 - u) * (1 - u),
    inCubic: (u) => u * u * u,
    outCubic: (u) => 1 - Math.pow(1 - u, 3),
    inOutCubic: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    outQuart: (u) => 1 - Math.pow(1 - u, 4),
    inOutQuart: (u) => (u < 0.5 ? 8 * u * u * u * u : 1 - Math.pow(-2 * u + 2, 4) / 2),
    outQuint: (u) => 1 - Math.pow(1 - u, 5),
    inExpo: (u) => (u <= 0 ? 0 : Math.pow(2, 10 * u - 10)),
    outExpo: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
    inOutExpo: (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2),
    outBack: (u) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
    outBackSoft: (u) => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
    inBack: (u) => { const c1 = 1.70158, c3 = c1 + 1; return c3 * u * u * u - c1 * u * u; },
  };
  /** Progression 0→1 entre a et a+d, avec easing. */
  const P = (t, a, d, e = Ease.outCubic) => e(clamp((t - a) / d));
  /** Enveloppe d'apparition / disparition. */
  function env(t, a, b, fi = 0.35, fo = 0.3) {
    if (t < a || t > b) return 0;
    return Ease.outCubic(clamp((t - a) / fi)) * (1 - Ease.inCubic(clamp((t - (b - fo)) / fo)));
  }
  function rng(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let x = Math.imul(s ^ (s >>> 15), 1 | s);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (i) => rng(i * 7919 + 104729)();

  function hexRgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mixHex(a, b, u) {
    const A = hexRgb(a), B = hexRgb(b);
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], u)).toString(16).padStart(2, '0')).join('');
  }
  function rgba(hex, a) {
    const [r, g, b] = hexRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  /** 12345 → « 12 345 » (espace insécable, typographie française). */
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function fmtBig(n) {
    if (n < 1e6) return fmt(n);
    const big = n >= 1e9, v = n / (big ? 1e9 : 1e6);
    const s = v.toFixed(1).replace('.', ',').replace(/,0$/, '');
    return `${s} ${big ? 'milliard' : 'million'}${v >= 2 ? 's' : ''}`;
  }

  // ════════════════════════════════════════════════════════════════════
  //  Primitives de dessin
  // ════════════════════════════════════════════════════════════════════
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
  function setFont(ctx, size, weight = 800, fam = FD) { ctx.font = `${weight} ${size}px ${fam}`; }
  function text(ctx, s, x, y, o = {}) {
    setFont(ctx, o.size || 60, o.weight || 800, o.fam || FD);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.letterSpacing = (o.ls || 0) + 'px';
    ctx.fillStyle = o.color || COL.ink;
    if (o.maxW) {
      const w = ctx.measureText(s).width;
      if (w > o.maxW) setFont(ctx, (o.size || 60) * (o.maxW / w), o.weight || 800, o.fam || FD);
    }
    ctx.fillText(s, x, y);
    ctx.letterSpacing = '0px';
  }
  function measure(ctx, s, size, weight = 800, fam = FD, ls = 0) {
    setFont(ctx, size, weight, fam);
    ctx.letterSpacing = ls + 'px';
    const w = ctx.measureText(s).width;
    ctx.letterSpacing = '0px';
    return w;
  }

  // ── Texte enrichi : {c:mot} = mot coloré, [c:mot] = surligneur ──────
  let _gid = 0;
  function parseRich(str) {
    const words = [];
    const re = /([{\[])([a-z]):([^}\]]+)[}\]](\S*)|(\S+)/g;
    let m;
    while ((m = re.exec(str))) {
      if (m[5]) { words.push({ w: m[5] }); continue; }
      const parts = m[3].split(' ');
      const gid = ++_gid;
      parts.forEach((w, i) => words.push({ w, color: PAL[m[2]], marker: m[1] === '[', groupEnd: i === parts.length - 1, gid }));
      if (m[4]) words.push({ w: m[4], attach: true, color: m[1] === '{' ? PAL[m[2]] : undefined });
    }
    return words;
  }
  function richLayout(ctx, lines, size, weight, fam, maxW) {
    let sz = size;
    for (let pass = 0; pass < 2; pass++) {
      setFont(ctx, sz, weight, fam);
      ctx.letterSpacing = '0px';
      const space = ctx.measureText(' ').width;
      const L = lines.map((str) => {
        const words = parseRich(str);
        let x = 0;
        const pad = sz * 0.13;
        words.forEach((w, i) => {
          const prev = words[i - 1];
          if (i > 0 && !w.attach) x += space;
          if (w.marker && (!prev || !prev.marker)) x += i > 0 ? pad : 0;
          if (prev && prev.marker && prev.groupEnd && !w.marker) x += pad;
          w.x = x;
          w.wd = ctx.measureText(w.w).width;
          x += w.wd;
        });
        if (words.length && words[words.length - 1].marker) x += 0;
        return { words, width: x };
      });
      const widest = Math.max(...L.map((l) => l.width));
      if (widest <= maxW || pass === 1) return { L, size: sz, space };
      sz = Math.floor((sz * maxW) / widest);
    }
  }
  /**
   * Texte cinétique : chaque mot monte en fondu (décalage), les mots surlignés
   * reçoivent un surligneur qui balaie de gauche à droite.
   */
  function drawRich(ctx, t, spec) {
    const { a, b } = spec;
    if (t < a || t > b) return;
    const weight = spec.weight || 900, fam = spec.fam || FD;
    const lay = richLayout(ctx, spec.lines, spec.size || 80, weight, fam, spec.maxW || 940);
    const size = lay.size, lh = spec.lh || 1.13, cx = spec.x ?? W / 2;
    const st = spec.stagger ?? 0.045, outDur = spec.outDur ?? 0.26;
    const top = spec.y ?? 330;
    let k = 0;
    // Balayage continu du surligneur sur l'ensemble d'un groupe de mots
    const groups = {};
    let kk = 0;
    for (const line of lay.L) {
      for (const w of line.words) {
        if (w.marker) {
          const g = groups[w.gid] || (groups[w.gid] = { t0: a + kk * st, x0: Infinity, x1: -Infinity, n: 0 });
          g.x0 = Math.min(g.x0, w.x - size * 0.13);
          g.x1 = Math.max(g.x1, w.x + w.wd + size * 0.13);
          g.n++;
        }
        kk++;
      }
    }
    lay.L.forEach((line, li) => {
      const by = top + size * 0.86 + li * size * lh;
      const x0 = spec.align === 'left' ? cx : cx - line.width / 2;
      line.words.forEach((w) => {
        const ti = a + k * st;
        const tout = b - outDur - (lay.L.length * 3 - k) * 0.004;
        k++;
        const pin = clamp((t - ti) / 0.5);
        if (pin <= 0) return;
        const pout = clamp((t - tout) / outDur);
        const ein = Ease.outQuart(pin), eout = Ease.inCubic(pout);
        const alpha = clamp(pin * 3.5) * (1 - eout);
        if (alpha <= 0.001) return;
        const dy = (1 - ein) * size * 0.45 - eout * size * 0.3;
        ctx.save();
        ctx.globalAlpha *= alpha;
        setFont(ctx, size, weight, fam);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const wx = x0 + w.x, wy = by + dy;
        const base = spec.color || COL.ink;
        if (w.marker) {
          const g = groups[w.gid];
          const head = x0 + g.x0 + (g.x1 - g.x0) * Ease.outQuart(clamp((t - g.t0 - 0.1) / (0.34 + 0.06 * g.n)));
          const padX = size * 0.13, padT = size * 0.82, padB = size * 0.2;
          const bw = w.wd + padX * 2 + (w.groupEnd ? 0 : lay.space);
          const rx = wx - padX, ry = wy - padT, rh = padT + padB;
          ctx.fillStyle = base;
          ctx.fillText(w.w, wx, wy);
          if (head > rx) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(rx - 2, ry - 6, Math.min(bw, head - rx) + 2, rh + 12);
            ctx.clip();
            ctx.fillStyle = w.color;
            rrect(ctx, rx, ry, bw, rh, size * 0.14);
            ctx.fill();
            ctx.fillStyle = spec.markerText || COL.dark;
            ctx.fillText(w.w, wx, wy);
            ctx.restore();
          }
        } else {
          ctx.fillStyle = w.color || base;
          ctx.fillText(w.w, wx, wy);
        }
        ctx.restore();
      });
    });
  }

  // ── Personnage simplifié ────────────────────────────────────────────
  function person(ctx, x, y, s, o = {}) {
    const k = o.scale ?? 1;
    if (k <= 0.001) return;
    const c = o.color || COL.blue;
    const headC = o.headColor || mixHex(c, '#FFFFFF', 0.45);
    const shade = mixHex(c, '#000000', 0.25);
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(k * (o.flip ? -1 : 1) * (o.sx ?? 1), k * (o.sy ?? 1));
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    const bw = 0.62 * s, bh = 0.46 * s, r = bw / 2, cr = s * 0.04;
    if (o.shadow !== false && !o.ghost) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 0, bw * 0.58, s * 0.04, 0, 0, TAU);
      ctx.fill();
    }
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(-r, -cr);
      ctx.lineTo(-r, -bh + r);
      ctx.arc(0, -bh + r, r, Math.PI, 0);
      ctx.lineTo(r, -cr);
      ctx.quadraticCurveTo(r, 0, r - cr, 0);
      ctx.lineTo(-r + cr, 0);
      ctx.quadraticCurveTo(-r, 0, -r, -cr);
      ctx.closePath();
    };
    const hr = 0.2 * s;
    const hy = -bh - 0.045 * s - hr + (o.bob || 0);
    if (o.ghost) {
      ctx.setLineDash([s * 0.09, s * 0.07]);
      ctx.lineWidth = s * 0.045;
      ctx.strokeStyle = 'rgba(245,247,255,0.8)';
      bodyPath();
      ctx.stroke();
      circle(ctx, 0, hy, hr);
      ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, '?', 0, hy + hr * 0.42, { size: hr * 1.25, weight: 900, color: 'rgba(245,247,255,0.7)' });
      ctx.restore();
      return;
    }
    bodyPath();
    ctx.fillStyle = c;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = shade;
    ctx.globalAlpha *= 0.5;
    ctx.beginPath();
    ctx.ellipse(r * 1.05, -bh * 0.35, r * 0.62, bh * 1.1, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Tête
    ctx.fillStyle = headC;
    circle(ctx, 0, hy, hr);
    ctx.fill();
    const lk = (o.look || 0) * hr * 0.18;
    const ex = hr * 0.36, ey = hy - hr * 0.02;
    const mood = o.mood || 'neutral';
    ctx.fillStyle = COL.dark;
    ctx.strokeStyle = COL.dark;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (o.boss) {
      ctx.fillStyle = COL.hat;
      const gw = hr * 0.66, gh = hr * 0.38, gy = ey - hr * 0.02;
      for (const sx of [-1, 1]) { rrect(ctx, sx * ex - gw / 2 + lk, gy - gh / 2, gw, gh, gh * 0.45); ctx.fill(); }
      ctx.lineWidth = hr * 0.1;
      ctx.beginPath();
      ctx.moveTo(-ex + gw / 2 + lk - 1, gy - gh * 0.12);
      ctx.lineTo(ex - gw / 2 + lk + 1, gy - gh * 0.12);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = hr * 0.06;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * ex - gw * 0.25 + lk, gy + gh * 0.12);
        ctx.lineTo(sx * ex - gw * 0.02 + lk, gy - gh * 0.16);
        ctx.stroke();
      }
      ctx.strokeStyle = COL.dark;
    } else if (mood === 'happy') {
      ctx.lineWidth = hr * 0.12;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * ex + lk, ey + hr * 0.07, hr * 0.12, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    } else {
      const bl = o.blink ? 0.12 : 1;
      const big = mood === 'shock' ? 1.25 : 1;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * ex + lk, ey, hr * 0.1 * big, hr * 0.13 * bl * big, 0, 0, TAU);
        ctx.fill();
      }
      if (mood === 'sad') {
        ctx.lineWidth = hr * 0.07;
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sx * ex * 1.45 + lk, ey - hr * 0.26);
          ctx.lineTo(sx * ex * 0.55 + lk, ey - hr * 0.36);
          ctx.stroke();
        }
      }
    }
    const my = hy + hr * 0.45;
    ctx.lineWidth = hr * 0.11;
    ctx.beginPath();
    switch (mood) {
      case 'happy':
        ctx.moveTo(-hr * 0.32 + lk, my - hr * 0.1);
        ctx.quadraticCurveTo(lk, my + hr * 0.42, hr * 0.32 + lk, my - hr * 0.1);
        ctx.closePath();
        ctx.fill();
        break;
      case 'sad':
        ctx.moveTo(-hr * 0.22 + lk, my + hr * 0.1);
        ctx.quadraticCurveTo(lk, my - hr * 0.16, hr * 0.22 + lk, my + hr * 0.1);
        ctx.stroke();
        break;
      case 'shock':
        ctx.ellipse(lk, my + hr * 0.04, hr * 0.13, hr * 0.18, 0, 0, TAU);
        ctx.fill();
        break;
      case 'smug':
        ctx.moveTo(-hr * 0.28 + lk, my - hr * 0.02);
        ctx.quadraticCurveTo(hr * 0.02 + lk, my + hr * 0.2, hr * 0.34 + lk, my - hr * 0.16);
        ctx.stroke();
        break;
      default:
        ctx.moveTo(-hr * 0.2 + lk, my);
        ctx.quadraticCurveTo(lk, my + hr * 0.14, hr * 0.2 + lk, my);
        ctx.stroke();
    }
    if (o.boss) {
      // Nœud papillon
      const ny = -bh + s * 0.035;
      ctx.fillStyle = COL.hat;
      ctx.beginPath();
      ctx.moveTo(0, ny); ctx.lineTo(-hr * 0.55, ny - hr * 0.26); ctx.lineTo(-hr * 0.55, ny + hr * 0.26); ctx.closePath();
      ctx.moveTo(0, ny); ctx.lineTo(hr * 0.55, ny - hr * 0.26); ctx.lineTo(hr * 0.55, ny + hr * 0.26); ctx.closePath();
      ctx.fill();
      circle(ctx, 0, ny, hr * 0.13);
      ctx.fill();
      // Haut-de-forme
      ctx.save();
      ctx.translate(hr * 0.06, hy - hr * 0.8);
      ctx.rotate(-0.12 + (o.hatTilt || 0));
      ctx.fillStyle = COL.hat;
      rrect(ctx, -hr * 1.1, -hr * 0.11, hr * 2.2, hr * 0.24, hr * 0.12);
      ctx.fill();
      rrect(ctx, -hr * 0.72, -hr * 1.2, hr * 1.44, hr * 1.16, hr * 0.12);
      ctx.fill();
      ctx.fillStyle = COL.red;
      ctx.fillRect(-hr * 0.72, -hr * 0.4, hr * 1.44, hr * 0.24);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── Billet ──────────────────────────────────────────────────────────
  function bill(ctx, x, y, w, rot = 0, o = {}) {
    const h = w * 0.52, r = h * 0.16;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(o.flip ?? 1, 1);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      rrect(ctx, -w / 2 + w * 0.04, -h / 2 + h * 0.14, w, h, r);
      ctx.fill();
    }
    ctx.fillStyle = o.color || COL.green;
    rrect(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1, w * 0.028);
    rrect(ctx, -w / 2 + w * 0.07, -h / 2 + h * 0.15, w * 0.86, h * 0.7, r * 0.6);
    ctx.stroke();
    ctx.fillStyle = COL.greenD;
    circle(ctx, 0, 0, h * 0.27);
    ctx.fill();
    text(ctx, '€', 0, h * 0.135, { size: h * 0.38, weight: 900, color: COL.greenL });
    ctx.restore();
  }
  const bez = (a, b, c, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;
  /** Billet en vol sur un arc, avec traînée et rotation 3D. */
  function flyBill(ctx, t, f) {
    const { t0, dur } = f;
    if (t < t0 || t > t0 + dur) return;
    const u = (t - t0) / dur;
    const cx = (f.x0 + f.x1) / 2 + (f.bend || 0), cy = (f.y0 + f.y1) / 2 + (f.arc ?? -220);
    const w0 = f.w || 100;
    for (let k = 3; k >= 0; k--) {
      const uk = clamp(u - k * 0.04);
      const e = Ease.inOutCubic(uk);
      const px = bez(f.x0, cx, f.x1, e), py = bez(f.y0, cy, f.y1, e);
      const sIn = Ease.outBack(clamp(uk / 0.2));
      const sOut = f.sink ? 1 - 0.6 * Ease.inCubic(clamp((uk - 0.7) / 0.3)) : 1;
      const rot = (f.spin ?? 1) * Math.sin(e * Math.PI) * 0.55 + (f.rot0 || 0);
      const flip = 0.3 + 0.7 * Math.abs(Math.cos(e * Math.PI * (f.flips ?? 1.5)));
      const al = k === 0 ? (f.sink ? 1 - Ease.inCubic(clamp((u - 0.85) / 0.15)) : 1) : 0.16 / k;
      bill(ctx, px, py, w0 * sIn * sOut * (1 - k * 0.07), rot, { alpha: al * (f.alpha ?? 1), flip, shadow: k === 0 });
    }
  }

  // ── Bocal « caisse » ────────────────────────────────────────────────
  function jar(ctx, cx, by, s, level, t, o = {}) {
    const w = s * 0.78, h = s * 0.78, nw = s * 0.52, nh = s * 0.08, lw = s * 0.64, lh = s * 0.1;
    const top = by - h, rad = s * 0.16;
    const danger = o.danger || 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, by, w * 0.6, s * 0.04, 0, 0, TAU);
    ctx.fill();
    // Verre (arrière)
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    rrect(ctx, cx - w / 2, top, w, h, rad);
    ctx.fill();
    // Contenu
    ctx.save();
    rrect(ctx, cx - w / 2 + s * 0.03, top + s * 0.03, w - s * 0.06, h - s * 0.06, rad * 0.8);
    ctx.clip();
    const inTop = top + s * 0.05, inBot = by - s * 0.03;
    const fy = inBot - (inBot - inTop) * level;
    if (level > 0.002) {
      const g = ctx.createLinearGradient(0, fy, 0, by);
      g.addColorStop(0, '#3FF0A8');
      g.addColorStop(1, '#0C8F57');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, by);
      for (let x = cx - w / 2; x <= cx + w / 2 + 1; x += 6) {
        ctx.lineTo(x, fy + Math.sin(x * 0.04 + t * 5) * s * 0.012);
      }
      ctx.lineTo(cx + w / 2, by);
      ctx.closePath();
      ctx.fill();
      // Liasses de billets
      ctx.strokeStyle = 'rgba(200,255,230,0.35)';
      ctx.lineWidth = s * 0.012;
      for (let yy = by - s * 0.08; yy > fy + s * 0.05; yy -= s * 0.075) {
        const off = ((yy * 13) % 40) - 20;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.3 + off * 0.3, yy);
        ctx.lineTo(cx + w * 0.3 + off * 0.3, yy);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Col + couvercle
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(cx - nw / 2, top - nh, nw, nh);
    ctx.fillStyle = danger > 0 ? mixHex('#2B3170', COL.red, danger) : '#2B3170';
    rrect(ctx, cx - lw / 2, top - nh - lh, lw, lh, lh * 0.35);
    ctx.fill();
    // Contour du verre
    const edge = danger > 0 ? mixHex('#F5F7FF', COL.red, danger) : '#F5F7FF';
    ctx.strokeStyle = rgba(edge, 0.7);
    ctx.lineWidth = s * 0.022;
    ctx.beginPath();
    ctx.moveTo(cx - nw / 2, top - nh);
    ctx.lineTo(cx - nw / 2, top);
    ctx.lineTo(cx - w / 2 + rad, top);
    ctx.arcTo(cx - w / 2, top, cx - w / 2, top + rad, rad);
    ctx.arcTo(cx - w / 2, by, cx, by, rad);
    ctx.arcTo(cx + w / 2, by, cx + w / 2, top, rad);
    ctx.arcTo(cx + w / 2, top, cx + nw / 2, top, rad);
    ctx.lineTo(cx + nw / 2, top);
    ctx.lineTo(cx + nw / 2, top - nh);
    ctx.stroke();
    // Reflet
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = s * 0.03;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.33, top + h * 0.2);
    ctx.lineTo(cx - w * 0.33, top + h * 0.55);
    ctx.stroke();
    // Étiquette « CAISSE »
    const lw2 = s * 0.5, lh2 = s * 0.15, ly = top + h * 0.3;
    ctx.fillStyle = '#F5F7FF';
    rrect(ctx, cx - lw2 / 2, ly - lh2 / 2, lw2, lh2, lh2 * 0.3);
    ctx.fill();
    text(ctx, 'CAISSE', cx, ly + lh2 * 0.24, { size: lh2 * 0.62, weight: 900, color: COL.dark, ls: lh2 * 0.06 });
    if (danger > 0.01) {
      ctx.globalAlpha *= danger * (0.5 + 0.5 * Math.sin(t * 14));
      ctx.strokeStyle = COL.red;
      ctx.lineWidth = s * 0.03;
      rrect(ctx, cx - w / 2 - s * 0.04, top - s * 0.04, w + s * 0.08, h + s * 0.08, rad * 1.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Icônes ──────────────────────────────────────────────────────────
  function iconCard(ctx, x, y, size, kind, t, sc = 1) {
    if (sc <= 0.001) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.fillStyle = COL.card;
    rrect(ctx, -size / 2, -size / 2, size, size, size * 0.24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 3;
    ctx.stroke();
    const u = size / 100;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'factory') {
      ctx.fillStyle = 'rgba(245,247,255,0.45)';
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.8 + i / 3) % 1;
        circle(ctx, 24 * u + ph * 10 * u, -40 * u - ph * 22 * u, (4 + ph * 6) * u);
        ctx.globalAlpha = 1 - ph;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = COL.ink;
      ctx.beginPath();
      ctx.moveTo(-34 * u, 30 * u);
      ctx.lineTo(-34 * u, -4 * u);
      ctx.lineTo(-16 * u, -16 * u);
      ctx.lineTo(-16 * u, -4 * u);
      ctx.lineTo(2 * u, -16 * u);
      ctx.lineTo(2 * u, -4 * u);
      ctx.lineTo(18 * u, -14 * u);
      ctx.lineTo(18 * u, -34 * u);
      ctx.lineTo(31 * u, -34 * u);
      ctx.lineTo(31 * u, 30 * u);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = COL.card;
      for (let i = 0; i < 3; i++) ctx.fillRect((-26 + i * 16) * u, 6 * u, 9 * u, 10 * u);
    } else {
      ctx.strokeStyle = COL.ink;
      ctx.lineWidth = 7 * u;
      ctx.beginPath();
      ctx.moveTo(-32 * u, -32 * u);
      ctx.lineTo(-32 * u, 30 * u);
      ctx.lineTo(34 * u, 30 * u);
      ctx.stroke();
      ctx.strokeStyle = COL.green;
      ctx.beginPath();
      ctx.moveTo(-20 * u, 16 * u);
      ctx.lineTo(-4 * u, -2 * u);
      ctx.lineTo(8 * u, 8 * u);
      ctx.lineTo(28 * u, -18 * u);
      ctx.stroke();
      ctx.fillStyle = COL.green;
      ctx.beginPath();
      ctx.moveTo(34 * u, -26 * u);
      ctx.lineTo(18 * u, -22 * u);
      ctx.lineTo(30 * u, -10 * u);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  function slam(t, t0, from = 2) {
    const u = t - t0;
    if (u < 0) return 0;
    if (u < 0.14) return lerp(from, 1, Ease.inQuad(u / 0.14));
    return 1 + 0.06 * Math.sin((u - 0.14) * 30) * Math.exp(-(u - 0.14) * 9);
  }
  function redX(ctx, x, y, size, t, t0) {
    const sc = slam(t, t0, 1.9);
    if (!sc) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.globalAlpha *= clamp((t - t0) / 0.06);
    ctx.strokeStyle = COL.red;
    ctx.lineCap = 'round';
    ctx.lineWidth = size * 0.11;
    const d = size * 0.4;
    ctx.beginPath();
    ctx.moveTo(-d, -d); ctx.lineTo(d, d);
    ctx.moveTo(d, -d); ctx.lineTo(-d, d);
    ctx.stroke();
    ctx.restore();
  }
  function burst(ctx, x, y, t, t0, color, r0, r1, n = 12, dur = 0.45) {
    const u = (t - t0) / dur;
    if (u < 0 || u > 1) return;
    const e = Ease.outCubic(u);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = lerp(10, 2, u);
    ctx.globalAlpha *= 1 - Ease.inQuad(u);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.2;
      const ra = lerp(r0, r1, e), rb = lerp(r0, r1, Math.min(1, e * 0.55 + 0.45 * Ease.outCubic(clamp(u * 1.6))));
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * Math.min(ra, rb) * 0.75, y + Math.sin(a) * Math.min(ra, rb) * 0.75);
      ctx.lineTo(x + Math.cos(a) * Math.max(ra, rb), y + Math.sin(a) * Math.max(ra, rb));
      ctx.stroke();
    }
    ctx.restore();
  }
  function sparkle(ctx, x, y, s, alpha, color = COL.yellow) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
    ctx.restore();
  }
  function bubble(ctx, x, y, w, h, tx, ty, sc = 1, o = {}) {
    if (sc <= 0.001) return;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(sc, sc);
    ctx.translate(-tx, -ty);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rrect(ctx, x - w / 2 + 6, y - h / 2 + 10, w, h, o.r ?? h * 0.3);
    ctx.fill();
    ctx.fillStyle = o.fill || '#FFFFFF';
    rrect(ctx, x - w / 2, y - h / 2, w, h, o.r ?? h * 0.3);
    ctx.fill();
    const bx = clamp(tx, x - w / 2 + 50, x + w / 2 - 50);
    const tw = Math.min(34, w * 0.12);
    ctx.beginPath();
    ctx.moveTo(bx - tw, y + h / 2 - 2);
    ctx.lineTo(bx + tw, y + h / 2 - 2);
    ctx.lineTo(tx, ty);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function moneyBag(ctx, x, y, s, rot = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.46, s * 0.4, s * 0.06, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COL.gold;
    ctx.beginPath();
    ctx.moveTo(-s * 0.17, -s * 0.26);
    ctx.bezierCurveTo(-s * 0.66, -s * 0.02, -s * 0.56, s * 0.46, 0, s * 0.46);
    ctx.bezierCurveTo(s * 0.56, s * 0.46, s * 0.66, -s * 0.02, s * 0.17, -s * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 0.27);
    ctx.lineTo(-s * 0.3, -s * 0.48);
    ctx.quadraticCurveTo(0, -s * 0.36, s * 0.3, -s * 0.48);
    ctx.lineTo(s * 0.15, -s * 0.27);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#A8720F';
    rrect(ctx, -s * 0.22, -s * 0.31, s * 0.44, s * 0.08, s * 0.04);
    ctx.fill();
    text(ctx, '€', 0, s * 0.26, { size: s * 0.42, weight: 900, color: '#7A4E05' });
    ctx.restore();
  }
  function earth(ctx, x, y, r, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#3A7BFF';
    circle(ctx, 0, 0, r);
    ctx.fill();
    ctx.save();
    circle(ctx, 0, 0, r);
    ctx.clip();
    ctx.fillStyle = COL.green;
    const span = r * 4, off = (t * r * 0.35) % span;
    for (const base of [-span, 0, span]) {
      const dx = base - off;
      const blobs = [[-0.55, -0.4, 0.42, 0.26, 0.5], [-0.25, 0.32, 0.26, 0.42, -0.3], [0.6, -0.15, 0.32, 0.46, 0.2], [1.5, 0.35, 0.36, 0.24, 0.1], [2.3, -0.35, 0.3, 0.3, 0.0], [3.0, 0.25, 0.35, 0.22, 0.6]];
      for (const [bx, by, rx, ry, a] of blobs) {
        ctx.beginPath();
        ctx.ellipse(dx + bx * r, by * r, rx * r, ry * r, a, 0, TAU);
        ctx.fill();
      }
    }
    const g = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, 'rgba(255,255,255,0.28)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,30,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = r * 0.05;
    circle(ctx, 0, 0, r);
    ctx.stroke();
    ctx.restore();
  }
  function flagIcon(ctx, x, y, s, t, ph = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = COL.ink;
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, s * 0.46);
    ctx.lineTo(-s * 0.3, -s * 0.46);
    ctx.stroke();
    ctx.fillStyle = COL.red;
    const fx = -s * 0.3, fy = -s * 0.44, fw = s * 0.72, fh = s * 0.44, n = 12;
    const wave = (i) => Math.sin((i / n) * Math.PI * 1.6 - t * 7 + ph) * s * 0.06 * (i / n);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) ctx.lineTo(fx + (fw * i) / n, fy + wave(i));
    for (let i = n; i >= 0; i--) ctx.lineTo(fx + (fw * i) / n, fy + fh + wave(i));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function shareIcon(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = COL.dark;
    ctx.fillStyle = COL.dark;
    ctx.lineWidth = s * 0.1;
    const pts = [[s * 0.28, -s * 0.32], [-s * 0.3, 0], [s * 0.28, s * 0.32]];
    ctx.beginPath();
    ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.lineTo(...pts[2]);
    ctx.stroke();
    for (const p of pts) { circle(ctx, p[0], p[1], s * 0.16); ctx.fill(); }
    ctx.restore();
  }

  // ── Fond & caméra ───────────────────────────────────────────────────
  function blob(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function drawBG(ctx, t, o = {}) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COL.bgTop);
    g.addColorStop(1, COL.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    blob(ctx, 180 + 90 * Math.sin(t * 0.31), 520 + 70 * Math.cos(t * 0.23), 640, 'rgba(91,140,255,0.17)');
    blob(ctx, 920 + 70 * Math.cos(t * 0.27), 1450 + 90 * Math.sin(t * 0.2), 700, 'rgba(167,139,250,0.15)');
    if (o.tint) blob(ctx, 540, 1000, 1100, o.tint);
    // Grille de points (parallaxe)
    const sp = 54, px = (o.px || 0) * 0.3, py = (o.py || 0) * 0.3;
    const ox = (((-px) % sp) + sp) % sp, oy = (((-py) % sp) + sp) % sp;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = oy - sp; y < H + sp; y += sp) {
      for (let x = ox - sp; x < W + sp; x += sp) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.5, H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
  function applyCam(ctx, cam) {
    ctx.translate(W / 2 + (cam.sx || 0), H / 2 + (cam.sy || 0));
    if (cam.r) ctx.rotate(cam.r);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.x, -cam.y);
  }
  function shakeAt(t, t0, amp, dur) {
    const u = (t - t0) / dur;
    if (u < 0 || u > 1) return { x: 0, y: 0 };
    const a = amp * Math.pow(1 - u, 2);
    return {
      x: a * (Math.sin(t * 83.1) * 0.6 + Math.sin(t * 131.7 + 1.3) * 0.4),
      y: a * (Math.sin(t * 97.3 + 0.7) * 0.6 + Math.sin(t * 151.1 + 2.1) * 0.4),
    };
  }
  function keyCam(keys, t) {
    if (t <= keys[0][0]) return { x: keys[0][1], y: keys[0][2], z: keys[0][3] };
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, x0, y0, z0] = keys[i], [t1, x1, y1, z1] = keys[i + 1];
      if (t < t1) {
        const u = Ease.inOutCubic((t - t0) / (t1 - t0));
        return { x: lerp(x0, x1, u), y: lerp(y0, y1, u), z: z0 * Math.pow(z1 / z0, u) };
      }
    }
    const k = keys[keys.length - 1];
    return { x: k[1], y: k[2], z: k[3] };
  }

  // Calques hors-écran (fondus propres de groupes entiers)
  const buffers = [];
  function getBuffer(i) {
    if (!buffers[i]) {
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : document.createElement('canvas');
      c.width = W;
      c.height = H;
      buffers[i] = c;
    }
    return buffers[i];
  }
  function layer(ctx, alpha, idx, fn) {
    if (alpha <= 0.001) return;
    if (alpha >= 0.999) { fn(ctx); return; }
    const c = getBuffer(idx), b = c.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.clearRect(0, 0, W, H);
    b.setTransform(ctx.getTransform());
    fn(b);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(c, 0, 0);
    ctx.restore();
  }

  // ════════════════════════════════════════════════════════════════════
  //  Conducteur (timeline)
  // ════════════════════════════════════════════════════════════════════
  const T = {
    hookZoom: 2.95, hookEnd: 3.45, reveal: 3.95,
    bossIn: 3.5, bubble: 4.5, bubble2: 5.45, stamp: 6.6, note: 7.3, promiseOut: 8.65,
    toApex: 9.0, apexDur: 0.75, jarIn: 9.35, L1in: 9.5, L1bills: 10.3,
    icons: 12.55, iconsX: 13.25, iconsOut: 14.45,
    L2in: 15.55, L2bills: 16.3, payL1: 18.35, stream: 19.6, streamEnd: 22.5,
    talk: 23.45, talkEnd: 25.45, zoomOut: 24.2, L3in: 24.85, L3bills: 25.75, payL2: 27.1,
    expoIn: 29.0, expoStart: 29.7, compare: 34.1, impossible: 35.3, expoOut: 36.4,
    ghosts: 37.0, worried: 37.55, bagIn: 38.25, drain: 38.45, run: 39.65, collapse: 40.6,
    toBilan: 41.95, bilan: 42.45, flagsWipe: 48.3, flags: 48.8, outroWipe: 54.8, outro: 55.3, end: DURATION,
  };

  const CAPTIONS = [
    { a: 3.9, b: 8.75, lines: ['Tout commence par', 'une {y:promesse}…'] },
    { a: 9.2, b: 12.0, lines: ['3 personnes lui', 'confient {g:100 €}.'] },
    { a: 12.15, b: 14.75, lines: ['Mais en secret…', 'il n’investit [r:rien].'] },
    { a: 15.1, b: 17.25, lines: ['45 jours plus tard,', 'il doit les payer.'] },
    { a: 17.35, b: 22.8, lines: ['Il paie les {b:anciens}', 'avec l’argent', 'des {v:nouveaux}.'] },
    { a: 23.1, b: 25.5, lines: ['Les anciens sont payés…', 'alors ils en parlent.'] },
    { a: 25.6, b: 28.8, lines: ['Et de plus en plus', 'de monde entre…'] },
    { a: 29.15, b: 31.65, lines: ['Pour payer tout le monde,', 'il en faut toujours [r:PLUS].'] },
    { a: 31.75, b: 33.95, lines: ['Chaque niveau doit être', '{o:3× plus grand} !'] },
    { a: 34.05, b: 36.35, lines: ['Au niveau 21, il faudrait', 'plus d’humains', 'que sur {b:Terre} !'] },
    { a: 36.7, b: 38.3, lines: ['Un jour, les nouveaux', 'n’arrivent plus…'] },
    { a: 38.4, b: 39.6, lines: ['La caisse se {r:vide}…'] },
    { a: 39.7, b: 40.5, lines: ['…et il {y:disparaît}.'] },
    { a: 40.6, b: 41.9, lines: ['[r:Tout s’effondre.]'], size: 104, stagger: 0.07 },
    { a: 42.7, b: 45.9, lines: ['Qui gagne ?', 'Qui perd ?'], size: 100 },
    { a: 46.0, b: 48.15, lines: ['Ici, {r:2 personnes sur 3}', 'perdent tout.'] },
    { a: 48.9, b: 54.6, lines: ['Comment la', 'repérer ?'], size: 100 },
  ];

  const CHAPTERS = [
    { a: 3.75, b: 14.75, n: '01', label: 'LA PROMESSE' },
    { a: 15.05, b: 22.8, n: '02', label: 'LE SECRET' },
    { a: 23.05, b: 28.8, n: '03', label: 'L’ILLUSION' },
    { a: 29.05, b: 36.3, n: '04', label: 'LE PIÈGE' },
    { a: 36.6, b: 41.9, n: '05', label: 'L’EFFONDREMENT' },
    { a: 42.6, b: 48.15, n: '06', label: 'LE BILAN' },
    { a: 48.85, b: 54.6, n: '07', label: 'LES SIGNAUX D’ALERTE' },
  ];

  // ── Mise en place du « monde » (coordonnées monde = écran à zoom 1) ──
  const LAY = {
    boss0: { x: 540, y: 1400, s: 380 },
    boss1: { x: 330, y: 960, s: 220 },
    jar: { x: 560, y: 960, s: 250 },
    L1: { y: 1185, s: 150, n: 3, x: (i) => 270 + i * 270, color: COL.blue, in: T.L1in, st: 0.12 },
    L2: { y: 1395, s: 96, n: 9, x: (i) => 540 + (i - 4) * 100, color: COL.violet, in: T.L2in, st: 0.05 },
    L3: { y: 1600, s: 62, n: 27, x: (i) => 540 + (i - 13) * 48, color: COL.orange, in: T.L3in, st: 0.022 },
    G: { y: 1790, s: 70, n: 9, x: (i) => 540 + (i - 4) * 124 },
  };
  const ROWS = [LAY.L1, LAY.L2, LAY.L3];
  const chest = (row, i) => ({ x: row.x(i), y: row.y - row.s * 0.28 });
  const JAR_IN = { x: LAY.jar.x, y: LAY.jar.y - LAY.jar.s * 0.84 };
  const JAR_OUT = { x: LAY.jar.x, y: LAY.jar.y - LAY.jar.s * 0.9 };
  const BAG = { x: LAY.boss1.x + 92, y: LAY.boss1.y - 44 };

  // ── Vols de billets & compteur de la caisse ─────────────────────────
  const FLIGHTS = [];
  const COUNTER = [];
  const LABELS = [];
  const HAPPY = { L1: [], L2: [] };
  function flight(t0, dur, a, b, o = {}) {
    const f = { t0, dur, x0: a.x, y0: a.y, x1: b.x, y1: b.y, ...o };
    FLIGHTS.push(f);
    return f;
  }
  for (let i = 0; i < 3; i++) {
    const t0 = T.L1bills + i * 0.3;
    flight(t0, 0.75, chest(LAY.L1, i), JAR_IN, { w: 110, arc: -260, sink: true, kind: 'in' });
    COUNTER.push([t0 + 0.75, 100]);
  }
  for (let i = 0; i < 9; i++) {
    const t0 = T.L2bills + i * 0.075;
    flight(t0, 0.8, chest(LAY.L2, i), JAR_IN, { w: 88, arc: -200, sink: true, bend: (4 - i) * 10, kind: 'in' });
    COUNTER.push([t0 + 0.8, 100]);
  }
  for (let i = 0; i < 3; i++) {
    const t0 = T.payL1 + i * 0.16, c = chest(LAY.L1, i);
    flight(t0, 0.75, JAR_OUT, { x: c.x, y: c.y - 30 }, { w: 120, arc: -170, spin: -1, kind: 'out' });
    COUNTER.push([t0, -150]);
    LABELS.push({ t: t0 + 0.75, x: c.x, y: LAY.L1.y - LAY.L1.s * 1.12, text: '+150 €', size: 50 });
    HAPPY.L1[i] = t0 + 0.75;
  }
  for (let i = 0; i < 27; i++) {
    const t0 = T.L3bills + i * 0.04;
    flight(t0, 0.75, chest(LAY.L3, i), JAR_IN, { w: 62, arc: -180, sink: true, bend: (13 - i) * 6, kind: 'in' });
    COUNTER.push([t0 + 0.75, 100]);
  }
  for (let i = 0; i < 9; i++) {
    const t0 = T.payL2 + i * 0.06, c = chest(LAY.L2, i);
    flight(t0, 0.7, JAR_OUT, { x: c.x, y: c.y - 20 }, { w: 84, arc: -150, spin: -1, kind: 'out' });
    COUNTER.push([t0, -150]);
    LABELS.push({ t: t0 + 0.7, x: c.x, y: LAY.L2.y - LAY.L2.s * 1.15 - (i % 2) * 34, text: '+150', size: 30 });
    HAPPY.L2[i] = t0 + 0.7;
  }
  for (let i = 0; i < 8; i++) {
    const t0 = T.drain + i * 0.08;
    flight(t0, 0.45, JAR_OUT, BAG, { w: 70, arc: -130, spin: -1, sink: true, kind: 'drain' });
    COUNTER.push([t0, -2100 / 8]);
  }
  // Flux d'argent illustratif (nouveaux → caisse → anciens)
  const STREAM = [];
  for (let j = 0, ts = T.stream; ts < T.streamEnd; j++, ts += 0.19) {
    if (j % 2 === 0) STREAM.push({ t0: ts, dur: 0.7, ...xy(chest(LAY.L2, (j * 7) % 9), JAR_IN), w: 54, arc: -170, sink: true, alpha: 0.85 });
    else STREAM.push({ t0: ts, dur: 0.7, ...xy(JAR_OUT, chest(LAY.L1, (j * 5) % 3)), w: 54, arc: -150, spin: -1, alpha: 0.85 });
  }
  function xy(a, b) { return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }; }

  const counterAt = (t) => {
    let v = 0;
    for (const [tt, d] of COUNTER) v += d * Ease.outCubic(clamp((t - tt) / 0.3));
    return Math.max(0, v);
  };
  const jarLevel = (v) => Math.pow(clamp(v / 3600), 0.6);

  // ── Exponentielle : instants d'apparition des niveaux 4 → 21 ────────
  const EXPO = (() => {
    const gaps = [0.45, 0.4, 0.35, 0.3, 0.27, 0.24, 0.21, 0.19, 0.17, 0.15, 0.14, 0.13, 0.12, 0.12, 0.12, 0.12, 0.12];
    const times = [], durs = [];
    let tt = T.expoStart;
    for (let i = 0; i < gaps.length; i++) { times.push(tt); durs.push(Math.min(0.42, gaps[i] * 1.15)); tt += gaps[i]; }
    times.push(tt + 0.4);
    durs.push(0.55);
    return { times, durs };
  })();

  // ════════════════════════════════════════════════════════════════════
  //  Scène 0 — Accroche
  // ════════════════════════════════════════════════════════════════════
  const BLOCKS = (() => {
    const out = [], bw = 176, bh = 104, gap = 14, top = 930;
    const colors = [COL.yellow, COL.blue, COL.violet, COL.orange];
    let order = 0;
    for (let r = 3; r >= 0; r--) {
      const n = r + 1, rowW = n * bw + (n - 1) * gap, y = top + r * (bh + gap);
      for (let i = 0; i < n; i++) {
        out.push({ x: 540 - rowW / 2 + i * (bw + gap) + bw / 2, y: y + bh / 2, w: bw, h: bh, color: colors[r], row: r, t: 0.3 + order * 0.075 });
        order++;
      }
    }
    return out;
  })();
  const HOOK_BILLS = [0, 1, 2, 3, 4, 5].map((i) => {
    const src = BLOCKS[[0, 3, 1, 2, 4, 6][i]];
    return { t0: 1.35 + i * 0.24, dur: 0.6, x0: src.x, y0: src.y - 20, x1: 540, y1: 975, w: 52, arc: -120, sink: true };
  });

  function drawBlock(ctx, b, sc, iconAlpha) {
    if (sc <= 0.001) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(sc, sc);
    const { w, h } = b;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rrect(ctx, -w / 2 + 6, -h / 2 + 10, w, h, 18);
    ctx.fill();
    ctx.fillStyle = mixHex(b.color, '#000000', 0.25);
    rrect(ctx, -w / 2, -h / 2, w, h, 18);
    ctx.fill();
    ctx.fillStyle = b.color;
    rrect(ctx, -w / 2, -h / 2, w, h - 14, 18);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    rrect(ctx, -w / 2 + 14, -h / 2 + 8, w - 28, 5, 3);
    ctx.fill();
    if (iconAlpha > 0) {
      ctx.globalAlpha *= iconAlpha;
      if (b.row === 0) {
        person(ctx, 0, h * 0.3, 68, { color: COL.dark, headColor: COL.dark, boss: true, shadow: false });
      } else {
        const ic = 'rgba(255,255,255,0.92)';
        ctx.fillStyle = ic;
        circle(ctx, 0, -h * 0.17, 13);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, h * 0.2, 24, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function sceneHook(ctx, t) {
    drawBG(ctx, t);
    const zu = clamp((t - T.hookZoom) / (T.hookEnd - T.hookZoom));
    const ez = Ease.inExpo(zu);
    const cam = { x: 540, y: lerp(960, 973, Ease.outCubic(zu)), z: lerp(1, 26, ez) * (1 + 0.012 * Math.sin(t * 1.3)), r: 0.004 * Math.sin(t * 0.9) * (1 - zu) };
    ctx.save();
    applyCam(ctx, cam);
    for (const b of BLOCKS) {
      const u = clamp((t - b.t) / 0.45);
      if (u <= 0) continue;
      const sc = Ease.outBack(u);
      const bob = Math.sin(t * 2.2 + b.x * 0.01) * 3 * clamp((t - 1.2) / 0.5);
      ctx.save();
      ctx.translate(0, (1 - Ease.outCubic(u)) * -50 + bob);
      drawBlock(ctx, b, sc, b.row === 0 ? 1 - clamp(zu * 3) : 1);
      ctx.restore();
    }
    for (const f of HOOK_BILLS) flyBill(ctx, t, f);
    // Scintillement au sommet
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.9 + i * 0.25) % 1;
      sparkle(ctx, 540 + Math.cos(i * 1.7) * 120, 930 - 30 - ph * 60, 14 * (1 - ph), clamp((t - 1.2) / 0.3) * (1 - ph) * (1 - zu));
    }
    ctx.restore();

    // Titre
    const out = P(t, 2.8, 0.3, Ease.inCubic);
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.translate(0, -out * 80);
    drawRich(ctx, t, { a: 0.1, b: 3.4, lines: ['La pyramide', 'de [y:Ponzi]'], size: 150, y: 400, lh: 1.04, stagger: 0.1, outDur: 0.01 });
    const pa = P(t, 0.95, 0.5, Ease.outBack);
    if (pa > 0) {
      const label = 'expliquée en 1 minute';
      const tw = measure(ctx, label, 44, 600, FT);
      const pw = tw + 110, ph = 84, py = 772;
      ctx.save();
      ctx.translate(540, py + ph / 2);
      ctx.scale(pa, pa);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      rrect(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Pastille « horloge »
      const cx = -pw / 2 + 46;
      ctx.strokeStyle = COL.yellow;
      ctx.lineWidth = 5;
      circle(ctx, cx, 0, 17);
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx + Math.cos(t * 4 - Math.PI / 2) * 11, Math.sin(t * 4 - Math.PI / 2) * 11);
      ctx.stroke();
      text(ctx, label, cx + 36, 15, { size: 44, weight: 600, fam: FT, align: 'left', color: COL.ink });
      ctx.restore();
    }
    ctx.restore();
  }

  // ════════════════════════════════════════════════════════════════════
  //  Scènes 1→5 — le « monde » (organisateur, caisse, investisseurs)
  // ════════════════════════════════════════════════════════════════════
  const CAM_WORLD = [
    [3.45, 540, 960, 1.0],
    [8.9, 540, 990, 1.05],
    [9.75, 540, 945, 1.0],
    [15.4, 540, 945, 1.0],
    [16.0, 540, 975, 0.975],
    [23.3, 540, 975, 0.975],
    [25.35, 540, 976, 0.72],
    [29.6, 540, 990, 0.62],
    [36.4, 540, 1058, 0.45],
    [36.95, 540, 1058, 0.66],
    [40.5, 540, 1050, 0.685],
  ];
  function worldCam(t) {
    const c = keyCam(CAM_WORLD, t);
    c.z *= 1 + 0.006 * Math.sin(t * 0.7);
    c.r = 0.0035 * Math.sin(t * 0.43);
    const sh = shakeAt(t, T.collapse, 34, 1.1), sh2 = shakeAt(t, T.stamp + 0.1, 10, 0.35), sh3 = shakeAt(t, T.iconsX, 8, 0.3);
    c.sx = sh.x + sh2.x + sh3.x;
    c.sy = sh.y + sh2.y + sh3.y;
    return c;
  }
  const worldAlpha = (t) => (t < T.expoIn ? 1 : t < 36.3 ? 1 - P(t, T.expoIn, 0.5, Ease.inOutCubic) : P(t, T.expoOut, 0.5, Ease.inOutCubic));

  /** Chute physique déterministe lors de l'effondrement. */
  function fall(t, t0, seed) {
    const tau = t - t0;
    if (tau <= 0) return null;
    const r = rng(seed * 31 + 7);
    const vx = (r() - 0.5) * 520, vy = -120 - r() * 380, vr = (r() - 0.5) * 7;
    return { dx: vx * tau, dy: vy * tau + 0.5 * 4400 * tau * tau, rot: vr * tau };
  }
  const blinkAt = (t, i) => ((t + hash(i) * 9) % 4.1) < 0.11;

  function bossState(t) {
    const m = Ease.inOutCubic(clamp((t - T.toApex) / T.apexDur));
    let x = lerp(LAY.boss0.x, LAY.boss1.x, m);
    const y = lerp(LAY.boss0.y, LAY.boss1.y, m);
    const s = lerp(LAY.boss0.s, LAY.boss1.s, m);
    const pin = clamp((t - T.bossIn) / 0.6);
    let scale = Ease.outBack(pin);
    const moving = Math.sin(m * Math.PI);
    let sx = 1 - moving * 0.08, sy = 1 + moving * 0.1;
    let flip = false, rot = 0;
    if (t > T.run - 0.2) flip = true;
    const ru = clamp((t - T.run) / 0.6);
    if (ru > 0) {
      x -= Ease.inCubic(ru) * 1100 - 30 * Math.sin(Math.min(ru / 0.3, 1) * Math.PI);
      rot = -0.2 * Ease.outCubic(clamp(ru * 3));
      sy = 1 + 0.06 * Math.sin(ru * 40);
    }
    let mood = 'smug', look = 0;
    if (t > T.icons - 0.3 && t < T.iconsOut + 0.2) look = -1;
    const bob = Math.sin(t * 2.4) * s * 0.012;
    return { x, y, s, scale, sx, sy, flip, rot, mood, look, bob };
  }

  function rowMood(rowIdx, i, t) {
    if (t >= T.collapse) return 'shock';
    if (rowIdx === 0) {
      if (t >= T.drain + 0.15) return 'sad';
      return HAPPY.L1[i] && t >= HAPPY.L1[i] ? 'happy' : 'neutral';
    }
    if (rowIdx === 1) {
      if (t >= T.drain + 0.15) return 'sad';
      return HAPPY.L2[i] && t >= HAPPY.L2[i] ? 'happy' : 'neutral';
    }
    return t >= T.worried ? 'sad' : 'neutral';
  }

  function sceneWorld(ctx, t) {
    const cam = worldCam(t);
    const tint = t > 38.6 && t < 42.5 ? `rgba(255,77,94,${0.22 * P(t, 38.9, 0.7) * (1 - P(t, 41.6, 0.5))})` : null;
    drawBG(ctx, t, { px: (cam.x - 540) * cam.z, py: (cam.y - 960) * cam.z, tint });
    const wa = worldAlpha(t);
    layer(ctx, wa, 0, (c) => {
      c.save();
      applyCam(c, cam);
      drawWorld(c, t, cam);
      c.restore();
    });
    if (t >= T.expoIn && t < T.expoOut + 0.6) {
      const ea = t < 36.3 ? P(t, T.expoIn + 0.05, 0.5, Ease.inOutCubic) : 1 - P(t, T.expoOut - 0.05, 0.45, Ease.inOutCubic);
      layer(ctx, ea, 1, (c) => drawExpo(c, t));
    }
  }

  function drawWorld(ctx, t, cam) {
    const zc = 1 / Math.pow(cam.z, 0.75); // compensation de taille des textes
    const col = t >= T.collapse ? t - T.collapse : -1;

    // Silhouette de pyramide en arrière-plan
    const revealY = 560 + (LAY.L1.y + 30 - 560) * P(t, T.L1in - 0.1, 0.7) + (LAY.L2.y - LAY.L1.y) * P(t, T.L2in - 0.1, 0.7) + (LAY.L3.y - LAY.L2.y) * P(t, T.L3in - 0.1, 0.7);
    const triA = (t > T.L1in - 0.1 ? 1 : 0) * (1 - P(t, T.collapse, 0.3));
    if (triA > 0) {
      ctx.save();
      ctx.globalAlpha *= triA;
      ctx.beginPath();
      ctx.rect(-2000, 0, 5000, revealY);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(545, 560);
      ctx.lineTo(1260, 1640);
      ctx.lineTo(-180, 1640);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 560, 0, 1640);
      g.addColorStop(0, 'rgba(255,210,63,0.10)');
      g.addColorStop(1, 'rgba(91,140,255,0.03)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.setLineDash([14, 14]);
      ctx.lineDashOffset = -t * 30;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Étages (plateformes)
    const tiers = [
      { y: LAY.boss1.y, x0: 190, x1: 730, t0: T.jarIn, k: 3 },
      { y: LAY.L1.y, x0: 150, x1: 930, t0: T.L1in, k: 0 },
      { y: LAY.L2.y, x0: 70, x1: 1010, t0: T.L2in - 0.05, k: 1 },
      { y: LAY.L3.y, x0: -110, x1: 1190, t0: T.L3in - 0.05, k: 2 },
    ];
    for (const tr of tiers) {
      const u = P(t, tr.t0, 0.5, Ease.outQuart);
      if (u <= 0) continue;
      const cx = (tr.x0 + tr.x1) / 2, hw = ((tr.x1 - tr.x0) / 2) * u;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      if (col > 0) {
        const delay = [0.22, 0.12, 0.02, 0.3][tr.k];
        for (const side of [-1, 1]) {
          const fz = fall(t, T.collapse + delay, tr.k * 2 + (side > 0 ? 1 : 0) + 50);
          ctx.save();
          if (fz) {
            ctx.translate(cx + (side * hw) / 2 + fz.dx * 0.4, tr.y + 10 + fz.dy);
            ctx.rotate(side * Math.abs(fz.rot) * 0.4);
          } else ctx.translate(cx + (side * hw) / 2, tr.y + 10);
          rrect(ctx, -hw / 2, -6, hw - 6, 12, 6);
          ctx.fill();
          ctx.restore();
        }
      } else {
        rrect(ctx, cx - hw, tr.y + 4, hw * 2, 12, 6);
        ctx.fill();
      }
      ctx.restore();
    }

    // Caisse (bocal)
    const v = counterAt(t);
    const jIn = P(t, T.jarIn, 0.55, Ease.outBack);
    if (jIn > 0) {
      ctx.save();
      const danger = P(t, T.drain + 0.5, 0.3);
      const fz = fall(t, T.collapse + 0.28, 99);
      ctx.translate(LAY.jar.x, LAY.jar.y);
      if (fz) { ctx.translate(fz.dx * 0.5, fz.dy); ctx.rotate(fz.rot * 0.6 + 0.4 * clamp((t - T.collapse - 0.28) * 3)); }
      ctx.scale(jIn, jIn);
      const shake = t > T.drain + 0.5 && t < T.collapse ? Math.sin(t * 60) * 3 * (1 - P(t, T.drain + 0.5, 0.8)) : 0;
      jar(ctx, shake, 0, LAY.jar.s, jarLevel(v), t, { danger });
      // Compteur
      const ca = P(t, T.jarIn + 0.15, 0.4) * (1 - P(t, T.collapse, 0.25));
      if (ca > 0) {
        ctx.globalAlpha *= ca;
        const isZero = danger > 0.5;
        const pulse = 1 + 0.12 * Math.exp(-Math.max(0, (t - lastCounterHit(t)) * 9));
        ctx.save();
        ctx.translate(0, -LAY.jar.s * 1.06);
        ctx.scale(pulse, pulse);
        text(ctx, `${fmt(v)} €`, 0, 0, { size: 66 * zc, weight: 900, color: isZero ? COL.red : COL.ink });
        ctx.restore();
      }
      ctx.restore();
    }

    // Organisateur
    const bs = bossState(t);
    if (bs.scale > 0.001 && bs.x > -600) {
      person(ctx, bs.x, bs.y, bs.s, {
        color: COL.yellow, headColor: '#FFE9A6', boss: true, mood: bs.mood, look: bs.look, bob: bs.bob,
        scale: bs.scale, sx: bs.sx, sy: bs.sy, flip: bs.flip, rot: bs.rot,
      });
      // Sac d'argent
      const ba = P(t, T.bagIn, 0.35, Ease.outBack);
      if (ba > 0) {
        const dir = bs.flip ? -1 : 1;
        ctx.save();
        ctx.translate(bs.x + dir * 92, bs.y - 44 + Math.sin(t * 20) * (t > T.run ? 6 : 0));
        ctx.scale(ba, ba);
        moneyBag(ctx, 0, 0, 92, t > T.run ? -0.3 : 0);
        ctx.restore();
      }
      // Lignes de vitesse + poussière
      if (t > T.run) {
        const ru = clamp((t - T.run) / 0.8);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const yy = bs.y - 30 - i * 32, len = 120 + hash(i) * 160;
          ctx.globalAlpha = (1 - ru) * 0.8;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(bs.x + 90 + hash(i + 9) * 40, yy);
          ctx.lineTo(bs.x + 90 + len, yy);
          ctx.stroke();
        }
        for (let i = 0; i < 6; i++) {
          const pu = clamp((t - T.run - i * 0.05) / 0.7);
          if (pu <= 0 || pu >= 1) continue;
          ctx.globalAlpha = (1 - pu) * 0.28;
          ctx.fillStyle = '#C9CEF0';
          circle(ctx, LAY.boss1.x + 40 - i * 70 + pu * 50, LAY.boss1.y - 12 - pu * 50 - (i % 2) * 18, 22 + pu * 40);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // Rangées d'investisseurs
    ROWS.forEach((row, ri) => {
      for (let i = 0; i < row.n; i++) {
        const tin = row.in + i * row.st;
        const u = clamp((t - tin) / 0.45);
        if (u <= 0) continue;
        let x = row.x(i), y = row.y, rot = 0;
        const fz = fall(t, T.collapse + [0.22, 0.12, 0.02][ri] + hash(i + ri * 40) * 0.12, i + ri * 100);
        if (fz) { x += fz.dx; y += fz.dy; rot = fz.rot; }
        if (y > 2600) continue;
        const look = clamp((LAY.jar.x - x) / 400, -1, 1) * 0.7;
        const hop = HAPPY[['L1', 'L2'][ri]] && HAPPY[['L1', 'L2'][ri]][i] ? Math.max(0, Math.sin(clamp((t - HAPPY[['L1', 'L2'][ri]][i]) / 0.35) * Math.PI)) * row.s * 0.18 : 0;
        person(ctx, x, y - hop, row.s, {
          color: row.color, scale: Ease.outBack(u), mood: rowMood(ri, i, t), look,
          blink: blinkAt(t, i + ri * 30), bob: Math.sin(t * 2.6 + i * 1.3) * row.s * 0.012, rot,
        });
        // Inquiétude
        if (ri === 2 && t > T.worried + (i % 5) * 0.06 && t < T.collapse && i % 2 === 0) {
          const qa = P(t, T.worried + (i % 5) * 0.06, 0.3, Ease.outBack);
          text(ctx, '?', x, y - row.s * 1.2 + Math.sin(t * 5 + i) * 4, { size: 46 * qa, weight: 900, color: COL.yellow });
        }
      }
    });

    // Nouveaux qui ne viennent plus (silhouettes fantômes)
    if (t > T.ghosts && t < 39.2) {
      for (let i = 0; i < LAY.G.n; i++) {
        const u = P(t, T.ghosts + i * 0.04, 0.4, Ease.outBack);
        const a = (0.75 + 0.25 * Math.sin(t * 6 + i)) * (1 - P(t, 38.6, 0.5));
        person(ctx, LAY.G.x(i), LAY.G.y, LAY.G.s, { ghost: true, scale: u, alpha: a });
      }
    }

    // Icônes « investissements » barrées
    if (t > T.icons && t < T.iconsOut + 0.4) {
      const out = P(t, T.iconsOut, 0.3, Ease.inBack);
      ['factory', 'chart'].forEach((k, i) => {
        const x = [390, 690][i], y = 1345;
        const sc = P(t, T.icons + i * 0.15, 0.5, Ease.outBack) * (1 - out);
        iconCard(ctx, x, y, 170, k, t, sc);
        if (sc > 0.01) text(ctx, ['Entreprise', 'Placement'][i], x, y + 130, { size: 34 * Math.min(1, sc), weight: 700, fam: FT, color: COL.mute });
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(Math.max(0.001, 1 - out), Math.max(0.001, 1 - out));
        redX(ctx, 0, 0, 190, t, T.iconsX + i * 0.15);
        ctx.restore();
      });
    }

    // Billets en vol
    for (const f of STREAM) flyBill(ctx, t, f);
    for (const f of FLIGHTS) flyBill(ctx, t, f);

    // Étiquettes « +150 € »
    for (const L of LABELS) {
      const u = (t - L.t) / 1.2;
      if (u < 0 || u > 1) continue;
      ctx.save();
      ctx.globalAlpha *= clamp(u * 6) * (1 - Ease.inCubic(clamp((u - 0.6) / 0.4)));
      const sc = Ease.outBack(clamp(u * 3));
      ctx.translate(L.x, L.y - Ease.outCubic(u) * 60);
      ctx.scale(sc, sc);
      text(ctx, L.text, 0, 0, { size: L.size * zc, weight: 900, color: COL.green });
      ctx.restore();
    }

    // Bouche-à-oreille : bulles « Ça marche ! » + ondes
    if (t > T.talk && t < T.talkEnd + 0.3) {
      for (let i = 0; i < 3; i++) {
        const x = LAY.L1.x(i), hy = LAY.L1.y - LAY.L1.s * 0.92;
        for (let k = 0; k < 3; k++) {
          const u = (t - (T.talk + 0.2 + k * 0.45 + i * 0.1)) / 1.2;
          if (u < 0 || u > 1) continue;
          ctx.save();
          ctx.strokeStyle = COL.blue;
          ctx.lineWidth = 6 * (1 - u);
          ctx.globalAlpha *= 0.7 * (1 - u);
          circle(ctx, x, hy, 60 + u * 230);
          ctx.stroke();
          ctx.restore();
        }
        const sc = P(t, T.talk + i * 0.15, 0.4, Ease.outBack) * (1 - P(t, T.talkEnd, 0.25, Ease.inBack));
        if (sc > 0.01) {
          const by = LAY.L1.y + 66, ty = LAY.L1.y + 10;
          ctx.save();
          ctx.translate(x, ty);
          ctx.scale(sc, sc);
          ctx.translate(-x, -ty);
          ctx.translate(x, by);
          ctx.scale(1, -1);
          ctx.translate(-x, -by);
          bubble(ctx, x, by, 224, 70, x, ty + 2 * (by - ty) - 0, 1);
          ctx.restore();
          ctx.save();
          ctx.translate(x, ty);
          ctx.scale(sc, sc);
          ctx.translate(-x, -ty);
          text(ctx, 'Ça marche !', x, by + 11, { size: 32, weight: 900, color: COL.dark });
          ctx.restore();
        }
      }
    }

    // Promesse : bulle, tampon « +50 % », note historique
    drawPromise(ctx, t);
  }

  let _lastHitCache = null;
  function lastCounterHit(t) {
    if (!_lastHitCache) _lastHitCache = COUNTER.map((c) => c[0]).sort((a, b) => a - b);
    let last = -10;
    for (const h of _lastHitCache) { if (h <= t) last = h; else break; }
    return last;
  }

  function drawPromise(ctx, t) {
    if (t < T.bubble || t > T.toApex + 0.2) return;
    const out = P(t, T.promiseOut, 0.3, Ease.inBack);
    // Bulle de dialogue
    const bIn = P(t, T.bubble, 0.45, Ease.outBack);
    const sc = bIn * (1 - out);
    if (sc > 0.01) {
      const bx = 540, by = 765, bw = 700, bh = 270;
      bubble(ctx, bx, by, bw, bh, 470, 985, sc, { r: 48 });
      ctx.save();
      ctx.translate(470, 985);
      ctx.scale(sc, sc);
      ctx.translate(-470, -985);
      drawRich(ctx, t, { a: T.bubble + 0.1, b: T.promiseOut + 0.25, lines: ['Confie-moi 100 €…'], size: 58, y: by - bh / 2 + 34, color: COL.dark, weight: 800, stagger: 0.06, outDur: 0.01 });
      drawRich(ctx, t, { a: T.bubble2, b: T.promiseOut + 0.25, lines: ['je te rends [g:150 €]', 'dans 45 jours !'], size: 58, y: by - bh / 2 + 34 + 74, color: COL.dark, weight: 800, stagger: 0.07, outDur: 0.01, markerText: COL.dark });
      ctx.restore();
    }
    // Tampon « +50 % GARANTI »
    const st = slam(t, T.stamp, 2.3);
    if (st && out < 1) {
      ctx.save();
      ctx.translate(828, 1235);
      ctx.rotate(-0.2);
      ctx.scale(st * (1 - out), st * (1 - out));
      ctx.globalAlpha *= clamp((t - T.stamp) / 0.06);
      ctx.fillStyle = 'rgba(11,14,34,0.85)';
      rrect(ctx, -165, -88, 330, 176, 30);
      ctx.fill();
      ctx.strokeStyle = COL.green;
      ctx.lineWidth = 9;
      ctx.stroke();
      text(ctx, '+50 %', 0, 22, { size: 86, weight: 900, color: COL.green });
      text(ctx, 'GARANTI', 0, 66, { size: 26, weight: 700, fam: FT, ls: 7, color: COL.green });
      ctx.restore();
      burst(ctx, 828, 1235, t, T.stamp + 0.13, COL.green, 150, 260, 14, 0.5);
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.7 + i * 0.2) % 1;
        sparkle(ctx, 828 + Math.cos(i * 2.3) * 170, 1235 + Math.sin(i * 2.3) * 110 - ph * 30, 16 * Math.sin(ph * Math.PI), (t > T.stamp + 0.3 ? 1 : 0) * (1 - out), COL.greenL);
      }
    }
    // Note historique
    const na = env(t, T.note, T.promiseOut + 0.3, 0.4, 0.3);
    if (na > 0) {
      ctx.save();
      ctx.globalAlpha *= na;
      ctx.translate(0, (1 - na) * 16);
      text(ctx, 'C’était la vraie promesse de', 540, 1478, { size: 34, weight: 600, fam: FT, color: COL.mute });
      text(ctx, 'Charles Ponzi, à Boston, en 1920.', 540, 1524, { size: 34, weight: 600, fam: FT, color: COL.mute });
      ctx.restore();
    }
  }

  // ── Scène 4 — croissance exponentielle ─────────────────────────────
  function levelColor(k) {
    if (k === 0) return COL.yellow;
    if (k === 1) return COL.blue;
    if (k === 2) return COL.violet;
    if (k === 3) return COL.orange;
    const c = mixHex('#FF8A3D', '#E5294A', clamp((k - 3) / 16));
    return k % 2 ? c : mixHex(c, '#000000', 0.14);
  }
  function drawExpo(ctx, t) {
    let R = 3;
    for (const tt of EXPO.times) if (t >= tt) R++;
    let L = 3;
    EXPO.times.forEach((tt, i) => { L += Ease.outCubic(clamp((t - tt) / EXPO.durs[i])); });
    const cmp = P(t, T.compare + 0.05, 0.6, Ease.inOutQuart);
    const outZoom = P(t, T.expoOut - 0.05, 0.5, Ease.inCubic);
    const apexX = 540, apexY = 655, Ht = 770, HW = 470;
    drawBG(ctx, t);
    ctx.save();
    // Mise en page « comparaison » : la pyramide remonte et rétrécit
    const sc = lerp(1, 0.6, cmp) * lerp(1, 1.8, outZoom);
    ctx.translate(apexX, apexY + cmp * 10);
    ctx.scale(sc, sc);
    ctx.translate(-apexX, -apexY);
    const yOf = (f) => apexY + Ht * f;
    const pts = [];
    for (let k = 0; k <= R; k++) {
      const f0 = k === 0 ? 0 : Math.pow(3, k - 1 - L), f1 = Math.pow(3, k - L);
      pts.push({ k, f0, f1 });
    }
    for (const p of pts) {
      const f1 = Math.min(p.f1, 3.2);
      if ((f1 - p.f0) * Ht < 0.25 && p.k > 0) continue;
      const y0 = yOf(p.f0), y1 = yOf(f1);
      let col = levelColor(p.k);
      if (p.k === R && t > T.impossible) col = mixHex(col, COL.red, 0.5 + 0.5 * Math.sin(t * 14));
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(apexX - HW * p.f0, y0);
      ctx.lineTo(apexX + HW * p.f0, y0);
      ctx.lineTo(apexX + HW * f1, y1);
      ctx.lineTo(apexX - HW * f1, y1);
      ctx.closePath();
      ctx.fill();
      if (p.k > 0 && (y1 - y0) > 6) {
        ctx.strokeStyle = COL.bgBot;
        ctx.lineWidth = 3 / sc;
        ctx.beginPath();
        ctx.moveTo(apexX - HW * p.f0, y0);
        ctx.lineTo(apexX + HW * p.f0, y0);
        ctx.stroke();
      }
    }
    // Étiquettes de niveaux
    for (const p of pts) {
      if (p.k === 0) continue;
      const y0 = yOf(p.f0), y1 = yOf(Math.min(p.f1, 3.2));
      const hgt = y1 - y0;
      if (hgt < 70) continue;
      const midF = Math.min((p.f0 + Math.min(p.f1, 1)) / 2, 0.82);
      const cy = yOf(Math.max(midF, p.f0 + 50 / Ht));
      const avail = HW * 2 * ((cy - apexY) / Ht) * 0.82;
      const big = clamp(hgt * 0.32, 30, 92);
      const isNew = p.k === R;
      const pop = isNew ? 1 + 0.15 * Math.exp(-Math.max(0, t - (EXPO.times[R - 4] ?? 0)) * 10) : 1;
      ctx.save();
      ctx.translate(apexX, cy);
      ctx.scale(pop, pop);
      text(ctx, `NIVEAU ${p.k}`, 0, -big * 0.75, { size: big * 0.36, weight: 700, fam: FT, ls: 5, color: 'rgba(255,255,255,0.85)', maxW: avail });
      text(ctx, fmtBig(Math.pow(3, p.k)), 0, big * 0.35, { size: big, weight: 900, color: '#FFFFFF', maxW: avail });
      ctx.restore();
    }
    ctx.restore();

    // Comparaison avec la population mondiale
    if (cmp > 0) {
      const g1 = P(t, T.compare + 0.35, 0.7, Ease.outQuart), g2 = P(t, T.compare + 0.65, 0.9, Ease.outQuart);
      const x0 = 205, wEarth = 590, wNeed = wEarth * (10.46 / 8.2);
      const rows = [
        { y: 1225, w: wEarth * g1, col: COL.blue, label: 'Terre : 8,2 milliards', a: g1 },
        { y: 1350, w: wNeed * g2, col: COL.red, label: 'Niveau 21 : 10,5 milliards', a: g2 },
      ];
      ctx.save();
      ctx.globalAlpha *= cmp * (1 - outZoom);
      earth(ctx, 140, 1225, 46 * Ease.outBack(clamp(g1 * 1.5)), t);
      // Mini pyramide
      ctx.save();
      ctx.translate(140, 1350);
      ctx.scale(Ease.outBack(clamp(g2 * 1.5)), Ease.outBack(clamp(g2 * 1.5)));
      ctx.fillStyle = COL.red;
      ctx.beginPath();
      ctx.moveTo(0, -42); ctx.lineTo(46, 36); ctx.lineTo(-46, 36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      for (const r of rows) {
        if (r.w < 2) continue;
        ctx.fillStyle = r.col;
        rrect(ctx, x0, r.y - 40, r.w, 80, 40);
        ctx.fill();
        ctx.save();
        rrect(ctx, x0, r.y - 40, r.w, 80, 40);
        ctx.clip();
        text(ctx, r.label, x0 + 32, r.y + 13, { size: 36, weight: 700, fam: FT, align: 'left', color: '#FFFFFF' });
        ctx.restore();
      }
      // Limite « Terre »
      const la = P(t, T.compare + 1.2, 0.4);
      if (la > 0) {
        ctx.globalAlpha *= la;
        ctx.setLineDash([12, 10]);
        ctx.strokeStyle = COL.ink;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x0 + wEarth, 1165);
        ctx.lineTo(x0 + wEarth, 1410);
        ctx.stroke();
        ctx.setLineDash([]);
        // Hachures sur le dépassement
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0 + wEarth, 1310, wNeed - wEarth, 80);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 6;
        for (let xx = x0 + wEarth - 100; xx < x0 + wNeed + 100; xx += 22) {
          ctx.beginPath();
          ctx.moveTo(xx + ((t * 60) % 22), 1310);
          ctx.lineTo(xx - 60 + ((t * 60) % 22), 1390);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
      // Tampon « IMPOSSIBLE »
      const st = slam(t, T.impossible, 2.4);
      if (st) {
        ctx.save();
        ctx.globalAlpha *= clamp((t - T.impossible) / 0.06) * (1 - outZoom);
        ctx.translate(560, 1450);
        ctx.rotate(-0.08);
        ctx.scale(st, st);
        ctx.fillStyle = COL.red;
        rrect(ctx, -240, -52, 480, 104, 22);
        ctx.fill();
        text(ctx, 'IMPOSSIBLE', 0, 24, { size: 66, weight: 900, color: '#FFFFFF', ls: 3 });
        ctx.restore();
        burst(ctx, 560, 1450, t, T.impossible + 0.13, COL.red, 230, 360, 16, 0.5);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  Scène 6 — Le bilan
  // ════════════════════════════════════════════════════════════════════
  function sceneBilan(ctx, t) {
    drawBG(ctx, t);
    const apexX = 540, apexY = 650, Ht = 430, HW = 300;
    const bands = [
      { f0: 0, f1: 0.2, col: COL.yellow, t0: 42.95 },
      { f0: 0.2, f1: 0.577, col: COL.green, t0: 43.65 },
      { f0: 0.577, f1: 1, col: COL.red, t0: 44.35 },
    ];
    const emph = P(t, 46.0, 0.4, Ease.outCubic);
    const triIn = P(t, 42.5, 0.6, Ease.outBack);
    ctx.save();
    ctx.translate(apexX, apexY + Ht / 2);
    ctx.scale(triIn, triIn);
    ctx.translate(-apexX, -(apexY + Ht / 2));
    // Contour de la pyramide
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX + HW, apexY + Ht);
    ctx.lineTo(apexX - HW, apexY + Ht);
    ctx.closePath();
    ctx.fill();
    bands.forEach((b, i) => {
      const u = P(t, b.t0, 0.5, Ease.outQuart);
      if (u <= 0) return;
      const y0 = apexY + Ht * b.f0, y1 = apexY + Ht * b.f1;
      ctx.save();
      const dim = i < 2 ? 1 - 0.55 * emph : 1;
      ctx.globalAlpha *= dim;
      if (i === 2 && emph > 0) {
        const pul = 1 + 0.035 * Math.sin((t - 46) * 9) * (1 - P(t, 47.2, 0.6));
        ctx.translate(apexX, (y0 + y1) / 2);
        ctx.scale(pul, pul);
        ctx.translate(-apexX, -(y0 + y1) / 2);
      }
      ctx.beginPath();
      ctx.rect(apexX - HW, y0, HW * 2 * u, y1 - y0 + 1);
      ctx.clip();
      ctx.fillStyle = b.col;
      ctx.beginPath();
      ctx.moveTo(apexX - HW * b.f0, y0 + (i ? 3 : 0));
      ctx.lineTo(apexX + HW * b.f0, y0 + (i ? 3 : 0));
      ctx.lineTo(apexX + HW * b.f1, y1);
      ctx.lineTo(apexX - HW * b.f1, y1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    // « 2 sur 3 »
    if (emph > 0) {
      ctx.save();
      ctx.globalAlpha *= emph;
      const s2 = Ease.outBack(emph);
      ctx.translate(apexX, apexY + Ht * 0.83);
      ctx.scale(s2, s2);
      text(ctx, '2 sur 3', 0, 20, { size: 64, weight: 900, color: '#FFFFFF' });
      ctx.restore();
    }
    ctx.restore();

    // Légende
    const rows = [
      { t0: 43.0, col: COL.yellow, title: 'L’organisateur', sub: 'repart avec le magot', icon: 'bag' },
      { t0: 43.7, col: COL.green, title: 'Les premiers', sub: 'gagnent un peu… au début', icon: 'plus' },
      { t0: 44.4, col: COL.red, title: 'Les derniers', sub: 'perdent tout', icon: 'minus' },
    ];
    rows.forEach((r, i) => {
      const u = P(t, r.t0, 0.55, Ease.outQuart);
      if (u <= 0) return;
      const y = 1170 + i * 132;
      ctx.save();
      ctx.globalAlpha *= clamp(u * 2) * (i < 2 ? 1 - 0.55 * emph : 1);
      ctx.translate((1 - u) * -80, 0);
      if (i === 2 && emph > 0) {
        ctx.fillStyle = rgba(COL.red, 0.14 * emph);
        rrect(ctx, 90, y - 62, 900, 124, 30);
        ctx.fill();
      }
      ctx.fillStyle = rgba(r.col, 0.18);
      circle(ctx, 165, y, 46);
      ctx.fill();
      if (r.icon === 'bag') moneyBag(ctx, 165, y + 4, 54);
      else {
        ctx.strokeStyle = r.col;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(146, y);
        ctx.lineTo(184, y);
        if (r.icon === 'plus') { ctx.moveTo(165, y - 19); ctx.lineTo(165, y + 19); }
        ctx.stroke();
      }
      text(ctx, r.title, 240, y - 6, { size: 50, weight: 800, align: 'left', color: COL.ink });
      text(ctx, r.sub, 240, y + 42, { size: 36, weight: 600, fam: FT, align: 'left', color: i === 2 ? COL.red : COL.mute });
      ctx.restore();
    });
  }

  // ════════════════════════════════════════════════════════════════════
  //  Scène 7 — Les signaux d'alerte
  // ════════════════════════════════════════════════════════════════════
  const FLAGS = ['Gains élevés « garantis »', '« Aucun risque », promis', 'Activité floue, invérifiable', 'Retraits bloqués ou retardés'];
  function sceneFlags(ctx, t) {
    drawBG(ctx, t);
    FLAGS.forEach((label, i) => {
      const t0 = 49.3 + i * 0.7;
      const u = P(t, t0, 0.6, Ease.outQuart);
      if (u <= 0) return;
      const y = 760 + i * 172;
      ctx.save();
      ctx.globalAlpha *= clamp(u * 2.5);
      ctx.translate((1 - u) * 300, 0);
      ctx.fillStyle = COL.card;
      rrect(ctx, 80, y - 72, 880, 144, 34);
      ctx.fill();
      const glow = P(t, 52.7 + i * 0.12, 0.25) * (1 - P(t, 53.3 + i * 0.12, 0.6));
      ctx.strokeStyle = glow > 0 ? rgba(COL.red, 0.25 + 0.6 * glow) : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 3;
      ctx.stroke();
      const bs = P(t, t0 + 0.15, 0.45, Ease.outBack);
      ctx.save();
      ctx.translate(165, y);
      ctx.scale(bs, bs);
      ctx.fillStyle = rgba(COL.red, 0.16);
      circle(ctx, 0, 0, 48);
      ctx.fill();
      flagIcon(ctx, 4, 0, 62, t, i);
      ctx.restore();
      text(ctx, label, 240, y + 17, { size: 46, weight: 800, align: 'left', color: COL.ink, maxW: 690 });
      ctx.restore();
    });
  }

  // ════════════════════════════════════════════════════════════════════
  //  Scène 8 — Conclusion
  // ════════════════════════════════════════════════════════════════════
  function sceneOutro(ctx, t) {
    drawBG(ctx, t);
    const zoom = 1 + 0.03 * clamp((t - T.outro) / 4.5);
    ctx.save();
    ctx.translate(540, 1000);
    ctx.scale(zoom, zoom);
    ctx.translate(-540, -1000);
    drawRich(ctx, t, { a: T.outro, b: DURATION + 1, lines: ['Si c’est trop beau', 'pour être vrai…'], size: 96, y: 640, stagger: 0.07 });
    const shk = shakeAt(t, 57.15, 10, 0.35);
    ctx.save();
    ctx.translate(shk.x, shk.y);
    drawRich(ctx, t, { a: 56.6, b: DURATION + 1, lines: ['…c’est sûrement', 'une [r:arnaque.]'], size: 112, y: 930, stagger: 0.09 });
    ctx.restore();
    ctx.restore();
    const ca = P(t, 58.0, 0.5, Ease.outBack);
    if (ca > 0) {
      const label = 'Partage pour protéger tes proches';
      const tw = measure(ctx, label, 38, 700, FT);
      const pw = tw + 130, ph = 92;
      ctx.save();
      ctx.translate(540, 1330);
      ctx.scale(ca, ca);
      ctx.fillStyle = COL.yellow;
      rrect(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2);
      ctx.fill();
      shareIcon(ctx, -pw / 2 + 56, 0, 46);
      text(ctx, label, -pw / 2 + 98, 13, { size: 38, weight: 700, fam: FT, align: 'left', color: COL.dark });
      ctx.restore();
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  Habillage global : chapitres, sous-titres, flashs
  // ════════════════════════════════════════════════════════════════════
  function drawChapter(ctx, t) {
    for (const c of CHAPTERS) {
      if (t < c.a || t > c.b) continue;
      const pin = Ease.outQuart(clamp((t - c.a) / 0.5));
      const pout = Ease.inCubic(clamp((t - (c.b - 0.3)) / 0.3));
      const nW = measure(ctx, c.n, 30, 900, FD);
      const lW = measure(ctx, c.label, 27, 700, FT, 4);
      const pw = 30 + nW + 34 + lW + 26, ph = 62;
      const x = W / 2 - pw / 2, y = 222 - (1 - pin) * 24;
      ctx.save();
      ctx.globalAlpha *= pin * (1 - pout);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      rrect(ctx, x, y, pw, ph, ph / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, c.n, x + 30, y + 42, { size: 30, weight: 900, align: 'left', color: COL.yellow });
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      circle(ctx, x + 30 + nW + 17, y + ph / 2, 4);
      ctx.fill();
      text(ctx, c.label, x + 30 + nW + 34, y + 41, { size: 27, weight: 700, fam: FT, align: 'left', ls: 4, color: COL.ink });
      // Progression du chapitre
      const prog = clamp((t - c.a) / (c.b - c.a));
      ctx.fillStyle = COL.yellow;
      rrect(ctx, x + 26, y + ph - 7, (pw - 52) * prog, 3, 1.5);
      ctx.fill();
      ctx.restore();
    }
  }
  function drawCaptions(ctx, t) {
    for (const c of CAPTIONS) if (t >= c.a && t <= c.b) drawRich(ctx, t, { y: 330, size: 80, ...c });
  }

  // ════════════════════════════════════════════════════════════════════
  //  Rendu d'une image
  // ════════════════════════════════════════════════════════════════════
  function wipe(ctx, t, t0, dur, A, B, color) {
    const u = Ease.inOutCubic(clamp((t - t0) / dur));
    const band = 320, slant = 260;
    const xt = lerp(-band - slant - 40, W + slant + 40, u);
    A(ctx, t);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(xt + slant, -10);
    ctx.lineTo(xt - slant, H + 10);
    ctx.lineTo(-10, H + 10);
    ctx.closePath();
    ctx.clip();
    B(ctx, t);
    ctx.restore();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(xt + slant, -10);
    ctx.lineTo(xt + band + slant, -10);
    ctx.lineTo(xt + band - slant, H + 10);
    ctx.lineTo(xt - slant, H + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COL.ink;
    ctx.beginPath();
    ctx.moveTo(xt + band + slant, -10);
    ctx.lineTo(xt + band + slant + 22, -10);
    ctx.lineTo(xt + band - slant + 22, H + 10);
    ctx.lineTo(xt + band - slant, H + 10);
    ctx.closePath();
    ctx.fill();
  }

  function render(ctx, t) {
    t = clamp(t, 0, DURATION - 1e-6);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    if (t < T.hookEnd) {
      sceneHook(ctx, t);
    } else if (t < T.reveal) {
      ctx.fillStyle = COL.yellow;
      ctx.fillRect(0, 0, W, H);
      const u = Ease.outQuart(clamp((t - T.hookEnd) / (T.reveal - T.hookEnd)));
      ctx.save();
      circle(ctx, 540, 1130, u * 1450);
      ctx.clip();
      sceneWorld(ctx, t);
      ctx.restore();
      ctx.strokeStyle = COL.ink;
      ctx.lineWidth = 14 * (1 - u);
      circle(ctx, 540, 1130, u * 1450);
      ctx.stroke();
    } else if (t < T.toBilan) {
      sceneWorld(ctx, t);
    } else if (t < T.bilan) {
      const u = Ease.inOutQuart(clamp((t - T.toBilan) / (T.bilan - T.toBilan)));
      ctx.save();
      ctx.translate(0, -H * u);
      sceneWorld(ctx, t);
      ctx.restore();
      ctx.save();
      ctx.translate(0, H * (1 - u));
      sceneBilan(ctx, t);
      ctx.fillStyle = COL.yellow;
      ctx.fillRect(0, -6, W, 12);
      ctx.restore();
    } else if (t < T.flagsWipe) {
      sceneBilan(ctx, t);
    } else if (t < T.flagsWipe + 0.55) {
      wipe(ctx, t, T.flagsWipe, 0.55, sceneBilan, sceneFlags, COL.yellow);
    } else if (t < T.outroWipe) {
      sceneFlags(ctx, t);
    } else if (t < T.outroWipe + 0.55) {
      wipe(ctx, t, T.outroWipe, 0.55, sceneFlags, sceneOutro, COL.red);
    } else {
      sceneOutro(ctx, t);
    }

    drawCaptions(ctx, t);
    drawChapter(ctx, t);

    // Flash rouge de l'effondrement
    const fl = (t - T.collapse) / 0.6;
    if (fl >= 0 && fl <= 1) {
      ctx.fillStyle = rgba(COL.red, 0.42 * Math.pow(1 - fl, 2));
      ctx.fillRect(0, 0, W, H);
    }
    // Flash blanc du tampon « +50 % »
    const fs = (t - T.stamp - 0.13) / 0.25;
    if (fs >= 0 && fs <= 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.12 * (1 - fs)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Fondu final (boucle propre)
    const fe = clamp((t - (DURATION - 0.55)) / 0.5);
    if (fe > 0) {
      ctx.save();
      ctx.globalAlpha = Ease.inOutCubic(fe);
      drawBG(ctx, t);
      ctx.restore();
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  Repères sonores (bande-son générée par scripts/soundtrack.cjs)
  // ════════════════════════════════════════════════════════════════════
  const CUES = [];
  const cue = (t, type, o = {}) => CUES.push({ t: +t.toFixed(4), type, ...o });
  (function buildCues() {
    // Accroche
    BLOCKS.forEach((b, i) => cue(b.t + 0.02, 'pop', { pitch: 0.8 + i * 0.07, gain: 0.45 }));
    cue(0.1, 'swoosh', { gain: 0.35, dur: 0.45 });
    cue(0.95, 'tick', { gain: 0.45 });
    HOOK_BILLS.forEach((f) => cue(f.t0 + f.dur * 0.9, 'coin', { gain: 0.22, pitch: 1.25 }));
    cue(2.85, 'riser', { dur: 0.6, gain: 0.55 });
    cue(T.hookEnd, 'whooshBig', { gain: 0.7 });
    cue(T.hookEnd, 'impact', { gain: 0.55 });
    // 01 — La promesse
    cue(T.bossIn, 'popBig', { gain: 0.7 });
    cue(T.bubble, 'bubble', { gain: 0.55 });
    cue(T.bubble2 + 0.05, 'pop', { pitch: 1.3, gain: 0.35 });
    cue(T.stamp + 0.12, 'stamp', { gain: 0.8 });
    cue(T.stamp + 0.18, 'sparkle', { gain: 0.4 });
    cue(T.note, 'tick', { gain: 0.3 });
    cue(T.promiseOut, 'swoosh', { gain: 0.4, dur: 0.35, down: true });
    cue(T.toApex, 'whoosh', { gain: 0.45 });
    cue(T.jarIn + 0.05, 'pop', { pitch: 0.75, gain: 0.55 });
    for (let i = 0; i < 3; i++) cue(LAY.L1.in + i * LAY.L1.st + 0.03, 'pop', { pitch: 1 + i * 0.12, gain: 0.5 });
    // Billets : départ (frottement) + arrivée (pièce)
    FLIGHTS.forEach((f, i) => {
      const many = f.w < 70;
      if (!many || i % 3 === 0) cue(f.t0, 'flick', { gain: many ? 0.12 : 0.2 });
      const g = f.kind === 'drain' ? 0.3 : many ? 0.16 : 0.32;
      const pitch = f.kind === 'drain' ? 1.4 - (i % 8) * 0.06 : f.kind === 'out' ? 1.12 : 1;
      cue(f.t0 + f.dur * (f.sink ? 0.9 : 1), 'coin', { gain: g, pitch });
    });
    cue(T.icons, 'pop', { pitch: 0.9, gain: 0.45 });
    cue(T.icons + 0.15, 'pop', { pitch: 1.05, gain: 0.45 });
    cue(T.iconsX + 0.1, 'stamp', { gain: 0.6, pitch: 1.2 });
    cue(T.iconsX + 0.25, 'stamp', { gain: 0.6, pitch: 1.35 });
    cue(T.iconsX + 0.1, 'buzz', { gain: 0.35 });
    cue(T.iconsOut, 'swoosh', { gain: 0.3, dur: 0.3, down: true });
    // 02 — Le secret
    for (let i = 0; i < 9; i++) cue(LAY.L2.in + i * LAY.L2.st + 0.03, 'pop', { pitch: 0.95 + i * 0.06, gain: 0.32 });
    cue(HAPPY.L1[2] + 0.05, 'chime', { gain: 0.45 });
    // 03 — L'illusion
    for (let i = 0; i < 3; i++) cue(T.talk + i * 0.15, 'bubble', { gain: 0.4, pitch: 1 + i * 0.1 });
    cue(T.zoomOut, 'whoosh', { gain: 0.45, dur: 0.9 });
    cue(LAY.L3.in, 'popRoll', { gain: 0.35, dur: 27 * LAY.L3.st + 0.2, n: 27 });
    cue(HAPPY.L2[8] + 0.05, 'chime', { gain: 0.35, pitch: 1.12 });
    // 04 — Le piège
    cue(T.expoIn, 'whoosh', { gain: 0.5, dur: 0.6 });
    EXPO.times.forEach((tt, i) => cue(tt, i === EXPO.times.length - 1 ? 'impact' : 'thump', { pitch: 0.8 + i * 0.07, gain: i === EXPO.times.length - 1 ? 0.75 : 0.4 + i * 0.012 }));
    cue(T.compare, 'whoosh', { gain: 0.4, dur: 0.5 });
    cue(T.compare + 0.35, 'swell', { gain: 0.35, dur: 0.8 });
    cue(T.compare + 0.65, 'swell', { gain: 0.35, dur: 0.9, pitch: 1.2 });
    cue(T.impossible + 0.12, 'stamp', { gain: 0.85 });
    cue(T.impossible + 0.12, 'buzz', { gain: 0.45 });
    // 05 — L'effondrement
    cue(T.expoOut, 'whooshRev', { gain: 0.45 });
    cue(T.ghosts, 'airy', { gain: 0.35, dur: 1.2 });
    cue(T.worried, 'tick', { gain: 0.25, pitch: 0.8 });
    cue(T.bagIn, 'pop', { pitch: 0.7, gain: 0.5 });
    cue(T.run, 'zip', { gain: 0.6 });
    cue(T.collapse, 'boom', { gain: 0.95 });
    cue(T.collapse + 0.05, 'crash', { gain: 0.6 });
    // Transitions & fin
    cue(T.toBilan, 'whoosh', { gain: 0.5, dur: 0.5 });
    cue(42.5, 'popBig', { gain: 0.45, pitch: 1.2 });
    [43.0, 43.7, 44.4].forEach((tt, i) => cue(tt, 'pop', { pitch: 1 + i * 0.15, gain: 0.45 }));
    cue(46.0, 'hit', { gain: 0.6 });
    cue(T.flagsWipe, 'whoosh', { gain: 0.5, dur: 0.55 });
    FLAGS.forEach((_, i) => cue(49.3 + i * 0.7, 'pop', { pitch: 1 + i * 0.1, gain: 0.45 }));
    cue(52.7, 'alert', { gain: 0.35 });
    cue(T.outroWipe, 'whoosh', { gain: 0.5, dur: 0.55 });
    cue(T.outro, 'hit', { gain: 0.4, pitch: 1.3 });
    cue(57.0, 'stamp', { gain: 0.7 });
    cue(58.0, 'popBig', { gain: 0.5, pitch: 1.3 });
    cue(58.05, 'sparkle', { gain: 0.35 });
    CUES.sort((a, b) => a.t - b.t);
  })();

  /** Structure musicale (synchronisée sur la timeline). */
  const MUSIC = { bpm: 120, drop: T.hookEnd, tension: 29.45, stop: T.collapse, back: 42.45, outro: 54.95, end: DURATION };

  return { W, H, FPS, DURATION, FONTS, CHAPTERS, CAPTIONS, CUES, MUSIC, T, render };
});
