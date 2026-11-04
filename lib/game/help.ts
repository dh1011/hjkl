import type { PuzzleSpec, CommandKey } from "./types";
import { SKILL_METADATA } from "./curriculum";

export interface CommandHelp {
  key: string;
  meaning: string;
  example: string;
}
const commands = {
  x: {
    key: "x",
    meaning: "Delete the character under the cursor.",
    example: "hello[o] → hello",
  },
  h: {
    key: "h",
    meaning: "Move one character left.",
    example: "ca[t] → c[a]t",
  },
  l: {
    key: "l",
    meaning: "Move one character right.",
    example: "c[a]t → ca[t]",
  },
  w: {
    key: "w",
    meaning: "Move to the start of the next word.",
    example: "[b]uy red apples → buy [r]ed apples",
  },
  b: {
    key: "b",
    meaning: "Move back to the start of a word.",
    example: "buy [r]ed apples → [b]uy red apples",
  },
  ciw: {
    key: "ciw",
    meaning:
      "Change the word under the cursor, then type its replacement in Insert mode.",
    example: "[r]ed apples → green apples: press ciw, then type green.",
  },
  j: {
    key: "j",
    meaning: "Move down one line, keeping your column when possible.",
    example: "On line 1, j moves to line 2.",
  },
  k: {
    key: "k",
    meaning: "Move up one line, keeping your column when possible.",
    example: "On line 2, k moves to line 1.",
  },
  dd: {
    key: "dd",
    meaning:
      "Cut the entire current line. Vim keeps it so you can put it elsewhere.",
    example: "On the line “old warning”, press dd to remove that line.",
  },
  v: {
    key: "v",
    meaning:
      "Enter Visual mode. The character under the cursor is included in the selection.",
    example: "On [c]at, press vll to select all three letters.",
  },
  d: {
    key: "d",
    meaning: "Delete the text selected in Visual mode.",
    example: "Select “very ” in “very ready”, then d leaves “ready”.",
  },
  p: {
    key: "p",
    meaning:
      "Put cut text after the cursor. A cut line goes below the current line.",
    example:
      "In “B / A / C”, dd on B, then p, gives “A / B / C” (each item is a line).",
  },
  i: {
    key: "i",
    meaning: "Insert before the cursor.",
    example: "On [r]eport, i then the adds text before report.",
  },
  a: {
    key: "a",
    meaning: "Insert after the cursor.",
    example: "At the last letter, a then . adds a period.",
  },
  I: {
    key: "I",
    meaning: "Insert at the first nonblank character.",
    example: "I then TODO: adds a line prefix.",
  },
  A: {
    key: "A",
    meaning: "Append at the end of the line.",
    example: "A then ! adds an exclamation mark.",
  },
  o: {
    key: "o",
    meaning: "Open a line below and enter Insert mode.",
    example: "o then Review adds a new checklist entry below.",
  },
  O: {
    key: "O",
    meaning: "Open a line above and enter Insert mode.",
    example: "O then Verify adds a new entry above.",
  },
  r: {
    key: "r",
    meaning: "Replace the character under the cursor.",
    example: "r3 changes [0] to 3.",
  },
  yy: {
    key: "yy",
    meaning: "Copy the current line without deleting it.",
    example: "yyp duplicates the line below itself.",
  },
  yw: {
    key: "yw",
    meaning: "Copy from the cursor to the next word.",
    example: "At the start of “review notes”, ywP gives “review review notes”.",
  },
  P: {
    key: "P",
    meaning: "Put copied or cut text before the cursor; lines go above.",
    example: "yyP duplicates a line above itself.",
  },
  "3w": {
    key: "3w",
    meaning: "Move three words forward.",
    example: "In “Please mark task pending”, 3w reaches pending from Please.",
  },
  "2w": {
    key: "2w",
    meaning: "Move two words forward.",
    example: "In “task is pending”, 2w reaches pending.",
  },
  "2dd": {
    key: "2dd",
    meaning: "Delete two lines.",
    example: "2dd removes the current and following lines.",
  },
  "3x": {
    key: "3x",
    meaning: "Delete three characters.",
    example: "On “???ready”, 3x leaves ready.",
  },
  "3p": {
    key: "3p",
    meaning: "Put three copies of the register.",
    example: "yy3p leaves four copies of the current line.",
  },
  f: {
    key: "f",
    meaning: "Find the next occurrence of a character on this line.",
    example: "f: moves onto the next colon.",
  },
  F: {
    key: "F",
    meaning: "Find a character backward on this line.",
    example: "F: moves onto the previous colon.",
  },
  t: {
    key: "t",
    meaning: "Move just before the next occurrence of a character.",
    example: "t: stops just before the next colon.",
  },
  T: {
    key: "T",
    meaning: "Move just after the previous occurrence of a character.",
    example: "T: stops just after the previous colon.",
  },
  ";": {
    key: ";",
    meaning: "Repeat the last character find in its original direction.",
    example: "f: then ; reaches the second colon.",
  },
  ",": {
    key: ",",
    meaning: "Repeat the last character find in the opposite direction.",
    example: "After f:;, press , to return to the first colon.",
  },
  "/": {
    key: "/",
    meaning: "Search forward; type the term and press Enter.",
    example: "/pending then Enter finds pending.",
  },
  "?": {
    key: "?",
    meaning: "Search backward; type the term and press Enter.",
    example: "?pending then Enter finds the preceding pending.",
  },
  n: {
    key: "n",
    meaning: "Find the next match in the original search direction.",
    example: "After /pending, n moves to the next pending.",
  },
  N: {
    key: "N",
    meaning: "Find a match opposite to the original search direction.",
    example: "After /pending, N moves to the previous pending.",
  },
  'ci"': {
    key: 'ci"',
    meaning: "Change inside double quotes, keeping the quotes.",
    example: 'On “mode = "local"”, ci" then shared changes local to shared.',
  },
  "ci'": {
    key: "ci'",
    meaning: "Change inside single quotes, keeping the quotes.",
    example: "On region = 'local', ci' then shared replaces local.",
  },
  "ci(": {
    key: "ci(",
    meaning: "Change inside parentheses, keeping the parentheses.",
    example: "ci( then result changes send(old, value) to send(result).",
  },
  diw: {
    key: "diw",
    meaning: "Delete the inner word; leave surrounding space or punctuation.",
    example: "diw changes [draft] to [].",
  },
  daw: {
    key: "daw",
    meaning: "Delete a word and adjacent whitespace.",
    example: "On old, daw changes “Remove old notes” to “Remove notes”.",
  },
  ".": {
    key: ".",
    meaning: "Repeat the last text change at the cursor.",
    example: "After r1 on one flag, move to the next flag and press dot.",
  },
  "0": {
    key: "0",
    meaning: "Move to the start of the current line.",
    example: "j0 moves down a line, then to its first character.",
  },
  gg: {
    key: "gg",
    meaning: "Move to the first line.",
    example: "gg0 moves to the start of the document.",
  },
  G: {
    key: "G",
    meaning: "Move to the last line.",
    example: "Go opens a new line at the end of the document.",
  },
  "%": {
    key: "%",
    meaning: "Jump between matching parentheses, brackets, or braces.",
    example: "On the opening { of a configuration object, % reaches its closing }.",
  },
  "12G": {
    key: "12G",
    meaning: "Jump directly to a numbered line; replace 12 with the line you need.",
    example: "12G moves to line 12, while gg and G move to the first and last lines.",
  },
  "<C-o>": {
    key: "ctrl-o",
    meaning: "Go backward through the locations you jumped from.",
    example: "After G moves to the end, Ctrl-O returns to the earlier location.",
  },
  "<C-i>": {
    key: "ctrl-i",
    meaning: "Go forward through jump history after moving backward.",
    example: "After Ctrl-O, Ctrl-I revisits the newer jump location.",
  },
  ma: {
    key: "ma",
    meaning: "Set mark a at the current position.",
    example: "Place the cursor on an owner field and press ma before editing elsewhere.",
  },
  "'a": {
    key: "'a",
    meaning: "Return to the line containing mark a.",
    example: "'a returns to the first nonblank character on the marked line.",
  },
  "`a": {
    key: "`a",
    meaning: "Return to the exact character position stored in mark a.",
    example: "`a returns to the precise character where ma was set.",
  },
  u: {
    key: "u",
    meaning: "Undo the last edit in Normal mode.",
    example: "Accidentally changed hello to hell? Press u to restore hello.",
  },
  esc: {
    key: "esc",
    meaning:
      "Return to Normal mode or cancel a selection or unfinished command.",
    example:
      "Started a command by mistake? Escape cancels it without changing text.",
  },
} satisfies Record<CommandKey, CommandHelp>;
export function helpForPuzzle(puzzle: PuzzleSpec) {
  const keys = puzzle.helpSkills.flatMap((skill) => SKILL_METADATA[skill].helpKeys);
  return {
    title: puzzle.helpTitle,
    commands: [
      ...new Set<CommandKey>([...keys, "u", "esc"]),
    ].map((key) => commands[key]),
  };
}
