import { SKILLS, SKILL_METADATA } from "@/lib/game/curriculum";

export const SITE_URL = "https://hjkl.duy.run";
export const SITE_NAME = "hjkl";
export const SITE_TITLE = "hjkl — learn Vim by doing";
export const SITE_TAGLINE = "Little edits. Lasting skills.";
export const AUTHOR = { name: "Duy Hua", url: "https://duy.run" };
export const SITE_DESCRIPTION =
  "Learn Vim in your browser with short, hands-on editing challenges. Practice motions, text objects, search, marks, counts, and repeats in a real Vim editor — free, no sign-up.";

export const SKILL_SUMMARIES = SKILLS.map((skill) => {
  const { name, keys } = SKILL_METADATA[skill];
  return { id: skill, name, keys: keys.map(([command, meaning]) => ({ command, meaning })) };
});

