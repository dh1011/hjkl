import { defineSkill } from "../helpers";

const tasks = [
  ["DEPLOYMENT", "production-rollout.yml", "12G", 12, 0],
  ["INCIDENT RESPONSE", "incident-runbook.md", "15G", 15, 0],
  ["CONTINUOUS INTEGRATION", "pipeline.yml", "8G", 8, 0],
  ["SERVICE OPERATIONS", "service-checklist.md", "G", 18, 0],
  ["RELEASE ENGINEERING", "release-plan.md", "G<C-o>", 1, 0],
  ["OBSERVABILITY", "alert-review.md", "gg<C-o>", 18, 17],
  ["DATABASE", "migration-runbook.md", "8G", 8, 0],
  ["SECURITY", "access-review.md", "9G", 9, 0],
  ["API SERVICE", "api-deploy.md", "G", 10, 0],
  ["SUPPORT ENGINEERING", "escalation-log.md", "9G", 9, 0],
  ["PLATFORM CONFIG", "region-rollout.md", "G<C-o>", 1, 0],
  ["TEST INFRASTRUCTURE", "browser-matrix.md", "gg<C-o>", 10, 9],
] as const;

function document(label: string, targetLine: number) {
  const lines = [
    "pending # rollout state",
    `owner: ${label.toLowerCase().replaceAll(" ", "-")}`,
    "environment: production",
    "change-window: approved",
    "backup: verified",
    "health-check: passing",
    "error-budget: available",
    "database-migration: complete",
    "cache-warmup: complete",
    "traffic-shadow: passing",
    "security-review: approved",
    "pending # rollout state",
    "observability: enabled",
    "alerts: routed",
    "pending # rollout state",
    "rollback: prepared",
    "communications: drafted",
    "pending # rollout state",
  ];
  lines[targetLine - 1] = "pending # rollout state";
  for (let i = 0; i < lines.length; i++)
    if (i !== targetLine - 1 && lines[i].startsWith("pending"))
      lines[i] = "ready # rollout state";
  return lines.join("\n");
}

function practiceDocument(label: string) {
  const lines = document(label, 4).split("\n");
  for (const line of [4, 10, 18])
    lines[line - 1] = "pending # rollout state";
  return lines.join("\n");
}

function rawKeys(route: string): string[] {
  return route.match(/<[^>]+>|[\s\S]/g) ?? [];
}

export const jump = defineSkill({
  id: "jump",
  name: "Jump through files",
  subtitle: "GO STRAIGHT THERE",
  stamp: "Navigation",
  keys: [
    ["12G", "Jump to a numbered line"],
    ["gg G", "First / last line"],
    ["ctrl-o ctrl-i", "Back / forward through jumps"],
  ],
  helpKeys: ["12G", "gg", "G", "<C-o>", "<C-i>", "ciw"],
  showMode: true,
  challenges: tasks.map(([world, file, route, targetLine, startLine], index) => {
    if (index >= 6) {
      const initial = practiceDocument(world);
      const target = initial
        .split("\n")
        .map((line, lineIndex) =>
          [3, 9, 17].includes(lineIndex)
            ? line.replace("pending", "ready")
            : line,
        )
        .join("\n");
      return {
        id: `jump-${index}`,
        world,
        file,
        title: "Update three distant rollout states.",
        goal: "Jump directly to lines 4, 10, and 18 and mark each rollout state ready.",
        initial,
        target,
        cursor: 0,
        assistance: "independent" as const,
        explanation: "Use numbered G jumps instead of walking through the file. Each destination needs the same focused state change.",
        solutionKeys: [
          "4", "G", "c", "i", "w", ..."ready", "<Esc>",
          "1", "0", "G", "c", "i", "w", ..."ready", "<Esc>",
          "G", "c", "i", "w", ..."ready", "<Esc>",
        ],
      };
    }
    const initial = document(world, targetLine);
    const lines = initial.split("\n");
    const target = lines.map((line, i) => i === targetLine - 1 ? line.replace("pending", "ready") : line).join("\n");
    const offsets = lines.map((_, i) => lines.slice(0, i).join("\n").length + (i ? 1 : 0));
    const cursor = offsets[startLine];
    const editCursor = offsets[targetLine - 1];
    const directRoute = route.replace("<C-o>", "").replace("<C-i>", "");
    const navigation = rawKeys(route);
    const solutionKeys = [...navigation, "c", "i", "w", ..."ready", "<Esc>"];
    return {
      id: `jump-${index}`,
      world,
      file,
      title: `Update the rollout state on line ${targetLine}.`,
      goal: `Jump directly to line ${targetLine} and change its state to ready.`,
      initial,
      target,
      cursor,
      assistance: index < 2 ? "guided" as const : index < 4 ? "prompted" as const : "independent" as const,
      explanation: "A line number followed by G jumps directly to that line. gg and G reach the first and last lines. Ctrl-O walks back through jump history and Ctrl-I walks forward again.",
      solutionKeys,
      coaching: [{
        document: initial,
        cursor,
        keys: solutionKeys,
        editCursor,
        editKeys: ["c", "i", "w", ..."ready", "<Esc>"],
        target,
        text: `Use ${directRoute || route} to reach line ${targetLine}, then change pending to ready.`,
      }],
    };
  }),
});
