import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { REQUIREMENTS_KEY, type Subject } from "../data/subjects";
import { getSubjectIcon } from "../data/subjectIcons";

const SECTION_TRANSITION = { type: "spring" as const, stiffness: 350, damping: 32 };

type RequirementsSectionProps = {
  subjects: Subject[];
};

function RequirementsSection({ subjects }: RequirementsSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const subjectsWithRequirements = useMemo(
    () => subjects.filter((subject) => subject.graduationRequirement),
    [subjects],
  );

  const toggleCollapsed = () => setCollapsed((c) => !c);

  return (
    <section
      id={`subject-${REQUIREMENTS_KEY}`}
      data-subject={REQUIREMENTS_KEY}
      aria-labelledby="requirements-heading"
      className="scroll-mt-6 rounded-2xl border border-line bg-white p-5"
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand requirements" : "Collapse requirements"}
        onClick={toggleCollapsed}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleCollapsed();
          }
        }}
        className="flex cursor-pointer items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-main-600"
      >
        <ChevronDown
          className="h-5 w-5 shrink-0 text-ink-secondary transition-transform duration-200"
          style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <GraduationCap className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2
            id="requirements-heading"
            className="text-xl leading-7 font-semibold text-ink"
          >
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
            transition={SECTION_TRANSITION}
            className="overflow-hidden"
          >
            {subjectsWithRequirements.length === 0 ? (
              <p className="mt-4 pl-8 text-sm text-ink-muted">
                No graduation requirements listed.
              </p>
            ) : (
              <ul className="mt-4 grid gap-x-6 gap-y-4 pl-8 md:grid-cols-2">
                {subjectsWithRequirements.map((subject) => {
                  const Icon = getSubjectIcon(subject.name);
                  return (
                    <li key={subject.name} className="flex items-start gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: subject.tint }}
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4" style={{ color: subject.accent }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-base leading-snug font-semibold text-ink">
                          {subject.name}
                        </p>
                        <p className="mt-0.5 text-sm leading-snug text-ink-secondary">
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
