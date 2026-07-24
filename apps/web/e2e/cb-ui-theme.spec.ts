import { expect, test, type Page } from '@playwright/test'

async function loginAs(page: Page, user: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForSelector('#username', { timeout: 20_000 })
  await page.fill('#username', user)
  await page.fill('#password', user)
  await page.locator('#kc-login, button[type="submit"], input[type="submit"]').first().click()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 20_000 })
}

test('graph editor themes to the motif (dark + accent) and nodes are draggable', async ({ page }) => {
  await loginAs(page, 'requester')
  // Dark mode + emerald accent.
  await page.getByRole('button', { name: /Switch to dark mode/i }).click()
  await page.getByRole('button', { name: /Choose accent color/i }).click()
  await page.getByRole('menuitemradio', { name: 'emerald' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Graph Editor' }).click()
  await page.getByRole('button', { name: /^api-call/ }).first().click()
  const node = page.locator('.react-flow__node').first()
  await expect(node).toBeVisible()

  // Drag the node — its transform (position) must change.
  const before = await node.getAttribute('style')
  const box = await node.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + 20)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + 90, { steps: 8 })
    await page.mouse.up()
  }
  await expect.poll(async () => node.getAttribute('style')).not.toBe(before)

  // The React Flow canvas is dark (themed), not white.
  const bg = await page.locator('.react-flow').evaluate((el) => getComputedStyle(el).backgroundColor)
  // dark background => low RGB sum; a white default would be ~ (255,255,255).
  const sum = (bg.match(/\d+/g) ?? []).slice(0, 3).reduce((a, b) => a + Number(b), 0)
  expect(sum).toBeLessThan(300) // clearly not white-on-white
  await page.screenshot({ path: 'e2e/screenshots/cb-ui-03-dark-themed-canvas.png', fullPage: true })
})
