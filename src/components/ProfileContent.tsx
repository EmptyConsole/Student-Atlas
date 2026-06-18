import { useEffect, useRef, useState } from "react";
import { GRADE_COLORS, GRADES } from "../data/courses";
import { PREREQUISITE_COURSES } from "../data/prerequisiteCourses";
import { isProfileComplete, type UserProfile } from "../hooks/useProfile";
import type { ProfileSection } from "./ProfileSidebar";

type ProfileContentProps = {
  profile: UserProfile;
  onChange: (patch: Partial<UserProfile>) => void;
  activeSection: ProfileSection;
  onSectionChange: (id: ProfileSection) => void;
  onboarding?: boolean;
  onSubmit?: () => Promise<{ error?: string }>;
};

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
}: ProfileContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
            <div>
              <label
                htmlFor="profile-name"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={profile.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Your name"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="profile-email"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={profile.email}
                onChange={(e) => onChange({ email: e.target.value })}
                placeholder="you@school.edu"
                className={inputClass}
              />
            </div>

            <div>
              <span className="mb-2 block text-sm font-semibold text-gray-700">
                Grade
              </span>
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
              <div className="flex flex-col gap-2">
                {PREREQUISITE_COURSES.map((title) => (
                  <PrerequisiteRow
                    key={title}
                    title={title}
                    checked={profile.completedCourses[title] != null}
                    onToggle={(checked) => setCourseCompleted(title, checked)}
                  />
                ))}
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
                  {submitting ? "Logging In..." : "Log In"}
                </button>
                {submitError && (
                  <p className="text-sm font-medium text-red-600">
                    {submitError}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

export default ProfileContent;
