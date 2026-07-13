import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup } from "motion/react";
import { LogOut, Pencil, Search, Trash2 } from "lucide-react";
import { buildSubject, type Subject } from "../data/subjects";
import { matchesSearch, type Term } from "../data/courses";
import { useCourses } from "../hooks/useCourses";
import { useSubjects } from "../hooks/useSubjects";
import { useTerms } from "../hooks/useTerms";
import {
  buildDisplayCourses,
  courseIdsInItem,
  repCourse,
  type DisplayCourse,
} from "../utils/courseGrouping";
import { DEFAULT_REQUIRED_RANKINGS } from "../utils/courseRanking";
import {
  createDepartment,
  createSchool,
  createTerm,
  deleteCourse,
  deleteDepartment,
  deleteSchool,
  deleteTerm,
  fetchDepartments,
  fetchSchool,
  fetchTerms,
  renameTerm,
  reorderTerms,
  saveCourseOfferings,
  updateDepartment,
  updateSchool,
  type CourseFormSubmit,
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
  type TermDraft,
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
  const [activeSubject, setActiveSubject] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [courseModal, setCourseModal] = useState<CourseModalState | null>(null);
  const [departmentModal, setDepartmentModal] =
    useState<DepartmentModalState | null>(null);
  const [schoolModalInitial, setSchoolModalInitial] =
    useState<SchoolFormInitial | null>(null);
  const [schoolModalTerms, setSchoolModalTerms] = useState<Term[]>([]);
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
    submit: CourseFormSubmit,
  ): Promise<{ error?: string }> => {
    // Existing offering rows to reconcile against (empty when adding).
    const existingIds =
      courseModal?.mode === "edit" ? courseIdsInItem(courseModal.item) : [];
    const result = await saveCourseOfferings(school.id, existingIds, submit);
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
      password: row?.password ?? school.password,
      rankings: row?.rankings ?? DEFAULT_REQUIRED_RANKINGS,
    });
  };

  /**
   * Applies the form's term drafts to Supabase: creates new terms, renames
   * changed ones, deletes removed ones (guarded), then persists the ordering.
   */
  const reconcileTerms = async (
    schoolId: string,
    existing: Term[],
    drafts: TermDraft[],
  ): Promise<{ error?: string }> => {
    const draftIds = new Set(
      drafts.filter((d) => d.id).map((d) => d.id as string),
    );
    for (const term of existing) {
      if (!draftIds.has(term.id)) {
        const result = await deleteTerm(schoolId, term.id);
        if (result.error) return { error: result.error };
      }
    }

    const orderedIds: string[] = [];
    for (const draft of drafts) {
      if (draft.id) {
        const prev = existing.find((t) => t.id === draft.id);
        if (prev && prev.name !== draft.name) {
          const result = await renameTerm(draft.id, draft.name);
          if (result.error) return { error: result.error };
        }
        orderedIds.push(draft.id);
      } else {
        const result = await createTerm(schoolId, draft.name);
        if (result.error) return { error: result.error };
        if (result.data) orderedIds.push(result.data.id);
      }
    }

    return reorderTerms(orderedIds);
  };

  const handleSaveSchool = async (
    input: SchoolInput,
    terms: TermDraft[],
  ): Promise<{ error?: string }> => {
    const result = await updateSchool(school.id, input);
    if (result.error) return { error: result.error };

    const termsResult = await reconcileTerms(school.id, schoolModalTerms, terms);
    if (termsResult.error) return { error: termsResult.error };

    onSchoolUpdated(input.name.trim(), input.password);
    reload();
    return {};
  };

  const handleCreateSchool = async (
    input: SchoolInput,
    terms: TermDraft[],
  ): Promise<{ error?: string }> => {
    const result = await createSchool(input);
    if (result.error) return { error: result.error };
    if (!result.data) return { error: "Failed to create school" };

    const termsResult = await reconcileTerms(result.data.id, [], terms);
    if (termsResult.error) return { error: termsResult.error };

    setCreatedSchool({
      id: result.data.id,
      name: result.data.name,
      password: input.password,
    });
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
      termById={termById}
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
