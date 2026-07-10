import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { Subject } from "../data/subjects";
import { repCourse, type DisplayCourse } from "../utils/courseGrouping";
import TeacherCourseCard from "./TeacherCourseCard";

type TeacherSubjectSectionProps = {
  subject: Subject;
  items: DisplayCourse[];
  expandedId: string | null;
  /** When false, the department edit/delete controls are hidden (ungrouped courses). */
  editable?: boolean;
  onToggleExpand: (id: string) => void;
  onEditDepartment: () => void;
  onDeleteDepartment: () => void;
  onEditCourse: (item: DisplayCourse) => void;
  onDeleteCourse: (item: DisplayCourse) => void;
};

function TeacherSubjectSection({
  subject,
  items,
  expandedId,
  editable = true,
  onToggleExpand,
  onEditDepartment,
  onDeleteDepartment,
  onEditCourse,
  onDeleteCourse,
}: TeacherSubjectSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section
      id={`subject-${subject.name}`}
      data-subject={subject.name}
      className="scroll-mt-4"
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className="mt-1 h-6 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: subject.color }}
          aria-hidden="true"
        />
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${subject.name}` : `Collapse ${subject.name}`}
          onClick={() => setCollapsed((c) => !c)}
          className="cursor-pointer rounded-full p-1.5 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
          style={{ color: subject.accent, outlineColor: subject.accent }}
        >
          <ChevronDown
            className="h-5 w-5 shrink-0 transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold" style={{ color: subject.accent }}>
              {subject.name}
            </h2>
            <span className="text-sm font-medium text-gray-400">
              {items.length} {items.length === 1 ? "course" : "courses"}
            </span>
            {editable && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Edit ${subject.name} department`}
                  onClick={onEditDepartment}
                  className="cursor-pointer rounded-full p-1.5 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
                  style={{ color: subject.accent }}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${subject.name} department`}
                  onClick={onDeleteDepartment}
                  className="cursor-pointer rounded-full p-1.5 text-red-500 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {!collapsed && subject.graduationRequirement && (
            <p className="text-sm leading-snug text-gray-600">
              <span className="font-bold">Graduation Requirement: </span>
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
            <div className="flex flex-col gap-3">
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-main-300 px-4 py-6 text-center text-sm text-gray-400">
                  No courses in this department yet.
                </p>
              ) : (
                items.map((item) => {
                  const course = repCourse(item);
                  return (
                    <TeacherCourseCard
                      key={course.id}
                      course={course}
                      subject={subject}
                      expanded={expandedId === course.id}
                      onToggleExpand={() => onToggleExpand(course.id)}
                      onEdit={() => onEditCourse(item)}
                      onDelete={() => onDeleteCourse(item)}
                    />
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default TeacherSubjectSection;
