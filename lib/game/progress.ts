import type { ProgressState } from "./types";
import { DEFAULT_SECTION_ORDER, shuffleSkillSections } from "./run";
export const SESSION_GAP = 30 * 60 * 1000;
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
// Each mounted game owns its progress; a page reload starts from scratch.
export function initializeProgress(data: { current: ProgressState | null }) {
  data.current ??= { ...newProgress(), sectionOrder: shuffleSkillSections() };
}
