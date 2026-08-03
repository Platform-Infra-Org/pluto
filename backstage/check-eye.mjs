import { chromium } from '@playwright/test';
const JOB = process.env.CLAUDE_JOB_DIR;
const b = await chromium.launch();
const ctx = await b.newContext();
const out = {};
try {
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForTimeout(4000);
  const popupP = ctx.waitForEvent('page', { timeout: 12000 }).catch(()=>null);
  await p.getByRole('button', { name: /keycloak/i }).first().click().catch(()=>{});
  const pop = await popupP;
  if (pop) {
    await pop.waitForLoadState('domcontentloaded').catch(()=>{});
    await pop.waitForTimeout(1500);
    await pop.fill('input[name="username"]', 'admin').catch(()=>{});
    await pop.fill('input[name="password"]', 'admin').catch(()=>{});
    await Promise.all([ pop.waitForEvent('close', { timeout: 12000 }).catch(()=>{}), pop.click('input[type="submit"], button[type="submit"], #kc-login').catch(()=>{}) ]);
  }
  out.popupHandled = !!pop;
  await new Promise(r => setTimeout(r, 4000));
  // fresh page reuses the authenticated session cookies
  const f = await ctx.newPage();
  await f.goto('http://localhost:3000/create/templates/default/provision-postgres', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await f.waitForTimeout(6000);
  await f.screenshot({ path: JOB + '/tmp/form.png', fullPage: true });
  const body = await f.locator('body').innerText().catch(()=>'');
  out.signedIn = !/Sign in to continue/.test(body);
  out.hasApiKeyField = body.includes('API key');
  out.eyeButtons = await f.locator('[aria-label="Show secret"], [aria-label="Hide secret"]').count().catch(()=>0);
  out.passwordInputs = await f.locator('input[type="password"]').count().catch(()=>0);
  out.showHideText = /\b(Show|Hide)\b/.test(body) ? 'present' : 'absent';
  out.bodySnippet = body.replace(/\n+/g,' | ').slice(0,220);
} catch (e) { out.error = e.message; }
console.log(JSON.stringify(out, null, 2));
await b.close();
