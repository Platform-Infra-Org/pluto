// Dev-only visual check. Usage:
//   node scripts/screenshot.mjs <outDir> [selector=body] [url=http://localhost:3000/]
// Captures at 6x so pixel edges are inspectable, and reports console errors.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const [outDir, selector = 'body', url = 'http://localhost:3000/'] =
  process.argv.slice(2);
if (!outDir) throw new Error('usage: screenshot.mjs <outDir> [selector] [url]');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 6 });
const errors = [];
page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
page.on(
  'console',
  m => m.type() === 'error' && errors.push(m.text().slice(0, 200)),
);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForSelector(selector, { timeout: 30000 });
await page.waitForTimeout(1500);
const name =
  selector.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'body';
await page.locator(selector).first().screenshot({ path: `${outDir}/${name}.png` });
console.log(JSON.stringify({ shot: `${outDir}/${name}.png`, errors }, null, 2));
await browser.close();
