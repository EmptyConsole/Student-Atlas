import { useEffect, useRef, useState } from "react";
import type { Subject } from "../data/subjects";

type Segment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type YearLongConnectorProps = {
  courseId: string;
  /** Ordered term-column ids this course spans (2 or more). */
  columnKeys: string[];
  containerEl: HTMLDivElement | null;
  subject: Subject;
  layoutKey: string;
};

function findRowEl(
  containerEl: HTMLDivElement,
  columnKey: string,
  courseId: string,
): HTMLElement | null {
  return containerEl.querySelector(
    `[data-ranking-column="${columnKey}"] [data-course-id="${courseId}"]`,
  );
}

/**
 * Draws dashed connectors between a spanning course's aligned rows across each
 * pair of adjacent term columns it belongs to.
 */
function YearLongConnector({
  courseId,
  columnKeys,
  containerEl,
  subject,
  layoutKey,
}: YearLongConnectorProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerEl || columnKeys.length < 2) {
      setSegments([]);
      return;
    }

    const measure = () => {
      const containerRect = containerEl.getBoundingClientRect();
      const next: Segment[] = [];

      for (let i = 0; i < columnKeys.length - 1; i += 1) {
        const leftRow = findRowEl(containerEl, columnKeys[i], courseId);
        const rightRow = findRowEl(containerEl, columnKeys[i + 1], courseId);
        if (!leftRow || !rightRow) continue;

        const leftRect = leftRow.getBoundingClientRect();
        const rightRect = rightRow.getBoundingClientRect();
        const y =
          (leftRect.top +
            leftRect.height / 2 +
            rightRect.top +
            rightRect.height / 2) /
            2 -
          containerRect.top;

        next.push({
          x1: leftRect.right - containerRect.left,
          y1: y,
          x2: rightRect.left - containerRect.left,
          y2: y,
        });
      }

      setSegments(next);
    };

    const loop = () => {
      measure();
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(containerEl);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [courseId, columnKeys, containerEl, layoutKey]);

  if (segments.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] overflow-visible"
      aria-hidden="true"
    >
      {segments.map((point, index) => (
        <g key={index}>
          <path
            d={`M ${point.x1} ${point.y1} L ${point.x2} ${point.y2}`}
            fill="none"
            stroke={subject.accent}
            strokeWidth={2}
            strokeDasharray="6 4"
            opacity={0.75}
          />
          <circle cx={point.x1} cy={point.y1} r={4} fill={subject.accent} />
          <circle cx={point.x2} cy={point.y2} r={4} fill={subject.accent} />
        </g>
      ))}
    </svg>
  );
}

export default YearLongConnector;
