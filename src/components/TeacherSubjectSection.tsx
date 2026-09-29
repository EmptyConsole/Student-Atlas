import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { Subject } from "../data/subjects";
import type { Term } from "../data/courses";
import { offeringsOf, repCourse, type DisplayCourse } from "../utils/courseGrouping";
import TeacherCourseCard from "./TeacherCourseCard";
import { LAYOUT_SWITCH_TRANSITION } from "./CatalogLayoutToggle";
import { iconButtonCompactClass } from "./controlStyles";

type TeacherSubjectSectionProps = {
  subject: Subject;
  items: DisplayCourse[];
  termById: Map<string, Term>;
  expandedId: string | null;
  /** When false, the department edit/delete controls are hidden (ungrouped courses). */
  editable?: boolean;
  onToggleExpand: (id: string) => void;
  onEditDepartment: () => void;
  onDeleteDepartment: () => void;
  onEditCourse: (item: DisplayCourse) => void;
  onDeleteCourse: (item: DisplayCourse) => void;
  /** Compact 3-column grid instead of full-width student-style cards. */
  compact?: boolean;
};

function TeacherSubjectSection({
  subject,
  items,
  termById,
  expandedId,
  editable = true,
  onToggleExpand,
  onEditDepartment,
  onDeleteDepartment,
  onEditCourse,
  onDeleteCourse,
  compact = false,
}: TeacherSubjectSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const renderCourseCard = (item: DisplayCourse) => {
    const course = repCourse(item);
    return (
      <TeacherCourseCard
        key={course.id}
        course={course}
        subject={subject}
        offerings={offeringsOf(item)}
        termById={termById}
        compact={compact}
        expanded={expandedId === course.id}
        onToggleExpand={() => onToggleExpand(course.id)}
        onEdit={() => onEditCourse(item)}
        onDelete={() => onDeleteCourse(item)}
      />
    );
  };

  return (
    <section
      id={`subject-${subject.name}`}
      data-subject={subject.name}
      className="scroll-mt-6"
    >
      <div className="mb-4 flex items-start gap-2">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${subject.name}` : `Collapse ${subject.name}`}
          onClick={() => setCollapsed((c) => !c)}
          className={`${iconButtonCompactClass} -ml-1 text-ink-secondary`}
        >
          <ChevronDown
            className="h-5 w-5 shrink-0 transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: subject.accent }}
              aria-hidden="true"
            />
            <h2 className="text-xl leading-7 font-semibold text-ink">
              {subject.name}
            </h2>
            <span className="text-sm text-ink-muted">
              {items.length} {items.length === 1 ? "course" : "courses"}
            </span>
            {editable && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label={`Edit ${subject.name} department`}
                  onClick={onEditDepartment}
                  className={`${iconButtonCompactClass} text-ink-secondary hover:text-primary`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${subject.name} department`}
                  onClick={onDeleteDepartment}
                  className={`${iconButtonCompactClass} text-red-600`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {subject.description && (
            <p className="text-sm leading-snug text-ink-secondary">
              {subject.description}
            </p>
          )}
          {!collapsed && subject.graduationRequirement && (
            <p className="text-sm leading-snug text-ink-secondary">
              <span className="font-semibold text-ink">Graduation Requirement: </span>
              {subject.graduationRequirement}
            </p>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="course-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="overflow-hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={compact ? "compact" : "full"}
                initial={{ opacity: 0, scale: 0.98, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -8 }}
                transition={LAYOUT_SWITCH_TRANSITION}
                className={
                  compact ? "flex items-start gap-3" : "flex flex-col gap-3"
                }
              >
                {items.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-6 text-center text-sm text-ink-muted">
                    No courses in this department yet.
                  </p>
                ) : compact ? (
                  <>
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      {items.filter((_, index) => index % 2 === 0).map(renderCourseCard)}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      {items.filter((_, index) => index % 2 === 1).map(renderCourseCard)}
                    </div>
                  </>
                ) : (
                  items.map(renderCourseCard)
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default TeacherSubjectSection;
