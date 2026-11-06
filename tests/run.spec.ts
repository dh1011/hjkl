import { expect } from "@playwright/test";
import { test, read } from "./progress-fixture";
import { COURSE, SECTIONS, SKILLS } from "../lib/game/curriculum";
import { course } from "../lib/game/content/course";
import { courseForRun, courseForSkills, DEFAULT_SECTION_ORDER, shuffleSkills, shuffleSkillSections } from "../lib/game/run";
import { initializeProgress } from "../lib/game/progress";
import type { ProgressState, Skill } from "../lib/game/types";

test.use({ randomizedCourse: true });

for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
  test(`shuffle ${value} keeps whole skill blocks, assessments, and unlock milestones`, () => {
    const sectionOrder = shuffleSkillSections(() => value);
    const run = courseForRun(sectionOrder);
    expect(new Set(sectionOrder).size).toBe(SECTIONS.length);
    expect([...sectionOrder].sort()).toEqual([...DEFAULT_SECTION_ORDER].sort());
    expect(run.COURSE).toHaveLength(117);
    expect(run.COURSE.map((p) => p.id).sort()).toEqual(COURSE.map((p) => p.id).sort());
    expect(run.COURSE.at(-1)?.id).toBe("advanced-final-document");
    const learned = new Set<Skill>();
    for (const section of run.SECTIONS) {
      const definition = course.sections.find((s) => s.id === section.id)!;
      expect(run.COURSE.slice(section.start, section.end).map((p) => p.id))
        .toEqual(definition.challengeIds);
      if (definition.kind === "lesson") learned.add(definition.skill!);
      else expect(definition.helpSkills.every((skill) => learned.has(skill))).toBe(true);
    }
    for (const name of ["paper", "cursor", "effect"] as const) {
      expect(run.UNLOCKS[name]).toBe(
        run.SECTIONS.find((s) => s.id === course.unlocks[name].afterSection)!.end,
      );
    }
    expect(course.sections.map((s) => s.id)).toEqual(DEFAULT_SECTION_ORDER);
  });
}

test("different shuffle draws change skills, while an initialized run remains stable", () => {
  expect(shuffleSkillSections(() => 0)).not.toEqual(shuffleSkillSections(() => 0.999));
  const data: { current: ProgressState | null } = { current: null };
  initializeProgress(data);
  const original = data.current;
  initializeProgress(data);
  expect(data.current).toBe(original);
  expect(() => courseForRun(DEFAULT_SECTION_ORDER.slice(1))).toThrow("every course section exactly once");
  expect(() => courseForRun(DEFAULT_SECTION_ORDER.map((id, i) => i ? id : "missing")))
    .toThrow('Run references unknown section "missing"');
});

test("a page keeps its shuffled run through hints and completion; reload draws a fresh run", async ({ page }) => {
  let draw = 0;
  // Control only the shuffler in the test response, leaving the app's initialization intact.
  await page.route("**/lib/game/run.ts*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + `
const originalShuffle = shuffleSkillSections;
shuffleSkillSections = () => originalShuffle(() => ${draw});`,
    });
  });
  const firstRun = courseForRun(shuffleSkillSections(() => draw));
  await page.goto("/");
  const editor = page.getByRole("textbox", { name: "Vim practice editor" });
  await expect(editor).toBeFocused();
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", firstRun.COURSE[0].id);
  await expect(editor).toHaveText(firstRun.COURSE[0].initial, { useInnerText: true });
  expect((await read(page)).sectionOrder).toEqual(firstRun.SECTIONS.map((s) => s.id));
  await page.keyboard.type(":help");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Get a hint", exact: true }).click();
  await expect(page.locator(".hint-box")).toBeVisible();
  expect((await read(page)).sectionOrder).toEqual(firstRun.SECTIONS.map((s) => s.id));
  await editor.focus();
  for (const key of firstRun.COURSE[0].solutionKeys)
    await page.keyboard.press(key === "<Esc>" ? "Escape" : key === " " ? "Space" : key);
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", firstRun.COURSE[1].id);
  expect((await read(page)).sectionOrder).toEqual(firstRun.SECTIONS.map((s) => s.id));
  draw = 0.75;
  const refreshed = courseForRun(shuffleSkillSections(() => draw));
  await page.reload();
  await expect(editor).toBeFocused();
  await expect(page.locator("main")).toHaveAttribute("data-puzzle", refreshed.COURSE[0].id);
  const state = await read(page);
  expect(state.sectionOrder).toEqual(refreshed.SECTIONS.map((s) => s.id));
  expect(state.sectionOrder).not.toEqual(firstRun.SECTIONS.map((s) => s.id));
  expect(state.courseIndex).toBe(0);
  expect(state.attempts).toHaveLength(0);
  await expect(page.locator(".hint-box")).toHaveCount(0);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })))
    .toEqual({ local: 0, session: 0 });
});

for (const skill of SKILLS) {
  test(`selected ${skill} follows guided, prompted, independent lessons`, () => {
    const run = courseForSkills([skill]);
    expect(run.COURSE.map((p) => p.skill)).toEqual(Array(6).fill(skill));
    expect(run.COURSE.map((p) => p.assistance)).toEqual([
      "guided", "guided", "prompted", "prompted", "independent", "independent",
    ]);
    expect(run.SECTIONS).toHaveLength(1);
  });
  test(`picker teaches ${skill} with bottom hints`, async ({ context }) => {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Resume" })).toHaveCount(0);
    await page.locator(`#landing-practice-${skill}`).click();
    await page.getByRole("button", { name: "Start" }).click();
    const editor = page.getByRole("textbox", { name: "Vim practice editor" });
    const run = courseForSkills([skill]);
    for (const [index, puzzle] of run.COURSE.entries()) {
      await expect(page.locator("main")).toHaveAttribute("data-puzzle", puzzle.id);
      await expect(editor).toBeFocused();
      if (index < 4) await expect(page.locator(".next-cue")).toBeVisible();
      else await expect(page.locator(".next-cue")).toHaveCount(0);
      await expect(page.locator(".first-key")).toHaveCount(0);
      for (const [step, key] of puzzle.solutionKeys.entries()) {
        await page.keyboard.press(key === "<Esc>" ? "Escape" : key === "<C-o>" ? "Control+o" : key === "<C-i>" ? "Control+i" : key === " " ? "Space" : key === "<CR>" ? "Enter" : key);
        if (step === 0 && (index === 2 || index === 3))
          await expect(page.locator(".next-cue")).toHaveCount(0);
      }
    }
    await expect(page.getByText("You’re an editor now.")).toBeVisible();
    await page.close();
  });
}

test("a shuffled selection keeps each selected skill's lessons together and in stage order", () => {
  const selected: Skill[] = ["word", "typo", "search", "mark"];
  for (const value of [0, 0.3, 0.6, 0.999]) {
    const order = shuffleSkills(selected, () => value);
    expect([...order].sort()).toEqual([...selected].sort());
    const run = courseForSkills(order, { keepOrder: true });
    expect([...new Set(run.COURSE.map((p) => p.skill))]).toEqual(order);
    for (const skill of order) {
      const lessons = run.COURSE.filter((p) => p.skill === skill);
      expect(lessons.map((p) => p.assistance).slice(0, 6)).toEqual([
        "guided", "guided", "prompted", "prompted", "independent", "independent",
      ]);
    }
    expect(run.COURSE.every((p) => selected.includes(p.skill))).toBe(true);
  }
  // Without keepOrder the authored course order wins, whatever order skills were picked in.
  expect([...new Set(courseForSkills(["mark", "typo"]).COURSE.map((p) => p.skill))]).toEqual(["typo", "mark"]);
});

test("the picker's shuffle toggle starts the selected skills in a shuffled order", async ({ context }) => {
  const page = await context.newPage();
  // Fix the draw so the shuffled order is known: [typo, word, line] -> [word, line, typo].
  await page.addInitScript(() => (Math.random = () => 0));
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Shuffle skill order" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.locator("#landing-practice-typo").focus();
  for (const key of ["Space", "l", "Space", "l", "Space", "s"]) await page.keyboard.press(key);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByRole("textbox", { name: "Vim practice editor" })).toBeVisible();
  const order = shuffleSkills(SKILLS.slice(0, 3), () => 0);
  expect(order).toEqual(["word", "line", "typo"]);
  await expect(page.locator("main")).toHaveAttribute(
    "data-puzzle",
    courseForSkills(order, { keepOrder: true }).COURSE[0].id,
  );
});
