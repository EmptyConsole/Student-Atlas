import { useEffect, useRef } from "react";
import type { ReqOptions } from "../../data/courses";
import type { ClassTime } from "../../utils/classTime";

const STORAGE_KEY = "student-atlas-teacher-course-draft";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const WRITE_DEBOUNCE_MS = 400;

/** Serializable form snapshot stored in localStorage. */
export type CourseDraftForm = {
  title: string;
  shortDescription: string;
  longDescription: string;
  grades: number[];
  offerings: {
    courseId: string | null;
    terms: string[];
    previousSchedule: ClassTime[];
  }[];
  classTimes: {
    day: string;
    start: string;
    end: string;
    original: ClassTime | null;
  }[];
  departmentId: string;
  teacherName: string;
  maxStudentCountInput: string;
  retakeable: boolean;
  prereq: ReqOptions;
  coreq: ReqOptions;
};

type DraftEntry = {
  savedAt: number;
  form: CourseDraftForm;
};

type DraftMap = Record<string, DraftEntry>;

function readMap(): DraftMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DraftMap;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeMap(map: DraftMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode — ignore */
  }
}

function pruneExpired(map: DraftMap, now = Date.now()): DraftMap {
  const next: DraftMap = {};
  for (const [id, entry] of Object.entries(map)) {
    if (
      entry &&
      typeof entry.savedAt === "number" &&
      entry.form &&
      now - entry.savedAt < DRAFT_TTL_MS
    ) {
      next[id] = entry;
    }
  }
  return next;
}

/** Build the draft id for an add or edit session at a school. */
export function courseDraftId(
  schoolId: string,
  mode: "add" | "edit",
  representativeCourseId?: string | null,
): string {
  if (mode === "add") return `${schoolId}:add`;
  return `${schoolId}:edit:${representativeCourseId ?? "unknown"}`;
}

/** Load a single draft (and prune expired entries). Returns null if missing. */
export function readCourseDraft(draftId: string): CourseDraftForm | null {
  const map = pruneExpired(readMap());
  writeMap(map);
  const entry = map[draftId];
  return entry?.form ?? null;
}

export function writeCourseDraft(draftId: string, form: CourseDraftForm) {
  const map = pruneExpired(readMap());
  map[draftId] = { savedAt: Date.now(), form };
  writeMap(map);
}

export function clearCourseDraft(draftId: string) {
  const map = pruneExpired(readMap());
  if (!(draftId in map)) {
    writeMap(map);
    return;
  }
  delete map[draftId];
  writeMap(map);
}

/**
 * Debounced localStorage persistence for an open course form. Writes only when
 * dirty; flushes immediately when the tab hides so a fast reload keeps the
 * last keystroke.
 */
export function useCourseDraft(
  draftId: string,
  form: CourseDraftForm,
  dirty: boolean,
) {
  const formRef = useRef(form);
  formRef.current = form;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      writeCourseDraft(draftId, formRef.current);
    }, WRITE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draftId, dirty, form]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) {
        writeCourseDraft(draftId, formRef.current);
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [draftId]);
}
