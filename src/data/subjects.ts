/** Sentinel value for the Requirements sidebar tab and scroll-spy target. */
export const REQUIREMENTS_KEY = "__requirements__";

export type Subject = {
  name: string;
  /** Sidebar tagline from the Supabase `departments.subtitle` column. */
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
 *
 * Values are CSS variables (light and dark hex live in `src/index.css`), so
 * they only work where a CSS color is accepted — no hex math on them.
 */
export const SUBJECT_PALETTE: Palette[] = Array.from({ length: 13 }, (_, i) => ({
  color: `var(--subject-${i + 1}-color)`,
  tint: `var(--subject-${i + 1}-tint)`,
  accent: `var(--subject-${i + 1}-accent)`,
}));

/** A department as returned from Supabase, narrowed to the fields we render. */
export type DepartmentInput = {
  name: string;
  graduationRequirement?: string | null;
  subtitle?: string | null;
};

/** Builds a Subject from a department, assigning a looped palette color. */
export function buildSubject(
  department: DepartmentInput,
  index: number,
): Subject {
  const palette = SUBJECT_PALETTE[index % SUBJECT_PALETTE.length];
  const graduationRequirement = department.graduationRequirement?.trim();
  const subtitle = department.subtitle?.trim();
  return {
    name: department.name,
    description: subtitle ?? "",
    graduationRequirement: graduationRequirement || undefined,
    ...palette,
  };
}

/** Builds the full ordered list of Subjects from departments. */
export function buildSubjects(departments: DepartmentInput[]): Subject[] {
  return departments.map((department, index) => buildSubject(department, index));
}
