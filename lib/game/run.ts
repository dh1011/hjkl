import { course } from "./content/course";
import { buildCurriculum } from "./content/compile";
import { SKILL_CONTENT, DOCUMENT_CONTENT } from "./curriculum";
import type { Skill } from "./types";

export const DEFAULT_SECTION_ORDER = course.sections.map((section) => section.id);

/**
 * Selected skills always retain their authored teaching progression. With
 * `keepOrder`, skill blocks follow the order of `selectedSkills` (a shuffled
 * run) instead of the course order; each block's lessons stay in sequence.
 */
export function courseForSkills(
  selectedSkills: readonly Skill[],
  { keepOrder = false }: { keepOrder?: boolean } = {},
) {
  const sections = course.sections.filter(
    (section) => section.kind === "lesson" && selectedSkills.includes(section.skill!),
  );
  // Array.prototype.sort is stable, so a skill's own sections keep their order.
  if (keepOrder)
    sections.sort(
      (a, b) => selectedSkills.indexOf(a.skill!) - selectedSkills.indexOf(b.skill!),
    );
  if (!sections.length) throw new Error("Select at least one skill");
  const lastSection = sections.at(-1)!.id;
  const milestone = (name: keyof typeof course.unlocks) => ({
    afterSection: sections.some((section) => section.id === course.unlocks[name].afterSection)
      ? course.unlocks[name].afterSection
      : lastSection,
  });
  return buildCurriculum(SKILL_CONTENT, DOCUMENT_CONTENT, {
    ...course,
    sections,
    unlocks: { paper: milestone("paper"), cursor: milestone("cursor"), effect: milestone("effect") },
  });
}

/** Fisher-Yates shuffle of the selected skills for an opt-in shuffled run. */
export function shuffleSkills<T>(skills: readonly T[], random: () => number = Math.random): T[] {
  const result = [...skills];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Shuffle whole skill blocks; keep assessments behind the skills they use. */
export function shuffleSkillSections(random: () => number = Math.random): string[] {
  const lessons = course.sections.filter((section) => section.kind === "lesson");
  const assessments = course.sections.filter((section) => section.kind !== "lesson");
  for (let i = lessons.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [lessons[i], lessons[j]] = [lessons[j], lessons[i]];
  }

  const remaining = new Map<Skill, number>();
  for (const section of lessons) {
    const skill = section.skill!;
    remaining.set(skill, (remaining.get(skill) ?? 0) + 1);
  }
  const learned = new Set<Skill>();
  const order: string[] = [];
  let assessmentIndex = 0;
  for (const section of lessons) {
    order.push(section.id);
    const skill = section.skill!;
    const left = remaining.get(skill)! - 1;
    remaining.set(skill, left);
    if (left === 0) learned.add(skill);
    while (
      assessmentIndex < assessments.length &&
      assessments[assessmentIndex].helpSkills.every((id) => learned.has(id))
    ) {
      order.push(assessments[assessmentIndex++].id);
    }
  }
  if (assessmentIndex !== assessments.length)
    throw new Error(`Section "${assessments[assessmentIndex].id}" needs skills with no lesson section`);
  return order;
}

export function courseForRun(sectionOrder: readonly string[] = DEFAULT_SECTION_ORDER) {
  const byId = new Map(course.sections.map((section) => [section.id, section]));
  if (sectionOrder.length !== byId.size || new Set(sectionOrder).size !== byId.size)
    throw new Error("A run must contain every course section exactly once");
  const sections = sectionOrder.map((id) => {
    const section = byId.get(id);
    if (!section) throw new Error(`Run references unknown section "${id}"`);
    return section;
  });
  return buildCurriculum(SKILL_CONTENT, DOCUMENT_CONTENT, { ...course, sections });
}
