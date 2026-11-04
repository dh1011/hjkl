import type { CommandKey, PuzzleSpec, Skill } from "../types";

export type ChallengeContent = Omit<
  PuzzleSpec,
  "skill" | "kind" | "variant" | "showMode" | "helpSkills" | "helpTitle"
>;

export interface SkillContent {
  readonly id: Skill;
  readonly name: string;
  readonly subtitle: string;
  readonly stamp: string;
  readonly keys: readonly (readonly [string, string])[];
  readonly helpKeys: readonly CommandKey[];
  readonly showMode: boolean;
  readonly challenges: readonly ChallengeContent[];
}

export interface DocumentContent extends ChallengeContent {
  readonly skill: Skill;
  readonly kind: "mixed" | "checkpoint" | "final";
}

export interface SectionDefinition {
  readonly id: string;
  readonly kind: "lesson" | "mixed" | "checkpoint" | "final";
  readonly title: string;
  readonly stamp: string;
  readonly skill?: Skill;
  readonly helpSkills: readonly Skill[];
  readonly challengeIds: readonly string[];
}

export interface CourseDefinition {
  readonly sections: readonly SectionDefinition[];
  readonly unlocks: Readonly<Record<"paper" | "cursor" | "effect", { readonly afterSection: string }>>;
}
