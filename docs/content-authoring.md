# Authoring challenges

The course contains 117 challenges in 22 sections. Its content lives in
`lib/game/content/`; gameplay does not decide which challenges belong in a section.

- `skills/<skill>.ts`: one skill's metadata and complete challenge records, including practice variants.
- `documents/<challenge-id>.ts`: one mixed document, checkpoint, or final document.
- `course.ts`: ordered sections, challenge references, help skills, and unlock milestones.
- `types.ts`: typed authoring interfaces.
- `helpers.ts`: typed definitions and immutable content helpers.
- `compile.ts`: reference validation and derived course/section views.

`lib/game/curriculum.ts` registers the skill and document modules and exposes the
compiled collections to the game. Importing it validates the content. Challenge
and section IDs are stable identifiers; displayed challenge numbers come from the
current run. Skill sections are shuffled once on each page load; `challengeIds`
order within each section is preserved. Mixed/document sections keep their
relative manifest order and wait until every skill in their `helpSkills` list
has completed all of its lesson sections.

## Add a challenge to an existing skill

Add a record to the skill's `challenges` array. For example, in `skills/typo.ts`:

```ts
{
  id: "typo-12",
  world: "GROUP CHAT",
  file: "morning-message.txt",
  title: "A better morning.",
  goal: "Remove the extra d.",
  initial: "goodd morning",
  target: "good morning",
  cursor: 4,
  assistance: "independent",
  explanation: "Press x to delete the character under your cursor.",
  solutionKeys: ["x"],
},
```

The surrounding skill definition supplies `skill`, command metadata, and the mode
indicator setting. The compiler supplies `variant` from the challenge ID.
`cursor` is a zero-based string offset; whitespace and line breaks in `target`
are significant. `solutionKeys` is an executable example solution for tests.
It never starts animated playback.

Choose guidance explicitly:

- `guided`: cues follow the current edit.
- `prompted`: the opening cue disappears after moving or editing.
- `independent`: no automatic cue; text hints remain available.

For a challenge with several edits, include `coaching` stages; see the existing
insertion or repetition challenges. Each stage contains its starting document,
target, cursor, command keys, and explanatory text. New editing techniques may
also require support in the editor, coaching, and command-help code.

To include the example in the main course, append `"typo-12"` to the `typo`
section's `challengeIds` in `course.ts`. The section then contains seven
challenges, and later sections shift automatically. A skill variant omitted from
the manifest remains available to practice selection after that skill is learned.
There is no fixed six-challenge limit in the compiler.

## Insert a section

For a challenge that is not already referenced in the course, insert a section at
the desired position in `course.ts`:

```ts
{
  id: "extra-typos",
  kind: "lesson",
  skill: "typo",
  title: "More typo practice",
  stamp: "More precision.",
  helpSkills: ["typo"],
  challengeIds: ["typo-12"],
},
```

A lesson section names its skill and uses challenges from that skill. A mixed
section can reference challenges across skills; course appearances become
independent and omit guided selection outlines. Their source definitions stay
unchanged. Document sections use `mixed`, `checkpoint`, or `final` to match their
document definitions. Each course challenge ID must appear only once.

`helpSkills` explicitly names the skills available in that section's help panel.
For mixed/document sections, those skills are also prerequisites for scheduling
the section in a shuffled run.
Moving the section does not silently add or remove help commands. The section's
`title` labels the journey and help panel; `stamp` supplies its completion message.

For a new document, create its file with `defineDocument`, export the record, and
register it in `DOCUMENT_CONTENT` in `curriculum.ts`. Give it a unique ID, a
registered `skill`, its document `kind`, and the same challenge fields as above.
Use `objectives` to describe its individual fixes. Then reference its ID in the
manifest. A document omitted from the course is registered but is not added to
the skill-variant practice pool.

For an entirely new skill, create a module using `defineSkill`, add its ID to the
`Skill` type, register it in `SKILL_CONTENT`, and add its section to the manifest.
Skill metadata includes `name`, `subtitle`, `stamp`, display `keys`, typed
`helpKeys`, and `showMode`. Command descriptions live in `lib/game/help.ts`;
new commands must also be represented in `CommandKey` and supported by the editor
and coaching where needed.

## Reorder content and unlocks

Move entries in `challengeIds` to change the order inside a skill. Skill section
positions are randomized for each run; moving a skill section in the manifest
changes the authored reference order, not a fixed player sequence. Non-lesson
sections retain their relative manifest order and follow their prerequisite
skills. Section ranges and completion boundaries are recalculated for each run.
No challenge numbers or numeric skill offsets need editing.

Unlocks reference a section ID:

```ts
paper: { afterSection: "typo" }
```

The unlock follows that section even if its length or position changes. Update
`afterSection` when deliberately changing the milestone. The existing mixed
sections retain their original IDs (`typo-6` and `work-message`); those IDs are
references, not computed positions.

## Validate an edit

Run `npm run typecheck`, `npm run lint`, and `npm test`, then `npm run build`.
The suite checks all authored example solutions against the Vim engine, guidance,
course traversal, manifest insertion/reordering, and invalid references. Counts
and milestone assertions describe the current course; update those intentionally
when adding content.

Duplicate skill/challenge/section IDs, repeated course challenges, unresolved
references, mismatched section kinds/skills, invalid initial cursor positions,
and missing unlock sections produce errors naming the relevant ID. Definitions
are frozen, including nested data; build a new presentation instead of mutating
shared challenge records.
