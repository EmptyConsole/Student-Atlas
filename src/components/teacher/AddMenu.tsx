import { useEffect, useRef, useState } from "react";
import { BookOpen, Building2, ChevronDown, Plus, School } from "lucide-react";

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
        className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[#4169e1] px-4 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:scale-[1.02] hover:bg-[#3557c7] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-700"
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
          className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border border-main-300 bg-white py-1 shadow-lg"
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
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-main-100"
            >
              <Icon className="h-4 w-4 text-[#4169e1]" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AddMenu;
