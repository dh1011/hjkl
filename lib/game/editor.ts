import { EditorView, basicSetup } from "codemirror";
import { Decoration, type DecorationSet } from "@codemirror/view";
import { EditorState, StateField } from "@codemirror/state";
import { setSearchQuery } from "@codemirror/search";
import { Vim, getCM } from "@replit/codemirror-vim";
import { vim } from "@replit/codemirror-vim";
import type {
  CommandEvidence,
  EditorSnapshot,
  Mode,
  PuzzleSpec,
  SavedAttempt,
  Skill,
} from "./types";

interface Options {
  puzzle: PuzzleSpec;
  parent: HTMLElement;
  saved?: SavedAttempt;
  demo?: boolean;
  onChange: (snapshot: EditorSnapshot) => void;
  onNudge: (text: string) => void;
  onHelp?: () => void;
  locked: () => boolean;
}
// Ex commands are registered globally by Vim; callbacks belong to each editor.
const helpActions = new WeakMap<object, () => void>();
Vim.defineEx("help", "h", (cm) => helpActions.get(cm)?.());

export class GameEditor {
  view: EditorView;
  private options: Options;
  private alive = true;
  private evidence: CommandEvidence[] = [];
  private motionUsed = new Set<string>();
  private marksSet = new Set<string>();
  private before = "";
  private beforeCursor = 0;
  private navigation = new Set<Skill>();
  private yanked = false;
  private observedFind = false;
  private observedSearch = false;
  private searchDirection?: "forward" | "backward";
  private observedChange = false;
  private keys: string[] = [];
  private lastCommand = "";
  private selectedMatch = false;
  private selectionMatched = false;
  private hasFreshKey = false;
  private pendingFlush = false;
  private cut?: { text: string; before: string };
  constructor(options: Options) {
    this.options = options;
    const p = options.puzzle;
    if (!options.demo) Vim.resetVimGlobalState_();
    const outline = StateField.define<DecorationSet>({
      create: () => Decoration.none,
      update: (_, tr) => {
        const target = p.selectionTarget;
        return target && tr.state.doc.toString() === p.initial
          ? Decoration.set([
              Decoration.mark({ class: "trace-outline" }).range(
                target.from,
                target.to,
              ),
            ])
          : Decoration.none;
      },
      provide: (field) => EditorView.decorations.from(field),
    });
    const doc = options.saved?.document ?? p.initial;
    this.view = new EditorView({
      parent: options.parent,
      state: EditorState.create({
        doc: p.initial,
        selection: { anchor: p.cursor },
        extensions: [
          vim(),
          basicSetup,
          outline,
          EditorView.contentAttributes.of({
            "aria-label": options.demo
              ? "Demonstration editor"
              : "Vim practice editor",
            spellcheck: "false",
            autocapitalize: "off",
            autocorrect: "off",
          }),
          EditorView.updateListener.of((update) => {
            // Delayed Vim search highlights replace text nodes. WebKit can
            // lose the DOM selection even though the editor state is correct.
            // Reapply it after highlighting, without stealing prompt focus.
            if (
              update.view.hasFocus &&
              update.transactions.some((transaction) =>
                transaction.effects.some((effect) => effect.is(setSearchQuery)),
              )
            ) {
              const range = update.state.selection.main;
              const anchor = update.view.domAtPos(range.anchor);
              const head = update.view.domAtPos(range.head);
              update.view.dom.ownerDocument.getSelection()?.setBaseAndExtent(
                anchor.node, anchor.offset, head.node, head.offset,
              );
            }
            this.schedule();
          }),
        ],
      }),
    });
    // A restored buffer has one recovery step back to its original puzzle.
    // This initialization is never recorded as player technique evidence.
    this.view.dispatch({
      ...(doc !== p.initial
        ? { changes: { from: 0, to: p.initial.length, insert: doc } }
        : {}),
      selection: {
        anchor: Math.min(
          doc.length,
          Math.max(0, options.saved?.cursor ?? p.cursor),
        ),
      },
    });
    helpActions.set(getCM(this.view)!, () => {
      // Let Vim close its command prompt before the help panel takes focus.
      queueMicrotask(() => {
        if (this.alive && !this.options.locked()) this.options.onHelp?.();
      });
    });
    this.view.dom.addEventListener("keydown", this.keydown, true);
    this.view.dom.addEventListener("keyup", this.afterKey);
    this.view.dom.addEventListener("pointerdown", this.pointer, true);
    this.view.dom.addEventListener("paste", this.paste, true);
    getCM(this.view)!.on("vim-mode-change", () => this.schedule());
    getCM(this.view)!.on("vim-command-done", () => this.schedule());
    this.before = doc;
    this.schedule();
  }
  private mode(): Mode {
    const s = getCM(this.view)!.state.vim;
    return s?.insertMode ? "insert" : s?.visualMode ? "visual" : "normal";
  }
  private pending() {
    const s = getCM(this.view)!.state.vim;
    return !!(
      s?.inputState.operator ||
      s?.inputState.keyBuffer.length ||
      s?.inputState.prefixRepeat.length ||
      (
        getCM(this.view)!.state.dialog as HTMLElement | undefined
      )?.querySelector("input")
    );
  }
  snapshot(): EditorSnapshot {
    const range = this.view.state.selection.main;
    return {
      document: this.view.state.doc.toString(),
      cursor: range.head,
      selection: { from: range.from, to: range.to },
      mode: this.mode(),
      pending: this.pending(),
      evidence: [...this.evidence],
      motionUsed: [...this.motionUsed],
      marksSet: [...this.marksSet],
      lastCommand: this.lastCommand,
      commandKeys: this.keys.join(""),
      selectionMatched: this.selectionMatched,
      copied: this.yanked,
      repeatable: this.observedChange,
      searchDirection: this.searchDirection,
    };
  }
  private schedule() {
    if (this.pendingFlush || !this.alive) return;
    this.pendingFlush = true;
    queueMicrotask(() => {
      this.pendingFlush = false;
      if (this.alive) {
        this.finishCommand();
        this.options.onChange(this.snapshot());
      }
    });
  }
  private beforeKey(key: string) {
    if (this.mode() === "normal" && !this.pending()) {
      this.before = this.view.state.doc.toString();
      this.beforeCursor = this.view.state.selection.main.head;
      this.keys = [];
      this.selectedMatch = false;
    }
    if (this.mode() !== "insert") this.keys.push(key);
    if (this.mode() === "visual" && ["d", "x"].includes(key)) {
      const r = this.view.state.selection.main,
        t = this.options.puzzle.selectionTarget;
      this.selectedMatch = !t || (r.from === t.from && r.to === t.to);
    }
    if (this.mode() === "normal" && ["w", "b"].includes(key) && !this.pending())
      this.motionUsed.add(key);
  }
  private finishCommand() {
    if (this.mode() !== "normal" || this.pending() || !this.keys.length) return;
    const command = this.keys.join("");
    this.lastCommand = command;
    this.keys = [];
    const after = this.view.state.doc.toString(),
      before = this.before;
    // Undo invalidates technique evidence, including actions whose letters were merely typed.
    if (command === "u" || command === "<C-r>") {
      this.evidence = [];
      this.cut = undefined;
      this.selectionMatched = false;
      this.clearProvenance();
      return;
    }
    const moved = this.beforeCursor !== this.view.state.selection.main.head;
    if (before === after) {
      if (/^\d*y[yw]$/.test(command)) {
        this.yanked = true;
        this.cut = undefined;
      }
      if (/^[fFtT].$/.test(command) && moved) this.observedFind = true;
      const markSet = command.match(/^m([a-z])$/);
      if (markSet) {
        this.marksSet.add(markSet[1]);
        this.motionUsed.add(command);
      }
      if (/^[/?].*<CR>$/.test(command) && moved) {
        this.observedSearch = true;
        this.searchDirection = command.startsWith("/") ? "forward" : "backward";
      }
      if (
        moved &&
        (/^[fFtT].$/.test(command) ||
          (/^[;,]$/.test(command) && this.observedFind))
      )
        this.navigation.add("find");
      if (
        moved &&
        (/^[/?].*<CR>$/.test(command) ||
          (/^[nN]$/.test(command) && this.observedSearch))
      )
        this.navigation.add("search");
      if (moved && /^[2-9]\d*[wbhjkl]$/.test(command))
        this.navigation.add("count");
      if (
        moved &&
        command === "%" &&
        this.options.puzzle.helpSkills.includes("match")
      ) {
        this.navigation.add("match");
        this.motionUsed.add(command);
      }
      if (
        moved &&
        /^(?:gg|G|[1-9]\d*G|<C-[oi]>)$/.test(command) &&
        this.options.puzzle.helpSkills.includes("jump")
      ) {
        this.navigation.add("jump");
        this.motionUsed.add(command);
      }
      const markJump = command.match(/^[\x27`]([a-z])$/);
      if (
        moved &&
        markJump &&
        this.marksSet.has(markJump[1]) &&
        this.options.puzzle.helpSkills.includes("mark")
      ) {
        this.navigation.add("mark");
        this.motionUsed.add(command);
      }
      return;
    }
    const skills = new Set<Skill>(this.navigation);
    this.navigation.clear();
    let skill: Skill | undefined;
    if (/^\d*x$/.test(command) && before.length > after.length) skill = "typo";
    if (/ciw$/.test(command) && before !== after) skill = "word";
    if (
      /^\d*dd$/.test(command) &&
      before.split("\n").length > after.split("\n").length
    ) {
      skill = "line";
      this.yanked = false;
      const beforeLines = before.split("\n"),
        afterLines = after.split("\n");
      this.cut = {
        text: beforeLines.find((line, i) => line !== afterLines[i]) ?? "",
        before,
      };
    }
    if (
      command.startsWith("v") &&
      /[dx]$/.test(command) &&
      this.selectedMatch
    ) {
      skill = "visual";
      this.selectionMatched = true;
    }
    if (
      /^[pP]$/.test(command) &&
      this.cut &&
      after.includes(this.cut.text) &&
      this.cut.before !== after &&
      this.cut.before.split("\n").slice().sort().join("\n") ===
        after.split("\n").slice().sort().join("\n")
    )
      skill = "move";
    if (skill) skills.add(skill);
    if (/^[iaIAoO]$/.test(command)) skills.add("insert");
    if (/^\d*r.$/.test(command)) skills.add("replace");
    if (/^\d*[pP]$/.test(command) && this.yanked) skills.add("copy");
    if (/^([2-9]\d*|1\d+)(dd|x|p|P)$/.test(command)) skills.add("count");
    if (/^[cd][ia]["'()]$/.test(command) || /^d[ia]w$/.test(command))
      skills.add("object");
    if (command === "." && this.observedChange) skills.add("repeat");
    if (/^[cdx]/.test(command) || /^\d+[cdx]/.test(command))
      this.yanked = false;
    if (command !== ".") this.observedChange = true;
    if (!this.options.demo)
      for (const demonstrated of skills)
        this.evidence.push({ skill: demonstrated, before, after });
  }
  private clearProvenance() {
    this.navigation.clear();
    this.yanked = false;
    this.observedFind = false;
    this.observedSearch = false;
    this.searchDirection = undefined;
    this.observedChange = false;
  }
  private keydown = (e: KeyboardEvent) => {
    if (e.key === "Tab") return;
    if (this.options.locked() || (e.repeat && !this.hasFreshKey)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (!e.repeat) this.hasFreshKey = true;
    const key =
      Vim.vimKeyFromEvent(e, getCM(this.view)!.state.vim ?? undefined) || e.key;
    // Mutation/mode listeners flush after Vim handles the event. A microtask
    // from this capture listener can run before the editor's bubble listener.
    this.options.onNudge("");
    this.beforeKey(key);
  };
  private afterKey = () => this.schedule();
  private pointer = (e: PointerEvent) => {
    this.navigation.clear();
    if (this.options.locked()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  private paste = (e: ClipboardEvent) => {
    if (this.options.locked()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    } else {
      // Pasted content can complete a puzzle, but cannot prove a Vim technique.
      this.keys = [];
      this.clearProvenance();
      this.evidence = [];
      this.cut = undefined;
      this.selectionMatched = false;
    }
  };
  finishEdit(): EditorSnapshot {
    // Close the user's actual edit so ciw evidence is retained, without
    // requiring another keypress to pass. The next puzzle starts in Normal.
    if (this.mode() !== "normal" || this.pending()) this.feed("<Esc>");
    return this.snapshot();
  }
  focus() {
    this.view.focus();
  }
  refreshLayout() {
    this.view.requestMeasure();
    // The Vim cursor has its own measurement layer. Inherited font-size
    // changes must invalidate that layer as well as CodeMirror's layout.
    getCM(this.view)?.state.vimPlugin?.blockCursor.scheduleRedraw();
  }
  escape() {
    this.feed("<Esc>");
    this.focus();
  }
  undo() {
    this.feed("<Esc>");
    this.feed("<Esc>");
    this.feed("u");
    this.focus();
  }
  /** Same Vim engine; used by demonstrations and engine integration checks. */
  feed(key: string) {
    this.beforeKey(key);
    const dialog = getCM(this.view)!.state.dialog as HTMLElement | undefined;
    const input = dialog?.querySelector("input");
    if (input) {
      if (key === "<CR>" || key === "<Esc>") {
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: key === "<CR>" ? "Enter" : "Escape",
            keyCode: key === "<CR>" ? 13 : 27,
            bubbles: false,
          }),
        );
      } else {
        const from = input.selectionStart ?? input.value.length;
        const to = input.selectionEnd ?? from;
        input.setRangeText(key, from, to, "end");
        input.dispatchEvent(new Event("input", { bubbles: false }));
        input.dispatchEvent(
          new KeyboardEvent("keyup", { key, bubbles: false }),
        );
      }
    } else if (this.mode() === "insert" && !key.startsWith("<")) {
      this.view.dispatch({
        ...this.view.state.replaceSelection(key),
        userEvent: "input.type",
      });
    } else {
      Vim.handleKey(getCM(this.view)!, key, "user");
    }
    this.finishCommand();
    this.options.onChange(this.snapshot());
  }
  destroy() {
    this.alive = false;
    helpActions.delete(getCM(this.view)!);
    this.view.dom.removeEventListener("keydown", this.keydown, true);
    this.view.dom.removeEventListener("keyup", this.afterKey);
    this.view.dom.removeEventListener("pointerdown", this.pointer, true);
    this.view.dom.removeEventListener("paste", this.paste, true);
    this.view.destroy();
  }
}
export function isolateVim() {
  const original = { ...Vim.getVimGlobalState_() };
  Vim.resetVimGlobalState_();
  return () => Object.assign(Vim.getVimGlobalState_(), original);
}
