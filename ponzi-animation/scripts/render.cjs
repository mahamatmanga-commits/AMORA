#!/usr/bin/env node
/**
 * Rendu vidéo image par image (déterministe) via Chromium + ffmpeg.
 *
 *   node scripts/render.cjs                      → output/pyramide-de-ponzi.mp4 (+ version sans musique)
 *   node scripts/render.cjs --fps 30             → cadence alternative
 *   node scripts/render.cjs --stills 1.2,5,18.5  → captures PNG dans output/stills/
 *   node scripts/render.cjs --from 10 --to 20    → extrait (aperçu rapide)
 *
 * Options : --fps <n> --workers <n> --from <s> --to <s> --out <fichier> --no-audio --crf <n>
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (_) { /* repli sur l'installation globale */ }
  const globalRoot = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim();
  return require(path.join(globalRoot, 'playwright'));
}

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'output');
const Ponzi = require(path.join(ROOT, 'src', 'animation.js'));

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.png': 'image/png' };
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
  await page.waitForFunction(() => window.__ready === true);
  return page;
}

async function grab(page, t) {
  const url = await page.evaluate((tt) => window.__png(tt), t);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg a échoué : ${args.join(' ')}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { chromium } = loadPlaywright();
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--disable-gpu', '--font-render-hinting=none'] });

  try {
    const stills = arg('stills');
    if (stills) {
      const dir = path.join(OUT_DIR, 'stills');
      fs.mkdirSync(dir, { recursive: true });
      const page = await openPage(browser, port);
      for (const s of String(stills).split(',')) {
        const t = parseFloat(s);
        const file = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
        fs.writeFileSync(file, await grab(page, t));
        console.log('✓', path.relative(ROOT, file));
      }
      return;
    }

    const fps = +arg('fps', Ponzi.FPS);
    const from = +arg('from', 0), to = +arg('to', Ponzi.DURATION);
    const total = Math.round((to - from) * fps);
    const workers = Math.max(1, Math.min(+arg('workers', Math.min(4, os.cpus().length)), total));
    const crf = String(arg('crf', 18));
    const out = path.resolve(arg('out', path.join(OUT_DIR, 'pyramide-de-ponzi.mp4')));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponzi-'));
    console.log(`Rendu ${total} images à ${fps} i/s (${from}s → ${to}s) avec ${workers} processus…`);

    const per = Math.ceil(total / workers);
    let done = 0;
    const started = Date.now();
    const segs = [];
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const a = w * per, b = Math.min(total, a + per);
      if (a >= b) return;
      const seg = path.join(tmp, `seg${w}.mp4`);
      segs[w] = seg;
      const page = await openPage(browser, port);
      const enc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
        '-x264-params', 'keyint=' + fps * 2 + ':min-keyint=' + fps + ':scenecut=0', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
        seg], { stdio: ['pipe', 'inherit', 'inherit'] });
      const closed = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error('encodeur ' + c)))));
      for (let i = a; i < b; i++) {
        const png = await grab(page, from + i / fps);
        if (!enc.stdin.write(png)) await new Promise((r) => enc.stdin.once('drain', r));
        done++;
        if (done % 60 === 0) {
          const el = (Date.now() - started) / 1000;
          process.stdout.write(`\r  ${done}/${total} images · ${(done / el).toFixed(1)} i/s · reste ~${Math.round((total - done) / (done / el))} s   `);
        }
      }
      enc.stdin.end();
      await closed;
      await page.close();
    }));
    process.stdout.write('\n');

    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
    const silent = path.join(tmp, 'video.mp4');
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);

    const music = path.join(OUT_DIR, 'ponzi-soundtrack.wav');
    const sfx = path.join(OUT_DIR, 'ponzi-sfx-only.wav');
    if (!arg('no-audio') && fs.existsSync(music)) {
      const mux = (wav, dest) => ffmpeg(['-i', silent, '-ss', String(from), '-t', String(to - from), '-i', wav,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', dest]);
      mux(music, out);
      console.log('✓', path.relative(process.cwd(), out));
      if (fs.existsSync(sfx) && !arg('out')) {
        const alt = out.replace(/\.mp4$/, '-sans-musique.mp4');
        mux(sfx, alt);
        console.log('✓', path.relative(process.cwd(), alt));
      }
    } else {
      ffmpeg(['-i', silent, '-c', 'copy', '-movflags', '+faststart', out]);
      console.log('✓ (sans audio)', path.relative(process.cwd(), out));
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
