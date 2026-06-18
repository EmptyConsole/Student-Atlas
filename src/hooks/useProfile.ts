import { useCallback, useEffect, useState } from "react";
import type { CourseCompletion } from "../data/courses";

export type { CourseCompletion };

export type UserProfile = {
  name: string;
  email: string;
  grade: number | null;
  completedCourses: Record<string, CourseCompletion | null>;
  courseNotes: Record<string, string>;
};

const STORAGE_KEY = "student-atlas-profile";

export const DEFAULT_PROFILE: UserProfile = {
  name: "",
  email: "",
  grade: null,
  completedCourses: {},
  courseNotes: {},
};

export function isProfileComplete(profile: UserProfile): boolean {
  return (
    profile.name.trim().length > 0 &&
    profile.email.trim().length > 0 &&
    profile.grade !== null
  );
}

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      name: parsed.name ?? "",
      email: parsed.email ?? "",
      grade: parsed.grade ?? null,
      completedCourses: parsed.completedCourses ?? {},
      courseNotes: parsed.courseNotes ?? {},
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function saveProfile(profile: UserProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateCourseNote = useCallback((courseId: string, note: string) => {
    setProfile((prev) => {
      const next = { ...prev.courseNotes };
      const trimmed = note.trim();
      if (trimmed) next[courseId] = trimmed;
      else delete next[courseId];
      return { ...prev, courseNotes: next };
    });
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProfile({ ...DEFAULT_PROFILE });
  }, []);

  return { profile, updateProfile, updateCourseNote, signOut };
}
