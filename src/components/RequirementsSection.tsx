import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { REQUIREMENTS_KEY, type Subject } from "../data/subjects";
import { getSubjectIcon } from "../data/subjectIcons";

type RequirementsSectionProps = {
  subjects: Subject[];
};

function RequirementsSection({ subjects }: RequirementsSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const subjectsWithRequirements = useMemo(
    () => subjects.filter((subject) => subject.graduationRequirement),
    [subjects],
  );

  return (
    <section
      id={`subject-${REQUIREMENTS_KEY}`}
      data-subject={REQUIREMENTS_KEY}
      aria-labelledby="requirements-heading"
      className="scroll-mt-4 rounded-2xl border border-main-300 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? "Expand requirements" : "Collapse requirements"
          }
          onClick={() => setCollapsed((c) => !c)}
          className="mt-0.5 cursor-pointer rounded-full p-1.5 text-gray-600 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-500"
        >
          <ChevronDown
            className="h-5 w-5 shrink-0 transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <GraduationCap
            className="h-6 w-6 shrink-0 text-gray-700"
            aria-hidden="true"
          />
          <h2 id="requirements-heading" className="text-xl font-bold text-gray-800">
            Requirements
          </h2>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="requirements-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="overflow-hidden"
          >
            {subjectsWithRequirements.length === 0 ? (
              <p className="mt-3 pl-11 text-sm text-gray-400">
                No graduation requirements listed.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3 pl-11">
                {subjectsWithRequirements.map((subject) => {
                  const Icon = getSubjectIcon(subject.name);
                  return (
                    <li key={subject.name} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: subject.tint }}
                        aria-hidden="true"
                      >
                        <Icon
                          className="h-4 w-4"
                          style={{ color: subject.accent }}
                        />
                      </span>
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
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default RequirementsSection;
