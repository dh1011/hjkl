import Link from "next/link";
import { GameMark } from "@/components/game-mark";
import { AUTHOR, REPO_URL, SITE_DESCRIPTION, SITE_TAGLINE, SKILL_SUMMARIES } from "@/lib/site";

// Server-rendered before the game mounts, so crawlers and agents that do not run
// JavaScript still see what the app teaches.
export function SiteIntro() {
  return (
    <main className="site-page">
      <header className="site-header">
        <GameMark />
        <h1>hjkl — learn Vim by doing</h1>
        <p className="site-tagline">{SITE_TAGLINE}</p>
        <p>{SITE_DESCRIPTION}</p>
      </header>
      <section aria-labelledby="intro-skills">
        <h2 id="intro-skills">What you practice</h2>
        <ul className="site-skill-list">
          {SKILL_SUMMARIES.map((skill) => (
            <li key={skill.id}>
              <strong>{skill.name}</strong>
              <span>
                {skill.keys.map(({ command }) => (
                  <kbd key={command}>{command}</kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="intro-how">
        <h2 id="intro-how">How it works</h2>
        <p>
          Pick the skills you want, then make small real edits in a browser Vim
          editor. Each skill runs two guided edits, two prompted edits, and two
          independent edits. Any valid edit that reaches the target text passes.
          Type <kbd>:help</kbd> in Normal mode for the current commands.
        </p>
        <p>
          Free, no account, nothing stored. Requires a desktop browser with a
          physical keyboard.
        </p>
      </section>
      <nav className="site-links" aria-label="More">
        <Link href="/commands">Vim commands cheat sheet</Link>
        <a href="/llms.txt">llms.txt</a>
        <a href={REPO_URL}>Source on GitHub</a>
        <a href={AUTHOR.url} rel="author">Made by {AUTHOR.name} · duy.run</a>
      </nav>
    </main>
  );
}
