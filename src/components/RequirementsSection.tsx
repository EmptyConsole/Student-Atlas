import { useMemo } from "react";
import type { Subject } from "../data/subjects";

type RequirementsSectionProps = {
  subjects: Subject[];
};

function RequirementsSection({ subjects }: RequirementsSectionProps) {
  const subjectsWithRequirements = useMemo(
    () => subjects.filter((subject) => subject.graduationRequirement),
    [subjects],
  );

  return (
    <section
      aria-labelledby="requirements-heading"
      className="rounded-2xl border border-main-300 bg-white p-4 shadow-sm"
    >
      <h2 id="requirements-heading" className="text-xl font-bold text-gray-800">
        Requirements
      </h2>

      {subjectsWithRequirements.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">
          No graduation requirements listed.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {subjectsWithRequirements.map((subject) => (
            <li key={subject.name} className="flex items-start gap-3">
              <span
                className="mt-1 h-4 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: subject.color }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p
                  className="text-base font-bold leading-snug"
                  style={{ color: subject.accent }}
                >
                  {subject.name}
                </p>
                <p className="mt-0.5 text-sm leading-snug text-gray-600">
                  {subject.graduationRequirement}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default RequirementsSection;
