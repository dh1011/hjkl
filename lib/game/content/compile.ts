import type { CourseSection, PuzzleSpec, Skill } from "../types";
import { freezeContent } from "./helpers";
import type {
  ChallengeContent,
  CourseDefinition,
  DocumentContent,
  SkillContent,
} from "./types";

/** Resolve authored IDs into independent course and practice presentations. */
export function buildCurriculum(
  skills: readonly SkillContent[],
  documents: readonly DocumentContent[],
  definition: CourseDefinition,
) {
  const metadata = new Map<Skill, SkillContent>();
  const canonical = new Map<string, PuzzleSpec>();
  const variants: PuzzleSpec[] = [];
  const course: PuzzleSpec[] = [];
  const sections: CourseSection[] = [];
  const sectionsById = new Map<string, CourseSection>();
  const courseIds = new Set<string>();

  function requireSkill(id: Skill, owner: string) {
    const skill = metadata.get(id);
    if (!skill) throw new Error(`${owner}: unknown skill "${id}"`);
    return skill;
  }

  function validateChallenge(challenge: ChallengeContent) {
    if (!challenge.id || canonical.has(challenge.id))
      throw new Error(`Duplicate or empty challenge ID "${challenge.id}"`);
    if (
      !Number.isInteger(challenge.cursor) ||
      challenge.cursor < 0 ||
      challenge.cursor >= Math.max(1, challenge.initial.length)
    )
      throw new Error(`Challenge "${challenge.id}": invalid cursor ${challenge.cursor}`);
    if (challenge.initial === challenge.target)
      throw new Error(`Challenge "${challenge.id}": starting text already matches the target`);
    if (!challenge.solutionKeys.length)
      throw new Error(`Challenge "${challenge.id}": missing solution keys`);
  }

  for (const skill of skills) {
    if (metadata.has(skill.id))
      throw new Error(`Duplicate skill ID "${skill.id}"`);
    metadata.set(skill.id, skill);
  }

  for (const skill of skills) {
    for (const challenge of skill.challenges) {
      validateChallenge(challenge);
      const puzzle: PuzzleSpec = freezeContent({
        ...structuredClone(challenge),
        variant: challenge.id,
        skill: skill.id,
        kind: "lesson",
        showMode: skill.showMode,
        helpSkills: [skill.id],
        helpTitle: skill.name,
      });
      canonical.set(puzzle.id, puzzle);
      variants.push(puzzle);
    }
  }

  for (const document of documents) {
    validateChallenge(document);
    requireSkill(document.skill, `Challenge "${document.id}"`);
    canonical.set(document.id, freezeContent({
      ...structuredClone(document),
      variant: document.id,
      showMode: true,
      helpSkills: [document.skill],
      helpTitle: document.title,
    }));
  }

  if (!definition.sections.length) throw new Error("Course has no sections");
  for (const section of definition.sections) {
    const owner = `Section "${section.id}"`;
    if (!section.id || sectionsById.has(section.id))
      throw new Error(`Duplicate or empty section ID "${section.id}"`);
    if (!section.challengeIds.length) throw new Error(`${owner}: no challenges`);
    if (!section.helpSkills.length) throw new Error(`${owner}: no help skills`);
    for (const id of section.helpSkills) requireSkill(id, owner);
    if (section.skill) requireSkill(section.skill, owner);
    if (section.kind === "lesson" && !section.skill)
      throw new Error(`${owner}: a lesson section needs a skill`);
    const start = course.length;
    for (const id of section.challengeIds) {
      const puzzle = canonical.get(id);
      if (!puzzle) throw new Error(`${owner}: unknown challenge "${id}"`);
      if (courseIds.has(id)) throw new Error(`${owner}: duplicate course challenge "${id}"`);
      if (section.kind === "lesson" &&
          (puzzle.kind !== "lesson" || puzzle.skill !== section.skill))
        throw new Error(`${owner}: challenge "${id}" does not belong to skill "${section.skill}"`);
      if (section.kind !== puzzle.kind &&
          !(section.kind === "mixed" && puzzle.kind === "lesson"))
        throw new Error(`${owner}: challenge "${id}" has incompatible kind "${puzzle.kind}"`);
      courseIds.add(id);
      course.push(freezeContent({
        ...puzzle,
        kind: section.kind,
        ...(section.kind !== "lesson"
          ? { assistance: "independent" as const, selectionTarget: undefined }
          : {}),
        helpSkills: [...section.helpSkills],
        helpTitle: section.title,
      }));
    }
    const resolved: CourseSection = {
      id: section.id,
      title: section.title,
      stamp: section.stamp,
      start,
      end: course.length,
      ...(section.skill ? { skill: section.skill } : {}),
    };
    sections.push(resolved);
    sectionsById.set(section.id, resolved);
  }

  function unlock(name: keyof CourseDefinition["unlocks"]) {
    const id = definition.unlocks[name].afterSection;
    const section = sectionsById.get(id);
    if (!section) throw new Error(`Unlock "${name}": unknown section "${id}"`);
    return section.end;
  }

  return freezeContent({
    COURSE: course,
    SECTIONS: sections,
    SKILLS: skills.map((skill) => skill.id),
    LEVELS: skills.map(({ name, subtitle, stamp, keys }) => ({ name, subtitle, stamp, keys })),
    SKILL_METADATA: Object.fromEntries(metadata) as Record<Skill, SkillContent>,
    VARIANTS: variants,
    // Preserve the existing lookup API: course appearances take precedence.
    // Canonical definitions and practice variants remain untouched.
    PUZZLES: Object.fromEntries([...canonical, ...course.map((p) => [p.id, p] as const)]),
    UNLOCKS: { paper: unlock("paper"), cursor: unlock("cursor"), effect: unlock("effect") },
    practicePuzzle(id: string): PuzzleSpec {
      const puzzle = canonical.get(id);
      if (!puzzle) throw new Error(`Practice: unknown challenge "${id}"`);
      return freezeContent({
        ...puzzle,
        kind: "review",
        assistance: "independent",
        selectionTarget: undefined,
        helpSkills: [puzzle.skill],
        helpTitle: requireSkill(puzzle.skill, `Challenge "${id}"`).name,
      });
    },
  });
}
