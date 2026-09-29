import { Maximize2, Minimize2 } from "lucide-react";

export const LAYOUT_SWITCH_TRANSITION = {
  type: "spring" as const,
  stiffness: 380,
  damping: 30,
};

type CatalogLayoutToggleProps = {
  /** True when the compact multi-column layout is active. */
  compact: boolean;
  onToggle: () => void;
  ariaLabelCompact?: string;
  ariaLabelFull?: string;
  titleCompact?: string;
  titleFull?: string;
};

function CatalogLayoutToggle({
  compact,
  onToggle,
  ariaLabelCompact = "Compact view — switch to full-width cards",
  ariaLabelFull = "Full-width cards — switch to compact view",
  titleCompact = "Compact view (click for full-width cards)",
  titleFull = "Full-width cards (click for compact view)",
}: CatalogLayoutToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!compact}
      aria-label={compact ? ariaLabelCompact : ariaLabelFull}
      title={compact ? titleCompact : titleFull}
      className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border shadow-raised transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${
        !compact
          ? "border-main-300 bg-white text-ink-secondary hover:bg-main-100"
          : "border-main-500 bg-main-100 text-ink hover:bg-main-200"
      }`}
    >
      {!compact ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </button>
  );
}

export default CatalogLayoutToggle;
