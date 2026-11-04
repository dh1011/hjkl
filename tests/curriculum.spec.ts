import { test, expect } from "@playwright/test";
import { buildCurriculum } from "../lib/game/content/compile";
import { course } from "../lib/game/content/course";
import type { CourseDefinition, DocumentContent, SkillContent } from "../lib/game/content/types";
import {
  COURSE, SECTIONS, UNLOCKS, VARIANTS,
  SKILL_CONTENT, DOCUMENT_CONTENT, practicePuzzle,
} from "../lib/game/curriculum";
import { helpForPuzzle } from "../lib/game/help";

const build = (definition: CourseDefinition = course) =>
  buildCurriculum(SKILL_CONTENT, DOCUMENT_CONTENT, definition);

function skillWithCursor(cursor: number): SkillContent[] {
  return SKILL_CONTENT.map((skill, i) => i ? skill : {
    ...skill,
    challenges: skill.challenges.map((challenge, j) => j ? challenge : {
      ...challenge, cursor,
    }),
  });
}

test("manifest insertion shifts following sections and section-based unlocks", () => {
  const inserted = build({
    ...course,
    sections: course.sections.map((section, i) => i ? section : {
      ...section,
      challengeIds: [...section.challengeIds, "typo-11"],
    }),
  });
  expect(inserted.COURSE).toHaveLength(118);
  expect(inserted.COURSE[6].id).toBe("typo-11");
  expect(inserted.SECTIONS[0]).toMatchObject({ start: 0, end: 7 });
  expect(inserted.SECTIONS[1]).toMatchObject({ start: 7, end: 13 });
  expect(inserted.UNLOCKS).toEqual({ paper: 7, cursor: 37, effect: 38 });
  expect(inserted.SECTIONS.find((s) => s.id === "final-document"))
    .toMatchObject({ start: 37, end: 38 });
  expect(COURSE).toHaveLength(117);
  expect(UNLOCKS).toEqual({ paper: 6, cursor: 36, effect: 37 });
});

test("manifest reordering follows section IDs and keeps explicit help skills", () => {
  const insertSection = course.sections.find((s) => s.id === "insert")!;
  const reordered = build({
    ...course,
    sections: [insertSection, ...course.sections.filter((s) => s.id !== "insert")],
  });
  expect(reordered.COURSE[0].id).toBe("insert-0");
  expect(reordered.COURSE[6].id).toBe("typo-0");
  expect(reordered.UNLOCKS).toEqual({ paper: 12, cursor: 42, effect: 43 });
  expect(reordered.SECTIONS.find((s) => s.id === "final-document"))
    .toMatchObject({ start: 42, end: 43 });
  const checkpoint = reordered.COURSE.find((p) => p.id === "final-document")!;
  expect(helpForPuzzle(checkpoint)).toEqual(helpForPuzzle(COURSE[36]));
  expect(checkpoint.helpSkills).not.toContain("insert");
  expect(reordered.COURSE[0].showMode).toBe(true);
  expect(reordered.COURSE[6].showMode).toBe(false);
});

test("manifest can insert a section without changing content registration or numeric offsets", () => {
  const expanded = build({
    ...course,
    sections: [course.sections[0], {
      id: "extra-typos",
      kind: "lesson",
      skill: "typo",
      title: "More typo practice",
      stamp: "More precision.",
      helpSkills: ["typo"],
      challengeIds: ["typo-11"],
    }, ...course.sections.slice(1)],
  });
  expect(expanded.SECTIONS).toHaveLength(SECTIONS.length + 1);
  expect(expanded.SECTIONS[1]).toMatchObject({ id: "extra-typos", start: 6, end: 7 });
  expect(expanded.UNLOCKS).toEqual({ paper: 6, cursor: 37, effect: 38 });
  expect(helpForPuzzle(expanded.COURSE[6]).title).toBe("More typo practice");
});

test("mixed and practice presentations leave canonical challenge data immutable", () => {
  const source = SKILL_CONTENT.find((s) => s.id === "visual")!.challenges[0];
  const before = structuredClone(source);
  const mixed = build({
    ...course,
    sections: course.sections.map((section) => ({
      ...section,
      challengeIds: section.id === "typo-6"
        ? [...section.challengeIds, "visual-0"]
        : section.challengeIds.filter((id) => id !== "visual-0"),
    })),
  });
  const appearance = mixed.COURSE.find((p) => p.id === "visual-0")!;
  const practice = practicePuzzle("visual-0");
  expect(appearance).toMatchObject({ kind: "mixed", assistance: "independent" });
  expect(appearance.selectionTarget).toBeUndefined();
  expect(practice).toMatchObject({ kind: "review", assistance: "independent" });
  expect(practice.selectionTarget).toBeUndefined();
  expect(practice.helpSkills).toEqual(["visual"]);
  expect(source).toEqual(before);
  expect(VARIANTS.find((p) => p.id === "visual-0"))
    .toMatchObject({ kind: "lesson", assistance: "guided", selectionTarget: source.selectionTarget });
  expect(Object.isFrozen(source)).toBe(true);
  expect(Object.isFrozen(source.solutionKeys)).toBe(true);
  expect(() => { source.solutionKeys.push("x"); }).toThrow(TypeError);
  expect(Object.isFrozen(appearance)).toBe(true);
});

test("content validation rejects duplicate definitions and references with useful IDs", () => {
  expect(() => buildCurriculum([...SKILL_CONTENT, SKILL_CONTENT[0]], DOCUMENT_CONTENT, course))
    .toThrow('Duplicate skill ID "typo"');
  expect(() => buildCurriculum(SKILL_CONTENT, [
    ...DOCUMENT_CONTENT, { ...DOCUMENT_CONTENT[0], id: "typo-0" },
  ], course)).toThrow('Duplicate or empty challenge ID "typo-0"');
  expect(() => build({ ...course, sections: [...course.sections, course.sections[0]] }))
    .toThrow('Duplicate or empty section ID "typo"');
  expect(() => build({ ...course, sections: course.sections.map((s, i) => i ? s : {
    ...s, challengeIds: [...s.challengeIds, "typo-0"],
  }) })).toThrow('Section "typo": duplicate course challenge "typo-0"');
});

test("content validation rejects missing challenge, skill, and unlock references", () => {
  expect(() => build({ ...course, sections: course.sections.map((s, i) => i ? s : {
    ...s, challengeIds: ["missing-challenge"],
  }) })).toThrow('Section "typo": unknown challenge "missing-challenge"');
  expect(() => buildCurriculum(SKILL_CONTENT.filter((skill) => skill.id !== "repeat"), DOCUMENT_CONTENT, course))
    .toThrow('Challenge "work-message": unknown skill "repeat"');
  const brokenHelp = {
    ...course,
    sections: course.sections.map((s, i) => i ? s : { ...s, helpSkills: ["missing-skill"] }),
  } as unknown as CourseDefinition;
  expect(() => build(brokenHelp)).toThrow('Section "typo": unknown skill "missing-skill"');
  expect(() => build({ ...course, unlocks: {
    ...course.unlocks, paper: { afterSection: "missing-section" },
  } })).toThrow('Unlock "paper": unknown section "missing-section"');
});

for (const cursor of [-1, 0.5, 6, Number.NaN]) {
  test(`content validation rejects invalid cursor ${cursor}`, () => {
    expect(() => buildCurriculum(skillWithCursor(cursor), DOCUMENT_CONTENT, course))
      .toThrow(`Challenge "typo-0": invalid cursor ${cursor}`);
  });
}

test("content validation rejects mismatched sections and empty content", () => {
  expect(() => build({ ...course, sections: [] })).toThrow("Course has no sections");
  expect(() => build({ ...course, sections: course.sections.map((s, i) => i ? s : {
    ...s, challengeIds: [],
  }) })).toThrow('Section "typo": no challenges');
  expect(() => build({ ...course, sections: course.sections.map((s, i) => i ? s : {
    ...s, challengeIds: ["word-11"],
  }) })).toThrow('Section "typo": challenge "word-11" does not belong to skill "typo"');
  const badDocument = { ...DOCUMENT_CONTENT[0], skill: "missing-skill" } as unknown as DocumentContent;
  expect(() => buildCurriculum(SKILL_CONTENT, [badDocument], course))
    .toThrow('Challenge "final-document": unknown skill "missing-skill"');
  expect(() => practicePuzzle("missing-challenge"))
    .toThrow('Practice: unknown challenge "missing-challenge"');
});
