import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { Subject } from "../data/subjects";

type ConnectorPoint = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type YearLongConnectorProps = {
  hoveredCourseId: string | null;
  fallRowRef: HTMLDivElement | null;
  springRowRef: HTMLDivElement | null;
  containerRef: HTMLDivElement | null;
  subject: Subject | null;
};

function YearLongConnector({
  hoveredCourseId,
  fallRowRef,
  springRowRef,
  containerRef,
  subject,
}: YearLongConnectorProps) {
  const [point, setPoint] = useState<ConnectorPoint | null>(null);

  useEffect(() => {
    if (!hoveredCourseId || !fallRowRef || !springRowRef || !containerRef) {
      setPoint(null);
      return;
    }

    const update = () => {
      const containerRect = containerRef.getBoundingClientRect();
      const fallRect = fallRowRef.getBoundingClientRect();
      const springRect = springRowRef.getBoundingClientRect();

      setPoint({
        x1: fallRect.right - containerRect.left,
        y1: fallRect.top + fallRect.height / 2 - containerRect.top,
        x2: springRect.left - containerRect.left,
        y2: springRect.top + springRect.height / 2 - containerRect.top,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [hoveredCourseId, fallRowRef, springRowRef, containerRef]);

  if (!point || !subject) return null;

  const midX = (point.x1 + point.x2) / 2;
  const path = `M ${point.x1} ${point.y1} C ${midX} ${point.y1}, ${midX} ${point.y2}, ${point.x2} ${point.y2}`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
      aria-hidden="true"
    >
      <motion.path
        d={path}
        fill="none"
        stroke={subject.accent}
        strokeWidth={2}
        strokeDasharray="6 4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.7 }}
        exit={{ pathLength: 0, opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
      <motion.circle
        cx={point.x1}
        cy={point.y1}
        r={4}
        fill={subject.accent}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
      />
      <motion.circle
        cx={point.x2}
        cy={point.y2}
        r={4}
        fill={subject.accent}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.1 }}
      />
    </svg>
  );
}

export default YearLongConnector;
