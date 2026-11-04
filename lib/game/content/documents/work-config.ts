import { defineDocument } from "../helpers";

export const workConfig = defineDocument({
  id: "work-config",
  world: "WORKING DOCUMENTS",
  file: "work-config.txt",
  title: "Update the service settings.",
  goal: "Update the service settings.",
  initial: "region = \"local\"\nretries=0\nold=true",
  target: "region = \"shared\"\nretries=3",
  cursor: 0,
  assistance: "independent",
  solutionKeys: ["f", "\"", "l", "c", "i", "\"", "s", "h", "a", "r", "e", "d", "<Esc>", "j", "0", "f", "=", "l", "r", "3", "j", "d", "d"],
  objectives: [
    {
      text: "Change the region to shared.",
      includes: "region = \"shared\"",
    },
    {
      text: "Set retries to 3.",
      includes: "retries=3",
    },
    {
      text: "Remove the obsolete setting.",
      excludes: "old=true",
    },
  ],
  explanation: "Work through the changes in any order. Match the target text, including spaces and line breaks. Use any commands you know; undo can recover a mistake.",
  skill: "repeat",
  kind: "mixed",
});
