"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Check,
  ListChecks,
  ListX,
  Shuffle,
  Worm,
} from "lucide-react";
import { GameMark } from "@/components/game-mark";
import { GameObjective } from "@/components/game-objective";
import { WormGame } from "@/components/worm-game";
import { SiteIntro } from "@/components/site-intro";
import { AUTHOR, REPO_URL } from "@/lib/site";
import { Progress } from "@/components/ui/progress";
import { nextCue, documentGoal } from "@/lib/game/coaching";
import { moveFocus } from "@/lib/spatial-focus";
import { helpForPuzzle } from "@/lib/game/help";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { practicePuzzle, SKILLS, SKILL_METADATA } from "@/lib/game/curriculum";
import { courseForRun, courseForSkills, shuffleSkills } from "@/lib/game/run";
import { displayKey, evaluate, mastery, recovery } from "@/lib/game/engine";
import { GameEditor } from "@/lib/game/editor";
import { initializeProgress, SESSION_GAP } from "@/lib/game/progress";
import type {
  AttemptResult,
  EditorSnapshot,
  ProgressState,
  Skill,
} from "@/lib/game/types";

const EMPTY: EditorSnapshot = {
  document: "helloo",
  cursor: 5,
  selection: { from: 5, to: 5 },
  mode: "normal",
  pending: false,
  evidence: [],
  motionUsed: [],
  marksSet: [],
  lastCommand: "",
  selectionMatched: false,
};
function DesktopGame() {
  const [state, setState] = useState<ProgressState | null>(null);
  const data = useRef<ProgressState | null>(null);
  const sectionOrder = state?.sectionOrder;
  const selectedSkills = state?.selectedSkills;
  const shuffledSkills = !!state?.shuffledSkills;
  const { COURSE, SECTIONS, UNLOCKS } = useMemo(
    () =>
      selectedSkills
        ? courseForSkills(selectedSkills, { keepOrder: shuffledSkills })
        : courseForRun(sectionOrder),
    [sectionOrder, selectedSkills, shuffledSkills],
  );
  const [snapshot, setSnapshot] = useState<EditorSnapshot>(EMPTY);
  const snapshotRef = useRef(snapshot);
  const [phase, setPhase] = useState<"playing" | "success" | "celebration">(
    "playing",
  );
  const [landing, setLanding] = useState(true);
  const [wormGame, setWormGame] = useState(false);
  const wormGameRef = useRef(wormGame);
  useLayoutEffect(() => {
    wormGameRef.current = wormGame;
  }, [wormGame]);
  const closeWormGame = useCallback(() => {
    setWormGame(false);
    requestAnimationFrame(() =>
      document.getElementById(`landing-practice-${SKILLS[0]}`)?.focus(),
    );
  }, []);
  const landingRef = useRef(landing);
  const landingSkillIndexRef = useRef(0);
  useLayoutEffect(() => {
    landingRef.current = landing;
    if (landing)
      requestAnimationFrame(() =>
        document
          .getElementById(
            `landing-practice-${SKILLS[landingSkillIndexRef.current]}`,
          )
          ?.focus(),
      );
  }, [landing]);
  const phaseRef = useRef(phase);
  useLayoutEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const [panel, setPanel] = useState<
    "assist" | "journey" | "practice" | "help" | "settings" | null
  >(null);
  const [practiceSkills, setPracticeSkills] = useState<Skill[]>([]);
  // Opt-in: run the selected skill blocks in a random order.
  const [shuffle, setShuffle] = useState(false);
  const panelRef = useRef(panel);
  useLayoutEffect(() => {
    panelRef.current = panel;
  }, [panel]);
  const [hint, setHint] = useState(0);
  const hintRef = useRef(0);
  const [nudge, setNudge] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const helpBody = useRef<HTMLDivElement>(null);
  const panelElement = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (panel) panelElement.current?.scrollTo({ top: 0 });
  }, [panel]);
  const commandInput = useRef<HTMLInputElement>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandError, setCommandError] = useState("");
  const continueButton = useRef<HTMLButtonElement>(null);
  const adapter = useRef<GameEditor | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const commit = useCallback((s: ProgressState) => {
    data.current = s;
    setState(s);
  }, []);
  useEffect(() => {
    initializeProgress(data);
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      setState(data.current);
      if (data.current?.celebration !== undefined) setPhase("celebration");
    });
    return () => {
      mounted = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data]);
  const reviewing = !!state && state.reviewIndex < state.review.length;
  const index =
    state?.celebration !== undefined
      ? Math.max(0, state.courseIndex - 1)
      : Math.min(state?.courseIndex ?? 0, COURSE.length - 1);
  const reviewId = reviewing ? state!.review[state!.reviewIndex] : undefined;
  // Stable identity prevents editor recreation on input and settings changes.
  const current = useMemo(
    () => (reviewId ? practicePuzzle(reviewId) : COURSE[index]),
    [reviewId, index, COURSE],
  );
  const puzzleRef = useRef(current);
  useLayoutEffect(() => {
    puzzleRef.current = current;
  }, [current]);
  useLayoutEffect(() => {
    if (landing) return;
    if (phase === "playing" && !panel) {
      adapter.current?.focus();
      adapter.current?.view.requestMeasure();
    } else if (phase === "celebration" && !panel) {
      continueButton.current?.focus();
    }
  }, [phase, panel, current.id, landing]);
  const complete = useCallback(
    (s: EditorSnapshot) => {
      if (phaseRef.current !== "playing" || !data.current) return;
      phaseRef.current = "success";
      setPhase("success");
      setNudge("");
      const completedSnapshot = adapter.current?.finishEdit() ?? s;
      const p = puzzleRef.current;
      let next = data.current;
      const at = Date.now();
      if (at - next.lastActive >= SESSION_GAP)
        next = { ...next, session: `session-${at}` };
      const result: AttemptResult = {
        puzzleId: p.id,
        variant: p.variant,
        skill: p.skill,
        world: p.world,
        session: next.session,
        completed: true,
        assisted: p.assistance !== "independent" || hintRef.current > 0,
        hints: hintRef.current,
        demonstrated: [
          ...new Set(completedSnapshot.evidence.map((e) => e.skill)),
        ],
        mixed:
          p.kind === "mixed" ||
          p.kind === "review" ||
          p.kind === "checkpoint" ||
          p.kind === "final",
        completedAt: at,
      };
      next = { ...next, attempts: [...next.attempts, result], lastActive: at };
      if (next.settings.sound) {
        try {
          const ctx = audio.current ?? new AudioContext();
          audio.current = ctx;
          void ctx.resume();
          const gain = ctx.createGain();
          gain.connect(ctx.destination);
          gain.gain.setValueAtTime(0.035, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
          const osc = ctx.createOscillator();
          osc.connect(gain);
          osc.frequency.setValueAtTime(660, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.09);
          osc.start();
          osc.stop(ctx.currentTime + 0.23);
        } catch {}
      }
      let n = next;
      const isReview = n.reviewIndex < n.review.length;
      if (isReview) {
        n = { ...n, reviewIndex: n.reviewIndex + 1, active: undefined };
        if (n.reviewIndex === n.review.length)
          n = {
            ...n,
            active: n.suspended,
            suspended: undefined,
            celebration:
              n.courseIndex >= COURSE.length ? SECTIONS.length - 1 : undefined,
          };
      } else {
        const courseIndex = n.courseIndex + 1;
        const sectionIndex = SECTIONS.findIndex(
          (section) => section.end === courseIndex,
        );
        const boundary = sectionIndex !== -1;
        n = {
          ...n,
          courseIndex,
          active: undefined,
          celebration: boundary ? sectionIndex : undefined,
        };
      }
      // Record the advance before the animation finishes.
      data.current = n;
      timer.current = setTimeout(() => {
        phaseRef.current =
          data.current!.celebration !== undefined ? "celebration" : "playing";
        setPhase(phaseRef.current);
        commit(data.current!);
      }, 750);
    },
    [commit, COURSE.length, SECTIONS],
  );
  useEffect(() => {
    if (!state || !host.current) return;
    const p = puzzleRef.current;
    const progress = data.current!;
    const resume =
      progress.active?.puzzleId === p.id ? progress.active : undefined;
    hintRef.current = resume?.hints ?? 0;
    setHint(hintRef.current);
    setNudge("");
    const editor = new GameEditor({
      puzzle: p,
      parent: host.current,
      saved:
        progress.celebration !== undefined
          ? { puzzleId: p.id, document: p.target, cursor: 0, hints: 0 }
          : resume,
      locked: () => phaseRef.current !== "playing" || panelRef.current !== null,
      onNudge: setNudge,
      onHelp: () => {
        panelRef.current = "help";
        setPanel("help");
      },
      onChange: (s) => {
        const latest = data.current;
        if (!latest || puzzleRef.current !== p) return;
        const expectedId =
          latest.reviewIndex < latest.review.length
            ? latest.review[latest.reviewIndex]
            : COURSE[Math.min(latest.courseIndex, COURSE.length - 1)].id;
        // A layout/focus callback from the previous editor can arrive while
        // React commits the next puzzle. It must never advance that puzzle.
        if (phaseRef.current === "playing" && expectedId !== p.id) return;
        snapshotRef.current = s;
        setSnapshot(s);
        if (phaseRef.current !== "playing" || !data.current) return;
        const now = Date.now();
        const old = data.current;
        data.current = {
          ...old,
          lastActive: now,
          session:
            now - old.lastActive >= SESSION_GAP
              ? `session-${now}`
              : old.session,
          active: {
            puzzleId: p.id,
            document: s.document,
            cursor: s.cursor,
            hints: hintRef.current,
          },
        };
        const result = evaluate(p, s);
        if (result.complete) complete(s);
        // The text is right, but the edit is not closed yet.
        else if (result.correct) setNudge("Text matches. Press esc to finish.");
      },
    });
    adapter.current = editor;
    const frame = requestAnimationFrame(() => {
      if (phaseRef.current === "playing") editor.focus();
    });
    const resize = new ResizeObserver(() => {
      editor.refreshLayout();
    });
    resize.observe(host.current);
    if (editor.view.contentDOM.firstElementChild)
      resize.observe(editor.view.contentDOM.firstElementChild);
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame);
      editor.destroy();
      adapter.current = null;
    };
    // Puzzle lifecycle only; all mutable state is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state === null, current.id, current.kind, landing, complete, commit]);
  const requestHint = useCallback(() => {
    if (!data.current || phaseRef.current !== "playing")
      return { available: false };
    const next = Math.min(2, hintRef.current + 1);
    hintRef.current = next;
    setHint(next);
    setNudge("");
    const s = adapter.current?.snapshot();
    if (s)
      commit({
        ...data.current,
        active: {
          puzzleId: puzzleRef.current.id,
          document: s.document,
          cursor: s.cursor,
          hints: next,
        },
      });
    adapter.current?.focus();
    return {
      available: true,
      level: next,
      explanation: puzzleRef.current.explanation,
    };
  }, [commit]);
  useEffect(() => {
    type Tool = {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const schema = {
      type: "object",
      properties: {},
      additionalProperties: false,
    };
    const validate = (input: unknown) => {
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).length
      )
        throw new Error("This tool takes an empty object.");
    };
    const tools: Tool[] = [
      {
        name: "read_game_state",
        title: "Read hjkl",
        description:
          "Read the current editing goal, document, mode, and course progress.",
        inputSchema: schema,
        annotations: { readOnlyHint: true },
        execute: (input) => {
          validate(input);
          return {
            goal: !!puzzleRef.current.objectives
              ? documentGoal(puzzleRef.current, snapshotRef.current.document)
              : puzzleRef.current.id === "typo-0"
                ? "Delete the extra o."
                : puzzleRef.current.goal,
            document: snapshotRef.current.document,
            mode: snapshotRef.current.mode,
            completed: data.current?.courseIndex ?? 0,
            total: COURSE.length,
            phase: phaseRef.current,
          };
        },
      },
      {
        name: "request_hint",
        title: "Request a hint",
        description:
          "Reveal text guidance for the current edit. Marks this attempt as assisted; the second hint shows the next step.",
        inputSchema: schema,
        annotations: { readOnlyHint: false },
        execute: async (input) => {
          validate(input);
          const result = requestHint();
          await new Promise((resolve) => requestAnimationFrame(resolve));
          return result;
        },
      },
    ];
    for (const tool of tools)
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    return () => controller.abort();
  }, [requestHint, COURSE.length]);
  const continueCourse = () => {
    if (!data.current) return;
    commit({ ...data.current, celebration: undefined });
    phaseRef.current = "playing";
    setPhase("playing");
    setLanding(false);
    requestAnimationFrame(() => adapter.current?.focus());
  };
  const startPractice = () => {
    if (!data.current || !practiceSkills.length) return;
    const s = data.current;
    if (timer.current) clearTimeout(timer.current);
    const skills = shuffle
      ? shuffleSkills(practiceSkills)
      : SKILLS.filter((skill) => practiceSkills.includes(skill));
    const run = courseForSkills(skills, { keepOrder: shuffle });
    commit({
      ...s,
      selectedSkills: skills,
      shuffledSkills: shuffle,
      sectionOrder: run.SECTIONS.map((section) => section.id),
      courseIndex: 0,
      review: [],
      reviewIndex: 0,
      suspended: undefined,
      active: undefined,
      celebration: undefined,
    });
    phaseRef.current = "playing";
    setPhase("playing");
    setLanding(false);
    panelRef.current = null;
    setPanel(null);
  };
  const setting = (patch: Partial<ProgressState["settings"]>) => {
    if (data.current)
      commit({
        ...data.current,
        settings: { ...data.current.settings, ...patch },
      });
  };
  const levelHelp = helpForPuzzle(current);
  const inFinal = !!current.objectives;
  const isLongDocument = current.initial.split("\n").length >= 15;
  const cue = nextCue(current, snapshot);
  // Only guided lessons point the way back after a mistake.
  const problem =
    current.assistance === "guided" ? recovery(current, snapshot) : undefined;
  const statusLine = nudge || problem;
  const hintText =
    hint === 1
      ? current.explanation
      : `${cue.key && !cue.recover ? `Press ${displayKey(cue.key)}. ` : ""}${cue.text}`;
  const first = current.id === "typo-0";
  const instruction =
    phase === "success"
      ? "Good edit."
      : first
        ? "Delete the extra o."
        : inFinal
          ? documentGoal(current, snapshot.document)
          : current.goal;
  const showCue =
    phase === "playing" &&
    !statusLine &&
    hint === 0 &&
    (current.assistance === "guided" ||
      (current.assistance === "prompted" &&
        snapshot.mode === "normal" &&
        !snapshot.pending &&
        snapshot.document === current.initial &&
        snapshot.cursor === current.cursor));
  const completed = state?.courseIndex ?? 0;
  const finished = completed >= COURSE.length;
  const celebration = state?.celebration;
  const currentSection = SECTIONS.find(
    (section) => index >= section.start && index < section.end,
  )!;
  const groupAttempts =
    state?.attempts.filter(
      (a) =>
        COURSE.slice(currentSection.start, index + 1).some(
          (p) => p.id === a.puzzleId,
        ) && a.completed,
    ) ?? [];
  const uniqueGroup = [
    ...new Map(groupAttempts.map((a) => [a.puzzleId, a])).values(),
  ];
  const restoreFocus = () => {
    if (phaseRef.current === "celebration") continueButton.current?.focus();
    else adapter.current?.focus();
  };
  const closePanel = () => {
    panelRef.current = null;
    setPanel(null);
    requestAnimationFrame(restoreFocus);
  };
  const openHelp = () => {
    setCommandOpen(false);
    setCommandError("");
    panelRef.current = "help";
    setPanel("help");
  };
  const openPractice = () => {
    panelRef.current = "practice";
    setPanel("practice");
  };
  const openCommand = () => {
    setCommandOpen(true);
    setCommandError("");
  };
  const keyboardActions = useRef({
    closePanel,
    advance: finished ? openPractice : continueCourse,
    openCommand,
    startPractice,
  });
  useLayoutEffect(() => {
    keyboardActions.current = {
      closePanel,
      advance: finished ? openPractice : continueCourse,
      openCommand,
      startPractice,
    };
  });
  useEffect(() => {
    const consumed = new Set<string>();
    const onKey = (event: KeyboardEvent) => {
      if (wormGameRef.current) return;
      const consume = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
        consumed.add(event.key);
      };
      if (landingRef.current) {
        if (
          event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          event.key === "Enter"
        ) {
          consume();
          keyboardActions.current.startPractice();
          return;
        }
        if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing)
          return;
        if (["h", "j", "k", "l"].includes(event.key)) {
          consume();
          const current = landingSkillIndexRef.current;
          const rowStart = Math.floor(current / 4) * 4;
          const next =
            event.key === "h"
              ? Math.max(rowStart, current - 1)
              : event.key === "l"
                ? Math.min(rowStart + 3, SKILLS.length - 1, current + 1)
                : event.key === "j"
                  ? Math.min(SKILLS.length - 1, current + 4)
                  : Math.max(0, current - 4);
          landingSkillIndexRef.current = next;
          document.getElementById(`landing-practice-${SKILLS[next]}`)?.focus();
          return;
        }
        if (event.key === "a" || event.key === "n") {
          consume();
          setPracticeSkills(event.key === "a" ? [...SKILLS] : []);
          return;
        }
        if (event.key === "s") {
          consume();
          setShuffle((on) => !on);
          return;
        }
        if (
          event.key === "Enter" &&
          event.target instanceof Element &&
          event.target.closest('[role="checkbox"]')
        ) {
          consume();
          return;
        }
        if (event.key === " ") {
          consume();
          const skill = SKILLS[landingSkillIndexRef.current];
          setPracticeSkills((selected) =>
            selected.includes(skill)
              ? selected.filter((item) => item !== skill)
              : [...selected, skill],
          );
        }
        return;
      }
      if (
        panelRef.current === "practice" &&
        event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        event.key === "Enter"
      ) {
        consume();
        keyboardActions.current.startPractice();
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing)
        return;
      if (consumed.has(event.key)) {
        consume();
        return;
      }
      if (panelRef.current !== null) {
        // Keep every control reachable with Tab, including WebKit's default
        // keyboard settings, which otherwise skip some buttons.
        const controls = () =>
          [
            ...(panelElement.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
            ) ?? []),
          ].filter((element) => element.getClientRects().length > 0);
        if (event.key === "Tab") {
          const list = controls();
          if (list.length) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const index = list.indexOf(document.activeElement as HTMLElement);
            const next = event.shiftKey
              ? index <= 0
                ? list.length - 1
                : index - 1
              : (index + 1) % list.length;
            list[next].focus();
          }
          return;
        }
        if (event.key === "Escape" || event.key === "q") {
          consume();
          keyboardActions.current.closePanel();
        } else if (["h", "j", "k", "l"].includes(event.key)) {
          consume();
          const help = helpBody.current;
          // The command list scrolls first, then hands focus to the buttons.
          if (
            help &&
            document.activeElement === help &&
            (event.key === "j" || event.key === "k")
          ) {
            const down = event.key === "j";
            const room = down
              ? help.scrollHeight - help.clientHeight - help.scrollTop
              : help.scrollTop;
            if (room > 1) {
              help.scrollBy({ top: down ? 80 : -80 });
              return;
            }
          }
          moveFocus(controls(), event.key as "h" | "j" | "k" | "l");
        } else if (
          panelRef.current === "practice" &&
          (event.key === "a" || event.key === "n")
        ) {
          consume();
          setPracticeSkills(event.key === "a" ? [...SKILLS] : []);
        } else if (panelRef.current === "practice" && event.key === "s") {
          consume();
          setShuffle((on) => !on);
        }
        return;
      }
      if (event.target instanceof HTMLInputElement) return;
      if (phaseRef.current === "celebration" && event.key === ":") {
        consume();
        keyboardActions.current.openCommand();
        return;
      }
      if (
        phaseRef.current === "celebration" &&
        (event.key === "Enter" || event.key === "l")
      ) {
        // Enter still activates another button reached with Tab (such as Help).
        if (
          event.key === "Enter" &&
          event.target instanceof Element &&
          event.target.closest("button, a") &&
          event.target !== continueButton.current
        )
          return;
        consume();
        keyboardActions.current.advance();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      consumed.delete(event.key);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    const onBlur = () => consumed.clear();
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  if (wormGame)
    return (
      <div className={`app-shell theme-${state?.settings.theme ?? "ink"}`}>
        <WormGame onExit={closeWormGame} />
      </div>
    );
  if (landing)
    return (
      <div className={`app-shell theme-${state?.settings.theme ?? "ink"}`}>
        <main className="selection-page">
          <header className="selection-toolbar">
            <h1 className="sr-only">Practice skills</h1>
            <span className="selection-brand" aria-label="hjkl">
              <span className="selection-mark" aria-hidden="true">
                <GameMark />
              </span>
              <span className="selection-wordmark" aria-hidden="true">
                <span className="selection-wordmark-text">hjkl</span>
                <span className="selection-wordmark-cursor" />
              </span>
            </span>
            <div className="selection-actions">
              <button
                className="text-button selection-game-button"
                aria-label="Play Worm"
                title="Play Worm"
                onClick={() => setWormGame(true)}
              >
                <Worm size={17} />
                <span>Worm</span>
              </button>
              <button
                className="text-button selection-icon-button"
                aria-label="Select all"
                title="Select all"
                disabled={practiceSkills.length === SKILLS.length}
                onClick={() => setPracticeSkills([...SKILLS])}
              >
                <ListChecks size={18} />
              </button>
              <button
                className="text-button selection-icon-button"
                aria-label="Clear all"
                title="Clear all"
                disabled={practiceSkills.length === 0}
                onClick={() => setPracticeSkills([])}
              >
                <ListX size={18} />
              </button>
              <button
                className="text-button selection-icon-button"
                aria-label="Shuffle skill order"
                aria-pressed={shuffle}
                title={shuffle ? "Shuffle skill order: on" : "Shuffle skill order: off"}
                onClick={() => setShuffle((on) => !on)}
              >
                <Shuffle size={18} />
              </button>
            </div>
          </header>
          <div className="selection-grid" aria-label="Practice skills">
            {SKILLS.map((skill, skillIndex) => {
              const metadata = SKILL_METADATA[skill];
              const checked = practiceSkills.includes(skill);
              return (
                <label
                  className="practice-skill-row"
                  htmlFor={`landing-practice-${skill}`}
                  key={skill}
                >
                  <Checkbox
                    id={`landing-practice-${skill}`}
                    aria-label={`Practice ${metadata.name}`}
                    checked={checked}
                    onFocus={() => {
                      landingSkillIndexRef.current = skillIndex;
                    }}
                    onCheckedChange={(value) =>
                      setPracticeSkills((selected) =>
                        value === true
                          ? selected.includes(skill)
                            ? selected
                            : [...selected, skill]
                          : selected.filter((item) => item !== skill),
                      )
                    }
                  />
                  <div className="practice-skill-text">
                    <strong>{metadata.name}</strong>
                    <span
                      className="selection-skill-keys"
                      aria-label={`Commands: ${metadata.keys.map(([keys]) => keys).join(", ")}`}
                    >
                      {metadata.keys.map(([keys]) => (
                        <kbd key={keys}>{keys}</kbd>
                      ))}
                    </span>
                    <small>×6</small>
                  </div>
                </label>
              );
            })}
          </div>
          <footer className="selection-footer">
            <p className="selection-keys">
              <kbd>h j k l</kbd> move · <kbd>space</kbd> select · <kbd>a</kbd>{" "}
              all · <kbd>n</kbd> none · <kbd>s</kbd> shuffle ·{" "}
              <kbd>ctrl enter</kbd> start
            </p>
            <a className="selection-credit" href={REPO_URL}>
              GitHub
            </a>
            <a className="selection-credit" href={AUTHOR.url} rel="author">
              duy.run
            </a>
            <p>{practiceSkills.length || "No"} skills selected</p>
            <button
              className="primary-button"
              disabled={!state || practiceSkills.length === 0}
              onClick={startPractice}
            >
              Start <ArrowRight size={16} />
            </button>
          </footer>
        </main>
      </div>
    );
  return (
    <div
      className={`app-shell theme-${state?.settings.theme ?? "ink"} ${state?.settings.cursor ? "outline-cursor" : ""} ${state?.settings.effect ? "completion-effect" : ""}`}
    >
      <main
        className="focus-workspace"
        data-puzzle={current.id}
        data-kind={current.kind}
        data-phase={phase}
      >
        <div
          className={`focus-task ${celebration !== undefined ? "task-finished" : ""}`}
        >
          <GameObjective
            puzzle={current}
            instruction={instruction}
            complete={phase === "success"}
          />
          <section
            className={`editor-panel ${first ? "opening-panel" : ""} ${phase === "success" ? "is-success" : ""} ${inFinal ? "document-editor" : ""} ${isLongDocument ? "long-editor" : ""}`}
            data-mode={snapshot.mode}
            aria-label="Editing playground"
            aria-describedby="editing-goal"
          >
            <div className="editor-stage">
              <div
                ref={host}
                className={`editor-host ${first ? "first-editor" : ""}`}
              />
            </div>
            {(current.showMode || snapshot.mode !== "normal") && (
              <span
                className={`current-mode ${snapshot.mode}`}
                aria-label={`Current mode: ${snapshot.mode}`}
              >
                <i aria-hidden="true" />
                {snapshot.mode === "normal"
                  ? "Normal"
                  : snapshot.mode === "insert"
                    ? "Insert"
                    : "Visual"}
              </span>
            )}
          </section>
          <div className="focus-coaching" aria-live="polite">
            {phase === "playing" && statusLine && hint === 0 ? (
              <div className="context-recovery">
                <p role="status">{statusLine}</p>
                {problem && (
                  <button
                    className="text-button"
                    onClick={() => adapter.current?.undo()}
                  >
                    <kbd>u</kbd> Undo
                  </button>
                )}
              </div>
            ) : phase === "playing" && hint > 0 ? (
              <div className="hint-box">
                <p>{hintText}</p>
                {hint === 1 && (
                  <button className="text-button" onClick={requestHint}>
                    Show next step
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            ) : showCue ? (
              <div className="next-cue">
                {cue.key && <kbd>{displayKey(cue.key)}</kbd>}
                <span>{cue.text}</span>
              </div>
            ) : null}
          </div>
        </div>
        {celebration !== undefined && (
          <section className="level-finish focus-finish" aria-live="polite">
            <span className="finish-mark" aria-hidden="true">
              <GameMark />
            </span>
            <h2>
              {finished
                ? "You’re an editor now."
                : SECTIONS[celebration]?.stamp}
            </h2>
            <p>
              {finished
                ? "One whole document. Your own way through it."
                : `${uniqueGroup.length} edits. ${uniqueGroup.filter((a) => !a.assisted).length} without hints.`}
            </p>
            <button
              ref={continueButton}
              className="primary-button"
              onClick={finished ? openPractice : continueCourse}
            >
              {finished ? "Choose practice" : "Keep going"}
              <ArrowRight size={17} />
            </button>
            <p className="continue-keys">
              <kbd>enter</kbd> or <kbd>l</kbd> to continue
            </p>
          </section>
        )}
        {commandOpen && (
          <form
            className="game-command"
            onSubmit={(event) => {
              event.preventDefault();
              const command = commandInput.current?.value.trim();
              if (command === "help" || command === "h") openHelp();
              else setCommandError("Type help, then press Enter.");
            }}
          >
            <label>
              <span>:</span>
              <input
                ref={commandInput}
                autoFocus
                aria-label="Game command"
                placeholder="help"
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setCommandOpen(false);
                    restoreFocus();
                  }
                }}
              />
            </label>
            {commandError && <p role="status">{commandError}</p>}
          </form>
        )}
      </main>
      <Sheet
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) closePanel();
        }}
      >
        <SheetContent
          ref={panelElement}
          className={`game-sheet ${panel === "help" ? "context-help" : ""}`}
          onOpenAutoFocus={(event) => {
            if (panelRef.current === "help") {
              event.preventDefault();
              helpBody.current?.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            restoreFocus();
          }}
        >
          <SheetHeader>
            <SheetTitle>
              {panel === "assist"
                ? "What do you need?"
                : panel === "journey"
                  ? "Your journey_"
                  : panel === "practice"
                    ? "Choose practice skills_"
                    : panel === "help"
                      ? levelHelp.title
                      : "Make it yours_"}
            </SheetTitle>
            <SheetDescription>
              {panel === "assist"
                ? "Your edit will be here when you return."
                : panel === "journey"
                  ? `${Math.min(completed, COURSE.length)} / ${COURSE.length} challenges complete. Progress resets when you refresh or close this page.`
                  : panel === "practice"
                    ? "Pick skills for your course. Each starts with two guided edits, then two prompted edits, then two independent edits."
                    : panel === "help"
                      ? "Keys for this level. [ ] marks the cursor in examples."
                      : "Same keys. A different feeling."}
            </SheetDescription>
          </SheetHeader>
          {panel === "assist" && (
            <div className="sheet-body assist-menu">
              <button
                disabled={phase !== "playing"}
                onClick={() => {
                  closePanel();
                  requestHint();
                }}
              >
                Get a hint <ArrowRight size={16} />
              </button>
              <button
                aria-label="Undo the last edit"
                disabled={phase !== "playing"}
                onClick={() => {
                  closePanel();
                  adapter.current?.undo();
                }}
              >
                Undo the last edit <kbd>u</kbd>
              </button>
              <button
                aria-label="Return to Normal"
                disabled={phase !== "playing"}
                onClick={() => {
                  closePanel();
                  adapter.current?.escape();
                }}
              >
                Return to Normal <kbd>esc</kbd>
              </button>
              <div className="assist-secondary">
                <button onClick={() => setPanel("help")}>Command guide</button>
                <button onClick={() => setPanel("journey")}>
                  Your journey
                </button>
                <button onClick={() => setPanel("settings")}>Settings</button>
              </div>
            </div>
          )}
          {panel === "journey" && (
            <div className="sheet-body">
              <Progress
                className="course-progress"
                value={(completed / COURSE.length) * 100}
                aria-label="Course progress"
              />
              <div className="mastery-list">
                {SECTIONS.map((section, i) => (
                  <div className="mastery-row" key={section.id}>
                    <span className="row-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{section.title}</h3>
                      {section.skill && (
                        <span>
                          {mastery(section.skill, state?.attempts ?? [])}
                        </span>
                      )}
                    </div>
                    {completed >= section.end && <Check size={18} />}
                  </div>
                ))}
              </div>
              <div className="mastery-explainer">
                <h3>Mastery grows with practice.</h3>
                <p>Guided → Independent → Consistent → Fluent</p>
                <p>
                  Two different edits without hints earn Independent. Consistent
                  takes four across two worlds and sessions. Fluent takes six
                  across three worlds and sessions, including two mixed edits.
                </p>
              </div>
              {!reviewing && (
                <button className="primary-button" onClick={openPractice}>
                  Choose practice skills
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
          {panel === "practice" && (
            <div className="sheet-body practice-picker">
              <div className="practice-actions">
                <button
                  className="text-button selection-icon-button"
                  aria-label="Select all"
                  title="Select all"
                  disabled={practiceSkills.length === SKILLS.length}
                  onClick={() => setPracticeSkills([...SKILLS])}
                >
                  <ListChecks size={18} />
                </button>
                <button
                  className="text-button selection-icon-button"
                  aria-label="Clear all"
                  title="Clear all"
                  disabled={practiceSkills.length === 0}
                  onClick={() => setPracticeSkills([])}
                >
                  <ListX size={18} />
                </button>
                <button
                  className="text-button selection-icon-button"
                  aria-label="Shuffle skill order"
                  aria-pressed={shuffle}
                  title={shuffle ? "Shuffle skill order: on" : "Shuffle skill order: off"}
                  onClick={() => setShuffle((on) => !on)}
                >
                  <Shuffle size={18} />
                </button>
              </div>
              <div className="practice-skill-list" aria-label="Practice skills">
                {SKILLS.map((skill) => {
                  const metadata = SKILL_METADATA[skill];
                  const checked = practiceSkills.includes(skill);
                  return (
                    <label
                      className="practice-skill-row"
                      htmlFor={`practice-${skill}`}
                      key={skill}
                    >
                      <Checkbox
                        id={`practice-${skill}`}
                        aria-label={`Practice ${metadata.name}`}
                        checked={checked}
                        onCheckedChange={(value) =>
                          setPracticeSkills((selected) =>
                            value === true
                              ? selected.includes(skill)
                                ? selected
                                : [...selected, skill]
                              : selected.filter((item) => item !== skill),
                          )
                        }
                      />
                      <div className="practice-skill-text">
                        <strong>{metadata.name}</strong>
                        <span>{metadata.subtitle}</span>
                        <small>
                          {mastery(skill, state?.attempts ?? [])} mastery
                        </small>
                      </div>
                    </label>
                  );
                })}
              </div>
              <button
                className="primary-button"
                disabled={practiceSkills.length === 0}
                onClick={startPractice}
              >
                Start
                <ArrowRight size={16} />
              </button>
              {practiceSkills.length === 0 && (
                <p className="sheet-note">
                  Select at least one skill to start.
                </p>
              )}
              <p className="sheet-note selection-keys">
                <kbd>h j k l</kbd> move · <kbd>space</kbd> select · <kbd>a</kbd>{" "}
                all · <kbd>n</kbd> none · <kbd>s</kbd> shuffle ·{" "}
              <kbd>ctrl enter</kbd> start
              </p>
            </div>
          )}
          {panel === "help" && (
            <>
              <div
                ref={helpBody}
                tabIndex={0}
                className="sheet-body current-help-body"
                aria-label="Commands for this level"
              >
                {levelHelp.commands.map((command) => (
                  <div
                    className="command-help"
                    key={command.key}
                    data-command={command.key}
                  >
                    <kbd>{command.key}</kbd>
                    <div>
                      <p>{command.meaning}</p>
                      <p className="command-example">{command.example}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="help-footer">
                <p>
                  <kbd>esc</kbd> or <kbd>q</kbd> to return · <kbd>h j k l</kbd>{" "}
                  to move
                </p>
                <div>
                  <button
                    className="text-button"
                    disabled={phase !== "playing"}
                    onClick={() => {
                      closePanel();
                      requestHint();
                    }}
                  >
                    Get a hint
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setPanel("assist")}
                  >
                    More options
                  </button>
                </div>
              </div>
            </>
          )}
          {panel === "settings" && (
            <div className="sheet-body">
              <div className="setting-row">
                <div>
                  <h3>Completion sound</h3>
                  <p>A small note for a good edit.</p>
                </div>
                <Switch
                  aria-label="Completion sound"
                  checked={state?.settings.sound ?? false}
                  onCheckedChange={(sound) => {
                    if (sound) {
                      try {
                        audio.current ??= new AudioContext();
                        void audio.current.resume();
                      } catch {}
                    }
                    setting({ sound });
                  }}
                />
              </div>
              <div className="setting-row">
                <div>
                  <h3>Paper terminal</h3>
                  <p>
                    {completed >= UNLOCKS.paper
                      ? "A soft light theme, unlocked."
                      : "Finish Fix a typo to unlock."}
                  </p>
                </div>
                <Switch
                  aria-label="Paper terminal theme"
                  disabled={completed < UNLOCKS.paper}
                  checked={state?.settings.theme === "paper"}
                  onCheckedChange={(on) =>
                    setting({ theme: on ? "paper" : "ink" })
                  }
                />
              </div>
              <div className="setting-row">
                <div>
                  <h3>Outline cursor</h3>
                  <p>
                    {completed >= UNLOCKS.cursor
                      ? "A crisp frame for Normal mode."
                      : "Finish mixed challenges to unlock."}
                  </p>
                </div>
                <Switch
                  aria-label="Outline cursor"
                  disabled={completed < UNLOCKS.cursor}
                  checked={state?.settings.cursor ?? false}
                  onCheckedChange={(cursor) => setting({ cursor })}
                />
              </div>
              <div className="setting-row">
                <div>
                  <h3>Phosphor finish</h3>
                  <p>
                    {completed >= UNLOCKS.effect
                      ? "A brief glow around a successful edit."
                      : "Finish your document to unlock."}
                  </p>
                </div>
                <Switch
                  aria-label="Phosphor finish"
                  disabled={completed < UNLOCKS.effect}
                  checked={state?.settings.effect ?? false}
                  onCheckedChange={(effect) => setting({ effect })}
                />
              </div>
              <p className="sheet-note">
                Animations follow your system’s reduced-motion preference. These
                settings never change how the keys work.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function Home() {
  const [mobile, setMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  if (mobile === null) return <SiteIntro />;
  if (mobile)
    return (
      <main className="mobile-notice">
        <GameMark />
        <h1>Desktop required_</h1>
        <p>
          This app only works on desktop. Open it on a computer with a physical
          keyboard to practice the editing commands.
        </p>
      </main>
    );
  return <DesktopGame />;
}
