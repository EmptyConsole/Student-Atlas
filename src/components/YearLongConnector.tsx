import { useEffect, useRef, useState } from "react";
import type { Subject } from "../data/subjects";

type ConnectorPoint = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type YearLongConnectorProps = {
  courseId: string;
  containerEl: HTMLDivElement | null;
  subject: Subject;
  layoutKey: string;
  isDragging: boolean;
};

function findRowEl(
  containerEl: HTMLDivElement,
  column: "fall" | "spring",
  courseId: string,
): HTMLElement | null {
  return containerEl.querySelector(
    `[data-ranking-column="${column}"] [data-course-id="${courseId}"]`,
  );
}

function YearLongConnector({
  courseId,
  containerEl,
  subject,
  layoutKey,
  isDragging,
}: YearLongConnectorProps) {
  const [point, setPoint] = useState<ConnectorPoint | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerEl) {
      setPoint(null);
      return;
    }

    const measure = () => {
      const fallRow = findRowEl(containerEl, "fall", courseId);
      const springRow = findRowEl(containerEl, "spring", courseId);
      if (!fallRow || !springRow) {
        setPoint(null);
        return;
      }

      const containerRect = containerEl.getBoundingClientRect();
      const fallRect = fallRow.getBoundingClientRect();
      const springRect = springRow.getBoundingClientRect();

      setPoint({
        x1: fallRect.right - containerRect.left,
        y1: fallRect.top + fallRect.height / 2 - containerRect.top,
        x2: springRect.left - containerRect.left,
        y2: springRect.top + springRect.height / 2 - containerRect.top,
      });
    };

    measure();

    // While dragging, rows carry live transforms that only a per-frame read can
    // track, so poll until the drag ends.
    if (isDragging) {
      const loop = () => {
        measure();
        frameRef.current = requestAnimationFrame(loop);
      };
      frameRef.current = requestAnimationFrame(loop);
      return () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      };
    }

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(containerEl);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [courseId, containerEl, layoutKey, isDragging]);

  if (!point) return null;

  // Connect the real row centers so the line stays attached to both rows even
  // mid-transition; once the linked rows settle on the same row it is flat.
  const path = `M ${point.x1} ${point.y1} L ${point.x2} ${point.y2}`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke={subject.accent}
        strokeWidth={2}
        strokeDasharray="6 4"
        opacity={0.7}
      />
      <circle cx={point.x1} cy={point.y1} r={4} fill={subject.accent} />
      <circle cx={point.x2} cy={point.y2} r={4} fill={subject.accent} />
    </svg>
  );
}

export default YearLongConnector;
