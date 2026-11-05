export type Skill =
  | "typo"
  | "word"
  | "line"
  | "visual"
  | "move"
  | "insert"
  | "replace"
  | "copy"
  | "count"
  | "find"
  | "search"
  | "object"
  | "repeat"
  | "match"
  | "jump"
  | "mark";
export type Mode = "normal" | "insert" | "visual";
export type Assistance = "guided" | "prompted" | "independent";
export type KeyStep = string;
export interface CoachingStep {
  document: string;
  target: string;
  cursor: number;
  keys: string[];
  text: string;
  editCursor?: number;
  editKeys?: string[];
  requiresYank?: boolean;
  requiresMark?: string;
}
export interface CourseSection {
  id: string;
  title: string;
  stamp: string;
  start: number;
  end: number;
  skill?: Skill;
}
export interface PuzzleSpec {
  id: string;
  variant: string;
  skill: Skill;
  showMode: boolean;
  helpSkills: readonly Skill[];
  helpTitle: string;
  world: string;
  title: string;
  goal: string;
  file: string;
  initial: string;
  cursor: number;
  target: string;
  assistance: Assistance;
  kind: "lesson" | "mixed" | "checkpoint" | "final" | "review";
  explanation: string;
  solutionKeys: KeyStep[];
  coaching?: CoachingStep[];
  objectives?: { text: string; includes?: string; excludes?: string }[];
  selectionTarget?: { from: number; to: number };
}
export interface CommandEvidence {
  skill: Skill;
  before: string;
  after: string;
}
export interface EditorSnapshot {
  document: string;
  cursor: number;
  selection: { from: number; to: number };
  mode: Mode;
  pending: boolean;
  evidence: CommandEvidence[];
  motionUsed: string[];
  marksSet: string[];
  lastCommand: string;
  commandKeys?: string;
  selectionMatched: boolean;
  copied?: boolean;
  repeatable?: boolean;
  searchDirection?: "forward" | "backward";
}
export interface AttemptResult {
  puzzleId: string;
  variant: string;
  skill: Skill;
  world: string;
  session: string;
  completed: boolean;
  assisted: boolean;
  hints: number;
  demonstrated: Skill[];
  mixed: boolean;
  completedAt: number;
}
export interface SavedAttempt {
  puzzleId: string;
  document: string;
  cursor: number;
  hints: number;
}
export interface ProgressState {
  version: 1;
  courseIndex: number;
  sectionOrder: string[];
  selectedSkills?: Skill[];
  /** The selected skills were shuffled; run them in `selectedSkills` order. */
  shuffledSkills?: boolean;
  attempts: AttemptResult[];
  lastActive: number;
  session: string;
  settings: {
    sound: boolean;
    theme: "ink" | "paper";
    cursor: boolean;
    effect: boolean;
  };
  active?: SavedAttempt;
  review: string[];
  reviewIndex: number;
  suspended?: SavedAttempt;
  celebration?: number;
}

export type CommandKey =
  | "x"
  | "h"
  | "l"
  | "w"
  | "b"
  | "ciw"
  | "j"
  | "k"
  | "dd"
  | "v"
  | "d"
  | "p"
  | "i"
  | "a"
  | "I"
  | "A"
  | "o"
  | "O"
  | "r"
  | "yy"
  | "yw"
  | "P"
  | "3w"
  | "2w"
  | "2dd"
  | "3x"
  | "3p"
  | "f"
  | "F"
  | "t"
  | "T"
  | ";"
  | ","
  | "/"
  | "?"
  | "n"
  | "N"
  | "ci\""
  | "ci'"
  | "ci("
  | "diw"
  | "daw"
  | "."
  | "0"
  | "gg"
  | "G"
  | "%"
  | "12G"
  | "<C-o>"
  | "<C-i>"
  | "ma"
  | "'a"
  | "`a"
  | "u"
  | "esc";
