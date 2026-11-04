import type { DocumentContent, SkillContent } from "./types";

// Content is shared by course and practice views. Freeze nested data too.
export function freezeContent<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeContent(child);
    Object.freeze(value);
  }
  return value;
}

export function defineSkill(content: SkillContent): SkillContent {
  return freezeContent(content);
}

export function defineDocument(content: DocumentContent): DocumentContent {
  return freezeContent(content);
}
