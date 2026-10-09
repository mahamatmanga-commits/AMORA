/*
 * Pyramide de Ponzi — motion design vertical 1080x1920, sans texte.
 *
 * Moteur entièrement déterministe : PonziAnim.draw(ctx, t, theme) dessine
 * l'image exacte de l'instant t (en secondes). Le même code sert à l'aperçu
 * en direct (index.html) et à l'export image par image (render.mjs).
 *
 * Scènes :
 *   1. 0.0 – 3.6   l'organisateur apparaît en haut
 *   2. 3.6 – 8.4   les premiers investisseurs lui confient de l'argent
 *   3. 8.4 – 16.8  l'argent des nouveaux sert à payer les anciens
 *   4. 16.8 – 26.0 la pyramide grandit, les flux s'accélèrent
 *   5. 26.0 – 31.0 plus personne n'arrive, les flux ralentissent
 *   6. 31.0 – 38.0 effondrement
 */
(function (root) {
  'use strict';

  const W = 1080, H = 1920, FPS = 60, DURATION = 38;
  const TAU = Math.PI * 2;

  const SCENES = [
    { id: 1, start: 0.0, end: 3.6, slug: '01_organisateur' },
    { id: 2, start: 3.6, end: 8.4, slug: '02_premiers-investisseurs' },
    { id: 3, start: 8.4, end: 16.8, slug: '03_les-nouveaux-paient-les-anciens' },
    { id: 4, start: 16.8, end: 26.0, slug: '04_la-pyramide-grandit' },
    { id: 5, start: 26.0, end: 31.0, slug: '05_plus-personne-n-arrive' },
    { id: 6, start: 31.0, end: 38.0, slug: '06_effondrement' },
  ];

  // ───────────────────────────── utilitaires
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const inv = (a, b, x) => clamp01((x - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const E = {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    inQuad: t => t * t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    outBounce: t => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    },
  };
  // réponse amortie à une impulsion (squash & stretch)
  const spring = (t, f = 18, d = 7) => (t <= 0 ? 0 : Math.exp(-d * t) * Math.sin(f * t));
  const bump = (a, b, x) => {
    const u = inv(a, b, x);
    return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u);
  };
  const smooth = (a, b, x) => E.inOutSine(inv(a, b, x));

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // interpolation cubique monotone (Fritsch–Carlson) : caméra et regards fluides
  function monotone(xs, ys) {
    const n = xs.length, d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = 0; m[n - 1] = 0;
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    return x => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0;
      while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] +
        (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }
  const keyed = keys => {
    const f = keys[0].slice(1).map((_, j) => monotone(keys.map(k => k[0]), keys.map(k => k[j + 1])));
    return t => f.map(g => g(t));
  };

  // ───────────────────────────── thèmes
  const NEUTRALS = [
    ['#6F80D6', '#97A6EC'],
    ['#8A78D8', '#AB9CEE'],
    ['#5B93D8', '#88B4EE'],
    ['#7A8BC4', '#A0AEDA'],
    ['#9A7AD2', '#B89DE8'],
  ];
  const THEMES = {
    dark: {
      bgTop: '#10152D', bgBottom: '#070A16', bgGlow: [92, 108, 255], bgGlowA: 0.16, vignette: 0.55, grain: 0.035,
      platform: [150, 168, 240], platformA: 0.17, platformEdgeA: 0.32,
      pedestal: [190, 175, 235], pedestalA: 0.2, pedestalEdge: [255, 200, 90],
      tri: [125, 140, 255], triA: 0.065, triEdgeA: 0.22,
      neutrals: NEUTRALS,
      paid: ['#2FCB8E', '#76E8BC'],
      lost: ['#363E58', '#46506E'],
      org: ['#F6B03A', '#FFD27C'], orgShirt: '#FFF3D9', orgTie: '#252D66',
      hat: '#2C3678', hatEdge: 'rgba(255,255,255,0.16)', hatBand: '#F6B03A',
      face: '#121731',
      bill: '#4ADE80', billInk: [20, 83, 45],
      bag: '#27AE68', bagDark: '#1A7C4A', bagFlap: '#38C980', coin: '#FFD25E', coinInk: '#B98722',
      green: [74, 222, 128], gold: [255, 196, 80], red: [255, 77, 106],
      ghost: [175, 190, 255],
      shadowA: 0.34, dust: [150, 162, 210], particle: [165, 182, 255], particleA: 0.22,
    },
    light: {
      bgTop: '#F8F5EF', bgBottom: '#E9E4DA', bgGlow: [255, 255, 255], bgGlowA: 0.75, vignette: 0.1, grain: 0.025,
      platform: [70, 82, 140], platformA: 0.13, platformEdgeA: 0.0,
      pedestal: [70, 82, 140], pedestalA: 0.14, pedestalEdge: [235, 160, 30],
      tri: [90, 100, 175], triA: 0.055, triEdgeA: 0.22,
      neutrals: NEUTRALS,
      paid: ['#1DB97C', '#5ED9A8'],
      lost: ['#A3A9B9', '#BBC0CC'],
      org: ['#F2A51F', '#FFC85E'], orgShirt: '#FFFFFF', orgTie: '#1E2552',
      hat: '#1E2552', hatEdge: 'rgba(255,255,255,0.12)', hatBand: '#F2A51F',
      face: '#161B33',
      bill: '#37C46C', billInk: [12, 84, 40],
      bag: '#22A061', bagDark: '#16744A', bagFlap: '#30B873', coin: '#FFC93F', coinInk: '#B07C14',
      green: [30, 185, 95], gold: [240, 165, 35], red: [228, 52, 84],
      ghost: [80, 95, 165],
      shadowA: 0.13, dust: [130, 132, 150], particle: [110, 120, 180], particleA: 0.14,
    },
  };
  THEMES.alpha = Object.assign({}, THEMES.dark, { transparent: true });

  // ───────────────────────────── mise en page (coordonnées « monde »)
  const ORG = { x: 492, y: 420, s: 1.28 };
  const BAG = { x: 618, y: 420 };
  const APEX_Y = 60, TRI_K = 0.334;
  const ROWS = [
    { n: 2, y: 625, hw: 92, s: 0.94 },
    { n: 4, y: 805, hw: 168, s: 0.86 },
    { n: 6, y: 975, hw: 246, s: 0.79 },
    { n: 8, y: 1135, hw: 312, s: 0.72 },
    { n: 10, y: 1285, hw: 372, s: 0.66 },
  ];
  const ROW_T = [
    { plat: 3.62, t0: 3.88, stag: 0.26, dur: 0.85 },
    { plat: 8.35, t0: 8.55, stag: 0.15, dur: 0.8 },
    { plat: 16.95, t0: 17.12, stag: 0.12, dur: 0.75 },
    { plat: 19.35, t0: 19.5, stag: 0.095, dur: 0.72 },
    { plat: 21.55, t0: 21.7, stag: 0.08, dur: 0.7 },
  ];
  const GHOST = { n: 11, y: 1425, hw: 410, s: 0.6, t0: 26.2, t1: 29.4 };
  const FLOOR = 1450;
  const G = 3200;
  const PLAT_H = 13;
  const SAG = 7; // affaissement juste avant la rupture d'un étage

  const CAM = keyed([
    [0.0, 494, 318, Math.log(1.86)],
    [1.15, 497, 320, Math.log(1.82)],
    [2.4, 556, 326, Math.log(1.75)],
    [3.3, 556, 330, Math.log(1.72)],
    [5.3, 545, 470, Math.log(1.36)],
    [8.1, 545, 478, Math.log(1.33)],
    [10.0, 540, 562, Math.log(1.14)],
    [16.5, 540, 572, Math.log(1.12)],
    [18.6, 540, 640, Math.log(1.06)],
    [21.0, 540, 700, Math.log(1.005)],
    [23.4, 540, 742, Math.log(0.965)],
    [25.7, 540, 748, Math.log(0.96)],
    [27.4, 540, 800, Math.log(0.96)],
    [31.9, 540, 800, Math.log(0.96)],
    [33.5, 540, 880, Math.log(0.975)],
    [35.6, 540, 1225, Math.log(1.03)],
    [38.0, 540, 1290, Math.log(1.08)],
  ]);

  // regard et humeur de l'organisateur : [t, regardX, regardY]
  const ORG_LOOK = keyed([
    [0, 0, 0.15], [1.7, 0, 0.15], [2.0, 1, -0.2], [2.8, 1, -0.2], [3.2, -0.1, 0.45],
    [5.0, -0.1, 0.5], [5.6, 0.9, -0.1], [6.9, 0.9, -0.1], [7.4, 0, 0.35],
    [9.6, 0, 0.5], [10.8, 0.9, -0.1], [11.6, -0.2, 0.6], [12.4, 0.2, 0.6], [14.5, 0.1, 0.4],
    [17.0, 0, 0.6], [24.0, 0.1, 0.6], [27.5, 0, 0.6], [28.7, 0.95, 0.75], [30.6, 0.95, 0.75], [31.2, 0, 0],
  ]);
  const ORG_MOOD = keyed([ // [t, joie, inquiétude, choc]
    [0, 0.0, 0, 0], [1.0, 0.55, 0, 0], [5.8, 0.55, 0, 0], [6.4, 1, 0, 0],
    [28.0, 1, 0, 0], [28.8, 0, 0, 0], [29.3, 0, 1, 0], [31.0, 0, 1, 0], [31.25, 0, 0, 1],
    [33.4, 0, 0, 1], [33.9, 0, 1, 0],
  ]);
  const ENERGY = keyed([[0, 1], [26.0, 1], [30.0, 0.3], [31.0, 0.3], [32.2, 0]]);

  const chest = p => ({ x: p.x, y: p.y - 48 * p.s });

  // ───────────────────────────── construction de la chronologie
  const TL = build();

  function build() {
    const R = mulberry32(20261009);
    const tl = { invs: [], rows: [], bills: [], arrows: [], fx: [], bagIn: [], bagOut: [], platforms: [], bodies: [], flutters: [], contacts: [] };

    // investisseurs
    ROWS.forEach((row, r) => {
      const list = [];
      for (let i = 0; i < row.n; i++) {
        const x = 540 - row.hw + (i * 2 * row.hw) / (row.n - 1);
        const p = {
          kind: 'inv', r, i, x, y: row.y, s: row.s, cols: NEUTRALS[(r * 2 + i * 3) % NEUTRALS.length],
          seed: R() * 100, launches: [], receives: [], paidN: 0, lostAt: 99,
        };
        list.push(p);
        tl.invs.push(p);
      }
      // ordre d'arrivée : du centre vers l'extérieur, en alternant les côtés
      const order = list.slice().sort((a, b) => Math.abs(a.x - 540) - Math.abs(b.x - 540) || a.x - b.x);
      const rt = ROW_T[r];
      order.forEach((p, k) => {
        const side = p.x < 540 ? -1 : 1;
        const t0 = rt.t0 + k * rt.stag;
        p.arr = {
          t0, dur: rt.dur, side,
          x0: p.x + side * (210 + R() * 120), y0: p.y + 300 + R() * 90, arc: 150 + R() * 60,
        };
        p.landT = t0 + rt.dur;
        tl.fx.push({ type: 'land', t: p.landT, x: p.x, y: p.y, s: p.s });
      });
      tl.rows.push(list);
    });
    const row = r => tl.rows[r];
    const [A, B] = row(0);

    // ── flux d'argent
    function addIn(p, t, dur) {
      const c = chest(p);
      const dist = Math.hypot(BAG.x - c.x, BAG.y - 80 - c.y);
      dur = dur || 0.78 + dist / 1700;
      tl.bills.push({ kind: 'in', p, t0: t, dur, seed: R() * TAU });
      p.launches.push(t);
      tl.bagIn.push(t + dur);
      tl.fx.push({ type: 'bagin', t: t + dur, seed: R() * TAU });
      return t + dur;
    }
    function addOut(p, t, dur, amt, slow) {
      const c = chest(p);
      const dist = Math.hypot(BAG.x - c.x, BAG.y - 80 - c.y);
      dur = dur || 0.74 + dist / 1800;
      const b = { kind: 'out', p, t0: t, dur, seed: R() * TAU, slow: !!slow, amt };
      tl.bills.push(b);
      tl.bagOut.push(b);
      p.receives.push(t + dur);
      p.paidN++;
      tl.fx.push({ type: 'recv', t: t + dur, p, seed: R() * TAU });
      return t + dur;
    }
    function pick(eligible) {
      let min = Infinity;
      for (const p of eligible) min = Math.min(min, p.paidN);
      const c1 = eligible.filter(p => p.paidN === min);
      const r0 = Math.min(...c1.map(p => p.r));
      const c2 = c1.filter(p => p.r === r0);
      return c2[Math.floor(R() * c2.length)];
    }
    const GROW_AMT = 0.5;

    // Scène 2 — les premiers confient leur argent (flèches + 3 billets chacun)
    tl.arrows.push({ kind: 'in', p: A, t0: 4.85, t1: 6.75 });
    tl.arrows.push({ kind: 'in', p: B, t0: 5.1, t1: 6.95 });
    [5.12, 5.29, 5.46].forEach(t => addIn(A, t, 0.95));
    [5.6, 5.77, 5.94].forEach(t => addIn(B, t, 0.95));

    // Scène 3 — l'argent des nouveaux paie les anciens (relais via le sac)
    const relay = (src, t, dst, arrowsAt) => {
      const tin = addIn(src, t, 1.0);
      const tout = tin + 0.22;
      const trecv = addOut(dst, tout, 0.95, GROW_AMT);
      if (arrowsAt !== undefined) {
        tl.arrows.push({ kind: 'in', p: src, t0: arrowsAt, t1: trecv + 0.25 });
        tl.arrows.push({ kind: 'out', p: dst, t0: tin - 0.25, t1: trecv + 0.35 });
      }
    };
    const r2 = row(1);
    relay(r2[1], 10.15, A, 9.75);
    relay(r2[2], 11.75, B, 11.35);
    relay(r2[0], 13.25, A);
    relay(r2[3], 13.5, B);
    [15.0, 15.2, 15.4, 15.6].forEach((t, k) => {
      const tin = addIn(r2[[1, 2, 0, 3][k]], t, 0.95);
      addOut(k % 2 ? B : A, tin + 0.2, 0.9, GROW_AMT);
    });

    // Scène 4 — chaque nouvel étage finance les étages du dessus
    const growRow = r => {
      const eligible = tl.invs.filter(p => p.r < r);
      row(r).slice().sort((a, b) => a.landT - b.landT).forEach(p => {
        const tin = addIn(p, p.landT + 0.22 + R() * 0.12);
        addOut(pick(eligible), tin + 0.15 + R() * 0.15, 0, GROW_AMT);
      });
    };
    growRow(2); growRow(3); growRow(4);
    // la base continue d'alimenter le système
    {
      const payers = row(4).concat(row(3));
      const eligible = tl.invs.filter(p => p.r <= 3);
      for (let k = 0; k < 14; k++) {
        const p = payers[Math.floor(R() * payers.length)];
        const tin = addIn(p, 23.55 + k * 0.155 + R() * 0.05);
        addOut(pick(eligible), tin + 0.15 + R() * 0.12, 0, GROW_AMT);
      }
    }

    // Scène 5 — plus d'entrées : le sac se vide, de plus en plus lentement
    const fundBefore = tl.bagIn.length - tl.bagOut.reduce((s, b) => s + b.amt, 0);
    const drain = [[26.05, 1.15], [26.55, 1.35], [27.15, 1.65], [27.95, 2.0], [28.85, 2.3]];
    const eligibleDrain = tl.invs.filter(p => p.r <= 3);
    drain.forEach(([t, d]) => addOut(pick(eligibleDrain), t, d, fundBefore / drain.length, true));

    // humeurs : la base comprend la première qu'elle ne sera jamais payée
    tl.invs.forEach(p => {
      if (p.r === 4) p.lostAt = 28.6 + Math.abs(p.i - 4.5) * 0.07;
      else if (p.r === 3) p.lostAt = 29.25 + Math.abs(p.i - 3.5) * 0.07;
      else p.lostAt = 31.0 + R() * 0.3;
    });

    // ── plateformes (étages) + fissures
    const BREAK = [32.92, 32.74, 32.56, 32.38, 32.2];
    const BREAK_ORG = 33.12;
    tl.BREAK = BREAK; tl.BREAK_ORG = BREAK_ORG;
    const mkPlat = (x0, x1, y, tAppear, crackT, breakT, gold, r, nSplit) => {
      const splits = [];
      for (let k = 1; k <= nSplit; k++) splits.push(lerp(x0, x1, (k + (R() - 0.5) * 0.5) / (nSplit + 1)));
      const cracks = splits.map(sx => {
        const pts = [[sx + (R() - 0.5) * 6, y - 1]];
        for (let k = 1; k <= 3; k++) pts.push([sx + (R() - 0.5) * 12, y + (k / 3) * (PLAT_H + 2)]);
        return pts;
      });
      const edges = [x0].concat(splits, [x1]);
      const pl = { x0, x1, y, tAppear, crackT, breakT, gold, r, splits, cracks, pieces: [] };
      for (let k = 0; k < edges.length - 1; k++) {
        const a = edges[k], b = edges[k + 1], w = b - a, cx = (a + b) / 2;
        const body = {
          kind: 'piece', w, x: cx, y: y + PLAT_H / 2 + SAG, t0: breakT,
          vx: (cx - 540) * 0.22 + (R() - 0.5) * 110, vy: -R() * 200, w0: (R() - 0.5) * 5,
          pileK: Math.max(0, (r === -1 ? 0.92 : [0.7, 0.5, 0.32, 0.15, 0][r]) - 0.05), jit: R() * 10,
          radius: rot => lerp(PLAT_H / 2, w / 2, Math.abs(Math.sin(rot))), rest: 0.25, mode: Math.PI,
        };
        pl.pieces.push(body);
        tl.bodies.push(body);
      }
      tl.platforms.push(pl);
    };
    mkPlat(ORG.x - 74, BAG.x + 78, ORG.y + 1, 0.5, 31.95, BREAK_ORG, true, -1, 2);
    ROWS.forEach((rw, r) => {
      const hw = rw.hw + 62 * rw.s;
      mkPlat(540 - hw, 540 + hw, rw.y + 1, ROW_T[r].plat, 31.1 + (4 - r) * 0.17, BREAK[r], false, r, 1 + Math.round(r * 0.6));
    });

    // ── effondrement : corps rigides simulés (pas fixe, donc reproductible)
    const PILE = [0.86, 0.72, 0.52, 0.3, 0.08];
    tl.invs.forEach(p => {
      p.body = {
        kind: 'person', p, x: p.x, y: p.y - 50 * p.s + SAG, t0: BREAK[p.r],
        vx: (p.x - 540) * 0.25 + (R() - 0.5) * 170, vy: -(80 + R() * 260), w0: (R() - 0.5) * 7 + Math.sign(p.x - 540) * 1.6,
        pileK: PILE[p.r], jit: R() * 14, rest: 0.3, mode: 'side',
        radius: rot => lerp(60, 42, Math.abs(Math.sin(rot))) * p.s,
      };
      tl.bodies.push(p.body);
    });
    tl.org = {
      kind: 'org', x: ORG.x, y: ORG.y, s: ORG.s, cols: null, seed: 3.7,
    };
    tl.org.body = {
      kind: 'person', p: tl.org, x: ORG.x, y: ORG.y - 50 * ORG.s + SAG, t0: BREAK_ORG,
      vx: -70, vy: -380, w0: -2.4, pileK: 1.0, jit: 0, rest: 0.3, mode: 'side',
      radius: rot => lerp(60, 42, Math.abs(Math.sin(rot))) * ORG.s,
    };
    tl.hatBody = {
      kind: 'hat', x: ORG.x, y: ORG.y - 143 * ORG.s + SAG, t0: BREAK_ORG + 0.02,
      vx: 300, vy: -1150, w0: 9.5, pileK: 1.04, jit: 0, rest: 0.35, mode: Math.PI,
      radius: rot => lerp(30, 40, Math.abs(Math.sin(rot))) * ORG.s,
    };
    tl.bagBody = {
      kind: 'bag', x: BAG.x, y: BAG.y - 22 + SAG, t0: BREAK_ORG + 0.04,
      vx: 140, vy: -300, w0: 3.2, pileK: 1.08, jit: 0, rest: 0.25, mode: Math.PI / 2,
      radius: rot => 22,
    };
    tl.bodies.push(tl.org.body, tl.hatBody, tl.bagBody);
    tl.bodies.forEach(simulate);

    // poussière et secousses à l'impact
    tl.bodies.forEach(b => {
      const c = b.contacts[0];
      if (!c) return;
      const heavy = b.kind === 'person' ? (b.p.kind === 'org' ? 1.6 : 0.55) : b.kind === 'piece' ? 0.4 : 0.5;
      tl.contacts.push({ t: c.t, amp: Math.min(10, c.v / 380) * heavy, ph: R() * TAU, ph2: R() * TAU });
      if (c.v > 380) tl.fx.push({ type: 'dust', t: c.t, x: c.x, y: c.y, size: b.kind === 'piece' ? 0.7 : 1, seed: R() * TAU });
    });

    // billets qui tombent en virevoltant pendant l'effondrement
    const holders = tl.invs.filter(p => p.r <= 3 && p.paidN > 0);
    for (let k = 0; k < 12 && holders.length; k++) {
      const p = holders.splice(Math.floor(R() * holders.length), 1)[0];
      const c = chest(p);
      const f = {
        x0: c.x, y0: c.y, t0: BREAK[p.r] + 0.03 + R() * 0.1, A: 26 + R() * 34, w: 2.2 + R() * 1.6, ph: R() * TAU,
        vterm: 230 + R() * 90, vy0: -(260 + R() * 260), vx0: (R() - 0.5) * 260, pileK: 0.7 + R() * 0.5, jit: R() * 12,
      };
      // instant d'atterrissage
      let tau = 0;
      for (; tau < 8; tau += 1 / 240) {
        const q = flutterRaw(f, tau);
        if (tau > 0.2 && q.y >= floorAt(f, q.x) - 6) break;
      }
      f.land = tau;
      tl.flutters.push(f);
    }

    // scintillements d'ambiance autour du sac (scène 1)
    [2.35, 2.62, 2.9, 3.15].forEach((t, k) => tl.fx.push({ type: 'twinkle', t, x: BAG.x + [-54, 50, -30, 58][k], y: BAG.y - [92, 70, 120, 112][k] }));

    // particules d'arrière-plan
    tl.motes = [];
    for (let k = 0; k < 34; k++) tl.motes.push({ x: R() * W, y: R() * H, r: 1.2 + R() * 2.4, v: 6 + R() * 16, a: 0.3 + R() * 0.7, ph: R() * TAU });
    return tl;
  }

  function floorAt(b, x) {
    return FLOOR - b.pileK * 235 * Math.exp(-Math.pow((x - 540) / 285, 2)) - b.jit;
  }

  function simulate(b) {
    const dt = 1 / 240, N = Math.round(5.5 / dt);
    let x = b.x, y = b.y, vx = b.vx, vy = b.vy, rot = 0, w = b.w0, target = null;
    const xs = new Float32Array(N + 1), ys = new Float32Array(N + 1), rs = new Float32Array(N + 1);
    b.contacts = [];
    for (let i = 0; i <= N; i++) {
      xs[i] = x; ys[i] = y; rs[i] = rot;
      vy += G * dt; x += vx * dt; y += vy * dt; rot += w * dt;
      if (x < 120) { x = 120; vx = Math.abs(vx) * 0.4; }
      if (x > 960) { x = 960; vx = -Math.abs(vx) * 0.4; }
      const r = b.radius(rot), fy = floorAt(b, x);
      if (y + r > fy) {
        y = fy - r;
        if (vy > 0) {
          if (vy > 200) b.contacts.push({ t: b.t0 + i * dt, x, y: fy, v: vy });
          vy = vy > 160 ? -vy * b.rest : 0;
          vx *= 0.55; w *= 0.5;
          if (target === null) {
            if (b.mode === 'side') target = Math.PI / 2 + Math.round((rot - Math.PI / 2) / Math.PI) * Math.PI;
            else target = Math.round(rot / b.mode) * b.mode;
          }
        }
        if (vy === 0) vx *= 1 - 6 * dt;
      }
      if (target !== null) w += ((target - rot) * 55 - w * 11) * dt;
    }
    Object.assign(b, { xs, ys, rs, dt, N });
  }

  function bodyAt(b, t) {
    if (t < b.t0) return null;
    const f = Math.min((t - b.t0) / b.dt, b.N - 1e-6), i = Math.floor(f), u = f - i;
    return { x: lerp(b.xs[i], b.xs[i + 1], u), y: lerp(b.ys[i], b.ys[i + 1], u), rot: lerp(b.rs[i], b.rs[i + 1], u) };
  }

  function flutterRaw(f, tau) {
    const k = 3.2;
    return {
      x: f.x0 + (f.vx0 * (1 - Math.exp(-2 * tau))) / 2 + f.A * (Math.sin(f.w * tau + f.ph) - Math.sin(f.ph)),
      y: f.y0 + f.vterm * tau + ((f.vy0 - f.vterm) * (1 - Math.exp(-k * tau))) / k,
      rot: 0.65 * Math.sin(f.w * tau + f.ph + 1.2),
    };
  }

  // ───────────────────────────── grandeurs dérivées du temps
  function fund(t) {
    let f = 0;
    for (const ti of TL.bagIn) f += smooth(ti, ti + 0.25, t);
    for (const b of TL.bagOut) f -= b.amt * smooth(b.t0, b.t0 + 0.25, t);
    return Math.max(0, f);
  }

  function bagState(t) {
    const F = fund(t);
    const appear = E.outBack(inv(1.35, 1.8, t), 2.2);
    let pulse = 0;
    for (const ti of TL.bagIn) if (t > ti && t < ti + 1) pulse += spring(t - ti, 20, 9) * 0.085;
    for (const b of TL.bagOut) if (t > b.t0 && t < b.t0 + 1) pulse -= spring(t - b.t0, 22, 9) * 0.06;
    pulse = Math.max(-0.13, Math.min(0.13, pulse));
    const k = (0.45 + 0.17 * Math.sqrt(F)) * appear;
    const deflate = 0.78 + 0.22 * clamp01(F / 1.5);
    const hop = 18 * (bump(2.3, 2.58, t) + bump(2.62, 2.9, t) * 0.7);
    return { F, k, sx: 1 + pulse, sy: (1 - pulse) * deflate, hop };
  }

  function bagMouth(t) {
    const b = bagState(t);
    return { x: BAG.x, y: BAG.y - b.hop - 84 * b.k * b.sy };
  }

  function camera(t) {
    const [x, y, ls] = CAM(t);
    let shx = 0, shy = 0;
    for (const c of TL.contacts) {
      const tau = t - c.t;
      if (tau < 0 || tau > 0.6) continue;
      const a = c.amp * Math.exp(-11 * tau);
      shx += a * Math.sin(53 * tau + c.ph);
      shy += a * Math.sin(61 * tau + c.ph2);
    }
    const trem = tremor(t);
    shx += trem * 1.6 * Math.sin(t * 71.3);
    shy += trem * 1.2 * Math.sin(t * 59.1 + 1);
    const lim = 16;
    return { x, y, s: Math.exp(ls), shx: Math.max(-lim, Math.min(lim, shx)), shy: Math.max(-lim, Math.min(lim, shy)) };
  }

  const tremor = t => (t < 31 || t > 33.3 ? 0 : Math.pow(inv(31.0, 32.15, t), 1.4) * (1 - inv(32.9, 33.3, t)));
  const jitter = (t, seed, amp) => (amp === 0 ? [0, 0] : [
    amp * (Math.sin(t * 47.3 + seed * 7.1) * 0.6 + Math.sin(t * 83.1 + seed * 3.3) * 0.4),
    amp * (Math.sin(t * 53.7 + seed * 5.7) * 0.6 + Math.sin(t * 91.9 + seed * 2.1) * 0.4) * 0.6,
  ]);

  function happiness(p, t) {
    if (!p.receives.length || t < p.receives[0]) return 0;
    const last = p.receives[p.receives.length - 1];
    const off = Math.max(last + 1.4, 27.0);
    return smooth(p.receives[0], p.receives[0] + 0.35, t) * (1 - smooth(off, off + 1.6, t));
  }

  // phase des chevrons qui montent le long de la pyramide (intégrale de la vitesse)
  const chevSpeed = t => (t < 17 ? 0 : t < 19 ? lerp(0, 75, smooth(17, 19, t)) : t < 26 ? lerp(75, 135, smooth(19, 24, t)) : lerp(135, 0, smooth(26, 29.6, t)));
  function chevPhase(t) {
    let ph = 0;
    const dt = 1 / 60;
    for (let s = 17; s < t; s += dt) ph += chevSpeed(s) * Math.min(dt, t - s);
    return ph;
  }

  // ───────────────────────────── primitives de dessin
  function pathBody(ctx) { ctx.roundRect(-44, -66, 88, 66, [36, 36, 12, 12]); }
  function pathHead(ctx) { ctx.moveTo(27, -99); ctx.arc(0, -99, 27, 0, TAU); }

  function drawHat(ctx, th) {
    ctx.fillStyle = th.hat;
    ctx.beginPath(); ctx.roundRect(-26, -50, 52, 46, [8, 8, 2, 2]); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-38, -7, 76, 9, 4.5); ctx.fill();
    ctx.fillStyle = th.hatBand;
    ctx.fillRect(-26, -15, 52, 8);
    ctx.fillStyle = th.hatEdge;
    ctx.fillRect(-21, -46, 6, 28);
  }

  // personnage stylisé, ancré aux pieds
  function drawPerson(ctx, th, o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.rot) { ctx.translate(0, -50 * o.s); ctx.rotate(o.rot); ctx.translate(0, 50 * o.s); }
    ctx.scale(o.s * o.sx, o.s * o.sy);
    ctx.globalAlpha *= o.alpha;

    // corps
    ctx.fillStyle = o.body;
    ctx.beginPath(); pathBody(ctx); ctx.fill();
    ctx.save();
    ctx.beginPath(); pathBody(ctx); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.fillRect(-50, -15, 100, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.beginPath(); ctx.ellipse(-20, -50, 13, 9, -0.5, 0, TAU); ctx.fill();
    if (o.org) {
      ctx.fillStyle = th.orgShirt;
      ctx.beginPath(); ctx.moveTo(-16, -70); ctx.lineTo(16, -70); ctx.lineTo(0, -38); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (o.org) {
      ctx.fillStyle = th.orgTie;
      ctx.beginPath();
      ctx.moveTo(0, -60); ctx.lineTo(-15, -68); ctx.lineTo(-15, -52); ctx.closePath();
      ctx.moveTo(0, -60); ctx.lineTo(15, -68); ctx.lineTo(15, -52); ctx.closePath();
      ctx.fill();
      ctx.beginPath(); ctx.arc(0, -60, 4, 0, TAU); ctx.fill();
    }

    // tête
    ctx.fillStyle = o.head;
    ctx.beginPath(); ctx.arc(0, -99, 27, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.arc(-9, -109, 7.5, 0, TAU); ctx.fill();

    // visage
    const lx = o.lookX * 3, ly = o.lookY * 3;
    const er = 3.4 * (1 + o.shock * 0.45);
    ctx.fillStyle = th.face;
    for (const ex of [-9.5, 9.5]) {
      ctx.beginPath();
      ctx.ellipse(ex + lx, -101 + ly, er, er * Math.max(0.12, 1 - o.blink), 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = th.face;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.6;
    if (o.happy > 0.02) {
      ctx.globalAlpha = o.alpha * o.happy;
      ctx.beginPath(); ctx.arc(lx * 0.7, -93 + ly * 0.5, 7.5, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
    }
    if (o.sad > 0.02) {
      ctx.globalAlpha = o.alpha * o.sad;
      ctx.beginPath(); ctx.arc(lx * 0.7, -80 + ly * 0.5, 7, 1.22 * Math.PI, 1.78 * Math.PI); ctx.stroke();
    }
    if (o.shock > 0.02) {
      ctx.globalAlpha = o.alpha * o.shock;
      ctx.fillStyle = th.face;
      ctx.beginPath(); ctx.ellipse(lx * 0.7, -87 + ly * 0.5, 3.4, 4.4, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = o.alpha;

    if (o.sweat > 0.01) {
      ctx.fillStyle = 'rgba(140,200,255,0.95)';
      ctx.globalAlpha = o.alpha * o.sweat;
      const sy = -112 + o.sweatY * 14;
      ctx.beginPath();
      ctx.moveTo(30, sy - 10);
      ctx.bezierCurveTo(34, sy - 3, 37, sy + 1, 37, sy + 4);
      ctx.arc(30, sy + 4, 7, 0, Math.PI);
      ctx.bezierCurveTo(23, sy + 1, 26, sy - 3, 30, sy - 10);
      ctx.fill();
      ctx.globalAlpha = o.alpha;
    }

    if (o.hat) {
      ctx.save();
      ctx.translate(0, -121 + o.hatY);
      ctx.rotate(-0.09 + o.hatRot);
      drawHat(ctx, th);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBill(ctx, th, x, y, rot, s, alpha) {
    if (alpha <= 0.003 || s <= 0.003) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.roundRect(-26, -11, 56, 30, 5); ctx.fill();
    ctx.fillStyle = th.bill;
    ctx.beginPath(); ctx.roundRect(-28, -15, 56, 30, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.roundRect(-28, -15, 56, 12, [5, 5, 0, 0]); ctx.fill();
    ctx.strokeStyle = css(th.billInk, 0.45); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-22.5, -9.5, 45, 19, 3); ctx.stroke();
    ctx.fillStyle = css(th.billInk, 0.4);
    ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-15, 0, 2.2, 0, TAU); ctx.arc(15, 0, 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawBag(ctx, th, x, y, st, rot, alpha, grey) {
    if (st.k <= 0.002) return;
    ctx.save();
    ctx.translate(x, y);
    if (rot) { ctx.translate(0, -45 * st.k); ctx.rotate(rot); ctx.translate(0, 45 * st.k); }
    ctx.scale(st.k * st.sx, st.k * st.sy);
    ctx.globalAlpha *= alpha;
    // billets qui dépassent
    const F = st.F;
    if (F > 0.25) drawBill(ctx, th, -9, -97, -0.42, 0.62, clamp01((F - 0.25) * 2));
    if (F > 2.5) drawBill(ctx, th, 11, -101, 0.34, 0.62, clamp01((F - 2.5) * 2));
    if (F > 7) drawBill(ctx, th, 1, -106, -0.05, 0.62, clamp01((F - 7) * 2));
    const bag = grey ? mixC(hex(th.bag), hex(th.lost[0]), grey) : hex(th.bag);
    const dark = grey ? mixC(hex(th.bagDark), hex(th.lost[0]), grey) : hex(th.bagDark);
    const flap = grey ? mixC(hex(th.bagFlap), hex(th.lost[1]), grey) : hex(th.bagFlap);
    ctx.fillStyle = css(bag);
    ctx.beginPath();
    ctx.moveTo(-13, -78);
    ctx.bezierCurveTo(-34, -66, -50, -42, -47, -22);
    ctx.bezierCurveTo(-44, -4, -26, 0, 0, 0);
    ctx.bezierCurveTo(26, 0, 44, -4, 47, -22);
    ctx.bezierCurveTo(50, -42, 34, -66, 13, -78);
    ctx.closePath();
    ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath(); ctx.ellipse(18, -10, 44, 22, -0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.ellipse(-26, -46, 9, 16, 0.5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = css(flap);
    ctx.beginPath();
    ctx.moveTo(-13, -78); ctx.lineTo(-23, -97); ctx.quadraticCurveTo(-11, -90, 0, -99);
    ctx.quadraticCurveTo(11, -90, 23, -97); ctx.lineTo(13, -78); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(dark);
    ctx.beginPath(); ctx.roundRect(-17, -84, 34, 9, 4.5); ctx.fill();
    // pièce emblème
    const coin = grey ? mixC(hex(th.coin), hex(th.lost[1]), grey) : hex(th.coin);
    ctx.fillStyle = css(coin);
    ctx.beginPath(); ctx.arc(0, -36, 15, 0, TAU); ctx.fill();
    ctx.strokeStyle = th.coinInk; ctx.globalAlpha *= 0.7; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -36, 9.5, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function star(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }

  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0.003) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, css(rgb, a));
    g.addColorStop(0.45, css(rgb, a * 0.45));
    g.addColorStop(1, css(rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ───────────────────────────── trajectoires des billets / flèches
  function bez(P0, P1, P2, P3, u) {
    const v = 1 - u;
    return {
      x: v * v * v * P0.x + 3 * v * v * u * P1.x + 3 * v * u * u * P2.x + u * u * u * P3.x,
      y: v * v * v * P0.y + 3 * v * v * u * P1.y + 3 * v * u * u * P2.y + u * u * u * P3.y,
    };
  }
  function flightCurve(kind, p, t, t0) {
    let P0, P1, P2, P3;
    if (kind === 'in') {
      P0 = chest(p); P3 = bagMouth(t);
      const dx = P3.x - P0.x, dist = Math.hypot(dx, P3.y - P0.y);
      P1 = { x: P0.x - dx * 0.08, y: P0.y - (90 + dist * 0.22) };
      P2 = { x: P3.x, y: P3.y - Math.min(210, 110 + dist * 0.14) };
    } else {
      P0 = bagMouth(t0 === undefined ? t : t0); P3 = chest(p);
      const dx = P3.x - P0.x, dist = Math.hypot(dx, P3.y - P0.y);
      P1 = { x: P0.x + Math.sign(dx || 1) * 55, y: P0.y - 150 };
      P2 = { x: P3.x, y: P3.y - (110 + dist * 0.12) };
    }
    return u => bez(P0, P1, P2, P3, u);
  }

  function billProgress(b, t) {
    const u = (t - b.t0) / b.dur;
    if (u < 0 || u > 1) return null;
    return b.slow ? E.inOutSine(u) : E.inOutCubic(u);
  }

  // ───────────────────────────── rendu d'une image
  function draw(ctx, t, themeName) {
    const th = THEMES[themeName] || THEMES.dark;
    t = Math.max(0, Math.min(DURATION, t));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    const cam = camera(t);
    if (!th.transparent) drawBackground(ctx, th, cam, t);

    ctx.save();
    ctx.translate(W / 2 + cam.shx, H / 2 + cam.shy);
    ctx.scale(cam.s, cam.s);
    ctx.translate(-cam.x, -cam.y);

    drawTriangle(ctx, th, t);
    drawGhosts(ctx, th, t);
    drawOrgGlow(ctx, th, t);
    drawPlatforms(ctx, th, t);
    drawPeople(ctx, th, t);
    drawArrows(ctx, th, t);
    drawBills(ctx, th, t);
    drawFx(ctx, th, t);
    ctx.restore();

    if (!th.transparent) drawGrain(ctx, th);
  }

  function drawBackground(ctx, th, cam, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bgTop);
    g.addColorStop(1, th.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // halo doux derrière le sommet de la pyramide
    const ax = W / 2 + (560 - cam.x) * cam.s, ay = H / 2 + (430 - cam.y) * cam.s;
    const fall = 1 - 0.6 * inv(32.2, 34.5, t);
    const rg = ctx.createRadialGradient(ax, ay, 0, ax, ay, 1050);
    rg.addColorStop(0, css(th.bgGlow, th.bgGlowA * fall));
    rg.addColorStop(1, css(th.bgGlow, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    // poussières lumineuses très discrètes
    ctx.fillStyle = css(th.particle, 1);
    for (const m of TL.motes) {
      const y = ((m.y - t * m.v) % H + H) % H;
      const x = m.x + Math.sin(t * 0.4 + m.ph) * 14;
      ctx.globalAlpha = th.particleA * m.a * (0.6 + 0.4 * Math.sin(t * 1.3 + m.ph));
      ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.48, H * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${th.vignette})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  let grainCanvas = null;
  function drawGrain(ctx, th) {
    if (!th.grain) return;
    if (!grainCanvas) {
      const R = mulberry32(77);
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      const img = g.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = R() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      grainCanvas = c;
    }
    ctx.save();
    ctx.globalAlpha = th.grain;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grainCanvas, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function triBottom(t) {
    let bottom = ORG.y + 40;
    ROW_T.forEach((rt, r) => { bottom = lerp(bottom, ROWS[r].y + 44, E.inOutCubic(inv(rt.plat, rt.plat + 0.75, t))); });
    return bottom;
  }

  function drawTriangle(ctx, th, t) {
    const a = smooth(0.5, 1.4, t) * (1 - smooth(32.2, 33.0, t));
    if (a <= 0) return;
    const bottom = triBottom(t);
    const hw = (bottom - APEX_Y) * TRI_K;
    const A = { x: 540, y: APEX_Y }, L = { x: 540 - hw, y: bottom }, Rr = { x: 540 + hw, y: bottom };
    const tr = tremor(t);
    const redMix = Math.min(1, tr * 1.6) * (0.6 + 0.4 * Math.sin(t * 22));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo((A.x + L.x) / 2, (A.y + L.y) / 2);
    ctx.arcTo(A.x, A.y, Rr.x, Rr.y, 30);
    ctx.arcTo(Rr.x, Rr.y, L.x, L.y, 26);
    ctx.arcTo(L.x, L.y, A.x, A.y, 26);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, APEX_Y, 0, bottom);
    g.addColorStop(0, css(mixC(th.tri, th.red, redMix * 0.7), th.triA * 1.6));
    g.addColorStop(1, css(mixC(th.tri, th.red, redMix * 0.7), th.triA * 0.6));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = css(mixC(th.tri, th.red, redMix), th.triEdgeA + redMix * 0.4);
    ctx.stroke();

    // chevrons : l'argent monte vers le sommet
    const ca = smooth(17.0, 18.2, t) * (1 - smooth(29.0, 30.4, t));
    if (ca > 0) {
      const ph = chevPhase(t);
      ctx.strokeStyle = css(th.green, 0.55 * ca);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const side of [-1, 1]) {
        const B0 = side < 0 ? L : Rr;
        const dx = A.x - B0.x, dy = A.y - B0.y, len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len;
        const nx = -side * -uy, ny = -side * ux; // normale vers l'intérieur
        const inset = -24, gap = 64;
        const off = ((ph % gap) + gap) % gap;
        for (let k = -1; k < len / gap + 1; k++) {
          const d = off + k * gap;
          if (d < 70 || d > len - 120) continue;
          const fade = Math.min(1, (d - 70) / 80, (len - 120 - d) / 80);
          const cx = B0.x + ux * d + nx * inset, cy = B0.y + uy * d + ny * inset;
          const sz = 11;
          ctx.globalAlpha = a * fade;
          ctx.beginPath();
          ctx.moveTo(cx - ux * sz + nx * sz, cy - uy * sz + ny * sz);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx - ux * sz - nx * sz, cy - uy * sz - ny * sz);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawGhosts(ctx, th, t) {
    if (t < GHOST.t0 || t > GHOST.t1 + 0.8) return;
    const a = smooth(GHOST.t0, GHOST.t0 + 0.5, t) * (1 - smooth(GHOST.t1, GHOST.t1 + 0.7, t));
    ctx.save();
    ctx.setLineDash([10, 9]);
    ctx.lineDashOffset = -t * 18;
    ctx.lineWidth = 3;
    const hw = (GHOST.hw + 62 * GHOST.s) * E.outCubic(inv(GHOST.t0, GHOST.t0 + 0.6, t));
    ctx.strokeStyle = css(th.ghost, 0.35 * a);
    ctx.beginPath(); ctx.roundRect(540 - hw, GHOST.y + 1, hw * 2, PLAT_H, 6); ctx.stroke();
    for (let i = 0; i < GHOST.n; i++) {
      const x = 540 - GHOST.hw + (i * 2 * GHOST.hw) / (GHOST.n - 1);
      const d = Math.abs(i - (GHOST.n - 1) / 2);
      const ai = smooth(GHOST.t0 + 0.25 + d * 0.06, GHOST.t0 + 0.65 + d * 0.06, t) *
        (1 - smooth(GHOST.t1 - 0.2 + (5 - d) * 0.05, GHOST.t1 + 0.35 + (5 - d) * 0.05, t));
      const pulse = 0.55 + 0.45 * Math.sin((t - GHOST.t0) * 4.2 - d * 0.6);
      if (ai <= 0) continue;
      ctx.save();
      ctx.translate(x, GHOST.y);
      ctx.scale(GHOST.s, GHOST.s);
      ctx.lineWidth = 3.5 / GHOST.s;
      ctx.strokeStyle = css(th.ghost, (0.18 + 0.4 * pulse) * ai * a);
      ctx.beginPath(); pathBody(ctx); ctx.stroke();
      ctx.beginPath(); pathHead(ctx); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawOrgGlow(ctx, th, t) {
    const appear = smooth(0.2, 1.1, t) * (1 - smooth(32.9, 33.6, t));
    let pulse = 0;
    for (const ti of TL.bagIn) if (t > ti && t < ti + 0.8) pulse += Math.exp(-(t - ti) * 5) * 0.12;
    const fade = 1 - 0.55 * smooth(27.5, 30.5, t);
    glow(ctx, 556, 330, 330, th.gold, (0.2 + Math.min(0.2, pulse)) * appear * fade);
  }

  function drawPlatforms(ctx, th, t) {
    const tr = tremor(t);
    for (const pl of TL.platforms) {
      if (t < pl.tAppear) continue;
      const fillC = pl.gold ? th.pedestal : th.platform;
      const fillA = pl.gold ? th.pedestalA : th.platformA;
      if (t < pl.breakT) {
        const wipe = E.outCubic(inv(pl.tAppear, pl.tAppear + 0.55, t));
        const cx = (pl.x0 + pl.x1) / 2, hw = ((pl.x1 - pl.x0) / 2) * wipe;
        const [jx, jy] = jitter(t, pl.r + 2, tr * 5);
        const sag = SAG * E.inQuad(inv(pl.breakT - 0.22, pl.breakT, t));
        const y = pl.y + jy + sag;
        const red = Math.min(1, tr * 1.3) * (0.55 + 0.45 * Math.sin(t * 24 + pl.r));
        ctx.save();
        ctx.translate(jx, 0);
        ctx.fillStyle = css(mixC(fillC, th.red, red * 0.8), fillA + red * 0.25);
        ctx.beginPath(); ctx.roundRect(cx - hw, y, hw * 2, PLAT_H, 6.5); ctx.fill();
        if (pl.gold) {
          ctx.fillStyle = css(th.pedestalEdge, 0.85 * (1 - red));
          ctx.beginPath(); ctx.roundRect(cx - hw + 4, y, hw * 2 - 8, 3.5, 1.75); ctx.fill();
        } else if (th.platformEdgeA) {
          ctx.fillStyle = css([255, 255, 255], th.platformEdgeA * 0.6);
          ctx.beginPath(); ctx.roundRect(cx - hw + 6, y, hw * 2 - 12, 2.5, 1.25); ctx.fill();
        }
        // fissures
        const cp = inv(pl.crackT, pl.crackT + 0.3, t);
        if (cp > 0) {
          ctx.strokeStyle = css(th.red, 0.95);
          ctx.lineWidth = 3.2;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          for (const c of pl.cracks) {
            ctx.beginPath();
            const n = c.length - 1, upto = cp * n;
            ctx.moveTo(c[0][0], c[0][1] + sag + jy);
            for (let k = 1; k <= n; k++) {
              const f = Math.min(1, upto - (k - 1));
              if (f <= 0) break;
              ctx.lineTo(lerp(c[k - 1][0], c[k][0], f), lerp(c[k - 1][1], c[k][1], f) + sag + jy);
            }
            ctx.stroke();
            glow(ctx, c[0][0], pl.y + 6 + sag, 26, th.red, 0.35 * cp * (0.6 + 0.4 * Math.sin(t * 30)));
          }
        }
        ctx.restore();
      } else {
        for (const b of pl.pieces) {
          const q = bodyAt(b, t);
          const landed = b.contacts.length ? b.contacts[0].t : 99;
          const a = 1 - 0.75 * smooth(landed + 0.5, landed + 1.6, t);
          ctx.save();
          ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          ctx.fillStyle = css(mixC(fillC, hex(th.lost[1]), 0.5), Math.min(0.9, fillA * 2.4) * a);
          ctx.beginPath(); ctx.roundRect(-b.w / 2, -PLAT_H / 2, b.w, PLAT_H, 5); ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  function personLook(p, t, l) {
    const lx = Math.max(-1, Math.min(1, (ORG.x + 40 - p.x) / 420)) * 0.7;
    return [lerp(lx, 0, l), lerp(-0.55, 0.85, l)];
  }

  function blinkAt(seed, t) {
    const period = 2.8 + (seed % 1) * 2.6;
    const ph = ((t + seed * 1.7) % period + period) % period;
    return ph < 0.14 ? Math.sin((Math.PI * ph) / 0.14) : 0;
  }

  function drawPeople(ctx, th, t) {
    const tr = tremor(t);
    const energy = ENERGY(t)[0];
    const lostC = th.lost.map(hex), paidC = th.paid.map(hex);

    // de la base vers le sommet : en tombant, les étages supérieurs recouvrent les inférieurs
    for (let r = ROWS.length - 1; r >= 0; r--) {
      for (const p of TL.rows[r]) {
        const a = p.arr;
        if (t < a.t0) continue;
        let x = p.x, y = p.y, sx = 1, sy = 1, rot = 0, alpha = 1, grounded = 1;
        const q = bodyAt(p.body, t);
        if (q) {
          x = q.x; y = q.y + 50 * p.s; rot = q.rot; grounded = 0;
        } else if (t < p.landT) {
          const u = (t - a.t0) / a.dur;
          x = lerp(a.x0, p.x, u);
          y = lerp(a.y0, p.y, u) - a.arc * 4 * u * (1 - u);
          alpha = E.outQuad(inv(0, 0.3, u));
          const sc = lerp(0.75, 1, E.outCubic(inv(0, 0.5, u)));
          sx = sy = sc;
          sy *= 1 + 0.08 * Math.sin(Math.PI * u);
          rot = -a.side * 0.35 * (1 - E.outCubic(u)) + a.side * 0.12 * Math.sin(Math.PI * u);
          grounded = 0;
        } else {
          const land = spring(t - p.landT, 18, 7);
          sy = 1 - 0.24 * land; sx = 1 + 0.18 * land;
          for (const tl0 of p.launches) {
            const h = bump(tl0 - 0.12, tl0 + 0.2, t);
            if (h) { y -= 13 * p.s * h; sy *= 1 + 0.06 * h; grounded = 1 - h; }
          }
          for (const trc of p.receives) {
            const h = bump(trc, trc + 0.38, t);
            if (h) { y -= 16 * p.s * h; grounded = Math.min(grounded, 1 - h); }
            if (t > trc && t < trc + 1) { const sp = spring(t - trc, 20, 8); sy *= 1 + 0.12 * sp; sx *= 1 - 0.08 * sp; }
          }
          sy *= 1 + 0.016 * Math.sin(t * 2.4 + p.seed) * energy;
          const [jx, jy] = jitter(t, p.seed, tr * 4.5);
          x += jx; y += jy + SAG * E.inQuad(inv(TL.BREAK[p.r] - 0.22, TL.BREAK[p.r], t));
        }
        const h = happiness(p, t);
        const l = smooth(p.lostAt, p.lostAt + 0.6, t);
        let body = mixC(hex(p.cols[0]), paidC[0], h), head = mixC(hex(p.cols[1]), paidC[1], h);
        body = mixC(body, lostC[0], l); head = mixC(head, lostC[1], l);

        // halos de gain
        if (!q) {
          let flash = 0;
          for (const trc of p.receives) if (t > trc && t < trc + 1.6) flash += Math.exp(-(t - trc) * 2.6);
          glow(ctx, x, y - 50 * p.s, 120 * p.s, th.green, (Math.min(0.5, flash * 0.42) + 0.16 * h) * (1 - l));
          if (grounded > 0.01) {
            ctx.fillStyle = `rgba(0,0,0,${th.shadowA * grounded * alpha})`;
            ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 38 * p.s, 6 * p.s, 0, 0, TAU); ctx.fill();
          }
        }
        const shock = q ? 0 : Math.min(1, tr * 2) * (1 - l * 0.3);
        const [lx, ly] = personLook(p, t, Math.max(l, q ? 1 : 0));
        drawPerson(ctx, th, {
          x, y, s: p.s, sx, sy, rot, alpha,
          body: css(body), head: css(head),
          lookX: lx, lookY: ly, blink: q && t > p.body.t0 + 1.2 ? 0.7 : blinkAt(p.seed, t),
          happy: h * (1 - l) * (1 - shock), sad: l * (1 - shock), shock,
        });
      }
    }
    drawOrganizer(ctx, th, t);
  }

  function drawOrganizer(ctx, th, t) {
    if (t < 0.35) return;
    const o = TL.org;
    const appear = E.outBack(inv(0.35, 0.95, t), 2.0);
    const alpha = inv(0.35, 0.5, t);
    let x = o.x, y = o.y, sx = appear, sy = appear, rot = 0;
    const q = bodyAt(o.body, t);
    const tr = tremor(t);
    if (q) {
      x = q.x; y = q.y + 50 * o.s; rot = q.rot;
    } else {
      const land = spring(t - 0.95, 16, 6);
      sy *= 1 - 0.14 * land; sx *= 1 + 0.1 * land;
      for (const tb of [6.2, 11.4, 13.1, 18.1, 20.4, 22.5, 24.6]) {
        const h = bump(tb, tb + 0.36, t);
        if (h) { y -= 14 * h; sy *= 1 + 0.05 * h; }
      }
      sy *= 1 + 0.014 * Math.sin(t * 2.1 + 1) * ENERGY(t)[0];
      const [jx, jy] = jitter(t, 9.1, tr * 4);
      x += jx; y += jy + SAG * E.inQuad(inv(TL.BREAK_ORG - 0.22, TL.BREAK_ORG, t));
      ctx.fillStyle = `rgba(0,0,0,${th.shadowA * alpha})`;
      ctx.beginPath(); ctx.ellipse(o.x, o.y + 1, 44 * o.s * appear, 7 * o.s, 0, 0, TAU); ctx.fill();
    }
    const [happy, sad, shock] = ORG_MOOD(t).map(clamp01);
    const [lx, ly] = ORG_LOOK(t);
    const grey = 0.72 * smooth(33.1, 33.9, t);
    const body = mixC(hex(th.org[0]), hex(th.lost[0]), grey), head = mixC(hex(th.org[1]), hex(th.lost[1]), grey);
    const hatY = -230 * (1 - E.outBounce(inv(0.72, 1.35, t)));
    drawPerson(ctx, th, {
      x, y, s: o.s, sx, sy, rot, alpha, org: true,
      body: css(body), head: css(head),
      lookX: lx, lookY: ly, blink: blinkAt(o.seed, t) * (shock > 0.5 ? 0 : 1),
      happy, sad, shock,
      sweat: smooth(29.5, 29.9, t) * (1 - smooth(31.3, 31.6, t)), sweatY: inv(29.5, 31.3, t),
      hat: t >= 0.72 && t < TL.hatBody.t0, hatY, hatRot: 0.08 * Math.sin(t * 30) * tr,
    });
    // chapeau éjecté
    const hq = bodyAt(TL.hatBody, t);
    if (hq) {
      ctx.save();
      ctx.translate(hq.x, hq.y); ctx.rotate(hq.rot - 0.09); ctx.scale(o.s, o.s);
      ctx.translate(0, 22);
      drawHat(ctx, th);
      ctx.restore();
    }
    // le sac d'argent
    const st = bagState(t);
    const bq = bodyAt(TL.bagBody, t);
    if (bq) {
      drawBag(ctx, th, bq.x, bq.y + 22, st, bq.rot, 1, grey * 0.6);
    } else if (t >= 1.35) {
      const [jx, jy] = jitter(t, 4.4, tr * 4);
      if (st.k > 0.05) {
        ctx.fillStyle = `rgba(0,0,0,${th.shadowA * 0.9})`;
        ctx.beginPath(); ctx.ellipse(BAG.x, BAG.y + 1, 44 * st.k * st.sx, 6, 0, 0, TAU); ctx.fill();
      }
      drawBag(ctx, th, BAG.x + jx, BAG.y - st.hop + jy + SAG * E.inQuad(inv(TL.BREAK_ORG - 0.22, TL.BREAK_ORG, t)), st, 0, 1, 0);
    }
  }

  function drawArrows(ctx, th, t) {
    for (const a of TL.arrows) {
      const pd = E.outCubic(inv(a.t0, a.t0 + 0.5, t));
      const fade = 1 - smooth(a.t1, a.t1 + 0.45, t);
      if (pd <= 0 || fade <= 0) continue;
      const curve = flightCurve(a.kind, a.p, t);
      const u0 = a.kind === 'in' ? 0.12 : 0.1, u1 = lerp(u0, 0.84, pd);
      const pts = [];
      for (let k = 0; k <= 40; k++) pts.push(curve(lerp(u0, u1, k / 40)));
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = css(th.green, 0.8);
      ctx.lineWidth = 7;
      ctx.setLineDash([1, 16]);
      ctx.lineDashOffset = -t * 45;
      ctx.beginPath();
      pts.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      ctx.setLineDash([]);
      // pointe de flèche
      const e = pts[pts.length - 1], f = pts[pts.length - 3];
      const ang = Math.atan2(e.y - f.y, e.x - f.x);
      const hs = 21 * E.outBack(inv(0.55, 1, pd), 2.5);
      if (hs > 0.5) {
        ctx.fillStyle = css(th.green, 0.95);
        ctx.translate(e.x, e.y); ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(hs * 0.9, 0);
        ctx.lineTo(-hs * 0.6, -hs * 0.75);
        ctx.quadraticCurveTo(-hs * 0.25, 0, -hs * 0.6, hs * 0.75);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawBills(ctx, th, t) {
    const sMul = 0.95;
    for (const b of TL.bills) {
      const e = billProgress(b, t);
      if (e === null) continue;
      const u = (t - b.t0) / b.dur;
      const curve = flightCurve(b.kind, b.p, t, b.t0);
      const pos = curve(e);
      // traînée
      const N = 12;
      let prev = pos;
      ctx.lineCap = 'round';
      for (let k = 1; k <= N; k++) {
        const uk = u - k * 0.016;
        if (uk <= 0) break;
        const ek = b.slow ? E.inOutSine(uk) : E.inOutCubic(uk);
        const q = curve(ek);
        ctx.strokeStyle = css(th.green, 0.42 * (1 - k / N) * Math.min(1, u * 6));
        ctx.lineWidth = 13 * (1 - k / N) + 1.5;
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        prev = q;
      }
      const ahead = curve(Math.min(1, e + 0.02));
      const vx = ahead.x - pos.x;
      const rot = Math.max(-0.5, Math.min(0.5, vx * 0.03)) + 0.22 * Math.sin(u * TAU * 1.4 + b.seed);
      let s = sMul * E.outBack(inv(0, 0.14, u), 2.4);
      let alpha = 1;
      if (b.kind === 'in') { s *= lerp(1, 0.45, inv(0.86, 1, u)); alpha = 1 - inv(0.93, 1, u); }
      else { s *= lerp(1, 0.55, inv(0.85, 1, u)); alpha = 1 - inv(0.9, 1, u); }
      drawBill(ctx, th, pos.x, pos.y, rot, s, alpha);
    }
    // billets qui virevoltent pendant l'effondrement
    for (const f of TL.flutters) {
      if (t < f.t0) continue;
      const tau = Math.min(t - f.t0, f.land);
      const q = flutterRaw(f, tau);
      let rot = q.rot;
      if (t - f.t0 > f.land) rot = lerp(q.rot, q.rot * 0.25, smooth(f.t0 + f.land, f.t0 + f.land + 0.35, t));
      const grey = 0.35 * smooth(f.t0 + f.land + 0.5, f.t0 + f.land + 2, t);
      drawBill(ctx, th, q.x, q.y, rot, 0.85 * E.outBack(inv(0, 0.2, t - f.t0)), 1 - grey);
    }
  }

  function drawFx(ctx, th, t) {
    for (const f of TL.fx) {
      const tau = t - f.t;
      if (tau < 0) continue;
      if (f.type === 'recv') {
        if (tau > 0.9) continue;
        const p = f.p, c = chest(p), k = tau / 0.9;
        ctx.strokeStyle = css(th.green, 0.85 * (1 - k));
        ctx.lineWidth = (5 * (1 - k) + 1) * p.s;
        ctx.beginPath(); ctx.arc(c.x, c.y - 20 * p.s, lerp(20, 95, E.outCubic(k)) * p.s, 0, TAU); ctx.stroke();
        ctx.fillStyle = css(th.green, 1 - k);
        for (let j = 0; j < 6; j++) {
          const ang = f.seed + (j * TAU) / 6;
          const d = lerp(30, 105, E.outCubic(k)) * p.s;
          star(ctx, c.x + Math.cos(ang) * d, c.y - 20 * p.s + Math.sin(ang) * d, 9 * (1 - k) * p.s);
        }
      } else if (f.type === 'bagin') {
        if (tau > 0.6) continue;
        const k = tau / 0.6, m = bagMouth(f.t);
        ctx.fillStyle = css(th.gold, 1 - k);
        for (let j = 0; j < 3; j++) {
          const ang = -Math.PI / 2 + (j - 1) * 0.9 + Math.sin(f.seed + j) * 0.3;
          const d = lerp(10, 58, E.outCubic(k));
          star(ctx, m.x + Math.cos(ang) * d, m.y - 6 + Math.sin(ang) * d, 8 * (1 - k));
        }
      } else if (f.type === 'land') {
        if (tau > 0.45) continue;
        const k = tau / 0.45;
        ctx.fillStyle = css(th.dust, 0.35 * (1 - k));
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(f.x + side * lerp(20, 58, E.outCubic(k)) * f.s, f.y - 6 * f.s, lerp(4, 11, k) * f.s, 0, TAU);
          ctx.fill();
        }
      } else if (f.type === 'dust') {
        if (tau > 0.9) continue;
        const k = tau / 0.9;
        ctx.fillStyle = css(th.dust, 0.32 * (1 - k) * f.size);
        for (let j = 0; j < 5; j++) {
          const ang = Math.PI + (j / 4) * Math.PI + Math.sin(f.seed + j) * 0.2;
          const d = lerp(8, 70, E.outCubic(k)) * f.size;
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(ang) * d, f.y - 8 + Math.sin(ang) * d * 0.45, lerp(6, 20, k) * f.size, 0, TAU);
          ctx.fill();
        }
      } else if (f.type === 'twinkle') {
        if (tau > 0.7) continue;
        const k = tau / 0.7;
        ctx.fillStyle = css(th.gold, Math.sin(Math.PI * k));
        star(ctx, f.x, f.y, 13 * Math.sin(Math.PI * k));
      }
    }
    // apparition de l'organisateur : onde dorée
    if (t > 0.3 && t < 1.3) {
      const k = (t - 0.3) / 1.0;
      ctx.strokeStyle = css(th.gold, 0.75 * (1 - k));
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(ORG.x, ORG.y - 70 * ORG.s, lerp(30, 230, E.outCubic(k)), 0, TAU); ctx.stroke();
    }
    if (t > 1.35 && t < 2.0) {
      const k = (t - 1.35) / 0.65;
      ctx.strokeStyle = css(th.green, 0.7 * (1 - k));
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(BAG.x, BAG.y - 40, lerp(16, 110, E.outCubic(k)), 0, TAU); ctx.stroke();
    }
  }

  root.PonziAnim = { W, H, FPS, DURATION, SCENES, THEMES, draw };
})(typeof window !== 'undefined' ? window : globalThis);
