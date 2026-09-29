import type { ReactNode } from "react";
import { useResizableWidth } from "../hooks/useResizableWidth";

const PANEL_WIDTH = {
  defaultWidth: 300,
  minWidth: 240,
  maxWidth: 400,
} as const;

type ResizableAsideProps = {
  storageKey: string;
  children: ReactNode;
  /** Which edge of the window the panel sits on; the drag handle is on the opposite edge. */
  side?: "left" | "right";
  label?: string;
  className?: string;
  id?: string;
};

/**
 * Side panel shell with a draggable inner edge to adjust width.
 * Width is persisted in localStorage under `storageKey`.
 */
function ResizableAside({
  storageKey,
  children,
  side = "left",
  label,
  className = "",
  id,
}: ResizableAsideProps) {
  const { width, onResizePointerDown } = useResizableWidth(storageKey, {
    ...PANEL_WIDTH,
    direction: side === "right" ? -1 : 1,
  });

  return (
    <aside
      id={id}
      aria-label={label}
      style={{ width }}
      className={`relative flex h-full shrink-0 flex-col bg-white ${
        side === "right" ? "border-l" : "border-r"
      } border-line ${className}`}
    >
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        title="Drag to resize panel"
        onPointerDown={onResizePointerDown}
        className={`absolute inset-y-0 z-10 w-1.5 cursor-col-resize touch-none select-none hover:bg-main-400/70 active:bg-main-500/80 ${
          side === "right" ? "left-0" : "right-0"
        }`}
      />
    </aside>
  );
}

export default ResizableAside;
