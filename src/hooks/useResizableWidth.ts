import { useCallback, useRef, useState } from "react";

type UseResizableWidthOptions = {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readStoredWidth(
  storageKey: string,
  options: UseResizableWidthOptions,
): number {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (Number.isFinite(parsed)) {
        return clamp(parsed, options.minWidth, options.maxWidth);
      }
    }
  } catch {
    /* ignore */
  }
  return options.defaultWidth;
}

/**
 * Drag-to-resize width with localStorage persistence.
 */
export function useResizableWidth(
  storageKey: string,
  options: UseResizableWidthOptions,
) {
  const [width, setWidth] = useState(() => readStoredWidth(storageKey, options));
  const widthRef = useRef(width);
  widthRef.current = width;

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      const startWidth = widthRef.current;

      const onMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        const next = clamp(
          startWidth + (moveEvent.clientX - startX),
          options.minWidth,
          options.maxWidth,
        );
        widthRef.current = next;
        setWidth(next);
      };

      const onUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== event.pointerId) return;
        handle.releasePointerCapture(event.pointerId);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
        try {
          localStorage.setItem(storageKey, String(widthRef.current));
        } catch {
          /* ignore */
        }
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    },
    [options.maxWidth, options.minWidth, storageKey],
  );

  return { width, onResizePointerDown };
}
