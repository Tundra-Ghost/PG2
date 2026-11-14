// Contrast audit: walks every visible text element on every screen and
// reports text whose WCAG contrast against its painted background is below
// 4.5:1 (3:1 for large text).
//
// Usage: start the game (pnpm dev), then from the repo root:
//   node game/scripts/contrast-audit.cjs        # phone and desktop
//   node game/scripts/contrast-audit.cjs p      # phone only (392x800)
//   node game/scripts/contrast-audit.cjs d      # desktop only (1300x850)
// Set BASE_URL to test another address (default http://localhost:5173/).
//
// Limits: text drawn over images or the Phaser board canvas cannot be
// measured; check those by eye in screenshots. Lines marked [img] sit on an
// element with a background image.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:5173/';

const AUDIT = () => {
  const parse = (str) => {
    const m = str && str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (k) => (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / a;
    return { r: mix('r'), g: mix('g'), b: mix('b'), a };
  };
  const gradientColor = (img) => {
    const colors = [...img.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0])).filter(c => c && c.a > 0);
    if (!colors.length) return null;
    const n = colors.length;
    const sum = colors.reduce((s, c) => ({ r: s.r + c.r, g: s.g + c.g, b: s.b + c.b, a: s.a + c.a }), { r: 0, g: 0, b: 0, a: 0 });
    return { r: sum.r / n, g: sum.g / n, b: sum.b / n, a: sum.a / n };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  const backgroundOf = (el) => {
    const layers = [];
    let hasImage = false;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        if (cs.backgroundImage.includes('url(')) hasImage = true;
        const g = gradientColor(cs.backgroundImage);
        if (g) layers.push(g);
      }
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) layers.push(bg);
      const top = layers.reduceRight((acc, c) => over(acc, c), { r: 0, g: 0, b: 0, a: 0 });
      if (layers.length && layers.reduce((acc, c) => over(acc, c)).a >= 0.98) break;
    }
    let result = { r: 255, g: 255, b: 255, a: 1 };
    const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
    if (bodyBg && bodyBg.a > 0) result = over(bodyBg, result);
    for (let i = layers.length - 1; i >= 0; i--) result = over(layers[i], result);
    return { color: result, hasImage };
  };

  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent.trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    let opacity = 1;
    for (let e = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
    if (opacity < 0.05) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const { color: bg, hasImage } = backgroundOf(el);
    const shown = over({ ...fg, a: fg.a * opacity }, bg);
    const r = ratio(shown, bg);
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    const disabled = el.closest('button:disabled, [aria-disabled="true"]');
    if (r < need && !disabled) {
      out.push({
        text: text.slice(0, 50),
        ratio: Math.round(r * 100) / 100,
        need,
        cls: (el.className && el.className.baseVal === undefined ? el.className : '').toString().split(' ').map(c => c.replace(/^_|_[a-z0-9]{5}_\d+$/g, '')).join(' ').slice(0, 60),
        image: hasImage,
      });
    }
  }
  return out;
};

async function audit(page, label) {
  await page.waitForTimeout(700);
  const rows = await page.evaluate(AUDIT);
  for (const r of rows) console.log(`${label}\t${r.ratio}<${r.need}\t${r.image ? '[img] ' : ''}${r.cls}\t${JSON.stringify(r.text)}`);
}

(async () => {
  const b = await chromium.launch();
  const sizes = process.argv[2] === 'd' ? [[1300, 850, 'd']] : process.argv[2] === 'p' ? [[392, 800, 'p']] : [[392, 800, 'p'], [1300, 850, 'd']];
  for (const [w, h, n] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: n === 'p', hasTouch: n === 'p' });
    await ctx.addInitScript(() => { try { localStorage.setItem('pg2-tutorial', 'done'); } catch {} });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('ERR', e.message));
    const go = async (path) => { await p.goto(BASE + path); await p.waitForTimeout(900); };
    const click = async (loc) => { if (n === 'p') await loc.tap(); else await loc.click(); await p.waitForTimeout(400); };

    await go(''); await audit(p, `${n} menu`);
    await go('settings');
    for (const tab of ['Account', 'Audio', 'Display', 'Gameplay', 'Access.', 'Feedback']) {
      const t = p.getByRole('tab', { name: tab, exact: true });
      if (await t.count()) { await click(t); await audit(p, `${n} settings/${tab}`); }
    }
    await go('profile'); await audit(p, `${n} profile`);
    for (const tab of ['stats', 'titles', 'achievements', 'history', 'edit']) {
      const t = p.getByRole('tab', { name: tab, exact: true });
      if (await t.count()) { await click(t); await audit(p, `${n} profile/${tab}`); }
    }
    await go('stats'); await audit(p, `${n} stats`);
    await go('online'); await audit(p, `${n} online`);
    await go('friends'); await audit(p, `${n} friends`);
    await go('collection'); await audit(p, `${n} collection`);
    await go('puzzles'); await audit(p, `${n} puzzles`);
    await click(p.getByRole('button', { name: 'Play' }).first()); await audit(p, `${n} puzzle-play`);
    await go('puzzles'); await click(p.getByRole('button', { name: /New puzzle/i }).first()); await audit(p, `${n} puzzle-edit`);
    await go('opponents'); await audit(p, `${n} opponents`);
    await click(p.getByText('Chick', { exact: true })); await audit(p, `${n} draft`);
    await click(p.locator('button[class*="card"]').first()); await audit(p, `${n} draft-detail`);
    await p.keyboard.press('Escape');
    await go('opponents'); await click(p.getByText('Chick', { exact: true }));
    await click(p.getByRole('button', { name: 'Random', exact: true }));
    await click(p.getByRole('button', { name: 'Start match' }));
    await p.waitForTimeout(1500);
    await audit(p, `${n} match`);
    if (n === 'p') {
      await click(p.getByRole('tab', { name: /Moves/ })); await audit(p, `${n} match/feed`);
      await click(p.getByRole('tab', { name: /Modifiers/ })); await audit(p, `${n} match/mods`);
      await click(p.getByRole('tab', { name: /Modifiers/ }));
    }
    // A square's info box.
    const sq = p.locator('[data-square][aria-label*=","]').first();
    if (await sq.count()) {
      if (n === 'd') { await sq.hover(); await audit(p, `${n} tooltip`); }
    }
    await ctx.close();
  }
  await b.close();
})();
