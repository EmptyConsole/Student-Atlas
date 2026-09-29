import { segmentedOptionClass, segmentedTrackClass } from "./controlStyles";

export const LAYOUT_SWITCH_TRANSITION = {
  type: "spring" as const,
  stiffness: 380,
  damping: 30,
};

type CatalogLayoutToggleProps = {
  /** True when the compact multi-column layout is active. */
  compact: boolean;
  onToggle: () => void;
};

function CatalogLayoutToggle({ compact, onToggle }: CatalogLayoutToggleProps) {
  return (
    <div role="radiogroup" aria-label="Catalog layout" className={segmentedTrackClass}>
      <button
        type="button"
        role="radio"
        aria-checked={!compact}
        onClick={() => {
          if (compact) onToggle();
        }}
        className={segmentedOptionClass(!compact)}
      >
        Full
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={compact}
        onClick={() => {
          if (!compact) onToggle();
        }}
        className={segmentedOptionClass(compact)}
      >
        Compact
      </button>
    </div>
  );
}

export default CatalogLayoutToggle;
