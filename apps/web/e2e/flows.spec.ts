import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots')
const shot = (name: string) => path.join(SHOTS, name)

// Drive the real OIDC Authorization-Code + PKCE login: SPA -> Keycloak form ->
// /auth/callback -> principal loaded from /api/me. Token is in-memory, so each
// test's fresh context re-logs in from scratch (no reload mid-flow).
async function loginAs(page: Page, user: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Login' }).click()

  // Keycloak login page.
  await page.waitForSelector('#username', { timeout: 20_000 })
  await page.fill('#username', user)
  await page.fill('#password', user)
  await page.locator('#kc-login, button[type="submit"], input[type="submit"]').first().click()

  // Back in the SPA: the Logout control only renders once the principal loaded.
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 20_000 })
}

// Client-side (SPA) navigation — NOT page.goto(). The access token lives only in
// module memory, so a hard document load would wipe it and drop the session.
// TanStack Router listens on popstate, so pushState + popstate routes in-app
// while keeping the same document (and the token).
async function clientNav(page: Page, to: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, to)
}

test('01+02 admin login + dashboard', async ({ page }) => {
  await loginAs(page, 'admin')

  // Header reflects a logged-in admin (username shown next to Logout).
  await expect(page.locator('header')).toContainText('admin')
  await page.screenshot({ path: shot('01-admin-login.png'), fullPage: true })

  // Admin dashboard: shell heading + overview tiles.
  await clientNav(page, '/admin')
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page.getByText('Pending approval')).toBeVisible()
  await expect(page.getByText('Workflow success rate')).toBeVisible()
  await page.screenshot({ path: shot('02-admin-dashboard.png'), fullPage: true })
})

test('03+04 requester catalog + resource detail', async ({ page }) => {
  await loginAs(page, 'requester')

  // Catalog list: seeded resources for the payments team render as rows.
  await clientNav(page, '/resources')
  await expect(page.getByRole('heading', { name: 'My Resources' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'payments-exports' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'payments-primary' })).toBeVisible()
  await page.screenshot({ path: shot('03-requester-catalog.png'), fullPage: true })

  // Resource detail renders (name heading + Raw JSON section).
  await clientNav(page, '/resources/1')
  await expect(page.getByRole('heading', { name: 'payments-exports' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Raw JSON' })).toBeVisible()
  await page.screenshot({ path: shot('04-request-form-or-detail.png'), fullPage: true })
})

test('05 auditor read-only (no approve/reject controls)', async ({ page }) => {
  await loginAs(page, 'auditor')

  // Approval queue: server-filtered to approvers, so the auditor gets no items
  // and NO mutate controls.
  await clientNav(page, '/requests/queue')
  await expect(page.getByRole('heading', { name: 'Approval Queue' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0)
  await page.screenshot({ path: shot('05-auditor-readonly.png'), fullPage: true })

  // Auditor can READ a pending request's detail (proving data is visible, the
  // empty queue isn't just a broken page) but the detail exposes no mutate
  // controls either.
  await clientNav(page, '/requests/1')
  await expect(page.getByRole('heading', { name: /#1 UPDATE bucket/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0)
  await page.screenshot({ path: shot('05b-auditor-request-detail.png'), fullPage: true })
})
