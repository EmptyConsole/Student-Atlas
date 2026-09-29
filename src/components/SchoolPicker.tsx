import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { School } from "../hooks/useSchools";

type SchoolPickerProps = {
  schools: School[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  placeholder?: string;
};

/** Searchable school dropdown shared by onboarding and the teacher gate. */
function SchoolPicker({
  schools,
  loading,
  error,
  selectedId,
  onSelect,
  placeholder = "Select your school",
}: SchoolPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = schools.find((s) => s.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) =>
      `${s.name} ${s.city} ${s.state}`.toLowerCase().includes(q),
    );
  }, [schools, search]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setSearch("");
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-main-300 ${
          open ? "border-primary" : "border-line"
        }`}
      >
        <span
          className={`truncate ${selected ? "text-ink" : "text-ink-muted"}`}
        >
          {selected
            ? `${selected.name}${selected.city ? ` — ${selected.city}, ${selected.state}` : ""}`
            : placeholder}
        </span>
        <ChevronDown
          className="h-5 w-5 shrink-0 text-ink-muted transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-line bg-white shadow-overlay">
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schools..."
              className="h-9 w-full rounded-lg border border-line bg-white pr-3 pl-9 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-main-300"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {loading ? (
              <li className="px-4 py-3 text-sm text-ink-muted">
                Loading schools...
              </li>
            ) : error ? (
              <li className="px-4 py-3 text-sm text-red-600">{error}</li>
            ) : filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-ink-muted">
                No schools found.
              </li>
            ) : (
              filtered.map((school) => {
                const isActive = school.id === selectedId;
                return (
                  <li key={school.id} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(school.id);
                        setOpen(false);
                      }}
                      className={`flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-main-100 ${
                        isActive
                          ? "bg-main-100 font-semibold text-ink"
                          : "text-ink"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{school.name}</span>
                        {school.city && (
                          <span className="block truncate text-xs font-normal text-ink-muted">
                            {school.city}, {school.state}
                          </span>
                        )}
                      </span>
                      {isActive && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SchoolPicker;
