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
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-main-400 bg-white px-4 text-left shadow-sm focus:border-main-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-500"
      >
        <span
          className={`truncate ${selected ? "text-gray-700" : "text-gray-400"}`}
        >
          {selected
            ? `${selected.name}${selected.city ? ` — ${selected.city}, ${selected.state}` : ""}`
            : placeholder}
        </span>
        <ChevronDown
          className="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-main-300 bg-white shadow-lg">
          <div className="relative border-b border-main-200 p-2">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schools..."
              className="h-9 w-full rounded-lg border border-main-300 bg-white pr-3 pl-9 text-sm text-gray-700 placeholder:text-gray-400 focus:border-main-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-500"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {loading ? (
              <li className="px-4 py-3 text-sm text-gray-400">
                Loading schools...
              </li>
            ) : error ? (
              <li className="px-4 py-3 text-sm text-red-500">{error}</li>
            ) : filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-400">
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
                      className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-main-100 ${
                        isActive
                          ? "bg-main-100 font-semibold text-gray-800"
                          : "text-gray-700"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{school.name}</span>
                        {school.city && (
                          <span className="block truncate text-xs text-gray-400">
                            {school.city}, {school.state}
                          </span>
                        )}
                      </span>
                      {isActive && (
                        <Check className="h-4 w-4 shrink-0 text-[#4169e1]" />
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
