import {
  AUTHOR,
  REPO_URL,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  SKILL_SUMMARIES,
} from "@/lib/site";

const body = `# ${SITE_TITLE}

> ${SITE_DESCRIPTION}

hjkl is a free, keyboard-first Vim learning game that runs in a desktop browser. Learners pick skills, then make short, real edits in a CodeMirror Vim editor until the text matches a target. Each selected skill runs two guided edits (live hint below the editor), two prompted edits (hint until editing starts), then two independent edits. Any valid edit sequence that produces the target passes. There is no account, sign-up, or saved data; progress lives in memory while the page is open. A physical keyboard and a viewport at least 768px wide are required.

Made by [${AUTHOR.name}](${AUTHOR.url}).

## Pages

- [Play hjkl](${SITE_URL}/): pick skills and start practicing
- [Vim commands cheat sheet](${SITE_URL}/commands): every command taught, grouped by skill
- [Source code](${REPO_URL}): MIT-licensed repository on GitHub
- [duy.run](${AUTHOR.url}): ${AUTHOR.name}'s other tools and projects

## Skills and commands

${SKILL_SUMMARIES.map(
  (skill) =>
    `### ${skill.name}\n\n${skill.keys.map(({ command, meaning }) => `- \`${command}\`: ${meaning}`).join("\n")}`,
).join("\n\n")}

## For agents

- In the app, type \`:help\` then Enter in Normal mode for the current level's commands; Escape or q closes help.
- In browsers that support \`document.modelContext\` (WebMCP), the page registers two tools: \`read_game_state\` returns the visible goal, document, and mode; \`request_hint\` advances the same hint ladder as the UI.
- The app is a client-side game; content above is the complete curriculum outline.
`;

export function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
