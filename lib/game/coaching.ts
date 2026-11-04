import type { EditorSnapshot, PuzzleSpec } from "./types";

export interface Cue {
  key?: string;
  text: string;
  /** An off-track cue pointing back with undo. */
  recover?: boolean;
}

/** Return one Normal-mode command, leaving typed text to live Insert-mode cues. */
function firstCommand(keys: string[]): string {
  const text = keys.join("");
  if (/^[/?]/.test(text)) return text.slice(0, text.indexOf("<CR>") + 4);
  return (
    text.match(
      /^(?:[1-9]\d*G|<C-[oi]>|m.|[\x27`].|(?:[1-9]\d*)?(?:[cd][ia][w"'()]|d[dw]|y[yw]|[rfFtT].|gg|.))/,
    )?.[0] ?? text
  );
}

/** A single immediate action, derived from the player's buffer, never a queued script. */
export function nextCue(p: PuzzleSpec, s: EditorSnapshot): Cue {
  const back = (): Cue =>
    s.mode === "normal"
      ? {
          key: "u",
          text: "Off track. Press u to undo.",
          recover: true,
        }
      : {
          key: "<Esc>",
          text: "Off track. Press esc, then u to undo.",
          recover: true,
        };
  const command = (key: string, text: string): Cue => ({
    key:
      s.pending && s.commandKeys && key.startsWith(s.commandKeys)
        ? key.slice(s.commandKeys.length)
        : key,
    text,
  });
  if (s.document === p.target) return { text: "Text is correct." };

  if (p.objectives)
    return s.mode === "normal"
      ? {
          text: "Choose one fix in the goal. If an edit went wrong, u brings it back.",
        }
      : back();

  if (p.coaching) {
    if (s.pending) {
      const stage = p.coaching.find((step) => step.document === s.document);
      if (stage && s.commandKeys) {
        const candidates = [stage.keys, stage.editKeys ?? []];
        const pending = candidates
          .map(firstCommand)
          .find((keys) => keys.startsWith(s.commandKeys!));
        if (pending) return command(pending, stage.text);
      }
      return {
        key: "<Esc>",
        text: "Cancel the unfinished command, then continue toward the target.",
      };
    }
    if (s.mode === "insert") {
      for (const step of p.coaching) {
        const prefix = s.document.slice(0, s.cursor),
          suffix = s.document.slice(s.cursor);
        if (
          step.target.startsWith(prefix) &&
          step.target.endsWith(suffix) &&
          step.target.length >= s.document.length
        ) {
          const missing = step.target.slice(
            prefix.length,
            step.target.length - suffix.length,
          );
          return missing
            ? { key: missing, text: "Type the missing text." }
            : { key: "<Esc>", text: "Return to Normal for the next edit." };
        }
      }
      return { text: "Edit this text to match the target, then press Escape." };
    }
    if (s.mode !== "normal") return back();
    const stage = p.coaching.find((step) => step.document === s.document);
    if (!stage)
      return {
        text: "Off track. Press u to undo.",
        recover: true,
      };
    const readyToEdit =
      (!stage.requiresYank || s.copied) &&
      (!stage.requiresMark || s.marksSet.includes(stage.requiresMark));
    if (readyToEdit && stage.editCursor === s.cursor && stage.editKeys)
      return { key: firstCommand(stage.editKeys), text: stage.text };
    if (
      p.skill === "search" &&
      s.searchDirection &&
      stage.editCursor !== undefined
    ) {
      const forward = s.cursor < stage.editCursor;
      return {
        key: forward === (s.searchDirection === "forward") ? "n" : "N",
        text: "Reach the match shown in the target.",
      };
    }
    if (stage.cursor === s.cursor && (!stage.requiresYank || !s.copied))
      return {
        key:
          stage.keys[0] === "." && !s.repeatable
            ? firstCommand(p.coaching[0].keys)
            : firstCommand(stage.keys),
        text:
          stage.keys[0] === "." && !s.repeatable
            ? "Make this correction again; there is no remembered edit in this attempt."
            : stage.text,
      };
    const destination = readyToEdit
      ? (stage.editCursor ?? stage.cursor)
      : stage.cursor;
    const row = s.document.slice(0, s.cursor).split("\n").length;
    const targetRow = s.document.slice(0, destination).split("\n").length;
    return {
      key:
        row !== targetRow
          ? row < targetRow
            ? "j"
            : "k"
          : s.cursor < destination
            ? "l"
            : "h",
      text: "Move to the next edit in the target.",
    };
  }

  if (p.skill === "word") {
    const quoted = [...p.goal.matchAll(/“([^”]+)”/g)].map((m) => m[1]);
    const [old, replacement] = quoted;
    if (!old || !replacement) return back();
    const from = p.initial.indexOf(old),
      to = from + old.length;
    if (s.mode === "insert") {
      const prefix = p.initial.slice(0, from),
        suffix = p.initial.slice(to);
      if (s.document.startsWith(prefix) && s.document.endsWith(suffix)) {
        const typed = s.document.slice(from, s.document.length - suffix.length);
        if (replacement.startsWith(typed))
          return {
            key: replacement.slice(typed.length),
            text: "Type the replacement.",
          };
      }
      return {
        text: `Make the replacement read “${replacement}”, then press Escape.`,
      };
    }
    if (s.mode !== "normal" || s.document !== p.initial) return back();
    if (s.cursor < from) return { key: "w", text: `Move to “${old}”.` };
    if (s.cursor >= to) return { key: "b", text: `Move back to “${old}”.` };
    return command("ciw", "Change this word.");
  }

  if (s.mode !== "normal" && !(p.skill === "visual" && s.mode === "visual"))
    return back();
  if (p.skill === "typo" && s.document === p.initial) {
    const positions = [...p.initial].flatMap((_, i) =>
      p.initial.slice(0, i) + p.initial.slice(i + 1) === p.target ? [i] : [],
    );
    if (positions.includes(s.cursor))
      return { key: "x", text: "Delete this character." };
    return {
      key: s.cursor < positions[0] ? "l" : "h",
      text:
        s.cursor < positions[0]
          ? "Move right to the extra letter."
          : "Move left to the extra letter.",
    };
  }
  if (p.skill === "visual" && s.document === p.initial) {
    let from = 0;
    while (p.initial[from] === p.target[from] && from < p.target.length) from++;
    const target = p.selectionTarget ?? {
      from,
      to: from + p.initial.length - p.target.length,
    };
    if (s.mode === "normal") {
      if (s.cursor < target.from)
        return { key: "l", text: "Move to the phrase." };
      if (s.cursor >= target.to)
        return { key: "h", text: "Move back to the phrase." };
      return { key: "v", text: "Start selecting the phrase." };
    }
    if (s.selection.from === target.from && s.selection.to === target.to)
      return { key: "d", text: "Delete the selection." };
    const reverse = p.cursor === target.to - 1;
    return {
      key: reverse
        ? s.selection.from > target.from
          ? "h"
          : "l"
        : s.selection.to < target.to
          ? "l"
          : "h",
      text: "Extend the selection to match the outline.",
    };
  }
  if (p.skill === "line" || p.skill === "move") {
    const rows = p.initial.split("\n"),
      targets = p.target.split("\n");
    const source =
      p.skill === "line"
        ? rows.findIndex((row) => !targets.includes(row))
        : rows.findIndex((row, i) => row !== targets[i]);
    const at = s.document.slice(0, s.cursor).split("\n").length - 1;
    if (s.document === p.initial) {
      if (at !== source)
        return {
          key: at < source ? "j" : "k",
          text: at < source ? "Move down to the line." : "Move up to the line.",
        };
      return command(
        "dd",
        p.skill === "line" ? "Delete this line." : "Cut this line.",
      );
    }
    if (
      p.skill === "move" &&
      s.document === rows.filter((_, i) => i !== source).join("\n") &&
      s.evidence.some((e) => e.skill === "line")
    ) {
      if (at !== source)
        return {
          key: at < source ? "j" : "k",
          text: "Move to the line it should follow.",
        };
      return { key: "p", text: "Put the cut line underneath." };
    }
  }
  return back();
}

/** Objectives describe each document; edit order is unrestricted. */
export function documentGoal(puzzle: PuzzleSpec, document: string): string {
  return (
    puzzle.objectives?.find(
      (goal) =>
        (goal.includes !== undefined && !document.includes(goal.includes)) ||
        (goal.excludes !== undefined && document.includes(goal.excludes)),
    )?.text ?? "Keep the heading and put the document in its final order."
  );
}
