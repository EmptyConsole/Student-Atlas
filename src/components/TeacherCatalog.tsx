import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { buildSubject, type Subject } from "../data/subjects";
import { matchesSearch, type Term } from "../data/courses";
import { useCourses } from "../hooks/useCourses";
import { useSubjects } from "../hooks/useSubjects";
import { useTerms } from "../hooks/useTerms";
import {
  buildDisplayCourses,
  courseIdsInItem,
  offeringRowsOf,
  offeringsOf,
  repCourse,
  type DisplayCourse,
} from "../utils/courseGrouping";
import { DEFAULT_REQUIRED_RANKINGS } from "../utils/courseRanking";
import { parseGradeSettings } from "../utils/gradeSettings";
import {
  createDepartment,
  createSchool,
  deleteCourse,
  deleteDepartment,
  deleteSchool,
  fetchDepartments,
  fetchSchool,
  fetchTerms,
  saveCourseOfferings,
  updateDepartment,
  updateSchool,
  type CourseFormSubmit,
  type DepartmentInput,
  type DepartmentRow,
  type SchoolInput,
  type UnlockedSession,
} from "../lib/teacher";
import TeacherSidebar from "./TeacherSidebar";
import TeacherSubjectSection from "./TeacherSubjectSection";
import AddMenu, { type AddKind } from "./teacher/AddMenu";
import CourseFormModal from "./teacher/CourseFormModal";
import DepartmentFormModal from "./teacher/DepartmentFormModal";
import SchoolFormModal, {
  type SchoolFormInitial,
  type TermDraft,
} from "./teacher/SchoolFormModal";
import ConfirmDeleteDialog from "./teacher/ConfirmDeleteDialog";
import ModalShell from "./teacher/ModalShell";
import { primaryButtonClass, secondaryButtonClass } from "./teacher/formStyles";
import CatalogLayoutToggle, {
  LAYOUT_SWITCH_TRANSITION,
} from "./CatalogLayoutToggle";

type TeacherCatalogProps = {
  school: UnlockedSession;
  onSchoolRenamed: (name: string) => void;
  onSchoolDeleted: () => void;
  onSessionExpired: () => void;
  onSwitchToSchool: (school: UnlockedSession) => void;
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

/** Student-style cards (1 per row) vs compact teacher grid (3 per row). */
type TeacherCatalogLayout = "student" | "teacher";

const CATALOG_LAYOUT_KEY = "student-atlas-teacher-catalog-layout";

function loadCatalogLayout(): TeacherCatalogLayout {
  try {
    const stored = localStorage.getItem(CATALOG_LAYOUT_KEY);
    if (stored === "student" || stored === "teacher") return stored;
  } catch {
    /* ignore */
  }
  return "student";
}

function TeacherCatalog({
  school,
  onSchoolRenamed,
  onSchoolDeleted,
  onSessionExpired,
  onSwitchToSchool,
}: TeacherCatalogProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  /**
   * Server rejected the session token, so the catalog can no longer save
   * anything: send the teacher back to the gate instead of failing silently.
   */
  const handleResult = (result: {
    error?: string;
    expired?: boolean;
  }): { error?: string } => {
    if (result.expired) onSessionExpired();
    return { error: result.error };
  };

  const { subjects, loading: subjectsLoading } = useSubjects(
    school.id,
    reloadKey,
  );
  const { courses, loading: coursesLoading } = useCourses(school.id, reloadKey);
  const { terms, termById } = useTerms(school.id, reloadKey);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);

  // Term ids referenced by at least one course — used to block term deletion.
  const usedTermIds = useMemo(() => {
    const set = new Set<string>();
    for (const course of courses) {
      for (const termId of course.termOptions) set.add(termId);
    }
    return set;
  }, [courses]);

  const [search, setSearch] = useState("");
  const [catalogLayout, setCatalogLayout] = useState<TeacherCatalogLayout>(
    loadCatalogLayout,
  );
  const [activeSubject, setActiveSubject] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [courseModal, setCourseModal] = useState<CourseModalState | null>(null);
  const [departmentModal, setDepartmentModal] =
    useState<DepartmentModalState | null>(null);
  const [schoolModalInitial, setSchoolModalInitial] =
    useState<SchoolFormInitial | null>(null);
  const [schoolModalTerms, setSchoolModalTerms] = useState<Term[]>([]);
  const [addSchoolOpen, setAddSchoolOpen] = useState(false);
  const [createdSchool, setCreatedSchool] = useState<UnlockedSession | null>(
    null,
  );

  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<number | null>(null);
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
  const initialLoading =
    loading && subjects.length === 0 && courses.length === 0;

  // After a background reload, restore the catalog scroll position.
  useEffect(() => {
    if (pendingScrollRef.current === null || loading) return;
    const top = pendingScrollRef.current;
    pendingScrollRef.current = null;
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = top;
    });
  }, [loading, courses, subjects, reloadKey]);

  // --- Add menu ---------------------------------------------------------------
  const handleAdd = (kind: AddKind) => {
    if (kind === "course") setCourseModal({ mode: "add" });
    else if (kind === "department") setDepartmentModal({ mode: "add" });
    else setAddSchoolOpen(true);
  };

  // --- Courses ----------------------------------------------------------------
  const handleSaveCourse = async (
    submit: CourseFormSubmit,
  ): Promise<{ error?: string }> => {
    if (scrollRef.current) {
      pendingScrollRef.current = scrollRef.current.scrollTop;
    }
    // Existing offering rows to reconcile against (empty when adding).
    const existingRows =
      courseModal?.mode === "edit"
        ? offeringRowsOf(courseModal.item).map((r) => ({
            courseId: r.courseId,
            schedule: r.schedule,
          }))
        : [];
    const result = await saveCourseOfferings(
      school.token,
      existingRows,
      submit,
    );
    if (!result.error) reload();
    return handleResult(result);
  };

  // --- Departments ------------------------------------------------------------
  const handleSaveDepartment = async (
    input: DepartmentInput,
  ): Promise<{ error?: string }> => {
    const result =
      departmentModal?.mode === "edit" && departmentModal.department
        ? await updateDepartment(school.token, departmentModal.department.id, input)
        : await createDepartment(school.token, input);
    if (!result.error) reload();
    return handleResult(result);
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
    const [row, termRows] = await Promise.all([
      fetchSchool(school.id),
      fetchTerms(school.id),
    ]);
    setSchoolModalTerms(termRows);
    setSchoolModalInitial({
      name: row?.name ?? school.name,
      website: row?.website ?? "",
      city: row?.city ?? "",
      state: row?.state ?? "",
      rankings: row?.rankings ?? DEFAULT_REQUIRED_RANKINGS,
      electivesAssigned: row?.electives_assigned ?? 0,
      gradeSettings: parseGradeSettings(row?.grade),
    });
  };

  const handleSaveSchool = async (
    input: SchoolInput,
    terms: TermDraft[],
  ): Promise<{ error?: string }> => {
    // The server reconciles the term drafts in the same request.
    const result = await updateSchool(school.token, input, terms);
    if (result.error || result.expired) return handleResult(result);

    onSchoolRenamed(input.name.trim());
    reload();
    return {};
  };

  const handleCreateSchool = async (
    input: SchoolInput,
    terms: TermDraft[],
  ): Promise<{ error?: string }> => {
    const result = await createSchool(input, terms);
    if (result.error) return { error: result.error };
    if (!result.data) return { error: "Failed to create school" };

    setCreatedSchool(result.data);
    return {};
  };

  // --- Deletion ---------------------------------------------------------------
  /** `password` is verified server-side for the destructive kinds. */
  const handleConfirmDelete = async (password: string) => {
    if (!deleteState || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    let result: { error?: string; expired?: boolean } = {};
    if (deleteState.kind === "course") {
      const ids = courseIdsInItem(deleteState.item);
      for (const id of ids) {
        result = await deleteCourse(school.token, id);
        if (result.error) break;
      }
    } else if (deleteState.kind === "department") {
      result = await deleteDepartment(
        school.token,
        deleteState.department.id,
        password,
      );
    } else {
      result = await deleteSchool(school.token, password);
    }
    setDeleteBusy(false);
    if (result.error) {
      setDeleteError(result.error);
      handleResult(result);
      return;
    }
    const kind = deleteState.kind;
    setDeleteState(null);
    if (kind === "school") onSchoolDeleted();
    else reload();
  };

  const deleteDialogProps = () => {
    if (!deleteState) return null;

    const cannotBeUndone = (
      <strong className="mt-1.5 block text-gray-700">This cannot be undone.</strong>
    );

    if (deleteState.kind === "course") {
      const title = repCourse(deleteState.item).title;
      const termIds = new Set<string>();
      for (const offering of offeringsOf(deleteState.item)) {
        for (const termId of offering) termIds.add(termId);
      }
      const termNames = [...termIds]
        .map((id) => termById.get(id))
        .filter((term): term is Term => term != null)
        .sort((a, b) => a.position - b.position)
        .map((term) => term.name);
      const quotedLabel =
        termNames.length > 0
          ? `${title} (${termNames.join(", ")})`
          : title;

      return {
        title: "Delete course",
        message: (
          <>
            Deleting &ldquo;{quotedLabel}&rdquo;?{cannotBeUndone}
          </>
        ),
      };
    }
    if (deleteState.kind === "department") {
      return {
        title: "Delete department and courses",
        message: (
          <>
            Deleting &ldquo;{deleteState.department.name}&rdquo; and all of its
            courses?
            {cannotBeUndone}
            <span className="mt-2 block">
              Enter the school password to confirm.
            </span>
          </>
        ),
        requirePassword: true,
      };
    }
    return {
      title: "Delete school",
      message: (
        <>
          Deleting &ldquo;{school.name}&rdquo; and all of its departments and
          courses?
          {cannotBeUndone}
          <span className="mt-2 block">
            Type the school name and password to confirm.
          </span>
        </>
      ),
      requirePassword: true,
      nameToMatch: school.name,
    };
  };

  const dialog = deleteDialogProps();

  const editableSubjectNames = new Set(subjects.map((s) => s.name));

  const toggleCatalogLayout = () => {
    setCatalogLayout((prev) => {
      const next: TeacherCatalogLayout = prev === "student" ? "teacher" : "student";
      try {
        localStorage.setItem(CATALOG_LAYOUT_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const renderSection = (subject: Subject) => (
    <TeacherSubjectSection
      key={subject.name}
      subject={subject}
      items={itemsBySubject.get(subject.name) ?? []}
      termById={termById}
      expandedId={expandedId}
      compact={catalogLayout === "teacher"}
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
        <div className="sticky top-0 z-20 flex flex-col gap-3 border-b border-dashed border-main-400 bg-detail-400/95 px-6 pt-6 pb-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold text-gray-800">
                {school.name}
              </h1>
              <p className="truncate text-sm text-gray-500">Teacher editing</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CatalogLayoutToggle
                compact={catalogLayout === "teacher"}
                onToggle={toggleCatalogLayout}
                ariaLabelFull="Student preview on — switch to compact teacher view"
                ariaLabelCompact="Compact teacher view — switch to student preview"
                titleFull="Student preview (click for compact view)"
                titleCompact="Compact teacher view (click for student preview)"
              />
              <AddMenu onSelect={handleAdd} />
              <button
                type="button"
                onClick={handleEditSchool}
                className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-main-400 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-150 hover:scale-[1.02] hover:bg-main-100 active:scale-95"
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
                className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 shadow-sm transition-all duration-150 hover:scale-[1.02] hover:bg-red-50 active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
                Delete school
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
          {initialLoading ? (
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
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={catalogLayout}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={LAYOUT_SWITCH_TRANSITION}
                  className="flex flex-col gap-8"
                >
                  {subjects.map(renderSection)}
                  {extraSubjects.map(renderSection)}
                </motion.div>
              </AnimatePresence>
            </LayoutGroup>
          )}
        </div>
      </main>

      {courseModal && (
        <CourseFormModal
          mode={courseModal.mode}
          departments={departments}
          courses={courses}
          terms={terms}
          editingItem={courseModal.mode === "edit" ? courseModal.item : null}
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
          initialTerms={schoolModalTerms}
          usedTermIds={usedTermIds}
          onClose={() => {
            setSchoolModalInitial(null);
            setSchoolModalTerms([]);
          }}
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
          requirePassword={dialog.requirePassword ?? false}
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
