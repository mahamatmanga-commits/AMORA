#!/usr/bin/env node
/*
 * Export de l'animation.
 *
 *   node render.cjs stills  --theme dark --times 1,5.5,12 --out stills/
 *   node render.cjs frames  --theme dark --out .frames/dark      (PNG 1080x1920, 60 i/s)
 *
 * Les images sont dessinées par src/ponzi.js dans Chromium (Playwright),
 * puis encodées avec ffmpeg (voir encode.sh).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const mode = args[0];
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};

(async () => {
  const theme = opt('theme', 'dark');
  const out = path.resolve(opt('out', 'out'));
  const workers = +opt('workers', 4);
  fs.mkdirSync(out, { recursive: true });

  const browser = await chromium.launch();
  const url = 'file://' + path.resolve(__dirname, 'src/index.html') + '?render=1';
  const open = async () => {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(url);
    await page.waitForFunction(() => typeof window.__frame === 'function');
    return page;
  };
  const grab = async (page, t, file) => {
    const data = await page.evaluate(([t, th]) => window.__frame(t, th), [t, theme]);
    fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  };

  if (mode === 'stills') {
    const page = await open();
    const times = opt('times', '0.5,2,5.5,7,10.8,12.4,15,18.5,22.8,25,27.5,29.6,31.6,32.6,33.5,38').split(',').map(Number);
    for (const t of times) await grab(page, t, path.join(out, `${theme}_${t.toFixed(2).padStart(6, '0')}.png`));
    console.log(`${times.length} images -> ${out}`);
  } else if (mode === 'frames') {
    const fps = +opt('fps', 60);
    const duration = await (await open()).evaluate(() => window.PonziAnim.DURATION);
    const total = Math.round(duration * fps) + 1;
    const pages = await Promise.all(Array.from({ length: workers }, open));
    let next = 0, done = 0;
    const t0 = Date.now();
    await Promise.all(pages.map(async page => {
      for (;;) {
        const f = next++;
        if (f >= total) return;
        await grab(page, f / fps, path.join(out, `f${String(f).padStart(5, '0')}.png`));
        if (++done % 120 === 0) process.stdout.write(`  ${done}/${total} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
      }
    }));
    console.log(`${total} images (${fps} i/s) -> ${out}`);
  } else {
    console.error('usage: node render.cjs stills|frames [--theme dark|light|alpha] [--out dir]');
    process.exitCode = 1;
  }
  await browser.close();
})();
