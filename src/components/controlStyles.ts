/** Shared Tailwind class strings for controls and surfaces (roles from design/tokens.json). */

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-main-600 focus-visible:ring-offset-2";

/** control.filled.default — 40px pill for most actions. */
export const primaryButtonClass = `inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-pressed ${focusRing} disabled:cursor-not-allowed disabled:bg-gray-300`;

/** control.filled.prominent — 48px pill for the one main action on a screen. */
export const prominentButtonClass = `inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-white transition-colors duration-150 hover:bg-primary-pressed ${focusRing} disabled:cursor-not-allowed disabled:bg-gray-300`;

/** control.outline.default — 40px outline pill. */
export const secondaryButtonClass = `inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-medium text-primary transition-colors duration-150 hover:bg-main-100 ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`;

/** control.outline.prominent — 48px outline pill paired with a prominent action. */
export const secondaryProminentButtonClass = `inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-white px-6 text-base font-medium text-primary transition-colors duration-150 hover:bg-main-100 ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`;

export const dangerButtonClass = `inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300`;

export const dangerOutlineButtonClass = `inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60`;

/** control.text — low-emphasis action with no border. */
export const textButtonClass = `inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-main-100 hover:text-ink ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`;

/** control.icon.default — 40px round icon button. */
export const iconButtonClass = `inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-secondary transition-colors duration-150 hover:bg-main-100 hover:text-ink ${focusRing}`;

/** Small icon button inside a card or row, where the row is the main target. */
export const iconButtonCompactClass = `inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-black/5 ${focusRing}`;

/** Bordered toolbar control sized to sit beside the 44px search field. `active` marks an open panel or pressed toggle. */
export function toolbarButtonClass(active = false, iconOnly = false): string {
  return `inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors duration-150 ${focusRing} ${
    iconOnly ? "w-11" : "px-4"
  } ${
    active
      ? "border-main-500 bg-main-100 text-primary"
      : "border-line bg-white text-ink hover:bg-main-100"
  }`;
}

/** field.text */
export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink placeholder:text-ink-muted transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-main-300 disabled:cursor-not-allowed disabled:bg-surface-muted";

/** field.textarea */
export const textareaClass =
  "w-full resize-y rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-muted transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-main-300 disabled:cursor-not-allowed disabled:bg-surface-muted";

/** field.search — pair with a leading icon at left-3.5. */
export const searchInputClass =
  "h-11 w-full rounded-lg border border-line bg-white pr-4 pl-11 text-base text-ink shadow-raised placeholder:text-ink-muted transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-main-300";

export const labelClass = "mb-1.5 block text-sm font-medium text-ink";

/** control.chip — 36px pill. Colors come from the caller. */
export const chipClass = `inline-flex h-9 cursor-pointer items-center rounded-full border px-3 text-sm font-medium transition-colors duration-150 ${focusRing}`;

/** Department chip. Selected fill is main-500; the dot color is set inline. */
export function departmentChipClass(selected: boolean): string {
  return `${chipClass} gap-2 ${
    selected
      ? "border-main-500 bg-main-500 text-ink"
      : "border-line bg-transparent text-ink-muted hover:bg-main-100 hover:text-ink"
  }`;
}

/** navigation.segmented — 44px track for a two-option switch such as Full / Compact. */
export const segmentedTrackClass =
  "inline-flex h-11 shrink-0 items-center gap-0.5 rounded-xl bg-main-200 p-1";

export function segmentedOptionClass(selected: boolean): string {
  return `inline-flex h-9 cursor-pointer items-center justify-center rounded-lg px-6 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-600 focus-visible:ring-offset-2 ${
    selected ? "bg-white text-ink" : "text-ink-secondary hover:text-ink"
  }`;
}

/** surface.card */
export const cardClass = "rounded-2xl border border-line bg-white";

/** surface.dialog, used inside a fixed backdrop. */
export const dialogBackdropClass =
  "fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4";

export const dialogPanelClass =
  "w-full max-w-md rounded-2xl bg-white p-6 shadow-overlay";

/** surface.callout variants. */
export const infoCalloutClass =
  "rounded-xl border border-main-300 bg-main-100 px-4 py-3 text-sm leading-relaxed text-ink";

export const warningCalloutClass =
  "rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900";

/** primitive.type.page */
export const pageTitleClass = "text-[32px] leading-10 font-bold text-ink";

/** navigation.tab — underline tab. Render an indicator span when selected. */
export function tabClass(selected: boolean, disabled = false): string {
  if (disabled) {
    return "relative inline-flex h-full shrink-0 cursor-not-allowed items-center px-4 text-sm font-medium text-gray-400";
  }
  return `relative inline-flex h-full shrink-0 cursor-pointer items-center gap-2 px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-main-600 ${
    selected ? "text-primary" : "text-ink-secondary hover:text-ink"
  }`;
}

export const tabIndicatorClass =
  "pointer-events-none absolute inset-x-3 bottom-0 h-[3px] rounded-t-[3px] bg-primary";

export const spinnerClass =
  "inline-block h-8 w-8 animate-spin rounded-full border-4 border-main-300 border-t-primary";
