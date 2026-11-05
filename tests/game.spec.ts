import { expect, type Locator, type Page } from "@playwright/test";
import { test, seedProgress, read } from "./progress-fixture";
import { COURSE } from "../lib/game/curriculum";
import { newProgress } from "../lib/game/progress";
import { courseForRun, shuffleSkillSections } from "../lib/game/run";
const editor = (page: Page) =>
  page.getByRole("textbox", { name: "Vim practice editor" });
async function openAt(
  page: Page,
  index = 0,
  patch: Record<string, unknown> = {},
  waitForEditor = true,
) {
  const state = {
    ...newProgress(),
    courseIndex: index,
    ...patch,
  };
  await seedProgress(page, state);
  await page.goto("/");
  if (waitForEditor) {
    await expect(editor(page)).toBeVisible();
    await editor(page).focus();
  }
}
async function keys(page: Page, steps: string[]) {
  for (const key of steps) {
    if (key === "<Esc>") await page.keyboard.press("Escape");
    else if (key === "<C-r>") await page.keyboard.press("Control+r");
    else if (key === "<C-o>") await page.keyboard.press("Control+o");
    else if (key === "<C-i>") await page.keyboard.press("Control+i");
    else
      await page.keyboard.press(
        key === " " ? "Space" : key === "\n" || key === "<CR>" ? "Enter" : key,
      );
  }
}
test("worm game uses hjkl controls and can return to practice", async ({ context }) => {
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Play Worm" }).click();
  await expect(page.getByRole("img", { name: /Worm game board/ })).toBeVisible();
  await expect(page.getByText("Movement drill", { exact: false })).toHaveCount(0);
  await expect(page.getByText("fruit", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exit Worm" })).toContainText("escBack");
  await expect(page.getByRole("button", { name: "Back to practice" })).toContainText("hjkl");
  await expect(page.getByText("Controls", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Choose a direction to begin.")).toHaveCount(0);
  await expect(page.getByText("Paused.", { exact: false })).toHaveCount(0);
  await expect(page.locator(".worm-controls")).toContainText("space pause");
  await expect(page.locator(".worm-page > .worm-shell + .worm-controls")).toBeVisible();
  await expect(page.locator(".worm-marker")).toHaveCount(425);

  await page.keyboard.press("l");
  await expect(page.getByRole("img", { name: /Score 1\./ })).toBeVisible({
    timeout: 2500,
  });
  await expect
    .poll(
      async () => Number(await page.locator(".worm-head").getAttribute("data-x")),
      { intervals: [10], timeout: 2500 },
    )
    .toBe(23);
  await expect
    .poll(
      async () => Number(await page.locator(".worm-head").getAttribute("data-x")),
      { intervals: [10], timeout: 2500 },
    )
    .toBe(0);
  await page.keyboard.press("Space");
  await expect(page.locator(".worm-page")).toHaveAttribute("data-state", "paused");

  await page.keyboard.press("k");
  await expect
    .poll(
      async () => Number(await page.locator(".worm-head").getAttribute("data-y")),
      { intervals: [10], timeout: 1000 },
    )
    .toBe(7);
  await page.keyboard.press("Space");
  await expect(page.locator(".worm-page")).toHaveAttribute("data-state", "paused");
  await page.keyboard.press("h");
  await expect
    .poll(
      async () => Number(await page.locator(".worm-head").getAttribute("data-x")),
      { intervals: [10], timeout: 1000 },
    )
    .toBe(23);
  await page.keyboard.press("Space");
  await expect(page.locator(".worm-page")).toHaveAttribute("data-state", "paused");
  await page.keyboard.press("j");
  await expect(page.locator("#worm-status")).toContainText("Game over", {
    timeout: 2500,
  });
  await expect(page.locator(".worm-shell #worm-status")).toBeVisible();
  await expect(page.locator("#worm-status")).not.toContainText("collected");

  await page.keyboard.press("r");
  await expect(page.getByRole("img", { name: /Score 0\./ })).toBeVisible();
  await page.getByRole("button", { name: "Back to practice" }).click();
  await expect(page.locator(".selection-page")).toBeVisible();
});
test("first press wins once, reload starts over", async ({
  page,
}) => {
  await page.goto("/");
  await expect(editor(page)).toHaveText("helloo");
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press("x");
  await expect.poll(async () => (await read(page)).courseIndex).toBe(1);
  await expect(
    page.getByRole("heading", { name: COURSE[1].goal, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".demonstration")).toHaveCount(0, {
    timeout: 10000,
  });
  expect((await read(page)).courseIndex).toBe(1);
  expect((await read(page)).attempts).toHaveLength(1);
  await page.reload();
  await expect.poll(async () => (await read(page)).attempts.length).toBe(0);
  await expect(
    page.getByRole("heading", { name: "Delete the extra o." }),
  ).toBeVisible();
});
test("all authored puzzles validate against the Vim engine", async ({
  page,
}) => {
  await openAt(page);
  const results = await page.evaluate(async () => {
    // @ts-expect-error Vite browser module imports
    const { VARIANTS, COURSE } = await import("/lib/game/curriculum.ts");
    // @ts-expect-error Vite browser module imports
    const { GameEditor, isolateVim } = await import("/lib/game/editor.ts");
    // @ts-expect-error Vite browser module imports
    const { evaluate } = await import("/lib/game/engine.ts");
    const failures = [];
    const restore = isolateVim();
    for (const p of new Map(
      [...VARIANTS, ...COURSE].map((p) => [p.id, p]),
    ).values()) {
      const parent = document.createElement("div");
      parent.className = "editor-host";
      parent.style.cssText =
        "position:fixed;left:0;top:0;width:1000px;min-height:300px;background:black;z-index:999";
      document.body.appendChild(parent);
      const game = new GameEditor({
        puzzle: p,
        parent,
        onChange: () => {},
        onNudge: () => {},
        locked: () => false,
      });
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      for (const key of p.solutionKeys) game.feed(key);
      const snap = game.snapshot();
      if (!evaluate(p, snap).complete)
        failures.push({
          id: p.id,
          expected: p.target,
          actual: snap.document,
          mode: snap.mode,
          evidence: snap.evidence,
          command: snap.lastCommand,
          selection: snap.selection,
        });
      game.destroy();
      parent.remove();
    }
    restore();
    return failures;
  });
  expect(results).toEqual([]);
});
test("correct text in Insert advances automatically and retains observed technique", async ({
  page,
}) => {
  await openAt(page, 6);
  await keys(page, ["c", "i", "w", ..."toma"]);
  await expect(page.locator(".editor-panel")).toHaveAttribute(
    "data-mode",
    "insert",
  );
  expect((await read(page)).courseIndex).toBe(6);
  await keys(page, [..."to"]);
  await expect.poll(async () => (await read(page)).courseIndex).toBe(7);
  expect((await read(page)).attempts.at(-1)!.demonstrated).toContain("word");
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", "word-1");
  await expect(page.locator(".editor-panel")).toHaveAttribute(
    "data-mode",
    "normal",
  );
});

test("navigation suggestions stay optional and undo recovery remains available", async ({
  page,
}) => {
  await openAt(page, 7);
  const cursorBefore = await page.locator(".cm-fat-cursor").boundingBox();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await page.locator(".cm-fat-cursor").boundingBox())?.x)
    .toBeGreaterThan(cursorBefore!.x);
  await expect(page.getByRole("status")).toHaveCount(0);
  await keys(page, ["d", "d"]);
  await expect(page.getByRole("status")).toContainText("Off track. Press u to undo.");
  await page.getByRole("button", { name: "u Undo", exact: true }).click();
  await expect(editor(page)).toHaveText("send cake tonight");
  await keys(page, ["0", ...Array(5).fill("ArrowRight"), "c", "w", ..."pizza"]);
  await expect.poll(async () => (await read(page)).courseIndex).toBe(8);
  expect((await read(page)).attempts.at(-1)!.demonstrated).not.toContain("word");
});

for (const [index, assistance] of [[2, "prompted"], [4, "independent"]] as const)
  test(`${assistance} lessons show no undo prompt after a mistake`, async ({ page }) => {
    expect(COURSE[index].assistance).toBe(assistance);
    await openAt(page, index);
    await keys(page, ["0", "x"]);
    await expect(editor(page)).not.toHaveText(COURSE[index].initial);
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.locator(".next-cue")).toHaveCount(0);
  });

test("an independent puzzle accepts replacing the whole buffer", async ({
  page,
}) => {
  await openAt(page, 4);
  await keys(page, ["g", "g", "d", "d", "i", ...COURSE[4].target, "<Esc>"]);
  await expect.poll(async () => (await read(page)).courseIndex).toBe(5);
  expect((await read(page)).attempts.at(-1)!.demonstrated).not.toContain("typo");
});
test("Visual selection works in both directions and undo clears evidence", async ({
  page,
}) => {
  await openAt(page, 18);
  await keys(page, ["v", "l", "l", "l", "l"]);
  await expect(page.locator(".editor-panel")).toHaveAttribute(
    "data-mode",
    "visual",
  );
  await page.keyboard.press("d");
  await expect.poll(async () => (await read(page)).courseIndex).toBe(19);
  await expect(
    page.getByRole("heading", { name: COURSE[19].goal }),
  ).toBeVisible();
  await keys(page, COURSE[19].solutionKeys);
  await expect.poll(async () => (await read(page)).courseIndex).toBe(20);
});
test("text hints preserve a changed attempt and never play a demonstration", async ({
  page,
}) => {
  await openAt(page, 24);
  await keys(page, ["d", "d"]);
  const text = await editor(page).innerText();
  await editor(page).focus();
  await page.keyboard.press("Escape");
  await page.keyboard.type(":help");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Get a hint", exact: true }).click();
  await page.getByRole("button", { name: "Show next step" }).click();
  await expect(page.locator(".hint-box")).toContainText("Press p.");
  await expect(page.getByRole("button", { name: /Show me how|Watch again|Show next step/ })).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "playing");
  await expect(editor(page)).toBeFocused();
  await expect(page.locator(".demonstration")).toHaveCount(0);
  await expect.poll(() => editor(page).innerText()).toBe(text);
  expect((await read(page)).attempts).toHaveLength(0);
  await keys(page, ["p"]);
  await expect.poll(async () => (await read(page)).courseIndex).toBe(25);
});
test("reload clears unfinished text and hints", async ({
  page,
}) => {
  await page.goto("/");
  await expect(editor(page)).toBeVisible();
  await keys(page, ["i", ..."test"]);
  await editor(page).focus();
  await page.keyboard.press("Escape");
  await page.keyboard.type(":help");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Get a hint", exact: true }).click();
  await expect.poll(async () => (await read(page)).active!.hints).toBe(1);
  await page.reload();
  await expect(editor(page)).toHaveText("helloo");
  await expect(page.locator(".editor-panel")).toHaveAttribute(
    "data-mode",
    "normal",
  );
  await expect(page.locator(".hint-box")).toHaveCount(0);
  expect((await read(page)).attempts).toHaveLength(0);
});
test("complete shuffled journey through actual keyboard input", async ({ page }) => {
  test.setTimeout(360000);
  const sectionOrder = shuffleSkillSections(() => 0.37);
  const { COURSE, SECTIONS } = courseForRun(sectionOrder);
  await openAt(page, 0, { sectionOrder });
  for (let i = 0; i < COURSE.length; i++) {
    await expect(page.locator("main")).toHaveAttribute(
      "data-puzzle",
      COURSE[i].id,
    );
    await expect(page.locator("main")).toHaveAttribute("data-phase", "playing");
    await expect(page.locator(".demonstration")).toHaveCount(0);
    await editor(page).focus();
    await keys(page, COURSE[i].solutionKeys);
    await expect
      .poll(async () => (await read(page)).courseIndex, {
        message: `Puzzle ${i}: ${COURSE[i].id}`,
      })
      .toBe(i + 1);
    if (SECTIONS.some((section) => section.end === i + 1)) {
      await expect(page.locator(".level-finish")).toBeVisible();
      if (i < COURSE.length - 1)
        await page.keyboard.press(i % 12 === 5 ? "Enter" : "l");
    }
  }
  await expect(
    page.getByRole("heading", { name: "You’re an editor now." }),
  ).toBeVisible();
  expect((await read(page)).attempts).toHaveLength(COURSE.length);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Choose practice skills_" }),
  ).toBeVisible();
  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-kind", "lesson");
});
test("responsive layout, focus navigation, reduced motion and settings", async ({
  page,
}, info) => {
  await openAt(page);
  await page.screenshot({
    path: `work/qa/${info.project.name}-desktop.png`,
    fullPage: true,
  });
  await page.keyboard.press("Tab");
  await expect(editor(page)).not.toBeFocused();
  await editor(page).focus();
  await page.keyboard.press("Escape");
  await page.keyboard.type(":help");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "More options", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("switch", { name: "Completion sound" }).click();
  await expect(
    page.getByRole("switch", { name: "Completion sound" }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Outline cursor" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Desktop required_" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: `work/qa/${info.project.name}-phone.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 900, height: 650 });
  await expect(editor(page)).toBeVisible();
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await expect
    .poll(() =>
      page.evaluate(() => {
        const range = document.createRange();
        const text = document.querySelector(".cm-line")!.firstChild!;
        range.setStart(text, 5);
        range.setEnd(text, 6);
        const cursor = document.querySelector(".cm-fat-cursor")!;
        return Math.abs(
          cursor.getBoundingClientRect().left -
            range.getBoundingClientRect().left,
        );
      }),
    )
    .toBeLessThan(1);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
test("long real-world files scroll inside the editor and keep jumps visible", async ({
  page,
}) => {
  const index = COURSE.findIndex((p) => p.id === "match-0");
  await openAt(page, index);
  const panel = page.locator(".editor-panel");
  const scroller = page.locator(".cm-scroller");
  await expect(panel).toHaveClass(/long-editor/);
  const viewport = await scroller.boundingBox();
  const content = await page.locator(".cm-content").boundingBox();
  expect(viewport!.height).toBeLessThan(content!.height);
  await page.keyboard.press("%");
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
for (const index of [1, 6, 37]) {
  test(`lesson ${COURSE[index].id} starts ready to edit with text guidance`, async ({ page }) => {
    await openAt(page, index);
    await expect(page.locator("main")).toHaveAttribute("data-phase", "playing");
    await expect(page.locator(".demonstration")).toHaveCount(0);
    await expect(page.locator(".next-cue")).toBeVisible();
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveText(COURSE[index].initial, { useInnerText: true });
    expect((await read(page)).attempts).toHaveLength(0);
    await keys(page, COURSE[index].solutionKeys);
    await expect.poll(async () => (await read(page)).courseIndex).toBe(index + 1);
  });
}
test("a held completion key cannot spill into the next puzzle", async ({
  page,
}) => {
  await openAt(page);
  await page.keyboard.down("x");
  await expect(
    page.getByRole("heading", { name: COURSE[1].goal, exact: true }),
  ).toBeVisible();
  await page.keyboard.down("x");
  await expect(editor(page)).toHaveText(COURSE[1].initial);
  await page.keyboard.up("x");
  await keys(page, COURSE[1].solutionKeys);
  await expect.poll(async () => (await read(page)).courseIndex).toBe(2);
});

test("opening exposes only the task, text and key cue", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Delete the extra o.", exact: true }),
  ).toBeVisible();
  await expect(editor(page)).toHaveText("helloo");
  await expect(page.locator(".first-key")).toHaveCount(0);
  await expect(page.locator(".next-cue kbd")).toHaveText("x");
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("link")).toHaveCount(0);
  await expect(
    page.locator(
      "header, footer, .command-guide, .chapter-track, .mode-tabs, .current-mode",
    ),
  ).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});

test("guided cues follow typing and disappear as soon as the text is correct", async ({
  page,
}) => {
  await openAt(page, 6);
  const cue = page.locator(".next-cue kbd");
  await expect(cue).toHaveText("ciw");
  await keys(page, ["c", "i", "w"]);
  await expect(cue).toHaveText("tomato");
  await keys(page, [..."tom"]);
  await expect(cue).toHaveText("ato");
  await keys(page, [..."ato"]);
  await expect(cue).toHaveCount(0);
  await expect(page.getByRole("heading")).toHaveText("Good edit.");
  await expect.poll(async () => (await read(page)).courseIndex).toBe(7);
});

test("single-action cues can solve every prompted lesson through the real engine", async ({
  page,
}) => {
  await openAt(page);
  const failures = await page.evaluate(async () => {
    // @ts-expect-error Vite browser module import
    const { VARIANTS } = await import("/lib/game/curriculum.ts");
    // @ts-expect-error Vite browser module import
    const { GameEditor, isolateVim } = await import("/lib/game/editor.ts");
    // @ts-expect-error Vite browser module import
    const { evaluate } = await import("/lib/game/engine.ts");
    // @ts-expect-error Vite browser module import
    const { nextCue } = await import("/lib/game/coaching.ts");
    const failures = [];
    const restore = isolateVim();
    for (const puzzle of VARIANTS.filter(
      (p: { assistance: string }) => p.assistance !== "independent",
    )) {
      const parent = document.createElement("div");
      parent.className = "editor-host";
      parent.style.cssText =
        "position:fixed;top:0;left:0;width:1000px;z-index:999";
      document.body.appendChild(parent);
      const game = new GameEditor({
        puzzle,
        parent,
        locked: () => false,
        onChange: () => {},
        onNudge: () => {},
      });
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const actions = [];
      for (
        let i = 0;
        i < 60 && !evaluate(puzzle, game.snapshot()).complete;
        i++
      ) {
        const cue = nextCue(puzzle, game.snapshot());
        actions.push(cue.key);
        if (!cue.key) break;
        for (const key of cue.key.match(/<[^>]+>|[\s\S]/g) ?? [])
          game.feed(key);
      }
      if (!evaluate(puzzle, game.snapshot()).complete)
        failures.push({ id: puzzle.id, actions, snapshot: game.snapshot() });
      game.destroy();
      parent.remove();
    }
    restore();
    return failures;
  });
  expect(failures).toEqual([]);
});

for (const index of [0, 6, 12, 18, 24]) {
  test(`guided ${COURSE[index].skill} lesson accepts a different edit without technique credit`, async ({
    page,
  }) => {
    await openAt(page, index);
    const p = COURSE[index];
    const alternative =
      index === 0
        ? ["X"]
        : index === 6
          ? ["c", "w", ..."tomato"]
          : index === 12
            ? ["V", "d"]
            : index === 18
              ? ["d", "w"]
              : ["g", "g", "d", "G", "i", ...p.target];
    await keys(page, alternative);
    await expect
      .poll(async () => (await read(page)).courseIndex)
      .toBe(index + 1);
    expect((await read(page)).attempts).toHaveLength(1);
    expect((await read(page)).attempts[0].demonstrated).not.toContain(p.skill);
  });
}

test("a resumed correct attempt advances once without redoing the suggested action", async ({
  page,
}) => {
  const state = {
    ...newProgress(),
    courseIndex: 7,
    active: {
      puzzleId: COURSE[7].id,
      document: COURSE[7].target,
      cursor: 8,
      hints: 1,
    },
  };
  await seedProgress(page, state);
  await page.goto("/");
  await expect.poll(async () => (await read(page)).courseIndex).toBe(8);
  await expect(page.locator("main")).toHaveAttribute(
    "data-puzzle",
    COURSE[8].id,
  );
  expect((await read(page)).attempts).toHaveLength(1);
  expect((await read(page)).attempts[0].demonstrated).toEqual([]);
});

test("pasting correct text in a guided lesson passes without claiming a Vim technique", async ({
  page,
}) => {
  await openAt(page, 6);
  await keys(page, ["c", "i", "w"]);
  await editor(page).evaluate((element) => {
    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", "tomato");
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: clipboard,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect.poll(async () => (await read(page)).courseIndex).toBe(7);
  expect((await read(page)).attempts[0].demonstrated).toEqual([]);
});

for (const [index, expected, absent] of [
  [0, "x", "ciw"],
  [6, "ciw", "dd"],
  [12, "dd", "v"],
  [18, "v", "p"],
  [24, "p", "ciw"],
  [30, "ciw", ""],
  [36, "p", ""],
] as const) {
  test(`:help shows commands and examples for ${COURSE[index].id}`, async ({
    page,
  }) => {
    await openAt(page, index);
    await page.keyboard.type(":help");
    await page.keyboard.press("Enter");
    const help = page.getByRole("dialog");
    await expect(help).toBeVisible();
    await expect(help.locator(`[data-command="${expected}"]`)).toBeVisible();
    if (absent)
      await expect(help.locator(`[data-command="${absent}"]`)).toHaveCount(0);
    for (const example of await help.locator(".command-example").all()) {
      await expect(example).not.toHaveText("");
    }
    await expect(help).toContainText("q");
    await page.keyboard.press(index % 12 === 0 ? "Escape" : "q");
    await expect(help).toHaveCount(0);
    await expect(editor(page)).toBeFocused();
    await expect
      .poll(() => editor(page).innerText())
      .toBe(COURSE[index].initial);
    expect((await read(page)).courseIndex).toBe(index);
    expect((await read(page)).attempts).toHaveLength(0);
  });
}

test(":help preserves changed text, cursor, undo and cut text", async ({
  page,
}) => {
  await openAt(page, 24);
  await keys(page, ["d", "d"]);
  const changed = await editor(page).innerText();
  const cursor = await page.locator(".cm-fat-cursor").boundingBox();
  await page.keyboard.type(":help");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.down("q");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.down("q"); // held close key must not start a Vim macro
  await page.keyboard.up("q");
  await expect.poll(() => editor(page).innerText()).toBe(changed);
  await expect
    .poll(async () => (await page.locator(".cm-fat-cursor").boundingBox())?.x)
    .toBe(cursor!.x);
  await page.keyboard.press("u");
  await expect.poll(() => editor(page).innerText()).toBe(COURSE[24].initial);
  await keys(page, ["d", "d"]);
  await page.keyboard.type(":help");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("q");
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press("p");
  await expect.poll(async () => (await read(page)).courseIndex).toBe(25);
});

test("help and next-level shortcuts leave normal editing and Insert text intact", async ({
  page,
}) => {
  await openAt(page, 6);
  await page.keyboard.press("l");
  expect((await read(page)).courseIndex).toBe(6);
  await keys(page, ["c", "i", "w", ...":help"]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(editor(page)).toHaveText(":help soup");
  await page.keyboard.press("Enter");
  expect((await read(page)).courseIndex).toBe(6);
  await expect(page.locator(".editor-panel")).toHaveAttribute(
    "data-mode",
    "insert",
  );
});

test("Enter and l continue completed levels once and return editor focus", async ({
  page,
}) => {
  await openAt(page, 6, { celebration: 0 }, false);
  const button = page.getByRole("button", { name: "Keep going", exact: true });
  await expect(button).toBeFocused();
  await page.keyboard.down("l");
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", "word-0");
  await expect(editor(page)).toBeFocused();
  const cursor = await page.locator(".cm-fat-cursor").boundingBox();
  await page.keyboard.down("l");
  await expect
    .poll(async () => (await page.locator(".cm-fat-cursor").boundingBox())?.x)
    .toBe(cursor!.x);
  await page.keyboard.up("l");
  await page.keyboard.press("l");
  await expect
    .poll(async () => (await page.locator(".cm-fat-cursor").boundingBox())?.x)
    .toBeGreaterThan(cursor!.x);
  expect((await read(page)).courseIndex).toBe(6);
});

test("help can scroll and open its options entirely from the keyboard", async ({
  page,
}) => {
  await openAt(page, 36);
  await page.setViewportSize({ width: 800, height: 650 });
  await page.keyboard.type(":help");
  await page.keyboard.press("Enter");
  const body = page.getByLabel("Commands for this level");
  await expect(body).toBeFocused();
  await page.keyboard.press("j");
  await expect.poll(() => body.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("k");
  await expect.poll(() => body.evaluate((e) => e.scrollTop)).toBe(0);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Get a hint", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "More options", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "What do you need?" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor(page)).toBeFocused();
});

test("every sidebar control is reachable with h j k l", async ({ page }) => {
  await openAt(page, 36);
  await page.setViewportSize({ width: 800, height: 650 });
  await page.keyboard.type(":help");
  await page.keyboard.press("Enter");
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const pressUntilFocused = async (key: string, target: string | Locator) => {
    const element = typeof target === "string" ? button(target) : target;
    for (let i = 0; i < 30; i++) {
      if (await element.evaluate((e) => e === document.activeElement)) return;
      await page.keyboard.press(key);
    }
    await expect(element).toBeFocused();
  };
  // j scrolls the command list to its end, then moves onto the buttons.
  await pressUntilFocused("j", "Get a hint");
  await page.keyboard.press("l");
  await expect(button("More options")).toBeFocused();
  await page.keyboard.press("h");
  await expect(button("Get a hint")).toBeFocused();
  await page.keyboard.press("l");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "What do you need?" })).toBeVisible();
  await pressUntilFocused("j", "Command guide");
  await page.keyboard.press("j");
  await expect(button("Your journey")).toBeFocused();
  await page.keyboard.press("Enter");
  await pressUntilFocused("j", "Choose practice skills");
  await page.keyboard.press("Enter");
  const first = page.getByRole("checkbox").first();
  await pressUntilFocused("j", first);
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  await page.keyboard.press("j");
  await expect(page.getByRole("checkbox").nth(1)).toBeFocused();
  await page.keyboard.press("k");
  await page.keyboard.press("k");
  await expect(button("Select all")).toBeFocused();
  await page.keyboard.press("l");
  await expect(button("Clear all")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(first).not.toBeChecked();
});

test("independent challenges show the goal without guidance until a hint is requested", async ({ page }) => {
  await openAt(page, 4);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "playing");
  await expect(page.locator(".next-cue, .hint-box, .demonstration")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: COURSE[4].goal })).toBeVisible();
  await keys(page, [...":help", "<CR>"]);
  await page.getByRole("button", { name: "Get a hint", exact: true }).click();
  await expect(page.locator(".hint-box")).toContainText(COURSE[4].explanation);
  await expect(editor(page)).toBeFocused();
  await keys(page, COURSE[4].solutionKeys);
  await expect.poll(async () => (await read(page)).courseIndex).toBe(5);
});

test(":help on a completed level cannot trigger the l continuation shortcut", async ({
  page,
}) => {
  await openAt(page, 6, { celebration: 0 }, false);
  await expect(
    page.getByRole("button", { name: "Keep going", exact: true }),
  ).toBeFocused();
  await page.keyboard.type(":help");
  await expect(page.getByRole("textbox", { name: "Game command" })).toHaveValue(
    "help",
  );
  expect((await read(page)).celebration).toBe(0);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Fix a typo");
  await page.keyboard.press("q");
  await expect(
    page.getByRole("button", { name: "Keep going", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", "word-0");
  await expect(editor(page)).toBeFocused();
});
for (const [index, assistance] of [[2, "prompted"], [4, "independent"]] as const)
  test(`opt-in undo reminders cover ${assistance} edits`, async ({ page }) => {
    expect(COURSE[index].assistance).toBe(assistance);
    await openAt(page, index, {
      settings: { ...newProgress().settings, undoReminders: true },
    });
    await keys(page, ["d", "d"]);
    await expect(page.getByRole("status")).toHaveText("Off track. Press u to undo.");
    await page.getByRole("button", { name: "u Undo", exact: true }).click();
    await expect(editor(page)).toHaveText(COURSE[index].initial);
    await expect(page.getByRole("status")).toHaveCount(0);
    await keys(page, ["c", "c", ...COURSE[index].target, "<Esc>"]);
    await expect.poll(async () => (await read(page)).courseIndex).toBe(index + 1);
    // Prompted edits are always assisted; an independent edit becomes assisted once reminded.
    expect((await read(page)).attempts.at(-1)!.assisted).toBe(true);
  });
test("undo reminders stay quiet for a change that moves toward the goal", async ({ page }) => {
  await openAt(page, 4, {
    settings: { ...newProgress().settings, undoReminders: true },
  });
  await keys(page, COURSE[4].solutionKeys);
  await expect.poll(async () => (await read(page)).courseIndex).toBe(5);
  expect((await read(page)).attempts.at(-1)!.assisted).toBe(false);
});
