import { expect } from "@playwright/test";
import { test } from "./progress-fixture";
import { mastery, selectReview, evaluate } from "../lib/game/engine";
import {
  COURSE,
  PUZZLES,
  SECTIONS,
  VARIANTS,
} from "../lib/game/curriculum";
import { newProgress } from "../lib/game/progress";
import type { AttemptResult, EditorSnapshot } from "../lib/game/types";
const attempt = (
  index: number,
  session = "one",
  assisted = false,
): AttemptResult => ({
  puzzleId: `typo-${index}`,
  variant: `typo-${index}`,
  skill: "typo",
  world: VARIANTS[index].world,
  session,
  completed: true,
  assisted,
  hints: assisted ? 1 : 0,
  demonstrated: ["typo"],
  mixed: index >= 4,
  completedAt: index + 1,
});
test("mastery requires distinct worlds, examples and later sessions", () => {
  expect(mastery("typo", [attempt(0, "one", true)])).toBe("Guided");
  expect(mastery("typo", [attempt(0), attempt(0), attempt(0)])).toBe("Guided");
  expect(mastery("typo", [attempt(0), attempt(1)])).toBe("Independent");
  expect(
    mastery(
      "typo",
      [0, 1, 2, 3].map((i) => attempt(i)),
    ),
  ).toBe("Independent");
  expect(
    mastery(
      "typo",
      [0, 1, 2, 3].map((i) => attempt(i, i < 2 ? "one" : "two")),
    ),
  ).toBe("Consistent");
  expect(
    mastery(
      "typo",
      [0, 1, 2, 3, 4, 5].map((i) => attempt(i, ["one", "two", "three"][i % 3])),
    ),
  ).toBe("Fluent");
  expect(
    mastery(
      "typo",
      [0, 1, 2, 3, 4, 5].map((i) => ({
        ...attempt(i, ["one", "two", "three"][i % 3]),
        demonstrated: [],
      })),
    ),
  ).toBe("New");
});
test("review uses only selected skills and prioritizes unseen variants", () => {
  const s = newProgress();
  s.attempts = [0, 1, 2, 3, 4, 5].map((i) => attempt(i));
  expect(selectReview(s, [])).toEqual([]);
  const review = selectReview(s, ["typo"], () => 0);
  expect(review).toHaveLength(3);
  expect(new Set(review).size).toBe(3);
  expect(review.every((id) => PUZZLES[id].skill === "typo")).toBe(true);
  expect(review.every((id) => Number(id.split("-").at(-1)) >= 6)).toBe(true);
});

test("review balances one, two, three, and larger selected pools", () => {
  const s = newProgress();
  const one = selectReview(s, ["typo"], () => 0);
  expect(one.map((id) => PUZZLES[id].skill)).toEqual([
    "typo",
    "typo",
    "typo",
  ]);
  expect(new Set(one).size).toBe(3);

  const two = selectReview(s, ["typo", "word"], () => 0);
  const twoCounts = Object.values(
    Object.groupBy(two, (id) => PUZZLES[id].skill),
  ).map((ids) => ids!.length);
  expect(twoCounts.sort()).toEqual([1, 2]);
  expect(new Set(two).size).toBe(3);

  for (const skills of [
    ["typo", "word", "line"],
    ["typo", "word", "line", "visual", "move"],
  ] as const) {
    const review = selectReview(s, skills, () => 0);
    expect(new Set(review.map((id) => PUZZLES[id].skill)).size).toBe(3);
    const selected = new Set<string>(skills);
    expect(review.every((id) => selected.has(PUZZLES[id].skill))).toBe(
      true,
    );
  }
});

test("review keeps authored variant order within each skill", () => {
  const s = newProgress();
  s.attempts = Array.from({ length: 12 }, (_, i) => attempt(i));
  expect(selectReview(s, ["typo"], () => 0)).toEqual([
    "typo-0",
    "typo-1",
    "typo-2",
  ]);

  const fresh = newProgress();
  const courseIds = new Set(COURSE.map((puzzle) => puzzle.id));
  const authored = VARIANTS.filter(
    (puzzle) => puzzle.skill === "typo" && !courseIds.has(puzzle.id),
  )
    .slice(0, 3)
    .map((puzzle) => puzzle.id);
  expect(selectReview(fresh, ["typo"], () => 0)).toEqual(authored);
  expect(selectReview(fresh, ["typo"], () => 0.999)).toEqual(authored);
});
test("review randomizes skill order without randomizing their variants", () => {
  const state = newProgress();
  const selected = ["typo", "word", "line", "visual"] as const;
  const first = selectReview(state, selected, () => 0);
  const second = selectReview(state, selected, () => 0.999);
  expect(first.map((id) => PUZZLES[id].skill)).not.toEqual(
    second.map((id) => PUZZLES[id].skill),
  );
  const courseIds = new Set(COURSE.map((puzzle) => puzzle.id));
  const firstAuthoredPractice = (skill: string) =>
    VARIANTS.find(
      (puzzle) => puzzle.skill === skill && !courseIds.has(puzzle.id),
    )!.id;
  for (const review of [first, second])
    expect(
      review.every(
        (id) => id === firstAuthoredPractice(PUZZLES[id].skill),
      ),
    ).toBe(true);
});
test("practice prefers real-world variants outside the guided course", () => {
  const review = selectReview(newProgress(), ["match", "jump", "mark"], () => 0);
  expect(review).toHaveLength(3);
  expect(review.every((id) => Number(id.split("-").at(-1)) >= 6)).toBe(
    true,
  );
  expect(review.every((id) => PUZZLES[id].initial.split("\n").length >= 14)).toBe(
    true,
  );
});
test("existing browser saves are ignored and playing does not write storage", async ({
  page,
  context,
}) => {
  const key = "edit-quest:v1";
  const previous = {
    ...newProgress(),
    courseIndex: 6,
    settings: { sound: true, theme: "paper", cursor: true, effect: true },
  };
  await page.addInitScript(
    ({ key, previous }) => {
      localStorage.setItem(key, JSON.stringify(previous));
      const tracked = window as unknown as { progressStorageWrites: string[] };
      tracked.progressStorageWrites = [];
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        tracked.progressStorageWrites.push(key);
        setItem.call(this, key, value);
      };
    },
    { key, previous },
  );
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Vim practice editor" });
  await expect(editor).toHaveText("helloo");
  await expect(page.locator(".app-shell")).toHaveClass(/theme-ink/);
  await expect(page.locator(".app-shell")).not.toHaveClass(/outline-cursor|completion-effect/);
  await editor.focus();
  await page.keyboard.press("x");
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", COURSE[1].id);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  expect(await page.evaluate(() => (
    window as unknown as { progressStorageWrites: string[] }
  ).progressStorageWrites)).toEqual([]);
  expect(await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!), key,
  )).toEqual(previous);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  await page.reload();
  await expect(editor).toHaveText("helloo");
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(reopened.locator(".selection-page")).toBeVisible();
  await reopened.getByRole("checkbox").first().click();
  await reopened.getByRole("button", { name: "Start" }).click();
  const reopenedEditor = reopened.getByRole("textbox", { name: "Vim practice editor" });
  await expect(reopenedEditor).toBeFocused();
  const puzzleId = await reopened.locator("main").getAttribute("data-puzzle");
  const startingPuzzles = SECTIONS.map((section) => COURSE[section.start])
    .filter((puzzle) => puzzle.kind === "lesson");
  const startingPuzzle = startingPuzzles.find((puzzle) => puzzle.id === puzzleId);
  expect(startingPuzzle).toBeDefined();
  await expect(reopenedEditor).toHaveText(startingPuzzle!.initial, { useInnerText: true });
  await expect(reopened.locator(".app-shell")).toHaveClass(/theme-ink/);
  await expect(reopened.locator(".app-shell")).not.toHaveClass(/outline-cursor|completion-effect/);
});
test("unavailable storage keeps the game playable", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw Error("Unavailable");
    };
    Storage.prototype.setItem = () => {
      throw Error("Unavailable");
    };
  });
  await page.goto("/");
  await expect(page.getByText("Progress isn’t saving.", { exact: false })).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Vim practice editor" }),
  ).toBeFocused();
  await page.keyboard.press("x");
  await expect(
    page.getByRole("heading", { name: COURSE[1].goal }),
  ).toBeVisible();
});
test("browser tools read state and request hints through the real UI", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const registry: Record<string, { execute: (input: unknown) => unknown }> =
      {};
    Object.defineProperty(document, "modelContext", {
      value: {
        registerTool: (tool: {
          name: string;
          execute: (input: unknown) => unknown;
        }) => {
          registry[tool.name] = tool;
        },
      },
    });
    Object.assign(window, { testTools: registry });
  });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Vim practice editor" }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const registry = (
      window as unknown as {
        testTools: Record<string, { execute: (input: unknown) => unknown }>;
      }
    ).testTools;
    const state = registry.read_game_state.execute({});
    const hints = [];
    for (let i = 0; i < 4; i++) hints.push(await registry.request_hint.execute({}));
    let rejected = false;
    try {
      await registry.request_hint.execute({ unexpected: true });
    } catch {
      rejected = true;
    }
    return { state, rejected, hints };
  });
  expect(result.rejected).toBe(true);
  expect(result.state).toMatchObject({
    document: "helloo",
    mode: "normal",
    completed: 0,
  });
  expect(result.hints).toMatchObject([{ level: 1 }, { level: 2 }, { level: 2 }, { level: 2 }]);
  await expect(page.locator(".hint-box")).toContainText("Press x.");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "playing");
  await expect(page.getByRole("textbox", { name: "Vim practice editor" })).toHaveText("helloo");
});
test("undo clears evidence and Insert text does not prove the commands it spells", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Vim practice editor" }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser module import
    const { GameEditor } = await import("/lib/game/editor.ts");
    // @ts-expect-error Vite browser module import
    const { VARIANTS } = await import("/lib/game/curriculum.ts");
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const game = new GameEditor({
      puzzle: VARIANTS[0],
      parent,
      onChange: () => {},
      onNudge: () => {},
      locked: () => false,
    });
    game.feed("x");
    game.feed("u");
    const undone = game.snapshot();
    for (const k of ["i", "x", "<Esc>"]) game.feed(k);
    const inserted = game.snapshot();
    game.destroy();
    parent.remove();
    return { undone, inserted };
  });
  expect(result.undone.evidence).toEqual([]);
  expect(
    result.inserted.evidence.map((e: { skill: string }) => e.skill),
  ).toEqual(["insert"]);
});

test("the target document passes in any mode, while meaningful whitespace still matters", () => {
  for (const puzzle of VARIANTS) {
    for (const mode of ["normal", "insert", "visual"] as const) {
      const snapshot: EditorSnapshot = {
        document: puzzle.target,
        mode,
        pending: true,
        cursor: 0,
        selection: { from: 0, to: 0 },
        evidence: [],
        motionUsed: [],
        marksSet: [],
        lastCommand: "",
        selectionMatched: false,
      };
      expect(evaluate(puzzle, snapshot).complete).toBe(true);
      expect(
        evaluate(puzzle, { ...snapshot, document: puzzle.target + " " })
          .complete,
      ).toBe(false);
    }
  }
});
test("opt-in Remember progress restores the run after a reload and forgets it when turned off", async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto("/");
  await page.locator("#landing-practice-typo").click();
  await page.getByRole("button", { name: "Start" }).click();
  const editor = page.getByRole("textbox", { name: "Vim practice editor" });
  await expect(editor).toBeFocused();
  await page.keyboard.press("x");
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", "typo-1");
  const openSettings = async () => {
    await page.keyboard.type(":help");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "More options", exact: true }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
  };
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await openSettings();
  await page.getByRole("switch", { name: "Remember progress" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(editor).toBeFocused();
  const before = await editor.innerText();
  await page.keyboard.press("0");
  await page.keyboard.press("x");
  const changed = await editor.innerText();
  expect(changed).not.toBe(before);

  await page.reload();
  await expect(page.locator(".selection-page")).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", "typo-1");
  await expect(editor).toHaveText(changed, { useInnerText: true });

  await openSettings();
  const toggle = page.getByRole("switch", { name: "Remember progress" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  expect(await page.evaluate(() => localStorage.getItem("hjkl:progress:v1"))).toBeNull();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(page.locator(".selection-page")).toBeVisible();
});
test("a saved run from different course content starts fresh and is removed", async ({ context }) => {
  const page = await context.newPage();
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(
      "hjkl:progress:v1",
      JSON.stringify({
        course: "typo-0,removed-challenge",
        state: {
          version: 1, courseIndex: 1, sectionOrder: [], selectedSkills: ["typo"], attempts: [],
          lastActive: 0, session: "s", review: [], reviewIndex: 0,
          settings: { sound: false, theme: "ink", cursor: false, effect: false, remember: true },
        },
      }),
    );
  });
  await page.goto("/");
  await expect(page.locator(".selection-page")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("hjkl:progress:v1"))).toBeNull();
});
