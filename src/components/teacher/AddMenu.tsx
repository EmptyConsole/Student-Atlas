import { useEffect, useRef, useState } from "react";
import { BookOpen, Building2, ChevronDown, Plus, School } from "lucide-react";
import { primaryButtonClass } from "../controlStyles";

export type AddKind = "course" | "department" | "school";

type AddMenuProps = {
  onSelect: (kind: AddKind) => void;
};

const OPTIONS: { id: AddKind; label: string; icon: typeof BookOpen }[] = [
  { id: "course", label: "Course", icon: BookOpen },
  { id: "department", label: "Department", icon: Building2 },
  { id: "school", label: "School", icon: School },
];

function AddMenu({ onSelect }: AddMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={primaryButtonClass}
      >
        <Plus className="h-4 w-4" />
        Add
        <ChevronDown
          className="h-4 w-4 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-white py-1.5 shadow-overlay"
        >
          {OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect(id);
              }}
              className="flex h-10 w-full cursor-pointer items-center gap-3 px-4 text-left text-sm font-medium text-ink transition-colors hover:bg-main-100 focus:outline-none focus-visible:bg-main-100"
            >
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AddMenu;
