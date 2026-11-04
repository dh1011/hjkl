import { typo } from "./content/skills/typo";
import { word } from "./content/skills/word";
import { line } from "./content/skills/line";
import { visual } from "./content/skills/visual";
import { move } from "./content/skills/move";
import { insert } from "./content/skills/insert";
import { replace } from "./content/skills/replace";
import { copy } from "./content/skills/copy";
import { count } from "./content/skills/count";
import { find } from "./content/skills/find";
import { search } from "./content/skills/search";
import { object } from "./content/skills/object";
import { repeat } from "./content/skills/repeat";
import { match } from "./content/skills/match";
import { jump } from "./content/skills/jump";
import { mark } from "./content/skills/mark";
import { finalDocument } from "./content/documents/final-document";
import { workMessage } from "./content/documents/work-message";
import { workConfig } from "./content/documents/work-config";
import { workChecklist } from "./content/documents/work-checklist";
import { workQueue } from "./content/documents/work-queue";
import { workScript } from "./content/documents/work-script";
import { workNotes } from "./content/documents/work-notes";
import { workFinalDocument } from "./content/documents/work-final-document";
import { advancedFinalDocument } from "./content/documents/advanced-final-document";
import { course } from "./content/course";
import { buildCurriculum } from "./content/compile";

export const SKILL_CONTENT = [typo, word, line, visual, move, insert, replace, copy, count, find, search, object, repeat, match, jump, mark];
export const DOCUMENT_CONTENT = [finalDocument, workMessage, workConfig, workChecklist, workQueue, workScript, workNotes, workFinalDocument, advancedFinalDocument];

const compiled = buildCurriculum(SKILL_CONTENT, DOCUMENT_CONTENT, course);
export const { COURSE, SECTIONS, SKILLS, LEVELS, SKILL_METADATA, VARIANTS, PUZZLES, UNLOCKS } = compiled;
export const sectionForIndex = (index: number) =>
  SECTIONS.find((section) => index >= section.start && index < section.end)!;
export const practicePuzzle = compiled.practicePuzzle;
