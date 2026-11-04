import { defineDocument } from "../helpers";

export const workChecklist = defineDocument({
  id: "work-checklist",
  world: "WORKING DOCUMENTS",
  file: "work-checklist.txt",
  title: "Put the release checklist in order.",
  goal: "Put the release checklist in order.",
  initial: "Publish\nRun tests\nNotify owner",
  target: "Run tests\nPublish\nNotify owner\nNotify owner",
  cursor: 0,
  assistance: "independent",
  solutionKeys: ["d", "d", "p", "j", "y", "y", "p"],
  objectives: [
    {
      text: "Run tests before publishing.",
      includes: "Run tests\nPublish",
    },
    {
      text: "Add a second owner notification.",
      includes: "Notify owner\nNotify owner",
    },
  ],
  explanation: "Work through the changes in any order. Match the target text, including spaces and line breaks. Use any commands you know; undo can recover a mistake.",
  skill: "repeat",
  kind: "mixed",
});
