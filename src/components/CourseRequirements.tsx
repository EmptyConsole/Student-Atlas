import { formatRequirementOptions, type Course, type ReqOptions } from "../data/courses";

type CourseRequirementsProps = {
  course: Course;
  className?: string;
};

function RequirementBlock({
  label,
  options,
}: {
  label: string;
  options: ReqOptions | undefined;
}) {
  const text = formatRequirementOptions(options);

  return (
    <div>
      <p className="text-sm text-ink-secondary">
        <span className="font-semibold text-ink">{label}: </span>
        {text || "None"}
      </p>
    </div>
  );
}

/** Structured prereq/coreq requirements rendered from the options arrays (display-only). */
function CourseRequirements({ course, className = "" }: CourseRequirementsProps) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <RequirementBlock label="Prerequisites" options={course.prereqOptions} />
      <RequirementBlock label="Corequisites" options={course.coreqOptions} />
    </div>
  );
}

export default CourseRequirements;
