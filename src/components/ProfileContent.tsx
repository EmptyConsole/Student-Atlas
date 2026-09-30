import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { GRADE_COLORS } from "../data/courses";
import { isProfileComplete, type UserProfile } from "../hooks/useProfile";
import type { ScreenMode } from "../hooks/useTheme";
import { useSchoolGrades } from "../hooks/useSchoolGrades";
import { useSchools } from "../hooks/useSchools";
import { useSchoolPrereqCourses } from "../hooks/useSchoolPrereqCourses";
import {
  sendEmailVerification,
  verifyEmailCode,
  type EmailVerificationPurpose,
} from "../lib/students";
import type { ProfileSection } from "./ProfileSidebar";
import SchoolPicker from "./SchoolPicker";

const RESEND_COOLDOWN_SEC = 45;

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
  /** Saved email from last successful save; used to detect email changes. */
  savedEmail?: string | null;
};

type PendingVerification = {
  purpose: EmailVerificationPurpose;
  email: string;
  /** Continues create / login / save after a successful OTP check. */
  onVerified: () => Promise<{ error?: string }>;
};

function RequiredFieldLabel({
  children,
  htmlFor,
  className = "mb-2",
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
  const labelClass = `block text-sm font-medium leading-5 text-ink-secondary ${className}`;

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
  const { bg, fg } = GRADE_COLORS[grade] ?? {
    bg: "var(--chip-neutral-bg)",
    fg: "var(--chip-neutral-fg)",
  };
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="inline-flex h-9 cursor-pointer items-center rounded-full border-2 px-3 text-sm font-medium leading-5 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
      style={{
        backgroundColor: active ? bg : "transparent",
        color: active ? fg : "var(--color-ink-muted)",
        borderColor: bg,
      }}
    >
      {grade}
    </button>
  );
}

const SCREEN_MODE_OPTIONS: { id: ScreenMode; label: string; Icon: LucideIcon }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "default", label: "Default", Icon: Monitor },
];

function ScreenModeChip({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium leading-5 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${
        active
          ? "border-primary bg-main-200 text-primary"
          : "border-main-300 bg-surface text-ink-muted hover:bg-main-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-main-300 bg-surface px-4 py-3 shadow-sm">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-primary"
        />
        <span className="text-sm font-medium text-ink">{title}</span>
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
  savedEmail = null,
}: ProfileContentProps) {
  const { schools, loading: schoolsLoading, error: schoolsError } = useSchools();
  const { grades: schoolGrades, loading: gradesLoading } = useSchoolGrades(
    profile.schoolId,
  );
  const { courseTitles, loading: prereqLoading } = useSchoolPrereqCourses(
    profile.schoolId,
  );

  const schoolSelected = profile.schoolId !== null;

  const [mode, setMode] = useState<"create" | "login">("create");
  const [loginEmail, setLoginEmail] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [pendingVerification, setPendingVerification] =
    useState<PendingVerification | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const clearVerification = () => {
    setPendingVerification(null);
    setOtpCode("");
    setVerifyError(null);
    setResendCooldown(0);
    setSendingCode(false);
    setVerifyingCode(false);
  };

  const startVerification = async (
    purpose: EmailVerificationPurpose,
    email: string,
    onVerified: () => Promise<{ error?: string }>,
  ): Promise<{ error?: string }> => {
    setSendingCode(true);
    setVerifyError(null);
    const result = await sendEmailVerification(email, purpose);
    setSendingCode(false);
    if (result.error) return { error: result.error };

    setPendingVerification({ purpose, email, onVerified });
    setOtpCode("");
    setResendCooldown(RESEND_COOLDOWN_SEC);
    return {};
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerifyEmail = async () => {
    if (!pendingVerification || verifyingCode) return;
    setVerifyingCode(true);
    setVerifyError(null);

    const check = await verifyEmailCode(
      pendingVerification.email,
      pendingVerification.purpose,
      otpCode,
    );
    if (check.error) {
      setVerifyError(check.error);
      setVerifyingCode(false);
      return;
    }

    const result = await pendingVerification.onVerified();
    if (result.error) {
      setVerifyError(result.error);
      setVerifyingCode(false);
      return;
    }

    const wasEmailChange = pendingVerification.purpose === "email_change";
    clearVerification();
    setLoggingIn(false);
    setSubmitting(false);
    setSaving(false);
    if (wasEmailChange) setJustSaved(true);
  };

  const handleResendCode = async () => {
    if (!pendingVerification || sendingCode || resendCooldown > 0) return;
    setSendingCode(true);
    setVerifyError(null);
    const result = await sendEmailVerification(
      pendingVerification.email,
      pendingVerification.purpose,
    );
    setSendingCode(false);
    if (result.error) {
      setVerifyError(result.error);
      return;
    }
    setOtpCode("");
    setResendCooldown(RESEND_COOLDOWN_SEC);
  };

  const handleLoginByEmailSubmit = async () => {
    if (!onLoginByEmail || loggingIn) return;
    setLoggingIn(true);
    setLoginError(null);
    const email = loginEmail.trim();
    const result = await startVerification("login", email, () =>
      onLoginByEmail(email),
    );
    if (result.error) {
      setLoginError(result.error);
      setLoggingIn(false);
    }
  };

  const handleSelectSchool = (schoolId: string) => {
    if (schoolId === profile.schoolId) return;
    // Completed courses belong to the previous school's catalog, so reset them.
    onChange({ schoolId, completedCourses: {}, grade: null });
  };

  // Drop a saved grade that isn't configured for this school anymore.
  useEffect(() => {
    if (gradesLoading || profile.grade === null) return;
    if (!schoolGrades.includes(profile.grade)) {
      onChange({ grade: null });
    }
  }, [gradesLoading, profile.grade, schoolGrades, onChange]);
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
    const result = await startVerification("signup", profile.email.trim(), () =>
      onSubmit(),
    );
    if (result.error) {
      setSubmitError(result.error);
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!onSaveChanges || !hasUnsavedChanges || saving) return;
    setSaving(true);
    setSaveError(null);

    const nextEmail = profile.email.trim();
    const emailChanged =
      savedEmail != null &&
      nextEmail.toLowerCase() !== savedEmail.trim().toLowerCase();

    if (emailChanged) {
      const result = await startVerification("email_change", nextEmail, () =>
        onSaveChanges(),
      );
      if (result.error) {
        setSaveError(result.error);
        setSaving(false);
      }
      return;
    }

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
    "h-[46px] w-full rounded-xl border border-main-300 bg-surface py-2 pr-2 pl-3 text-base leading-6 text-ink-secondary placeholder:text-ink-muted focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary";

  if (pendingVerification) {
    return (
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-6 pb-10">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <h2 className="text-[28px] leading-9 font-semibold text-ink">Verify Email</h2>
          <p className="text-sm text-ink-secondary">
            We sent a 6-digit code to{" "}
            <span className="font-semibold text-ink">
              {pendingVerification.email}
            </span>
            . Enter it below to continue.
          </p>
          <div>
            <label
              htmlFor="email-otp"
              className="mb-2 block text-sm font-medium leading-5 text-ink-secondary"
            >
              Verification code
            </label>
            <input
              id="email-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpCode}
              onChange={(e) =>
                setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleVerifyEmail();
              }}
              placeholder="000000"
              className={`${inputClass} tracking-[0.35em]`}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void handleVerifyEmail()}
              disabled={otpCode.length !== 6 || verifyingCode}
              className={`inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium leading-5 text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${
                otpCode.length === 6 && !verifyingCode
                  ? "cursor-pointer bg-primary hover:bg-primary-pressed"
                  : "cursor-not-allowed bg-primary opacity-60"
              }`}
            >
              {verifyingCode ? "Verifying..." : "Verify Email"}
            </button>
            <button
              type="button"
              onClick={() => void handleResendCode()}
              disabled={sendingCode || resendCooldown > 0}
              className={`inline-flex h-10 w-full items-center justify-center rounded-[20px] text-base font-medium leading-6 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${
                !sendingCode && resendCooldown === 0
                  ? "cursor-pointer border border-main-300 bg-surface text-primary hover:bg-main-100"
                  : "cursor-not-allowed border border-line bg-surface-muted text-ink-muted"
              }`}
            >
              {sendingCode
                ? "Sending..."
                : resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                clearVerification();
                setLoggingIn(false);
                setSubmitting(false);
                setSaving(false);
              }}
              className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-lg px-3 text-base font-medium leading-6 text-ink-muted transition-colors duration-150 ease-out hover:text-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
            {verifyError && (
              <p className="text-sm font-medium text-red-600">{verifyError}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-6 pb-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-12">
        <section
          id="section-profile"
          data-section="profile"
          className="scroll-mt-4"
        >
          <h2 className="mb-6 text-[28px] leading-9 font-semibold text-ink">Profile</h2>

          <div className="flex flex-col gap-5">
            {onboarding && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-ink-muted">
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
                    clearVerification();
                  }}
                  className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary px-4 text-sm font-medium leading-5 text-white transition-colors duration-150 ease-out hover:bg-primary-pressed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
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
                    className="mb-2 block text-sm font-medium leading-5 text-ink-secondary"
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
                    onClick={() => void handleLoginByEmailSubmit()}
                    disabled={!loginEmail.trim() || loggingIn || sendingCode}
                    className={`inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium leading-5 text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${
                      loginEmail.trim() && !loggingIn && !sendingCode
                        ? "cursor-pointer bg-primary hover:bg-primary-pressed"
                        : "cursor-not-allowed bg-primary opacity-60"
                    }`}
                  >
                    {loggingIn || sendingCode ? "Sending code..." : "Log In"}
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
                    <p className="mt-1.5 text-xs font-medium text-ink-muted">
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
                    {gradesLoading ? (
                      <div className="flex items-center gap-2 py-1 text-sm text-ink-muted">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-main-300 border-t-main-600" />
                        Loading grades...
                      </div>
                    ) : schoolGrades.length === 0 ? (
                      <p className="text-sm text-ink-muted">
                        This school has no grades configured yet.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {schoolGrades.map((grade) => (
                          <GradeChip
                            key={grade}
                            grade={grade}
                            active={profile.grade === grade}
                            onClick={() => onChange({ grade })}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="mb-2 block text-sm font-medium leading-5 text-ink-secondary">
                      Courses Taken{" "}
                      <span className="font-normal text-ink-muted">
                        (not required)
                      </span>
                    </span>
                    {prereqLoading ? (
                      <div className="flex items-center gap-2 py-3 text-sm text-ink-muted">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-main-300 border-t-main-600" />
                        Loading courses...
                      </div>
                    ) : courseTitles.length === 0 ? (
                      <p className="py-3 text-sm text-ink-muted">
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

                {!onboarding && (
                  <div>
                    <span className="mb-2 block text-sm font-medium leading-5 text-ink-secondary">
                      Screen Mode
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SCREEN_MODE_OPTIONS.map(({ id, label, Icon }) => (
                        <ScreenModeChip
                          key={id}
                          label={label}
                          Icon={Icon}
                          active={profile.screenMode === id}
                          onClick={() => onChange({ screenMode: id })}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-ink-muted">
                      Default follows your device's light or dark setting. Applies
                      once you save.
                    </p>
                  </div>
                )}

                {onboarding && (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={!canSubmit || submitting || sendingCode}
                      className={`inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium leading-5 text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${
                        canSubmit && !submitting && !sendingCode
                          ? "cursor-pointer bg-primary hover:bg-primary-pressed"
                          : "cursor-not-allowed bg-primary opacity-60"
                      }`}
                    >
                      {submitting || sendingCode
                        ? "Sending code..."
                        : "Create Account"}
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
                  onClick={() => void handleSave()}
                  disabled={!hasUnsavedChanges || saving || sendingCode}
                  className={`inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-medium leading-6 text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${
                    hasUnsavedChanges && !saving && !sendingCode
                      ? "cursor-pointer bg-primary hover:bg-primary-pressed"
                      : "cursor-not-allowed bg-primary opacity-60"
                  }`}
                >
                  {saving || sendingCode ? "Saving..." : "Save Changes"}
                </button>
                {hasUnsavedChanges ? (
                  <span className="text-sm font-medium text-ink-muted">
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
