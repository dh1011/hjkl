import { test as base, type Page } from "@playwright/test";
import type { ProgressState } from "../lib/game/types";
import { DEFAULT_SECTION_ORDER } from "../lib/game/run";

declare global {
  interface Window {
    testInitialProgress?: ProgressState;
    testProgress?: { current: ProgressState };
  }
}

// Instrument only the test server response, keeping test controls out of the app.
export const test = base.extend<{ randomizedCourse: boolean }>({
  randomizedCourse: [false, { option: true }],
  page: async ({ page, randomizedCourse }, run) => {
    await page.route("**/lib/game/progress.ts*", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + `
const originalInitializeProgress = initializeProgress;
initializeProgress = function (progress) {
  originalInitializeProgress(progress);
  if (window.testInitialProgress) progress.current = structuredClone(window.testInitialProgress);
  else if (!${randomizedCourse}) progress.current.sectionOrder = ${JSON.stringify(DEFAULT_SECTION_ORDER)};
  window.testProgress = progress;
};`,
      });
    });
    // Direct lesson tests bypass the picker; context-created pages test the real entry flow.
    await page.route("**/app/page.tsx*", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace(/(\[landing, setLanding\] = (?:useState|[^;]*?useState\))\()true\)/, "$1false)"),
      });
    });
    await run(page);
  },
});

export async function seedProgress(page: Page, state: ProgressState) {
  await page.addInitScript((initial) => {
    window.testInitialProgress = initial;
  }, state);
}

export async function read(page: Page) {
  await page.waitForFunction(() => window.testProgress?.current);
  return page.evaluate(() => window.testProgress!.current);
}
