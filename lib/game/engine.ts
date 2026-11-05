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
  // Passing depends on the document. Observed commands only inform mastery.
  return { correct, complete: correct };
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
/** Character edit distance, trimmed to the region where the texts differ. */
export function editDistance(a: string, b: string) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length,
    endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const x = a.slice(start, endA),
    y = b.slice(start, endB);
  let row = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const next = [i];
    for (let j = 1; j <= y.length; j++)
      next[j] = Math.min(
        row[j] + 1,
        next[j - 1] + 1,
        row[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[y.length];
}
/**
 * Opt-in undo reminder for prompted and independent edits. Valid alternative
 * routes leave the authored path, so a reminder also requires the text to be
 * further from the target than the starting text was.
 */
export function undoReminder(
  p: PuzzleSpec,
  s: EditorSnapshot,
  cue: { recover?: boolean },
): string | undefined {
  if (s.mode !== "normal" || s.pending || s.document === p.target) return;
  if (!recovery(p, s) && !cue.recover) return;
  if (editDistance(s.document, p.target) <= editDistance(p.initial, p.target))
    return;
  return "Off track. Press u to undo.";
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
