import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { checkForConsoleErrors, setupConsoleErrorCollection } from './helpers';

// Known merchant with a long-standing comment history — "Maia" coffee shop,
// 9 comments, the oldest from 2024.
// WARNING: These tests depend on merchant ID 1128 keeping at least two
// comments in the API (asserted loudly below). If it gets purged, swap in
// another merchant with a stable comment history.
const COMMENTED_MERCHANT_ID = 1128;

// Wait for the comment list, then require >=2 comments so the
// non-target/negative assertions below actually prove something.
async function commentDateLinks(page: Page) {
	const dateLinks = page.locator('a[href^="#comment-"]');
	await expect(dateLinks.first()).toBeVisible();
	expect(await dateLinks.count()).toBeGreaterThan(1);
	return dateLinks;
}

test.describe('Merchant comment permalinks', () => {
	test.beforeEach(async ({ page }) => {
		setupConsoleErrorCollection(page);
	});

	test.afterEach(async ({ page }) => {
		checkForConsoleErrors(page);
	});

	test('comment dates link to matching per-comment anchors', async ({ page }) => {
		await page.goto(`/merchant/${COMMENTED_MERCHANT_ID}`);

		const dateLink = (await commentDateLinks(page)).first();
		const href = await dateLink.getAttribute('href');
		expect(href).toMatch(/^#comment-\d+$/);

		const anchorId = href?.slice(1) ?? '';
		await expect(page.locator(`[id="${anchorId}"]`)).toHaveCount(1);
		// ...and the link really sits inside the container carrying that id
		expect(await dateLink.evaluate((el, id) => el.closest(`#${id}`) !== null, anchorId)).toBe(
			true
		);
	});

	test('clicking a date updates the URL and highlights only that comment', async ({ page }) => {
		await page.goto(`/merchant/${COMMENTED_MERCHANT_ID}`);

		const dateLinks = await commentDateLinks(page);
		// Click the last comment's date; the first comment doubles as the
		// non-target below, so a highlight-everything regression fails loudly
		const firstHref = await dateLinks.first().getAttribute('href');
		const dateLink = dateLinks.last();
		const href = await dateLink.getAttribute('href');
		await dateLink.click();

		await expect.poll(() => new URL(page.url()).hash).toBe(href);
		await expect(page.locator(`[id="${href?.slice(1)}"]`)).toHaveClass(/bg-link\/10/);
		// Kit syncs the page store synchronously in its click handler, so the
		// highlight state is settled once the URL check above has passed — a
		// one-shot-free negative assertion is safe here
		await expect(page.locator(`[id="${firstHref?.slice(1)}"]`)).not.toHaveClass(/bg-link\/10/);
	});

	test('opening a comment permalink scrolls to and highlights the comment', async ({ page }) => {
		// Derive a permalink from the live page instead of hardcoding a comment id
		await page.goto(`/merchant/${COMMENTED_MERCHANT_ID}`);
		const dateLinks = await commentDateLinks(page);
		const firstHref = await dateLinks.first().getAttribute('href');
		const href = await dateLinks.last().getAttribute('href');
		expect(href).toMatch(/^#comment-\d+$/);

		// Leave the page first so the second goto is a fresh document load,
		// not a same-page fragment navigation
		await page.goto('about:blank');
		await page.goto(`/merchant/${COMMENTED_MERCHANT_ID}${href}`);

		// NOTE: this asserts the user-visible outcome. When hydration beats the
		// window load event, Chrome's native pending-fragment scroll can land
		// this even without the app's onMount fallback; the late-render path the
		// fallback exists for is not deterministically exercised here.
		const target = page.locator(`[id="${href?.slice(1)}"]`);
		await expect(target).toBeInViewport();
		await expect(target).toHaveClass(/bg-link\/10/);
		await expect(page.locator(`[id="${firstHref?.slice(1)}"]`)).not.toHaveClass(/bg-link\/10/);
	});
});
