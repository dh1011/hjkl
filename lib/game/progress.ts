import type { ProgressState } from "./types";
import {
  courseForRun,
  courseForSkills,
  DEFAULT_SECTION_ORDER,
  shuffleSkillSections,
} from "./run";
import { PUZZLES, SKILLS } from "./curriculum";
export const SESSION_GAP = 30 * 60 * 1000;
/** Only written while the learner has turned on Remember progress. */
export const PROGRESS_KEY = "hjkl:progress:v1";
export function newProgress(now = Date.now()): ProgressState {
  return {
    version: 1,
    courseIndex: 0,
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    attempts: [],
    lastActive: now,
    session: `session-${now}`,
    settings: { sound: false, theme: "ink", cursor: false, effect: false },
    review: [],
    reviewIndex: 0,
  };
}

function runFor(state: ProgressState) {
  return state.selectedSkills
    ? courseForSkills(state.selectedSkills)
    : courseForRun(state.sectionOrder);
}
/** Identifies the exact challenge list a saved run was made from. */
function fingerprint(state: ProgressState) {
  return runFor(state)
    .COURSE.map((puzzle) => puzzle.id)
    .join(",");
}

/**
 * Restores an opted-in saved run. Anything unreadable, from another version,
 * or made from different course content starts fresh instead.
 */
export function loadProgress(): ProgressState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PROGRESS_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as {
      state: ProgressState;
      course: string;
    };
    const state = saved.state;
    if (state?.version !== 1 || !state.settings?.remember) throw Error("stale");
    if (state.selectedSkills?.some((skill) => !SKILLS.includes(skill)))
      throw Error("stale");
    if (saved.course !== fingerprint(state)) throw Error("stale");
    const total = runFor(state).COURSE.length;
    if (
      !Number.isInteger(state.courseIndex) ||
      state.courseIndex < 0 ||
      state.courseIndex > total ||
      !Array.isArray(state.attempts) ||
      !state.review.every((id) => id in PUZZLES)
    )
      throw Error("stale");
    return state;
  } catch {
    forgetProgress();
    return null;
  }
}
export function saveProgress(state: ProgressState | null) {
  if (!state?.settings.remember) return;
  try {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ state, course: fingerprint(state) }),
    );
  } catch {
    // Storage can be full, blocked or unavailable; play continues in memory.
  }
}
export function forgetProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {}
}

// Each mounted game owns its progress. A reload starts from scratch unless the
// learner opted in to Remember progress, which restores the saved run.
export function initializeProgress(data: { current: ProgressState | null }) {
  data.current ??= loadProgress() ?? {
    ...newProgress(),
    sectionOrder: shuffleSkillSections(),
  };
}
