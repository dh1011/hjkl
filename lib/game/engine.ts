import type {
  AttemptResult,
  EditorSnapshot,
  ProgressState,
  PuzzleSpec,
  Skill,
} from "./types";
import { COURSE, SKILLS, VARIANTS } from "./curriculum";
export function evaluate(p: PuzzleSpec, s: EditorSnapshot) {
  const correct = s.document === p.target;
  // Passing depends on the document, finished like a real edit: back in
  // Normal mode with no pending command. Observed commands only inform mastery.
  return { correct, complete: correct && s.mode === "normal" && !s.pending };
}
export function mastery(skill: Skill, attempts: AttemptResult[]) {
  const relevant = attempts.filter(
    (a) => a.completed && a.demonstrated.includes(skill),
  );
  const independent = relevant.filter((a) => !a.assisted);
  const distinct = [
    ...new Map(independent.map((a) => [a.variant, a])).values(),
  ];
  const worlds = new Set(independent.map((a) => a.world)).size,
    sessions = new Set(independent.map((a) => a.session)).size;
  if (
    distinct.length >= 6 &&
    worlds >= 3 &&
    sessions >= 3 &&
    distinct.filter((a) => a.mixed).length >= 2
  )
    return "Fluent";
  if (distinct.length >= 4 && worlds >= 2 && sessions >= 2) return "Consistent";
  if (distinct.length >= 2) return "Independent";
  if (relevant.length) return "Guided";
  return "New";
}
function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function selectReview(
  state: ProgressState,
  selectedSkills: readonly Skill[],
  random: () => number = Math.random,
): string[] {
  const selected = [...new Set(selectedSkills)].filter((skill) =>
    SKILLS.includes(skill),
  );
  if (!selected.length) return [];
  const courseIds = new Set(COURSE.map((puzzle) => puzzle.id));
  const seen = new Set(state.attempts.map((a) => a.variant));
  const lastSeen = (id: string) =>
    Math.max(
      0,
      ...state.attempts
        .filter((a) => a.variant === id)
        .map((a) => a.completedAt),
    );
  const slots: Skill[] = [];
  while (slots.length < 3)
    for (const skill of shuffled(selected, random)) {
      slots.push(skill);
      if (slots.length === 3) break;
    }
  const chosen: string[] = [];
  for (const skill of slots) {
    const candidates = VARIANTS.filter(
      (p) => p.skill === skill && !chosen.includes(p.id),
    );
    candidates.sort(
      (a, b) =>
        Number(seen.has(a.id)) - Number(seen.has(b.id)) ||
        lastSeen(a.id) - lastSeen(b.id) ||
        Number(courseIds.has(a.id)) - Number(courseIds.has(b.id)),
    );
    if (candidates[0]) chosen.push(candidates[0].id);
  }
  return chosen;
}
export function recovery(p: PuzzleSpec, s: EditorSnapshot): string | undefined {
  if (s.mode === "insert" || s.pending) return;
  if (s.document === p.target) return;
  if (
    s.lastCommand === "dd" &&
    p.skill !== "move" &&
    !p.objectives &&
    !p.coaching
  )
    return "Off track. Press u to undo.";
  if (
    s.document.split("\n").length < p.target.split("\n").length &&
    p.skill !== "move" &&
    !p.coaching &&
    !p.objectives
  )
    return "Off track. Press u to undo.";
}
/** Keys in the authored example: each `<…>` name is one key, as is each character. */
export function exampleKeyCount(p: PuzzleSpec) {
  return p.solutionKeys.reduce(
    (total, step) => total + (step.match(/<[^>]+>|[\s\S]/g)?.length ?? 0),
    0,
  );
}
export function displayKey(key: string) {
  return key === "<Esc>"
    ? "esc"
    : key === " "
      ? "space"
      : key === "<CR>"
        ? "enter"
        : key.replaceAll("<CR>", " enter").replaceAll("<Esc>", " esc");
}
