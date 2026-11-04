import { ArrowRight } from "lucide-react";
import type { PuzzleSpec } from "@/lib/game/types";

// Keep just the changed words; the editor already supplies their context.
function changedWords(initial: string, target: string) {
  const before = initial.split(/(\s+)/);
  const after = target.split(/(\s+)/);
  while (before.length && after.length && before[0] === after[0]) {
    before.shift();
    after.shift();
  }
  while (before.length && after.length && before.at(-1) === after.at(-1)) {
    before.pop();
    after.pop();
  }
  return { before: before.join(""), after: after.join("") };
}

function changedSegment(initial: string, target: string) {
  let start = 0;
  while (
    start < initial.length &&
    start < target.length &&
    initial[start] === target[start]
  )
    start++;
  const word = (character: string | undefined) =>
    !!character && /[\p{L}\p{N}_]/u.test(character);
  while (
    start > 0 &&
    word(initial[start - 1]) &&
    word(initial[start]) &&
    word(target[start])
  )
    start--;
  let beforeEnd = initial.length;
  let afterEnd = target.length;
  while (
    beforeEnd > start &&
    afterEnd > start &&
    initial[beforeEnd - 1] === target[afterEnd - 1]
  ) {
    beforeEnd--;
    afterEnd--;
  }
  while (
    beforeEnd < initial.length &&
    afterEnd < target.length &&
    word(initial[beforeEnd - 1]) &&
    word(initial[beforeEnd]) &&
    word(target[afterEnd - 1]) &&
    word(target[afterEnd])
  ) {
    beforeEnd++;
    afterEnd++;
  }
  return {
    prefix: target.slice(0, start),
    before: initial.slice(start, beforeEnd),
    after: target.slice(start, afterEnd),
    suffix: target.slice(afterEnd),
  };
}

function practiceChanges(initial: string, target: string) {
  const before = initial.split("\n");
  const after = target.split("\n");
  return after.flatMap((line, index) => {
    if (before[index] === line) return [];
    const change = changedSegment(before[index] ?? "", line);
    return [
      <div className="objective-diff-row" key={index}>
        {change.prefix && <span>{change.prefix}</span>}
        {change.before && <s>{change.before}</s>}
        {change.before && change.after && <ArrowRight size={16} />}
        {change.after && <mark>{change.after}</mark>}
        {change.suffix && <span>{change.suffix}</span>}
      </div>,
    ];
  });
}

export function GameObjective({
  puzzle,
  instruction,
  complete,
}: {
  puzzle: PuzzleSpec;
  instruction: string;
  complete: boolean;
}) {
  const inline =
    !puzzle.objectives && (puzzle.skill === "typo" || puzzle.skill === "word");
  const change = inline ? changedWords(puzzle.initial, puzzle.target) : null;
  const highlightLongTarget =
    !puzzle.objectives && puzzle.initial.split("\n").length >= 8;

  return (
    <div className="objective">
      <h1 id="editing-goal" className="sr-only">
        {instruction}
      </h1>
      {complete ? (
        <div aria-hidden="true">Good edit.</div>
      ) : change ? (
        <div className="objective-change" aria-hidden="true">
          <s>{change.before}</s>
          <ArrowRight size={20} />
          <span>{change.after}</span>
        </div>
      ) : (
        <div className="objective-target" role="group" aria-label="Target text">
          <span className="objective-label" aria-hidden="true">
            {highlightLongTarget ? "Target changes" : "Target"}
          </span>
          {highlightLongTarget ? (
            <div className="objective-diffs" aria-hidden="true">
              {practiceChanges(puzzle.initial, puzzle.target)}
            </div>
          ) : (
            <pre>{puzzle.target}</pre>
          )}
        </div>
      )}
    </div>
  );
}
