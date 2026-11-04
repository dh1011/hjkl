import { defineDocument } from "../helpers";

export const workMessage = defineDocument({
  id: "work-message",
  world: "WORKING DOCUMENTS",
  file: "work-message.txt",
  title: "Prepare the team update.",
  goal: "Prepare the team update.",
  initial: "Helloo team\nStatus: pending",
  target: "Hello team!\nStatus: ready",
  cursor: 0,
  assistance: "independent",
  solutionKeys: ["l", "l", "l", "l", "x", "A", "!", "<Esc>", "j", "0", "w", "w", "c", "i", "w", "r", "e", "a", "d", "y", "<Esc>"],
  objectives: [
    {
      text: "Correct the greeting and add an exclamation mark.",
      includes: "Hello team!",
    },
    {
      text: "Mark the status as ready.",
      includes: "Status: ready",
    },
  ],
  explanation: "Work through the changes in any order. Match the target text, including spaces and line breaks. Use any commands you know; undo can recover a mistake.",
  skill: "repeat",
  kind: "mixed",
});
