import type { Metadata } from "next";
import Link from "next/link";
import { GameMark } from "@/components/game-mark";
import { AUTHOR, REPO_URL, SITE_NAME, SITE_URL, SKILL_SUMMARIES } from "@/lib/site";

const title = "Vim commands cheat sheet";
const description = `Vim commands taught in ${SITE_NAME}, grouped by skill: moving, inserting, changing words, text objects, search, find, counts, marks, jumps, Visual mode, copy and put, and repeat.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/commands" },
  openGraph: {
    type: "article",
    siteName: SITE_NAME,
    url: "/commands",
    title: `${title} · ${SITE_NAME}`,
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: title }],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: title,
  description,
  url: `${SITE_URL}/commands`,
  inLanguage: "en",
  isAccessibleForFree: true,
  about: { "@type": "SoftwareApplication", name: "Vim" },
  isPartOf: { "@id": `${SITE_URL}/#website` },
  author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
};

export default function Commands() {
  return (
    <main className="site-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <header className="site-header">
        <Link href="/" aria-label="hjkl home">
          <GameMark />
        </Link>
        <h1>{title}</h1>
        <p>
          Every command practiced in hjkl, grouped by skill. Run them in Normal
          mode; press <kbd>Escape</kbd> to get back to Normal from Insert or
          Visual mode.
        </p>
      </header>
      {SKILL_SUMMARIES.map((skill) => (
        <section key={skill.id} aria-labelledby={`skill-${skill.id}`}>
          <h2 id={`skill-${skill.id}`}>{skill.name}</h2>
          <table className="site-command-table">
            <thead>
              <tr>
                <th scope="col">Keys</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {skill.keys.map(({ command, meaning }) => (
                <tr key={command}>
                  <td>
                    <kbd>{command}</kbd>
                  </td>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <nav className="site-links" aria-label="More">
        <Link href="/">Practice these in hjkl →</Link>
        <a href={REPO_URL}>Source on GitHub</a>
        <a href={AUTHOR.url} rel="author">Made by {AUTHOR.name} · duy.run</a>
      </nav>
    </main>
  );
}
