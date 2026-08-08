import type { ReactNode } from "react";
import { useResizableWidth } from "../hooks/useResizableWidth";

const SIDEBAR_WIDTH = {
  defaultWidth: 240,
  minWidth: 160,
  maxWidth: 420,
} as const;

type ResizableAsideProps = {
  storageKey: string;
  children: ReactNode;
  className?: string;
};

/**
 * Left sidebar shell with a draggable right edge to adjust width.
 * Width is persisted in localStorage under `storageKey`.
 */
function ResizableAside({
  storageKey,
  children,
  className = "",
}: ResizableAsideProps) {
  const { width, onResizePointerDown } = useResizableWidth(
    storageKey,
    SIDEBAR_WIDTH,
  );

  return (
    <aside
      style={{ width }}
      className={`relative flex h-full shrink-0 flex-col bg-main-100 ${className}`}
    >
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        title="Drag to resize sidebar"
        onPointerDown={onResizePointerDown}
        className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none select-none hover:bg-main-400/70 active:bg-main-500/80"
      />
    </aside>
  );
}

export default ResizableAside;
