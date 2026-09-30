import { useCallback, useEffect, useState } from "react";
import type { CourseCompletion } from "../data/courses";
import { clearStudentSession } from "../lib/students";
import { readScreenMode, type ScreenMode } from "./useTheme";

export type { CourseCompletion };

export type UserProfile = {
  schoolId: string | null;
  name: string;
  email: string;
  grade: number | null;
  screenMode: ScreenMode;
  completedCourses: Record<string, CourseCompletion | null>;
  courseNotes: Record<string, string>;
};

const STORAGE_KEY = "student-atlas-profile";
const ONBOARDED_KEY = "student-atlas-onboarded";
const STUDENT_ID_KEY = "student-atlas-student-id";

export const DEFAULT_PROFILE: UserProfile = {
  schoolId: null,
  name: "",
  email: "",
  grade: null,
  screenMode: "default",
  completedCourses: {},
  courseNotes: {},
};

export function isProfileComplete(profile: UserProfile): boolean {
  return (
    profile.schoolId !== null &&
    profile.name.trim().length > 0 &&
    profile.email.trim().length > 0 &&
    profile.grade !== null
  );
}

// The screen mode always comes from the theme the page is actually painted
// with, so the field can never disagree with what the student is looking at.
function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE, screenMode: readScreenMode() };
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      schoolId: parsed.schoolId ?? null,
      name: parsed.name ?? "",
      email: parsed.email ?? "",
      grade: parsed.grade ?? null,
      screenMode: readScreenMode(),
      completedCourses: parsed.completedCourses ?? {},
      courseNotes: parsed.courseNotes ?? {},
    };
  } catch {
    return { ...DEFAULT_PROFILE, screenMode: readScreenMode() };
  }
}

function saveProfile(profile: UserProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function loadOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "true";
  } catch {
    return false;
  }
}

function loadStudentId(): string | null {
  try {
    return localStorage.getItem(STUDENT_ID_KEY) ?? null;
  } catch {
    return null;
  }
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [onboarded, setOnboarded] = useState<boolean>(loadOnboarded);
  const [studentId, setStudentIdState] = useState<string | null>(loadStudentId);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const markOnboarded = useCallback(() => {
    localStorage.setItem(ONBOARDED_KEY, "true");
    setOnboarded(true);
  }, []);

  const setStudentId = useCallback((id: string) => {
    localStorage.setItem(STUDENT_ID_KEY, id);
    setStudentIdState(id);
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateCourseNote = useCallback((courseId: string, note: string) => {
    setProfile((prev) => {
      const next = { ...prev.courseNotes };
      if (note) next[courseId] = note;
      else delete next[courseId];
      return { ...prev, courseNotes: next };
    });
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ONBOARDED_KEY);
    localStorage.removeItem(STUDENT_ID_KEY);
    clearStudentSession();
    // Signing out clears the account, not the look of the app.
    setProfile({ ...DEFAULT_PROFILE, screenMode: readScreenMode() });
    setOnboarded(false);
    setStudentIdState(null);
  }, []);

  return {
    profile,
    onboarded,
    markOnboarded,
    studentId,
    setStudentId,
    updateProfile,
    updateCourseNote,
    signOut,
  };
}
