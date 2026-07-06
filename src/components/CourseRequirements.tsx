import type { Course } from "../data/courses";

type CourseRequirementsProps = {
  course: Course;
  accent: string;
  className?: string;
};

function RequirementBlock({
  label,
  items,
  custom,
  accent,
}: {
  label: string;
  items: string[];
  custom?: string;
  accent: string;
}) {
  const hasItems = items.length > 0;
  const hasCustom = Boolean(custom);

  return (
    <div>
      <p className="text-sm text-gray-700">
        <span className="font-semibold" style={{ color: accent }}>
          {label}:{" "}
        </span>
        {!hasItems && !hasCustom ? "None" : null}
        {hasItems ? items.join(", ") : null}
      </p>
      {hasCustom && (
        <p className="mt-0.5 text-sm leading-relaxed text-gray-600">
          {custom}
        </p>
      )}
    </div>
  );
}

/** Structured prereq/coreq links plus catalog custom text (display-only). */
function CourseRequirements({ course, accent, className = "" }: CourseRequirementsProps) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <RequirementBlock
        label="Prerequisites"
        items={course.prerequisites}
        custom={course.customPrereq}
        accent={accent}
      />
      <RequirementBlock
        label="Corequisites"
        items={course.corequisites}
        custom={course.customCoreq}
        accent={accent}
      />
    </div>
  );
}

export default CourseRequirements;
