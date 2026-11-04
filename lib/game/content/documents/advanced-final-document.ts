import { defineDocument } from "../helpers";

const initial = [
  "# Production incident handoff",
  "",
  "The checkout servvice recovered after traffic moved to the secondary region. Error rates are falling, but the team will keep the mitigation active through the next observation window.",
  "Traffic is stable and customer support has the current impact summary. The next engineer needs the verified rollback settings and a clear owner before taking over.",
  "",
  "owner: unassigned",
  "severity: high",
  "status: active",
  "",
  "export const rollback = {",
  '  strategy: "regional",',
  "  batchSize: 10,",
  "  pauseSeconds: 30,",
  "  verifyHealth: true,",
  "  notifySupport: true,",
  '  ownerChannel: "platform-on-call",',
  "}",
  "",
  "obsolete: page the retired vendor contact",
  "obsolete: restart every worker without draining",
  "",
  "Verification includes checkout, payment authorization, and order confirmation. Dashboards and synthetic checks must stay healthy for thirty minutes before closing the incident.",
  "Support will post the customer update after the incident commander confirms the handoff. Link the follow-up review from this document when it is scheduled.",
  "",
  "pending",
].join("\n");

const target = initial
  .replace("servvice", "service")
  .replace("owner: unassigned", "owner: platform # confirmed")
  .replace("\n}\n", "\n};\n")
  .replace("obsolete: page the retired vendor contact\n", "")
  .replace("obsolete: restart every worker without draining\n", "")
  .replace(/pending$/, "ready\nHandoff complete.");

export const advancedFinalDocument = defineDocument({
  id: "advanced-final-document",
  world: "PRODUCTION OPERATIONS",
  file: "incident-handoff.md",
  title: "Complete the production incident handoff.",
  goal: "Complete the production incident handoff.",
  initial,
  target,
  cursor: initial.indexOf("unassigned"),
  assistance: "independent",
  solutionKeys: [
    "m", "a", "c", "i", "w", ..."platform", "<Esc>",
    "3", "G", "0", "f", "v", "x",
    "1", "0", "G", "f", "{", "%", "a", ";", "<Esc>",
    "j", "j", "2", "d", "d",
    "G", "c", "i", "w", ..."ready", "<Esc>",
    "'", "a", "A", ..." # confirmed", "<Esc>",
    "G", "o", ..."Handoff complete.", "<Esc>",
  ],
  objectives: [
    { text: "Correct the service name in the recovery summary.", excludes: "servvice" },
    { text: "Assign and confirm the platform owner.", includes: "owner: platform # confirmed" },
    { text: "Finish the rollback declaration.", includes: "ownerChannel: \"platform-on-call\",\n};" },
    { text: "Remove both obsolete response steps.", excludes: "obsolete:" },
    { text: "Mark the handoff ready.", includes: "\nready\n" },
    { text: "Add the completion note.", includes: "ready\nHandoff complete." },
  ],
  explanation: "Work through the handoff in any order. Use structural matching, direct line jumps, and a mark to preserve context while moving through the document. Match all punctuation and line breaks.",
  skill: "mark",
  kind: "final",
});
