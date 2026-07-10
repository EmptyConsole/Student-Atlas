import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup } from "motion/react";
import { LogOut, Pencil, Search, Trash2 } from "lucide-react";
import { buildSubject, type Subject } from "../data/subjects";
import { matchesSearch } from "../data/courses";
import { useCourses } from "../hooks/useCourses";
import { useSubjects } from "../hooks/useSubjects";
import {
  buildDisplayCourses,
  courseIdsInItem,
  repCourse,
  type DisplayCourse,
} from "../utils/courseGrouping";
import {
  createCourse,
  createDepartment,
  createSchool,
  deleteCourse,
  deleteDepartment,
  deleteSchool,
  fetchDepartments,
  fetchSchool,
  updateCourse,
  updateDepartment,
  updateSchool,
  type CourseInput,
  type DepartmentInput,
  type DepartmentRow,
  type SchoolInput,
} from "../lib/teacher";
import type { UnlockedSchool } from "./TeacherGate";
import TeacherSidebar from "./TeacherSidebar";
import TeacherSubjectSection from "./TeacherSubjectSection";
import AddMenu, { type AddKind } from "./teacher/AddMenu";
import CourseFormModal from "./teacher/CourseFormModal";
import DepartmentFormModal from "./teacher/DepartmentFormModal";
import SchoolFormModal, {
  type SchoolFormInitial,
} from "./teacher/SchoolFormModal";
import ConfirmDeleteDialog from "./teacher/ConfirmDeleteDialog";
import ModalShell from "./teacher/ModalShell";
import { primaryButtonClass, secondaryButtonClass } from "./teacher/formStyles";

type TeacherCatalogProps = {
  school: UnlockedSchool;
  onSwitchSchool: () => void;
  onSchoolUpdated: (name: string, password: string) => void;
  onSchoolDeleted: () => void;
  onSwitchToSchool: (school: UnlockedSchool) => void;
};

type CourseModalState =
  | { mode: "add" }
  | { mode: "edit"; item: DisplayCourse };
type DepartmentModalState = {
  mode: "add" | "edit";
  department?: DepartmentRow;
};
type DeleteState =
  | { kind: "course"; item: DisplayCourse }
  | { kind: "department"; department: DepartmentRow }
  | { kind: "school" }
  | null;

function TeacherCatalog({
  school,
  onSwitchSchool,
  onSchoolUpdated,
  onSchoolDeleted,
  onSwitchToSchool,
}: TeacherCatalogProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const { subjects, loading: subjectsLoading } = useSubjects(
    school.id,
    reloadKey,
  );
  const { courses, loading: coursesLoading } = useCourses(school.id, reloadKey);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);

  const [search, setSearch] = useState("");
  const [activeSubject, setActiveSubject] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [courseModal, setCourseModal] = useState<CourseModalState | null>(null);
  const [departmentModal, setDepartmentModal] =
    useState<DepartmentModalState | null>(null);
  const [schoolModalInitial, setSchoolModalInitial] =
    useState<SchoolFormInitial | null>(null);
  const [addSchoolOpen, setAddSchoolOpen] = useState(false);
  const [createdSchool, setCreatedSchool] = useState<UnlockedSchool | null>(
    null,
  );

  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(activeSubject);
  activeRef.current = activeSubject;

  useEffect(() => {
    let mounted = true;
    fetchDepartments(school.id)
      .then((rows) => {
        if (mounted) setDepartments(rows);
      })
      .catch(() => {
        if (mounted) setDepartments([]);
      });
    return () => {
      mounted = false;
    };
  }, [school.id, reloadKey]);

  // Departments (with palette colors) plus synthetic sections for any courses
  // whose subject no longer maps to a department (e.g. after a delete).
  const extraSubjects = useMemo(() => {
    const known = new Set(subjects.map((s) => s.name));
    const extras: string[] = [];
    for (const course of courses) {
      if (!known.has(course.subject) && !extras.includes(course.subject)) {
        extras.push(course.subject);
      }
    }
    return extras.map((name, i) =>
      buildSubject(
        { name, subtitle: null, graduationRequirement: null },
        subjects.length + i,
      ),
    );
  }, [subjects, courses]);

  const itemsBySubject = useMemo(() => {
    const map = new Map<string, DisplayCourse[]>();
    for (const subject of [...subjects, ...extraSubjects])
      map.set(subject.name, []);
    for (const item of buildDisplayCourses(courses)) {
      const rep = repCourse(item);
      if (!matchesSearch(rep, search)) continue;
      map.get(rep.subject)?.push(item);
    }
    return map;
  }, [subjects, extraSubjects, courses, search]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const name = entry.target.getAttribute("data-subject");
          if (!name) continue;
          if (entry.isIntersecting)
            visible.set(name, entry.boundingClientRect.top);
          else visible.delete(name);
        }
        if (visible.size === 0) return;
        const topmost = [...visible.entries()].sort(
          (a, b) => a[1] - b[1],
        )[0][0];
        if (topmost !== activeRef.current) setActiveSubject(topmost);
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    const sections = root.querySelectorAll("[data-subject]");
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [search, subjects, extraSubjects]);

  const toggleExpand = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

  const loading = subjectsLoading || coursesLoading;

  // --- Add menu ---------------------------------------------------------------
  const handleAdd = (kind: AddKind) => {
    if (kind === "course") setCourseModal({ mode: "add" });
    else if (kind === "department") setDepartmentModal({ mode: "add" });
    else setAddSchoolOpen(true);
  };

  // --- Courses ----------------------------------------------------------------
  const handleSaveCourse = async (
    input: CourseInput,
  ): Promise<{ error?: string }> => {
    if (courseModal?.mode === "edit") {
      const { item } = courseModal;
      if (item.kind === "group") {
        const fall = await updateCourse(item.fallId, school.id, {
          ...input,
          term: "fall",
        });
        if (fall.error) return { error: fall.error };
        const spring = await updateCourse(item.springId, school.id, {
          ...input,
          term: "spring",
        });
        if (!spring.error) reload();
        return { error: spring.error };
      }
      const result = await updateCourse(item.course.id, school.id, input);
      if (!result.error) reload();
      return { error: result.error };
    }
    const result = await createCourse(school.id, input);
    if (!result.error) reload();
    return { error: result.error };
  };

  // --- Departments ------------------------------------------------------------
  const handleSaveDepartment = async (
    input: DepartmentInput,
  ): Promise<{ error?: string }> => {
    const result =
      departmentModal?.mode === "edit" && departmentModal.department
        ? await updateDepartment(departmentModal.department.id, input)
        : await createDepartment(school.id, input);
    if (!result.error) reload();
    return { error: result.error };
  };

  const openEditDepartment = (subjectName: string) => {
    const department = departments.find((d) => d.name === subjectName);
    if (department) setDepartmentModal({ mode: "edit", department });
  };

  const requestDeleteDepartment = (subjectName: string) => {
    const department = departments.find((d) => d.name === subjectName);
    if (!department) return;
    setDeleteError(null);
    setDeleteState({ kind: "department", department });
  };

  // --- School -----------------------------------------------------------------
  const handleEditSchool = async () => {
    const row = await fetchSchool(school.id);
    setSchoolModalInitial({
      name: row?.name ?? school.name,
      website: row?.website ?? "",
      city: row?.city ?? "",
      state: row?.state ?? "",
      password: row?.password ?? school.password,
    });
  };

  const handleSaveSchool = async (
    input: SchoolInput,
  ): Promise<{ error?: string }> => {
    const result = await updateSchool(school.id, input);
    if (!result.error) {
      onSchoolUpdated(input.name.trim(), input.password);
      reload();
    }
    return { error: result.error };
  };

  const handleCreateSchool = async (
    input: SchoolInput,
  ): Promise<{ error?: string }> => {
    const result = await createSchool(input);
    if (result.error) return { error: result.error };
    if (result.data) {
      setCreatedSchool({
        id: result.data.id,
        name: result.data.name,
        password: input.password,
      });
    }
    return {};
  };

  // --- Deletion ---------------------------------------------------------------
  const handleConfirmDelete = async () => {
    if (!deleteState || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    let result: { error?: string } = {};
    if (deleteState.kind === "course") {
      const ids = courseIdsInItem(deleteState.item);
      for (const id of ids) {
        result = await deleteCourse(id, school.id);
        if (result.error) break;
      }
    } else if (deleteState.kind === "department") {
      result = await deleteDepartment(deleteState.department.id);
    } else {
      result = await deleteSchool(school.id);
    }
    setDeleteBusy(false);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    const kind = deleteState.kind;
    setDeleteState(null);
    if (kind === "school") onSchoolDeleted();
    else reload();
  };

  const deleteDialogProps = () => {
    if (!deleteState) return null;
    if (deleteState.kind === "course") {
      const title = repCourse(deleteState.item).title;
      const bothTerms = deleteState.item.kind === "group";
      return {
        title: "Delete course",
        message: bothTerms
          ? `Delete "${title}" (Fall and Spring)? This cannot be undone.`
          : `Delete "${title}"? This cannot be undone.`,
      };
    }
    if (deleteState.kind === "department") {
      return {
        title: "Delete department and courses",
        message: `Delete the "${deleteState.department.name}" department and all of its courses? This cannot be undone. Enter the school password to confirm.`,
        passwordToMatch: school.password,
      };
    }
    return {
      title: "Delete school",
      message: `This permanently deletes ${school.name} and all of its departments and courses. Type the school name and password to confirm.`,
      passwordToMatch: school.password,
      nameToMatch: school.name,
    };
  };

  const dialog = deleteDialogProps();

  const editableSubjectNames = new Set(subjects.map((s) => s.name));

  const renderSection = (subject: Subject) => (
    <TeacherSubjectSection
      key={subject.name}
      subject={subject}
      items={itemsBySubject.get(subject.name) ?? []}
      expandedId={expandedId}
      onToggleExpand={toggleExpand}
      editable={editableSubjectNames.has(subject.name)}
      onEditDepartment={() => openEditDepartment(subject.name)}
      onDeleteDepartment={() => requestDeleteDepartment(subject.name)}
      onEditCourse={(item) => setCourseModal({ mode: "edit", item })}
      onDeleteCourse={(item) => {
        setDeleteError(null);
        setDeleteState({ kind: "course", item });
      }}
    />
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      <TeacherSidebar
        subjects={subjects}
        activeSubject={activeSubject}
        onSelectSubject={setActiveSubject}
      />

      <main className="flex flex-1 flex-col overflow-hidden bg-detail-400">
        <div className="sticky top-0 z-20 flex flex-col gap-3 bg-detail-400/95 px-6 pt-6 pb-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-gray-800">
                {school.name}
              </h1>
              <p className="text-sm text-gray-500">Teacher editing</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AddMenu onSelect={handleAdd} />
              <button
                type="button"
                onClick={handleEditSchool}
                className="flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-main-400 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-150 hover:scale-[1.02] hover:bg-main-100 active:scale-95"
              >
                <Pencil className="h-4 w-4" />
                Edit school
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteState({ kind: "school" });
                }}
                className="flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 shadow-sm transition-all duration-150 hover:scale-[1.02] hover:bg-red-50 active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
                Delete school
              </button>
              <button
                type="button"
                onClick={onSwitchSchool}
                className="flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-gray-500 transition-colors hover:bg-main-100 hover:text-gray-700"
              >
                <LogOut className="h-4 w-4" />
                Switch school
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses by title or description..."
              className="h-12 w-full rounded-xl border border-main-400 bg-white pr-4 pl-11 text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-main-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-500"
            />
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-2 pb-10">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-main-300 border-t-main-600" />
            </div>
          ) : subjects.length === 0 && courses.length === 0 ? (
            <div className="mx-auto max-w-md py-16 text-center">
              <p className="text-gray-500">
                This school has no departments yet. Use{" "}
                <span className="font-semibold text-gray-700">Add</span> to
                create your first department, then add courses.
              </p>
            </div>
          ) : (
            <LayoutGroup>
              <div className="flex flex-col gap-8">
                {subjects.map(renderSection)}
                {extraSubjects.map(renderSection)}
              </div>
            </LayoutGroup>
          )}
        </div>
      </main>

      {courseModal && (
        <CourseFormModal
          mode={courseModal.mode}
          departments={departments}
          courses={courses}
          editingCourse={
            courseModal.mode === "edit" ? repCourse(courseModal.item) : null
          }
          onClose={() => setCourseModal(null)}
          onSave={handleSaveCourse}
        />
      )}

      {departmentModal && (
        <DepartmentFormModal
          mode={departmentModal.mode}
          editingDepartment={departmentModal.department ?? null}
          onClose={() => setDepartmentModal(null)}
          onSave={handleSaveDepartment}
        />
      )}

      {schoolModalInitial && (
        <SchoolFormModal
          mode="edit"
          initial={schoolModalInitial}
          onClose={() => setSchoolModalInitial(null)}
          onSave={handleSaveSchool}
        />
      )}

      {addSchoolOpen && (
        <SchoolFormModal
          mode="add"
          onClose={() => setAddSchoolOpen(false)}
          onSave={handleCreateSchool}
        />
      )}

      {createdSchool && (
        <ModalShell
          title="School created"
          maxWidthClass="max-w-md"
          onClose={() => setCreatedSchool(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setCreatedSchool(null)}
                className={secondaryButtonClass}
              >
                Stay here
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = createdSchool;
                  setCreatedSchool(null);
                  onSwitchToSchool(target);
                }}
                className={primaryButtonClass}
              >
                Go edit it
              </button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-600">
            {createdSchool.name} was created. Switch to it now to add
            departments and courses?
          </p>
        </ModalShell>
      )}

      {dialog && (
        <ConfirmDeleteDialog
          title={dialog.title}
          message={dialog.message}
          confirmLabel="Delete"
          passwordToMatch={dialog.passwordToMatch ?? null}
          nameToMatch={dialog.nameToMatch ?? null}
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => {
            if (!deleteBusy) {
              setDeleteState(null);
              setDeleteError(null);
            }
          }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}

export default TeacherCatalog;
