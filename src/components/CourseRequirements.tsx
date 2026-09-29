import { formatRequirementOptions, type Course, type ReqOptions } from "../data/courses";

type CourseRequirementsProps = {
  course: Course;
  accent: string;
  className?: string;
};

function RequirementBlock({
  label,
  options,
  accent,
}: {
  label: string;
  options: ReqOptions | undefined;
  accent: string;
}) {
  const text = formatRequirementOptions(options);

  return (
    <div>
      <p className="text-sm text-gray-700">
        <span className="font-semibold" style={{ color: accent }}>
          {label}:{" "}
        </span>
        {text || "None"}
      </p>
    </div>
  );
}

/** Structured prereq/coreq requirements rendered from the options arrays (display-only). */
function CourseRequirements({ course, accent, className = "" }: CourseRequirementsProps) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <RequirementBlock
        label="Prerequisites"
        options={course.prereqOptions}
        accent={accent}
      />
      <RequirementBlock
        label="Corequisites"
        options={course.coreqOptions}
        accent={accent}
      />
    </div>
  );
}

export default CourseRequirements;
