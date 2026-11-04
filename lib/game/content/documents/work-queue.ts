import { defineDocument } from "../helpers";

export const workQueue = defineDocument({
  id: "work-queue",
  world: "WORKING DOCUMENTS",
  file: "work-queue.txt",
  title: "Clean up the support queue.",
  goal: "Clean up the support queue.",
  initial: "obsolete A\nobsolete B\nTicket A: pending\nTicket B: pending",
  target: "Ticket A: ready\nTicket B: ready",
  cursor: 0,
  assistance: "independent",
  solutionKeys: ["2", "d", "d", "/", "p", "e", "n", "d", "i", "n", "g", "<CR>", "c", "i", "w", "r", "e", "a", "d", "y", "<Esc>", "n", "."],
  objectives: [
    {
      text: "Remove both obsolete entries.",
      excludes: "obsolete",
    },
    {
      text: "Mark both tickets as ready.",
      excludes: "pending",
    },
  ],
  explanation: "Work through the changes in any order. Match the target text, including spaces and line breaks. Use any commands you know; undo can recover a mistake.",
  skill: "repeat",
  kind: "mixed",
});
