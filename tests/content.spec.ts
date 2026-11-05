import { expect, type Page } from "@playwright/test";
import { test, seedProgress, read } from "./progress-fixture";
import {
  COURSE,
  VARIANTS,
  SKILLS,
  SKILL_METADATA,
  SECTIONS,
  UNLOCKS,
  PUZZLES,
} from "../lib/game/curriculum";
import { newProgress, SESSION_GAP } from "../lib/game/progress";
import { helpForPuzzle } from "../lib/game/help";
import { nextCue, documentGoal } from "../lib/game/coaching";
import type { EditorSnapshot } from "../lib/game/types";

const editor = (page: Page) =>
  page.getByRole("textbox", { name: "Vim practice editor" });
async function openAt(page: Page, index: number, patch = {}) {
  const state = {
    ...newProgress(),
    courseIndex: index,
    ...patch,
  };
  await seedProgress(page, state);
  await page.goto("/");
}
async function play(page: Page, steps: string[]) {
  for (const key of steps)
    await page.keyboard.press(
      key === "<Esc>"
        ? "Escape"
        : key === "<CR>"
          ? "Enter"
          : key === " "
            ? "Space"
            : key,
    );
}
async function openPracticePicker(page: Page) {
  await editor(page).focus();
  await play(page, [...":help", "<CR>"]);
  await page.getByRole("button", { name: "More options", exact: true }).click();
  await page.getByRole("button", { name: "Your journey", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose practice skills", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Choose practice skills_" }),
  ).toBeVisible();
}

test("course sections, content and help cover the course", () => {
  expect(COURSE).toHaveLength(117);
  expect(Object.keys(PUZZLES)).toHaveLength(201);
  expect(VARIANTS).toHaveLength(192);
  expect(new Set(COURSE.map((p) => p.id)).size).toBe(117);
  expect(COURSE[36]).toMatchObject({
    id: "final-document",
    kind: "checkpoint",
  });
  expect(COURSE[37].id).toBe("insert-0");
  expect(COURSE.at(-1)?.kind).toBe("final");
  expect(UNLOCKS).toEqual({ paper: 6, cursor: 36, effect: 37 });
  expect(SECTIONS.flatMap((s) => COURSE.slice(s.start, s.end))).toEqual(COURSE);
  for (const skill of SKILLS) {
    const variants = VARIANTS.filter((p) => p.skill === skill);
    expect(variants).toHaveLength(12);
    expect(variants.slice(0, 6).map((p) => p.assistance)).toEqual([
      "guided",
      "guided",
      "prompted",
      "prompted",
      "independent",
      "independent",
    ]);
  }
  for (const skill of ["match", "jump", "mark"] as const) {
    const practice = VARIANTS.filter(
      (puzzle) =>
        puzzle.skill === skill && Number(puzzle.id.split("-").at(-1)) >= 6,
    );
    expect(practice).toHaveLength(6);
    for (const puzzle of practice) {
      expect(puzzle.initial.split("\n").length).toBeGreaterThanOrEqual(15);
      expect(
        puzzle.target
          .split("\n")
          .filter((line, index) => line !== puzzle.initial.split("\n")[index])
          .length,
      ).toBeGreaterThanOrEqual(2);
    }
  }
  for (const puzzle of Object.values(PUZZLES)) {
    expect(puzzle.initial).not.toBe(puzzle.target);
    expect(puzzle.cursor).toBeGreaterThanOrEqual(0);
    expect(puzzle.cursor).toBeLessThan(puzzle.initial.length);
    expect(puzzle.solutionKeys.length).toBeGreaterThan(0);
  }
  expect(helpForPuzzle(COURSE[36]).commands.map((c) => c.key)).not.toContain(
    ".",
  );
  expect(helpForPuzzle(COURSE[30]).commands.map((c) => c.key)).toContain("ciw");
  expect(helpForPuzzle(COURSE.at(-1)!).commands.map((c) => c.key)).toEqual(
    expect.arrayContaining([".", "?", "ci(", "3p", "yy", "%", "ctrl-o", "ma"]),
  );
});

test("solution keys prove their skill and keep simulated evidence isolated", async ({
  page,
}) => {
  await openAt(page, 37);
  await expect(editor(page)).toBeVisible();
  const failures = await page.evaluate(async () => {
    // @ts-expect-error Vite browser module imports
    const { VARIANTS } = await import("/lib/game/curriculum.ts");
    // @ts-expect-error Vite browser module imports
    const { GameEditor, isolateVim } = await import("/lib/game/editor.ts");
    const failures = [];
    for (const puzzle of VARIANTS) {
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      const game = new GameEditor({
        puzzle,
        parent,
        onChange() {},
        onNudge() {},
        locked: () => false,
      });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      for (const key of puzzle.solutionKeys) game.feed(key);
      const snap = game.snapshot();
      if (
        !snap.evidence.some((e: { skill: string }) => e.skill === puzzle.skill)
      )
        failures.push({
          id: puzzle.id,
          evidence: snap.evidence,
          command: snap.lastCommand,
        });
      const restore = isolateVim();
      const demo = new GameEditor({
        puzzle,
        parent,
        demo: true,
        onChange() {},
        onNudge() {},
        locked: () => false,
      });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      for (const key of puzzle.solutionKeys) demo.feed(key);
      if (demo.snapshot().evidence.length)
        failures.push({ id: puzzle.id, demo: true });
      demo.destroy();
      restore();
      game.destroy();
      parent.remove();
    }
    return failures;
  });
  expect(failures).toEqual([]);
});

test("advanced navigation credit is limited to lessons that expose it", async ({
  page,
}) => {
  await openAt(page, 0);
  const evidence = await page.evaluate(async () => {
    // @ts-expect-error Vite browser module imports
    const { PUZZLES } = await import("/lib/game/curriculum.ts");
    // @ts-expect-error Vite browser module imports
    const { GameEditor } = await import("/lib/game/editor.ts");
    const puzzle = PUZZLES["repeat-8"];
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const game = new GameEditor({
      puzzle,
      parent,
      onChange() {},
      onNudge() {},
      locked: () => false,
    });
    for (const key of puzzle.solutionKeys) game.feed(key);
    const skills = game.snapshot().evidence.map(
      (item: { skill: string }) => item.skill,
    );
    game.destroy();
    parent.remove();
    return skills;
  });
  expect(evidence).toContain("repeat");
  expect(evidence).not.toContain("jump");
});

test("coaching follows partial text and cursor movement and documents accept any edit order", () => {
  const p = PUZZLES["insert-0"];
  const s: EditorSnapshot = {
    document: p.initial,
    cursor: p.cursor,
    selection: { from: p.cursor, to: p.cursor },
    mode: "normal",
    pending: false,
    evidence: [],
    motionUsed: [],
    marksSet: [],
    lastCommand: "",
    selectionMatched: false,
  };
  expect(nextCue(p, s).key).toContain("i");
  expect(nextCue(p, { ...s, cursor: 0 }).key).toBe("l");
  expect(
    nextCue(p, { ...s, mode: "insert", document: "Send threport", cursor: 7 })
      .key,
  ).toBe("e ");
  const search = PUZZLES["search-0"];
  expect(
    nextCue(search, {
      ...s,
      document: search.initial,
      cursor: 0,
      pending: true,
      commandKeys: "/pen",
    }).key,
  ).toBe("ding<CR>");
  expect(nextCue(p, { ...s, document: "something else" }).text).toBe(
    "Off track. Press u to undo.",
  );
  const repeat = PUZZLES["repeat-0"];
  const remaining = repeat.coaching![1];
  const restored = {
    ...s,
    document: remaining.document,
    cursor: remaining.cursor,
  };
  expect(nextCue(repeat, restored).key).toBe("r1");
  expect(nextCue(repeat, { ...restored, repeatable: true }).key).toBe(".");
  const final = PUZZLES["work-final-document"];
  expect(
    documentGoal(
      final,
      final.initial.replace('region = "local"', 'region = "shared"'),
    ),
  ).toBe("Correct and punctuate the greeting.");
  expect(documentGoal(COURSE[36], COURSE[36].target)).toContain("final order");
});

test("search cancellation, native input and alternative solutions behave correctly", async ({
  page,
}) => {
  const index = COURSE.findIndex((p) => p.id === "search-0");
  await openAt(page, index);
  await editor(page).focus();
  await play(page, ["/", ..."pending", "<Esc>"]);
  await expect(editor(page)).toHaveText(COURSE[index].initial, {
    useInnerText: true,
  });
  await play(page, COURSE[index].solutionKeys);
  await expect.poll(async () => (await read(page)).courseIndex).toBe(index + 1);
  expect((await read(page)).attempts.at(-1)!.demonstrated).toEqual(
    expect.arrayContaining(["search", "word"]),
  );
});

for (const id of ["search-0", "search-1"]) {
  test(`${id} highlighting preserves prompt focus and the matched cursor`, async ({ page }) => {
    const index = COURSE.findIndex((p) => p.id === id);
    const puzzle = COURSE[index];
    await openAt(page, index);
    await editor(page).focus();
    const prompt = page.locator(".cm-panels input");
    await play(page, [puzzle.solutionKeys[0], ..."pen"]);
    await expect(page.locator(".cm-searchMatch")).toHaveCount(3);
    await expect(prompt).toBeFocused();
    await expect(prompt).toHaveValue("pen");
    await play(page, [..."ding", "<CR>"]);
    await expect(prompt).toHaveCount(0);
    await expect(editor(page)).toBeFocused();
    // After the delayed highlight update, the cursor must
    // remain at the match, so the next command changes the intended word.
    await expect.poll(async () => (await read(page)).active?.cursor)
      .toBe(puzzle.target.indexOf("ready"));
    await play(page, [..."ciwready", "<Esc>"]);
    await expect.poll(async () => (await read(page)).courseIndex).toBe(index + 1);
  });
}

test("pasting a correct new puzzle passes without technique credit", async ({
  page,
}) => {
  await openAt(page, 37);
  await editor(page).focus();
  await play(page, [..."ggVGc"]);
  await editor(page).evaluate((element) =>
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      }),
    ),
  );
  await page.keyboard.insertText(COURSE[37].target);
  await expect.poll(async () => (await read(page)).courseIndex).toBe(38);
  expect((await read(page)).attempts.at(-1)!.demonstrated).toEqual([]);
});

test("the original document checkpoint continues with unlocks intact", async ({
  page,
}) => {
  const settings = { sound: false, theme: "paper", cursor: true, effect: true };
  await openAt(page, 37, { celebration: 6, settings });
  await expect(
    page.getByRole("heading", { name: "Your first document, ready." }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", "insert-0");
  expect((await read(page)).settings).toEqual(settings);
});

for (const index of [7, 36])
  test(`unfinished challenge ${index} keeps its buffer`, async ({
    page,
  }) => {
    await openAt(page, index, {
      active: {
        puzzleId: COURSE[index].id,
        document: "Unfinished work",
        cursor: 4,
        hints: 1,
      },
    });
    await expect(editor(page)).toHaveText("Unfinished work");
    await expect(page.locator("main")).toHaveAttribute(
      "data-puzzle",
      COURSE[index].id,
    );
    expect((await read(page)).courseIndex).toBe(index);
  });

test("active review resumes the course and selects fresh skill variants", async ({
  page,
}) => {
  await openAt(page, 37, {
    review: ["typo-6"],
    reviewIndex: 0,
    lastActive: Date.now() - SESSION_GAP - 1000,
  });
  await expect(page.locator("main")).toHaveAttribute("data-kind", "review");
  await editor(page).focus();
  await play(page, PUZZLES["typo-6"].solutionKeys);
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", "insert-0");
  await play(page, COURSE[37].solutionKeys);
  await expect.poll(async () => (await read(page)).courseIndex).toBe(38);
  const review = await page.evaluate(async (state) => {
    // @ts-expect-error Vite browser module imports
    const { selectReview } = await import("/lib/game/engine.ts");
    state.attempts = state.attempts.filter(
      (a: { skill: string }) => a.skill === "insert",
    );
    return selectReview(state, ["insert"], () => 0);
  }, await read(page));
  expect(review).toHaveLength(3);
  expect(new Set(review).size).toBe(3);
  expect(review.every((id: string) => id.startsWith("insert-"))).toBe(true);
});

test("long practice targets reuse the concise before-and-after language", async ({ page }) => {
  await openAt(page, 0, { review: ["mark-6"], reviewIndex: 0 });
  await expect(page.locator("main")).toHaveAttribute("data-kind", "review");
  const changes = page.locator(".objective-diff-row");
  await expect(changes).toHaveCount(2);
  await expect(page.getByText("Target changes", { exact: true })).toBeVisible();
  await expect(changes.first().locator("s")).toHaveText("unassigned");
  await expect(changes.first().locator("mark")).toHaveText("web # confirmed");
  await expect(changes.last().locator("s")).toHaveText("pending");
  await expect(changes.last().locator("mark")).toHaveText("ready");
  await expect(page.locator(".objective-target pre")).toHaveCount(0);
});

for (const skill of ["match", "jump", "mark"] as const) {
  for (const variant of [0, 2, 4]) {
    test(`${skill}-${variant} keeps long lesson goals concise alongside bottom guidance`, async ({ page }) => {
      const index = COURSE.findIndex((puzzle) => puzzle.id === `${skill}-${variant}`);
      await openAt(page, index);
      await expect(page.getByText("Target changes", { exact: true })).toBeVisible();
      await expect(page.locator(".objective-target pre")).toHaveCount(0);
      await expect(page.locator(".objective-diff-row")).toHaveCount(skill === "mark" ? 2 : 1);
      await expect(page.locator(".objective-diff-row mark").first()).toBeVisible();
      if (skill !== "match")
        await expect(page.locator(".objective-diff-row s").first()).toBeVisible();
      if (variant < 4) await expect(page.locator(".focus-coaching .next-cue")).toBeVisible();
      else await expect(page.locator(".focus-coaching .next-cue")).toHaveCount(0);
    });
  }
}

test("clicking anywhere in a skill cell toggles it", async ({ context }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const cell = page.locator(".selection-grid .practice-skill-row").first();
  const checkbox = cell.getByRole("checkbox");
  const box = await cell.boundingBox();
  if (!box) throw new Error("skill cell is not visible");
  await page.mouse.click(box.x + box.width - 8, box.y + box.height - 8);
  await expect(checkbox).toBeChecked();
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
  await page.close();
});

test("desktop opens on the skill selection page", async ({ context }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator(".selection-page")).toBeVisible();
  await expect(page.locator(".selection-brand")).toHaveText("hjkl");
  await expect(page.getByText("Practice setup", { exact: true })).toHaveCount(0);
  await expect(page.getByText("×6", { exact: true })).toHaveCount(16);
  await expect(
    page.locator(".selection-grid .practice-skill-row").first().locator("kbd"),
  ).toHaveText(["x", "h l"]);
  await expect(page.getByRole("checkbox")).toHaveCount(SKILLS.length);
  await expect(page.getByRole("button", { name: "Start" })).toBeDisabled();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight),
  ).toBe(true);
  const skills = page.getByRole("checkbox");
  await expect(skills.first()).toBeFocused();
  await page.keyboard.press("l");
  await expect(skills.nth(1)).toBeFocused();
  await page.keyboard.press("j");
  await expect(skills.nth(5)).toBeFocused();
  await page.keyboard.press("h");
  await expect(skills.nth(4)).toBeFocused();
  await page.keyboard.press("k");
  await expect(skills.first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await page.keyboard.press("a");
  expect(
    await skills.evaluateAll(
      (items) =>
        items.filter((item) => item.getAttribute("data-state") === "checked")
          .length,
    ),
  ).toBe(SKILLS.length);
  await page.keyboard.press("n");
  expect(
    await skills.evaluateAll(
      (items) =>
        items.filter((item) => item.getAttribute("data-state") === "checked")
          .length,
    ),
  ).toBe(0);
  await expect(skills.first()).toBeFocused();
  await page.keyboard.press("Space");
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("main")).toHaveAttribute("data-kind", "lesson");
});

test("practice picker answers Vim motions", async ({ page }) => {
  await openAt(page, 0);
  await openPracticePicker(page);
  const checkboxes = page.getByRole("checkbox");
  await checkboxes.first().focus();
  await page.keyboard.press("j");
  await expect(checkboxes.nth(1)).toBeFocused();
  await page.keyboard.press("k");
  await expect(checkboxes.first()).toBeFocused();
  await page.keyboard.press("Space");
  await expect(checkboxes.first()).toBeChecked();
  await page.keyboard.press("n");
  await expect(checkboxes.first()).not.toBeChecked();
  await page.keyboard.press("a");
  await expect(checkboxes.last()).toBeChecked();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(editor(page)).toBeFocused();
});

test("practice picker exposes every skill and retains its session selection", async ({
  page,
}) => {
  await openAt(page, 0);
  await openPracticePicker(page);
  const checkboxes = page.getByRole("checkbox");
  const start = page.getByRole("button", { name: "Start" });
  await expect(checkboxes).toHaveCount(16);
  await expect(start).toBeDisabled();

  await checkboxes.first().focus();
  await page.keyboard.press("Space");
  await expect(checkboxes.first()).toBeChecked();
  await expect(start).toBeEnabled();
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(start).toBeDisabled();
  await page.getByRole("button", { name: "Select all" }).click();
  expect(await checkboxes.evaluateAll((items) =>
    items.filter((item) => item.getAttribute("data-state") === "checked").length,
  )).toBe(SKILLS.length);
  await page.getByRole("button", { name: "Clear all" }).click();

  for (const skill of [SKILLS[0], SKILLS.at(-1)!])
    await page
      .getByRole("checkbox", {
        name: `Practice ${SKILL_METADATA[skill].name}`,
      })
      .click();
  await page.keyboard.press("Escape");
  await expect(editor(page)).toBeFocused();
  await openPracticePicker(page);
  for (const skill of [SKILLS[0], SKILLS.at(-1)!])
    await expect(
      page.getByRole("checkbox", {
        name: `Practice ${SKILL_METADATA[skill].name}`,
      }),
    ).toBeChecked();

  await page.reload();
  await openPracticePicker(page);
  expect(await page.getByRole("checkbox").evaluateAll((items) =>
    items.filter((item) => item.getAttribute("data-state") === "checked").length,
  )).toBe(0);
  await expect(page.getByRole("button", { name: "Start" })).toBeDisabled();
});

test("selected course replaces the previous edit and teaches only selected skills", async ({ page }) => {
  await openAt(page, 37, { active: { puzzleId: COURSE[37].id, document: "Unfinished work", cursor: 4, hints: 2 } });
  await openPracticePicker(page);
  for (const skill of ["typo", "mark"] as const)
    await page.getByRole("checkbox", { name: `Practice ${SKILL_METADATA[skill].name}` }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", "typo-0");
  await expect(page.locator(".next-cue")).toBeVisible();
  const state = await read(page);
  expect(state.selectedSkills).toEqual(["typo", "mark"]);
  expect(state.sectionOrder).toEqual(["typo", "mark"]);
  expect(state.courseIndex).toBe(0);
  expect(state.review).toEqual([]);
  expect(state.suspended).toBeUndefined();
});

test("finished course starts a fresh selected course", async ({ page }) => {
  await openAt(page, COURSE.length, { celebration: SECTIONS.length - 1 });
  await expect(page.getByText("You’re an editor now.")).toBeVisible();
  await page.getByRole("button", { name: "Choose practice", exact: true }).click();
  await page.getByRole("checkbox", { name: `Practice ${SKILL_METADATA.typo.name}` }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", "typo-0");
  await expect(page.locator(".next-cue")).toBeVisible();
  expect((await read(page)).courseIndex).toBe(0);
});

test("l opens and closes the finished-course picker with focus restored", async ({
  page,
}) => {
  await openAt(page, COURSE.length, { celebration: SECTIONS.length - 1 });
  await expect(page.getByText("You’re an editor now.")).toBeVisible();
  await page.keyboard.press("l");
  await expect(
    page.getByRole("heading", { name: "Choose practice skills_" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Choose practice", exact: true }),
  ).toBeFocused();
});

test("mobile layouts show the desktop requirement instead of the game", async ({
  context,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Desktop required_" })).toBeVisible();
  await expect(page.getByText("This app only works on desktop.", { exact: false })).toBeVisible();
  await expect(editor(page)).toHaveCount(0);
});

test("demonstrations preserve a player's copied text, search, and remembered edit", async ({
  page,
}) => {
  await openAt(page, 37);
  await expect(editor(page)).toBeVisible();
  const failures = await page.evaluate(async () => {
    // @ts-expect-error Vite browser module imports
    const { PUZZLES } = await import("/lib/game/curriculum.ts");
    // @ts-expect-error Vite browser module imports
    const { GameEditor, isolateVim } = await import("/lib/game/editor.ts");
    const failures = [];
    for (const [id, prefixLength] of [
      ["copy-0", 2],
      ["search-2", 9],
      ["repeat-1", 9],
    ] as const) {
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      const puzzle = PUZZLES[id];
      const player = new GameEditor({
        puzzle,
        parent,
        onChange() {},
        onNudge() {},
        locked: () => false,
      });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      for (const key of puzzle.solutionKeys.slice(0, prefixLength))
        player.feed(key);
      const restore = isolateVim();
      const demoPuzzle = PUZZLES["search-5"];
      const demo = new GameEditor({
        puzzle: demoPuzzle,
        parent,
        demo: true,
        onChange() {},
        onNudge() {},
        locked: () => false,
      });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      for (const key of demoPuzzle.solutionKeys) demo.feed(key);
      demo.destroy();
      restore();
      for (const key of puzzle.solutionKeys.slice(prefixLength))
        player.feed(key);
      if (player.snapshot().document !== puzzle.target)
        failures.push({ id, snapshot: player.snapshot() });
      player.destroy();
      parent.remove();
    }
    return failures;
  });
  expect(failures).toEqual([]);
});

test("undo and cancelled searches cannot supply new technique credit", async ({
  page,
}) => {
  await openAt(page, 37);
  await expect(editor(page)).toBeVisible();
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser module imports
    const { PUZZLES } = await import("/lib/game/curriculum.ts");
    // @ts-expect-error Vite browser module imports
    const { GameEditor } = await import("/lib/game/editor.ts");
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const game = new GameEditor({
      puzzle: PUZZLES["search-0"],
      parent,
      onChange() {},
      onNudge() {},
      locked: () => false,
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    for (const key of ["/", ..."pending", "<Esc>", ..."wwwwciwready", "<Esc>"])
      game.feed(key);
    const cancelled = game
      .snapshot()
      .evidence.map((e: { skill: string }) => e.skill);
    game.feed("u");
    const undone = game.snapshot().evidence;
    game.destroy();
    parent.remove();
    return { cancelled, undone };
  });
  expect(result.cancelled).toContain("word");
  expect(result.cancelled).not.toContain("search");
  expect(result.undone).toEqual([]);
});
test("undo reminders need an off-path edit that moves away from the target", async () => {
  const { undoReminder, editDistance } = await import("../lib/game/engine");
  expect(editDistance("kitten", "sitting")).toBe(3);
  expect(editDistance("same", "same")).toBe(0);
  const p = PUZZLES["word-4"];
  const base = { cursor: 0, selection: { from: 0, to: 0 }, mode: "normal" as const, pending: false, evidence: [], motionUsed: [], marksSet: [], lastCommand: "", selectionMatched: false };
  expect(undoReminder(p, { ...base, document: p.initial }, { recover: true })).toBeUndefined();
  expect(undoReminder(p, { ...base, document: "" }, { recover: true })).toBe("Off track. Press u to undo.");
  expect(undoReminder(p, { ...base, document: "" }, {})).toBeUndefined();
  expect(undoReminder(p, { ...base, document: "", mode: "insert" }, { recover: true })).toBeUndefined();
});
