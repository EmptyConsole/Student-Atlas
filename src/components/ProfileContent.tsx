import { useEffect, useState, type ReactNode } from "react";
import { GRADE_COLORS } from "../data/courses";
import { isProfileComplete, type UserProfile } from "../hooks/useProfile";
import { useSchoolGrades } from "../hooks/useSchoolGrades";
import { useSchools } from "../hooks/useSchools";
import { useSchoolPrereqCourses } from "../hooks/useSchoolPrereqCourses";
import {
  sendEmailVerification,
  verifyEmailCode,
  type EmailVerificationPurpose,
} from "../lib/students";
import {
  cardClass,
  chipClass,
  inputClass,
  labelClass,
  pageTitleClass,
  primaryButtonClass,
  prominentButtonClass,
  secondaryButtonClass,
  secondaryProminentButtonClass,
} from "./controlStyles";
import SchoolPicker from "./SchoolPicker";

const RESEND_COOLDOWN_SEC = 45;

type ProfileContentProps = {
  profile: UserProfile;
  onChange: (patch: Partial<UserProfile>) => void;
  onboarding?: boolean;
  onSubmit?: () => Promise<{ error?: string }>;
  onLoginByEmail?: (email: string) => Promise<{ error?: string }>;
  hasUnsavedChanges?: boolean;
  onSaveChanges?: () => Promise<{ error?: string }>;
  /** Saved email from last successful save; used to detect email changes. */
  savedEmail?: string | null;
  /** Sign-out / delete controls, rendered below the profile form. */
  accountSection?: ReactNode;
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
  className = "mb-1.5",
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  const content = (
    <>
      {children}
      <span className="ml-0.5 text-red-600" aria-hidden="true">
        *
      </span>
    </>
  );
  const requiredLabelClass = `block text-sm font-medium text-ink ${className}`;

  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={requiredLabelClass}>
        {content}
      </label>
    );
  }

  return <span className={requiredLabelClass}>{content}</span>;
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
  const { bg, fg } = GRADE_COLORS[grade] ?? { bg: "#e5e7eb", fg: "#374151" };
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${chipClass} min-w-11 justify-center ${
        active
          ? "font-semibold"
          : "border-line bg-white font-medium text-ink-secondary hover:bg-main-100 hover:text-ink"
      }`}
      style={active ? { backgroundColor: bg, color: fg, borderColor: fg } : undefined}
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
    <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-white px-4 py-2.5 transition-colors hover:border-main-500">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
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
  onboarding = false,
  onSubmit,
  onLoginByEmail,
  hasUnsavedChanges = false,
  onSaveChanges,
  savedEmail = null,
  accountSection = null,
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

  const setCourseCompleted = (title: string, completed: boolean) => {
    onChange({
      completedCourses: {
        ...profile.completedCourses,
        [title]: completed ? "prereq" : null,
      },
    });
  };

  if (pendingVerification) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[672px] flex-col gap-6 px-4 pt-8 pb-12 sm:px-6">
          <div>
            <h1 className={pageTitleClass}>Verify Email</h1>
            <p className="mt-2 text-base text-ink-secondary">
              We sent a 6-digit code to{" "}
              <span className="font-semibold text-ink">
                {pendingVerification.email}
              </span>
              . Enter it below to continue.
            </p>
          </div>
          <div className={`${cardClass} flex flex-col gap-5 p-6`}>
          <div>
            <label htmlFor="email-otp" className={labelClass}>
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
              className={`${prominentButtonClass} w-full`}
            >
              {verifyingCode ? "Verifying..." : "Verify Email"}
            </button>
            <button
              type="button"
              onClick={() => void handleResendCode()}
              disabled={sendingCode || resendCooldown > 0}
              className={`${secondaryProminentButtonClass} w-full`}
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
              className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full text-base font-medium text-ink-secondary transition-colors duration-150 hover:bg-main-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-main-600 focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            {verifyError && (
              <p className="text-sm font-medium text-red-600">{verifyError}</p>
            )}
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[672px] flex-col gap-6 px-4 pt-8 pb-12 sm:px-6">
        <section aria-labelledby="profile-heading">
          <div className="mb-6">
            <h1 id="profile-heading" className={pageTitleClass}>
              Profile
            </h1>
            <p className="mt-2 text-base text-ink-secondary">Your account details</p>
          </div>

          <div className={`${cardClass} flex flex-col gap-5 p-6`}>
            {onboarding && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
                <span className="text-sm font-medium text-ink-secondary">
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
                  className={secondaryButtonClass}
                >
                  {mode === "create" ? "Already Have An Account?" : "Create An Account"}
                </button>
              </div>
            )}

            {onboarding && mode === "login" ? (
              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="login-email" className={labelClass}>
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
                    className={`${prominentButtonClass} w-full`}
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
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-main-300 border-t-primary" />
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
                    <span className="mb-2 block text-sm font-medium text-ink">
                      Courses Taken{" "}
                      <span className="font-normal text-ink-secondary">
                        (not required)
                      </span>
                    </span>
                    {prereqLoading ? (
                      <div className="flex items-center gap-2 py-3 text-sm text-ink-muted">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-main-300 border-t-primary" />
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

                {onboarding && (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={!canSubmit || submitting || sendingCode}
                      className={`${prominentButtonClass} w-full`}
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
          <div className="sticky bottom-0 -mx-4 border-t border-line bg-detail-400/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!hasUnsavedChanges || saving || sendingCode}
                  className={primaryButtonClass}
                >
                  {saving || sendingCode ? "Saving..." : "Save Changes"}
                </button>
                {hasUnsavedChanges ? (
                  <span className="text-sm font-medium text-ink-secondary">
                    You have unsaved changes.
                  </span>
                ) : justSaved ? (
                  <span className="text-sm font-medium text-green-700">
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

        {accountSection}
      </div>
    </div>
  );
}

export default ProfileContent;
