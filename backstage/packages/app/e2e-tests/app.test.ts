/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from '@playwright/test';

test('App should render the welcome page', async ({ page }) => {
  await page.goto('/');

  const signInButton = page.getByRole('button', {
    name: 'Sign in with Keycloak',
  });
  await expect(signInButton).toBeVisible();

  const popupPromise = page.waitForEvent('popup');
  await signInButton.click();
  const popup = await popupPromise;
  await popup.getByLabel('Username or email').fill('admin');
  await popup.getByRole('textbox', { name: 'Password' }).fill('admin');
  await popup.getByRole('button', { name: 'Sign In' }).click();
  await popup.waitForEvent('close');

  await expect(
    page.getByRole('link', { name: 'Catalog', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'APIs', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Notifications/ })).toContainText(
    '5',
  );
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible();
});
