import { useEffect, useRef } from "react";
import type { TeacherSection } from "./TeacherSidebar";

type TeacherContentProps = {
  activeSection: TeacherSection;
  onSectionChange: (id: TeacherSection) => void;
};

const SECTIONS: { id: TeacherSection; label: string }[] = [
  { id: "course", label: "Course" },
  { id: "department", label: "Department" },
  { id: "school", label: "School" },
];

function TeacherContent({
  activeSection,
  onSectionChange,
}: TeacherContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
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
          onSectionChange(topmost as TeacherSection);
        }
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    const sections = root.querySelectorAll("[data-section]");
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [onSectionChange]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-6 pb-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-12">
        {SECTIONS.map(({ id, label }) => (
          <section
            key={id}
            id={`section-${id}`}
            data-section={id}
            className="scroll-mt-4"
          >
            <h2 className="mb-6 text-2xl font-bold text-gray-800">{label}</h2>
          </section>
        ))}
      </div>
    </div>
  );
}

export default TeacherContent;
