/** Sentinel value for the Requirements sidebar tab and scroll-spy target. */
export const REQUIREMENTS_KEY = "__requirements__";

export type Subject = {
  name: string;
  description: string;
  /**
   * Optional graduation requirement for the department, shown under the section
   * heading. Comes from the Supabase `departments.graduation_requirement` column.
   */
  graduationRequirement?: string;
  /** Pastel color used for the sidebar bookmark tab. */
  color: string;
  /** Very light pastel tint used as the course card background. */
  tint: string;
  /** Slightly stronger accent (text/badges) that reads on the tint. */
  accent: string;
};

type Palette = Pick<Subject, "color" | "tint" | "accent">;

/**
 * Ordered color palette. Subjects (departments) are colored by their position
 * in the list, and the palette loops back to the start once there are more
 * subjects than entries here — so adding departments in Supabase never runs out
 * of colors.
 */
export const SUBJECT_PALETTE: Palette[] = [
  { color: "#f7c5d9", tint: "#fdeef4", accent: "#b14e7a" },
  { color: "#d9c2f0", tint: "#f4eefb", accent: "#7c52ad" },
  { color: "#f3c4ec", tint: "#fceefa", accent: "#a8489c" },
  { color: "#bcd4f6", tint: "#eef4fd", accent: "#3d6bb3" },
  { color: "#bfe6c9", tint: "#eef9f1", accent: "#3f8b58" },
  { color: "#f8d7a8", tint: "#fdf3e4", accent: "#b3792b" },
  { color: "#f6bdb4", tint: "#fceeeb", accent: "#b65244" },
  { color: "#e6cfb0", tint: "#f8f1e6", accent: "#946a36" },
  { color: "#b6e6df", tint: "#ecf9f7", accent: "#358077" },
  { color: "#c4cdf2", tint: "#eef0fc", accent: "#4f5bb0" },
  { color: "#b3e2ee", tint: "#ebf8fc", accent: "#2f7d92" },
  { color: "#cfe9aa", tint: "#f3f9e8", accent: "#5f8a2f" },
  { color: "#f6e6a8", tint: "#fcf8e6", accent: "#a8902f" },
];

/**
 * Optional taglines keyed by department name. Departments returned from Supabase
 * that aren't listed here simply render without a tagline.
 */
export const SUBJECT_DESCRIPTIONS: Record<string, string> = {
  Arts: "Creative expression",
  "Performing Arts": "Theater, dance & music",
  "Visual Arts": "Drawing, painting & design",
  "Computer Science": "Code & computing",
  Economics: "Markets & money",
  Engineering: "Design & build systems",
  English: "Reading & writing",
  History: "People & the past",
  Interdisciplinary: "Where subjects meet",
  Languages: "Speak the world",
  Math: "Numbers & logic",
  Science: "How nature works",
  "Social Emotional Learning": "Social & emotional growth",
};

/** A department as returned from Supabase, narrowed to the fields we render. */
export type DepartmentInput = {
  name: string;
  graduationRequirement?: string | null;
};

/** Builds a Subject from a department, assigning a looped palette color. */
export function buildSubject(
  department: DepartmentInput,
  index: number,
): Subject {
  const palette = SUBJECT_PALETTE[index % SUBJECT_PALETTE.length];
  const graduationRequirement = department.graduationRequirement?.trim();
  return {
    name: department.name,
    description: SUBJECT_DESCRIPTIONS[department.name] ?? "",
    graduationRequirement: graduationRequirement || undefined,
    ...palette,
  };
}

/** Builds the full ordered list of Subjects from departments. */
export function buildSubjects(departments: DepartmentInput[]): Subject[] {
  return departments.map((department, index) => buildSubject(department, index));
}
