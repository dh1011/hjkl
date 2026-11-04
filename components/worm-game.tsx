"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { GameMark } from "@/components/game-mark";

type Point = { x: number; y: number };
type Direction = "left" | "down" | "up" | "right";
type GameState = "ready" | "running" | "paused" | "over" | "won";

const COLUMNS = 24;
const ROWS = 16;
const WIN_LENGTH = 32;
const INITIAL_WORM: Point[] = [
  { x: 11, y: 8 },
  { x: 10, y: 8 },
  { x: 9, y: 8 },
  { x: 8, y: 8 },
];
const MOVES: Record<Direction, Point> = {
  left: { x: -1, y: 0 },
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
};
const KEY_DIRECTIONS: Record<string, Direction> = {
  h: "left",
  j: "down",
  k: "up",
  l: "right",
};
const OPPOSITE: Record<Direction, Direction> = {
  left: "right",
  right: "left",
  up: "down",
  down: "up",
};

function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function nextFood(worm: Point[]): Point {
  const open: Point[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLUMNS; x += 1) {
      if (!worm.some((part) => part.x === x && part.y === y)) open.push({ x, y });
    }
  }
  return open[Math.floor(Math.random() * open.length)] ?? { x: 0, y: 0 };
}

export function WormGame({ onExit }: { onExit: () => void }) {
  const [worm, setWorm] = useState<Point[]>(INITIAL_WORM);
  const [food, setFood] = useState<Point>({ x: 17, y: 8 });
  const [gameState, setGameState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const direction = useRef<Direction>("right");
  const queuedDirection = useRef<Direction>("right");
  const wormRef = useRef<Point[]>(INITIAL_WORM);
  const foodRef = useRef<Point>({ x: 17, y: 8 });

  const reset = useCallback(() => {
    wormRef.current = INITIAL_WORM;
    foodRef.current = { x: 17, y: 8 };
    setWorm(INITIAL_WORM);
    setFood(foodRef.current);
    setScore(0);
    direction.current = "right";
    queuedDirection.current = "right";
    setGameState("ready");
  }, []);

  const move = useCallback(() => {
    const current = wormRef.current;
    const nextDirection = queuedDirection.current;
    direction.current = nextDirection;
    const delta = MOVES[nextDirection];
    const head = {
      x: (current[0].x + delta.x + COLUMNS) % COLUMNS,
      y: (current[0].y + delta.y + ROWS) % ROWS,
    };
    const eating = samePoint(head, foodRef.current);
    const collisionBody = eating ? current : current.slice(0, -1);
    const collided = collisionBody.some((part) => samePoint(part, head));

    if (collided) {
      setGameState("over");
      return;
    }

    const moved = [head, ...current];
    const nextWorm = eating ? moved : moved.slice(0, -1);
    wormRef.current = nextWorm;
    setWorm(nextWorm);
    if (eating) {
      foodRef.current = nextFood(nextWorm);
      setFood(foodRef.current);
      setScore((value) => value + 1);
      if (nextWorm.length >= WIN_LENGTH) setGameState("won");
    }
  }, []);

  useEffect(() => {
    if (gameState !== "running") return;
    const speed = Math.max(70, 150 - score * 5);
    const timer = window.setInterval(move, speed);
    return () => window.clearInterval(timer);
  }, [gameState, move, score]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;

      const requested = KEY_DIRECTIONS[event.key.toLowerCase()];
      if (requested) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (gameState === "over" || gameState === "won") return;
        if (requested !== OPPOSITE[direction.current]) queuedDirection.current = requested;
        if (gameState === "ready" || gameState === "paused") setGameState("running");
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (gameState === "running") setGameState("paused");
        else if (gameState === "paused" || gameState === "ready") setGameState("running");
      } else if (
        (event.key === "r" || event.key === "Enter") &&
        (gameState === "over" || gameState === "won")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        reset();
      } else if (event.key === "Escape" || event.key === "q") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onExit();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [gameState, onExit, reset]);

  const cells = useMemo(
    () =>
      Array.from({ length: COLUMNS * ROWS }, (_, index) => ({
        x: index % COLUMNS,
        y: Math.floor(index / COLUMNS),
      })),
    [],
  );
  const markers = useMemo(
    () =>
      Array.from({ length: (COLUMNS + 1) * (ROWS + 1) }, (_, index) => ({
        x: index % (COLUMNS + 1),
        y: Math.floor(index / (COLUMNS + 1)),
      })),
    [],
  );

  const message =
    gameState === "ready"
      ? "Choose a direction to begin."
      : gameState === "paused"
        ? "Paused. Press a direction or space to continue."
        : gameState === "over"
          ? "Game over"
          : gameState === "won"
            ? "You win"
          : "Catch the fruit. Don’t hit the wall or yourself.";

  return (
    <main className="worm-page" data-state={gameState}>
      <header className="selection-toolbar worm-toolbar">
        <button
          className="selection-brand worm-home"
          aria-label="Back to practice"
          onClick={onExit}
        >
          <span className="selection-mark" aria-hidden="true">
            <GameMark />
          </span>
          <span className="worm-wordmark" aria-hidden="true">
            <span className="worm-wordmark-text">hjkl</span>
            <span className="worm-wordmark-arrows">
              <ArrowLeft />
              <ArrowDown />
              <ArrowUp />
              <ArrowRight />
            </span>
          </span>
        </button>
        <button className="text-button worm-exit" aria-label="Exit Worm" onClick={onExit}>
          <kbd>esc</kbd>
          <span>Back</span>
        </button>
      </header>

      <section
        className="worm-shell"
        aria-describedby={gameState === "over" || gameState === "won" ? "worm-status" : undefined}
      >
        <div className="worm-field">
          <div className="worm-markers" aria-hidden="true">
            {markers.map((marker) => (
              <span
                key={`${marker.x}-${marker.y}`}
                className="worm-marker"
                style={{
                  left: `${(marker.x / COLUMNS) * 100}%`,
                  top: `${(marker.y / ROWS) * 100}%`,
                }}
              >
                +
              </span>
            ))}
          </div>
          <div
            className="worm-board"
            role="img"
            aria-label={`Worm game board. Score ${score}. ${message}`}
            style={{
              gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            }}
          >
            {cells.map((cell) => {
              const partIndex = worm.findIndex((part) => samePoint(part, cell));
              const isFood = samePoint(food, cell);
              return (
                <span
                  key={`${cell.x}-${cell.y}`}
                  data-x={cell.x}
                  data-y={cell.y}
                  className={`worm-cell${partIndex === 0 ? " worm-head" : partIndex > 0 ? " worm-body" : ""}${isFood ? " worm-food" : ""}`}
                />
              );
            })}
          </div>
        </div>
        {(gameState === "over" || gameState === "won") && (
          <div id="worm-status" className="worm-result" role="status">
            <strong>{gameState === "won" ? "You win" : "Game over"}</strong>
            <button className="text-button" onClick={reset}>
              <kbd>r</kbd> {gameState === "won" ? "Play again" : "Try again"}
            </button>
          </div>
        )}
      </section>

      <div className="command-guide worm-controls" aria-label="Game controls">
        <span><kbd>h</kbd> left</span>
        <span><kbd>j</kbd> down</span>
        <span><kbd>k</kbd> up</span>
        <span><kbd>l</kbd> right</span>
        <span><kbd>space</kbd> pause</span>
      </div>
    </main>
  );
}
