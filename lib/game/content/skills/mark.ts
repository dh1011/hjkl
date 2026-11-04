import { defineSkill } from "../helpers";

const tasks = [
  ["INCIDENT RESPONSE", "database-latency.md", "database"],
  ["RELEASE ENGINEERING", "release-handoff.md", "release"],
  ["PLATFORM OPERATIONS", "region-failover.md", "platform"],
  ["SECURITY", "access-incident.md", "security"],
  ["API SERVICE", "api-degradation.md", "api"],
  ["DATA PIPELINE", "pipeline-recovery.md", "data"],
  ["WEB APPLICATION", "frontend-incident.md", "web"],
  ["SUPPORT ENGINEERING", "customer-escalation.md", "support"],
  ["OBSERVABILITY", "alert-tuning.md", "observability"],
  ["TEST INFRASTRUCTURE", "browser-failure.md", "quality"],
  ["AUTHENTICATION", "session-incident.md", "identity"],
  ["WORKER SERVICE", "queue-recovery.md", "workers"],
] as const;

function incident(owner: string) {
  return [
    "# Incident handoff",
    "severity: high",
    "owner: unassigned",
    `service: ${owner}`,
    "started: 09:40 UTC",
    "customer-impact: elevated latency",
    "detection: automated alert",
    "mitigation: traffic reduced",
    "database: healthy",
    "cache: warming",
    "workers: recovering",
    "error-rate: falling",
    "dashboard: linked",
    "timeline: updated",
    "review: scheduled",
    "communications: drafted",
    "next-update: 10:30 UTC",
    "pending",
  ].join("\n");
}

export const mark = defineSkill({
  id: "mark",
  name: "Set and return to marks",
  subtitle: "LEAVE A WAY BACK",
  stamp: "Context",
  keys: [
    ["ma", "Set mark a"],
    ["'a `a", "Return to its line / exact position"],
  ],
  helpKeys: ["ma", "'a", "`a", "G", "ciw", "A"],
  showMode: true,
  challenges: tasks.map(([world, file, owner], index) => {
    const initial = incident(owner);
    const ownerCursor = initial.indexOf("unassigned");
    const first = initial.replace("unassigned", owner);
    const second = first.replace(/pending$/, "ready");
    const target = second.replace(`owner: ${owner}`, `owner: ${owner} # confirmed`);
    const firstCursor = first.indexOf(owner) + owner.length - 1;
    const lastLine = first.lastIndexOf("pending");
    const secondCursor = second.lastIndexOf("ready") + "ready".length - 1;
    const ownerLine = second.indexOf("owner:");
    const returnKey = index < 6 ? "'" : "`";
    return {
      id: `mark-${index}`,
      world,
      file,
      title: "Update distant fields and return to the owner.",
      goal: "Mark the owner, update the handoff status, then return and confirm ownership.",
      initial,
      target,
      cursor: ownerCursor,
      assistance: index < 2 ? "guided" as const : index < 4 ? "prompted" as const : "independent" as const,
      explanation: "ma stores the current position as mark a. 'a returns to its line; `a returns to its exact character. Marks preserve your context while you make a distant edit.",
      solutionKeys: [
        "m", "a", "c", "i", "w", ...owner, "<Esc>",
        "G", "c", "i", "w", ..."ready", "<Esc>",
        returnKey, "a", "A", ..." # confirmed", "<Esc>",
      ],
      coaching: [
        {
          document: second,
          cursor: secondCursor,
          keys: [returnKey, "a", "A", ..." # confirmed", "<Esc>"],
          editCursor: returnKey === "'" ? ownerLine : second.indexOf(owner),
          editKeys: ["A", ..." # confirmed", "<Esc>"],
          target,
          text: `Use ${returnKey}a to return to the owner, then append the confirmation.`,
        },
        {
          document: first,
          cursor: firstCursor,
          keys: ["G", "c", "i", "w", ..."ready", "<Esc>"],
          editCursor: lastLine,
          editKeys: ["c", "i", "w", ..."ready", "<Esc>"],
          target: second,
          text: "Jump to the last line and mark the handoff ready.",
        },
        {
          document: initial,
          cursor: ownerCursor,
          keys: ["m", "a", "c", "i", "w", ...owner, "<Esc>"],
          editCursor: ownerCursor,
          editKeys: ["c", "i", "w", ...owner, "<Esc>"],
          requiresMark: "a",
          target: first,
          text: "Set mark a here, then assign the real owner.",
        },
      ],
    };
  }),
});
