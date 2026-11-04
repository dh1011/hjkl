import { defineSkill } from "../helpers";

const tasks = [
  ["API SERVICE", "api-policy.ts", "apiPolicy", "object"],
  ["WEB APPLICATION", "feature-flags.ts", "featureFlags", "object"],
  ["DEPLOYMENT", "regions.ts", "deploymentRegions", "array"],
  ["TEST SUITE", "browser-projects.ts", "browserProjects", "array"],
  ["OBSERVABILITY", "alert-rules.ts", "alertRules", "array"],
  ["DATA PIPELINE", "pipeline.ts", "pipeline", "call"],
  ["INCIDENT RESPONSE", "escalation.ts", "escalationPolicy", "object"],
  ["RELEASE ENGINEERING", "release-gates.ts", "releaseGates", "array"],
  ["AUTHENTICATION", "session-policy.ts", "sessionPolicy", "object"],
  ["WORKER SERVICE", "worker.ts", "worker", "call"],
  ["ANALYTICS", "report.ts", "dailyReport", "call"],
  ["PLATFORM CONFIG", "runtime.ts", "runtimeConfig", "object"],
] as const;

function source(name: string, shape: string) {
  if (shape === "array")
    return [
      `export const ${name} = [`,
      '  "validate-input",',
      '  "load-configuration",',
      '  "open-connection",',
      '  "check-permissions",',
      '  "start-transaction",',
      '  "write-primary",',
      '  "write-audit",',
      '  "publish-event",',
      '  "confirm-delivery",',
      '  "update-metrics",',
      '  "close-connection",',
      '  "record-duration",',
      '  "notify-owner",',
      '  "archive-result",',
      '  "finish",',
      "]",
    ].join("\n");
  if (shape === "call")
    return [
      `export const ${name} = registerWorkflow(`,
      '  "validate-input",',
      '  "load-configuration",',
      '  "open-connection",',
      '  "check-permissions",',
      '  "start-transaction",',
      '  "write-primary",',
      '  "write-audit",',
      '  "publish-event",',
      '  "confirm-delivery",',
      '  "update-metrics",',
      '  "close-connection",',
      '  "record-duration",',
      '  "notify-owner",',
      '  "archive-result",',
      '  "finish",',
      ")",
    ].join("\n");
  return [
    `export const ${name} = {`,
    '  owner: "platform",',
    '  environment: "production",',
    '  region: "us-east",',
    "  replicas: 3,",
    "  timeoutSeconds: 30,",
    "  retryLimit: 4,",
    "  auditLog: true,",
    "  metrics: true,",
    "  tracing: true,",
    "  healthCheck: true,",
    '  releaseChannel: "stable",',
    '  rollbackMode: "automatic",',
    '  alertPolicy: "on-call",',
    '  dataClass: "internal",',
    '  changeWindow: "weekday",',
    "}",
  ].join("\n");
}

function practiceSource(name: string) {
  return [
    `export const ${name}Policy = {`,
    '  owner: "platform",',
    "  retries: 3,",
    "}",
    "",
    `export const ${name}Stages = [`,
    '  "validate",',
    '  "publish",',
    '  "audit",',
    "]",
    "",
    `export const ${name}Workflow = registerWorkflow(`,
    '  "prepare",',
    '  "finish",',
    ")",
  ].join("\n");
}

export const match = defineSkill({
  id: "match",
  name: "Match delimiters",
  subtitle: "FOLLOW THE STRUCTURE",
  stamp: "Structure",
  keys: [["%", "Jump to the matching delimiter"]],
  helpKeys: ["%", "a", "u"],
  showMode: true,
  challenges: tasks.map(([world, file, name, shape], index) => {
    if (index >= 6) {
      const initial = practiceSource(name);
      const target = initial
        .split("\n")
        .map((line) => (["}", "]", ")"].includes(line) ? `${line};` : line))
        .join("\n");
      return {
        id: `match-${index}`,
        world,
        file,
        title: "Finish all three declarations.",
        goal: "Use delimiter matching to finish the policy, stages, and workflow declarations.",
        initial,
        target,
        cursor: initial.indexOf("{"),
        assistance: "independent" as const,
        explanation: "% reaches the closing delimiter without counting lines. Finish each declaration, then move to the next opening line.",
        solutionKeys: [
          "%", "a", ";", "<Esc>",
          "j", "j", "0", "%", "a", ";", "<Esc>",
          "j", "j", "0", "%", "a", ";", "<Esc>",
        ],
      };
    }
    const full = source(name, shape);
    const initial = full;
    const open = shape === "object" ? "{" : shape === "array" ? "[" : "(";
    const close = shape === "object" ? "}" : shape === "array" ? "]" : ")";
    const cursor = initial.indexOf(open);
    const editCursor = initial.lastIndexOf(close);
    const target = `${initial};`;
    return {
      id: `match-${index}`,
      world,
      file,
      title: "Finish the structured declaration.",
      goal: `Jump from the opening ${open} to its matching ${close}, then add the missing semicolon.`,
      initial,
      target,
      cursor,
      assistance: index < 2 ? "guided" as const : index < 4 ? "prompted" as const : "independent" as const,
      explanation: `% jumps between matching (), [], and {} delimiters. It is safer than counting lines through a long block. Here it reaches the closing ${close}; append the missing semicolon there.`,
      solutionKeys: ["%", "a", ";", "<Esc>"],
      coaching: [{
        document: initial,
        cursor,
        keys: ["%", "a", ";", "<Esc>"],
        editCursor,
        editKeys: ["a", ";", "<Esc>"],
        target,
        text: "Use % to reach the matching delimiter, then append the semicolon.",
      }],
    };
  }),
});
