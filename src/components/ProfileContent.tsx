import { useEffect, useRef, useState } from "react";
import { GRADE_COLORS, GRADES } from "../data/courses";
import { isProfileComplete, type UserProfile } from "../hooks/useProfile";
import { useSchools } from "../hooks/useSchools";
import { useSchoolPrereqCourses } from "../hooks/useSchoolPrereqCourses";
import type { ProfileSection } from "./ProfileSidebar";
import SchoolPicker from "./SchoolPicker";

type ProfileContentProps = {
  profile: UserProfile;
  onChange: (patch: Partial<UserProfile>) => void;
  activeSection: ProfileSection;
  onSectionChange: (id: ProfileSection) => void;
  onboarding?: boolean;
  onSubmit?: () => Promise<{ error?: string }>;
  onLoginByEmail?: (email: string) => Promise<{ error?: string }>;
  hasUnsavedChanges?: boolean;
  onSaveChanges?: () => Promise<{ error?: string }>;
};

function RequiredFieldLabel({
  children,
  htmlFor,
  className = "mb-1.5",
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  const content = (
    <>
      {children}
      <span className="ml-0.5 text-red-500" aria-hidden="true">
        *
      </span>
    </>
  );
  const labelClass = `block text-sm font-semibold text-gray-700 ${className}`;

  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={labelClass}>
        {content}
      </label>
    );
  }

  return <span className={labelClass}>{content}</span>;
}

function GradeChip({
  grade,
  active,
  onClick,
}: {
  grade: number;
  active: boolean;
  onClick: () => void;
}) {
  const { bg, fg } = GRADE_COLORS[grade];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="cursor-pointer rounded-full border-2 px-3 py-1 text-sm font-semibold transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2"
      style={{
        backgroundColor: active ? bg : "transparent",
        color: active ? fg : "#6b7280",
        borderColor: bg,
      }}
    >
      {grade}
    </button>
  );
}

function PrerequisiteRow({
  title,
  checked,
  onToggle,
}: {
  title: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-main-300 bg-white px-4 py-3 shadow-sm">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-[#4169e1]"
        />
        <span className="text-sm font-medium text-gray-800">{title}</span>
      </label>
    </div>
  );
}

function ProfileContent({
  profile,
  onChange,
  activeSection,
  onSectionChange,
  onboarding = false,
  onSubmit,
  onLoginByEmail,
  hasUnsavedChanges = false,
  onSaveChanges,
}: ProfileContentProps) {
  const { schools, loading: schoolsLoading, error: schoolsError } = useSchools();
  const { courseTitles, loading: prereqLoading } = useSchoolPrereqCourses(
    profile.schoolId,
  );

  const schoolSelected = profile.schoolId !== null;

  const [mode, setMode] = useState<"create" | "login">("create");
  const [loginEmail, setLoginEmail] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLoginByEmailSubmit = async () => {
    if (!onLoginByEmail || loggingIn) return;
    setLoggingIn(true);
    setLoginError(null);
    const result = await onLoginByEmail(loginEmail);
    if (result.error) {
      setLoginError(result.error);
      setLoggingIn(false);
    }
  };

  const handleSelectSchool = (schoolId: string) => {
    if (schoolId === profile.schoolId) return;
    // Completed courses belong to the previous school's catalog, so reset them.
    onChange({ schoolId, completedCourses: {} });
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const canSubmit = isProfileComplete(profile);

  const handleSubmit = async () => {
    if (!onSubmit || !canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit();
    if (result.error) {
      setSubmitError(result.error);
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!onSaveChanges || !hasUnsavedChanges || saving) return;
    setSaving(true);
    setSaveError(null);
    const result = await onSaveChanges();
    setSaving(false);
    if (result.error) {
      setSaveError(result.error);
    } else {
      setJustSaved(true);
    }
  };

  // Clear the "Saved" confirmation as soon as new edits are made.
  useEffect(() => {
    if (hasUnsavedChanges) setJustSaved(false);
  }, [hasUnsavedChanges]);

  const activeRef = useRef(activeSection);
  activeRef.current = activeSection;

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-section");
          if (!id) continue;
          if (entry.isIntersecting) {
            visible.set(id, entry.boundingClientRect.top);
          } else {
            visible.delete(id);
          }
        }
        if (visible.size === 0) return;
        const topmost = [...visible.entries()].sort((a, b) => a[1] - b[1])[0][0];
        if (topmost !== activeRef.current) {
          onSectionChange(topmost as ProfileSection);
        }
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    const sections = root.querySelectorAll("[data-section]");
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [onSectionChange]);

  const setCourseCompleted = (title: string, completed: boolean) => {
    onChange({
      completedCourses: {
        ...profile.completedCourses,
        [title]: completed ? "prereq" : null,
      },
    });
  };

  const inputClass =
    "h-11 w-full rounded-xl border border-main-400 bg-white px-4 text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-main-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-500";

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-6 pb-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-12">
        <section
          id="section-profile"
          data-section="profile"
          className="scroll-mt-4"
        >
          <h2 className="mb-6 text-2xl font-bold text-gray-800">Profile</h2>

          <div className="flex flex-col gap-5">
            {onboarding && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-500">
                  {mode === "create"
                    ? "You are currently creating an account"
                    : "You are currently signing into your account"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode((m) => (m === "create" ? "login" : "create"));
                    setLoginError(null);
                    setLoginEmail("");
                  }}
                  className="h-11 shrink-0 cursor-pointer rounded-xl bg-[#4169e1] px-5 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:scale-[1.02] hover:bg-[#3557c7] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-700"
                >
                  {mode === "create" ? "Already Have An Account?" : "Create An Account"}
                </button>
              </div>
            )}

            {onboarding && mode === "login" ? (
              <div className="flex flex-col gap-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="mb-1.5 block text-sm font-semibold text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleLoginByEmailSubmit();
                    }}
                    placeholder="you@school.edu"
                    className={inputClass}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleLoginByEmailSubmit}
                    disabled={!loginEmail.trim() || loggingIn}
                    className={`h-11 w-full rounded-xl text-base font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-main-700 ${
                      loginEmail.trim() && !loggingIn
                        ? "cursor-pointer bg-[#4169e1] hover:bg-[#3557c7]"
                        : "cursor-not-allowed bg-gray-300"
                    }`}
                  >
                    {loggingIn ? "Logging In..." : "Log In"}
                  </button>
                  {loginError && (
                    <p className="text-sm font-medium text-red-600">{loginError}</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <RequiredFieldLabel>School</RequiredFieldLabel>
                  <SchoolPicker
                    schools={schools}
                    loading={schoolsLoading}
                    error={schoolsError}
                    selectedId={profile.schoolId}
                    onSelect={handleSelectSchool}
                  />
                  {!schoolSelected && (
                    <p className="mt-1.5 text-xs font-medium text-gray-400">
                      Select a school first to fill in the rest of your profile.
                    </p>
                  )}
                </div>

                <div
                  aria-hidden={!schoolSelected}
                  className={
                    schoolSelected
                      ? "flex flex-col gap-5"
                      : "pointer-events-none flex flex-col gap-5 opacity-50 select-none"
                  }
                >
                  <div>
                    <RequiredFieldLabel htmlFor="profile-name">Name</RequiredFieldLabel>
                    <input
                      id="profile-name"
                      type="text"
                      value={profile.name}
                      disabled={!schoolSelected}
                      onChange={(e) => onChange({ name: e.target.value })}
                      placeholder="Your name"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <RequiredFieldLabel htmlFor="profile-email">Email</RequiredFieldLabel>
                    <input
                      id="profile-email"
                      type="email"
                      value={profile.email}
                      disabled={!schoolSelected}
                      onChange={(e) => onChange({ email: e.target.value })}
                      placeholder="you@school.edu"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <RequiredFieldLabel className="mb-2">Grade</RequiredFieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {GRADES.map((grade) => (
                        <GradeChip
                          key={grade}
                          grade={grade}
                          active={profile.grade === grade}
                          onClick={() => onChange({ grade })}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="mb-3 block text-sm font-semibold text-gray-700">
                      Courses Taken
                    </span>
                    {prereqLoading ? (
                      <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-main-300 border-t-main-600" />
                        Loading courses...
                      </div>
                    ) : courseTitles.length === 0 ? (
                      <p className="py-3 text-sm text-gray-400">
                        No prerequisite or corequisite courses for this school.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {courseTitles.map((title) => (
                          <PrerequisiteRow
                            key={title}
                            title={title}
                            checked={profile.completedCourses[title] != null}
                            onToggle={(checked) => setCourseCompleted(title, checked)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {onboarding && (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSubmit || submitting}
                      className={`h-11 w-full rounded-xl text-base font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-main-700 ${
                        canSubmit && !submitting
                          ? "cursor-pointer bg-[#4169e1] hover:bg-[#3557c7]"
                          : "cursor-not-allowed bg-gray-300"
                      }`}
                    >
                      {submitting ? "Creating Account..." : "Create Account"}
                    </button>
                    {submitError && (
                      <p className="text-sm font-medium text-red-600">
                        {submitError}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {!onboarding && onSaveChanges && (hasUnsavedChanges || justSaved) && (
          <div className="sticky bottom-0 -mx-6 border-t border-main-300 bg-detail-400/95 px-6 py-4 backdrop-blur">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges || saving}
                  className={`h-11 rounded-xl px-6 text-base font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-main-700 ${
                    hasUnsavedChanges && !saving
                      ? "cursor-pointer bg-[#4169e1] hover:bg-[#3557c7]"
                      : "cursor-not-allowed bg-gray-300"
                  }`}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                {hasUnsavedChanges ? (
                  <span className="text-sm font-medium text-gray-500">
                    You have unsaved changes.
                  </span>
                ) : justSaved ? (
                  <span className="text-sm font-medium text-green-600">
                    Changes saved.
                  </span>
                ) : null}
              </div>
              {saveError && (
                <p className="text-sm font-medium text-red-600">{saveError}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileContent;
